import datetime
import logging
import json

from flask import current_app

# from xml.etree import ElementTree as ET

from lxml import etree as ET

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import func

from geonature.utils import utilsrequests
from geonature.utils.errors import GeonatureApiError

from geonature.utils.env import DB
from geonature.core.gn_meta.models import (
    TDatasets,
    CorDatasetActor,
    TAcquisitionFramework,
    CorAcquisitionFrameworkActor,
)
from geonature.core.gn_commons.models import TModules


namespace = current_app.config["XML_NAMESPACE"]
api_endpoint = current_app.config["MTD_API_ENDPOINT"]

NOMENCLATURE_MAPPING = {
    "id_nomenclature_data_type": "DATA_TYP",
    "id_nomenclature_dataset_objectif": "JDD_OBJECTIFS",
    "id_nomenclature_data_origin": "DS_PUBLIQUE",
    "id_nomenclature_source_status": "STATUT_SOURCE",
}

# get the root logger
log = logging.getLogger()
gunicorn_error_logger = logging.getLogger("gunicorn.error")

xml_parser = ET.XMLParser(ns_clean=True, recover=True, encoding="utf-8")


def get_acquisition_framework(uuid_af):
    """
        Fetch a AF from the MTD WS with the uuid of the AD

        Parameters:
            - uuid_af (str): the uuid of the AF
        Returns:
            byte: the xml of the AF as byte
    """
    url = "{}/cadre/export/xml/GetRecordById?id={}"
    try:
        r = utilsrequests.get(url.format(api_endpoint, uuid_af))
    except AssertionError:
        raise GeonatureApiError(
            message="Error with the MTD Web Service while getting Acquisition Framwork"
        )
    return r.content


def get_tag_content(parent, tag_name, default_value=None):
    """
    Return the content of a xml tag
    Check if the node exist or return a default value
    Params:
        parent (etree Element): the parent where find the tag
        tag_name (str): the name of the tag
        default_value (any): the default value f the tag doesn't exist
    Return
        any: the tag content or the default value
    """
    tag = parent.find(namespace + tag_name)
    if tag is not None:
        if tag.text and len(tag.text) > 0:
            return tag.text
    return default_value

    return tag.text if tag is not None else default_value


def parse_acquisition_framwork_xml(xml):
    """
        Parse an xml of AF from a string
        Return: 
            dict: a dict of the parsed xml 
    """
    root = ET.fromstring(xml, parser=xml_parser)
    ca = root.find(".//" + namespace + "CadreAcquisition")
    ca_uuid = get_tag_content(ca, "identifiantCadre")
    ca_name = get_tag_content(ca, "libelle")
    ca_desc = get_tag_content(ca, "description", default_value="")
    ca_start_date = get_tag_content(
        ca, "dateLancement", default_value=datetime.datetime.now()
    )
    ca_end_date = get_tag_content(ca, "dateCloture")

    return {
        "unique_acquisition_framework_id": ca_uuid,
        "acquisition_framework_name": ca_name,
        "acquisition_framework_desc": ca_desc,
        "acquisition_framework_start_date": ca_start_date,
        "acquisition_framework_end_date": ca_end_date,
    }


def get_jdd_by_user_id(id_user):
    """ fetch the jdd(s) created by a user from the MTD web service
        Parameters:
            - id (int):  id_user from CAS
        Return:
            byte: a XML as byte 
    """
    url = "{}/cadre/jdd/export/xml/GetRecordsByUserId?id={}"
    try:
        r = utilsrequests.get(url.format(api_endpoint, str(id_user)))
        assert r.status_code == 200
    except AssertionError:
        raise GeonatureApiError(
            message="Error with the MTD Web Service (JDD), status_code: {}".format(
                r.status_code
            )
        )
    return r.content


def parse_jdd_xml(xml):
    """
        Parse an xml of datasets from a string
        Return: 
            list: a list of dict of the JDD in the xml
    """

    root = ET.fromstring(xml, parser=xml_parser)
    jdd_list = []
    for jdd in root.findall(".//" + namespace + "JeuDeDonnees"):
        jdd_uuid = get_tag_content(jdd, "identifiantJdd")
        ca_uuid = get_tag_content(jdd, "identifiantCadre")

        dataset_name = get_tag_content(jdd, "libelle")
        dataset_shortname = get_tag_content(jdd, "libelleCourt")
        dataset_desc = get_tag_content(jdd, "description", default_value="")
        terrestrial_domain = get_tag_content(jdd, "domaineTerrestre")
        marine_domain = get_tag_content(jdd, "domaineMarin")
        data_type = get_tag_content(jdd, "typeDonnees")

        current_jdd = {
            "unique_dataset_id": jdd_uuid,
            "uuid_acquisition_framework": ca_uuid,
            "dataset_name": dataset_name,
            "dataset_shortname": dataset_shortname,
            "dataset_desc": dataset_desc,
            "terrestrial_domain": json.loads(terrestrial_domain),
            "marine_domain": json.loads(marine_domain),
            "id_nomenclature_data_type": data_type,
        }

        jdd_list.append(current_jdd)
    return jdd_list


def post_acquisition_framework(uuid=None, id_user=None, id_organism=None):
    """ 
        Post an acquisition framwork from MTD XML
        Params:
            uuid (str): uuid of the acquisition framework
            id_user (int): the id of the user connected via CAS
            id_organism (int): the id of the organism user via CAS
    
    """
    xml_af = None
    xml_af = get_acquisition_framework(uuid)

    if xml_af:
        acquisition_framwork = parse_acquisition_framwork_xml(xml_af)
        new_af = TAcquisitionFramework(**acquisition_framwork)
        id_acquisition_framework = TAcquisitionFramework.get_id(uuid)
        # if the CA already exist in the DB
        if id_acquisition_framework:
            # check if actor role not already exist for this CA
            actor_role = CorAcquisitionFrameworkActor.get_actor(
                id_acquisition_framework=id_acquisition_framework,
                id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                    "ROLE_ACTEUR", "1"
                ),
                id_role=id_user,
            )

            # if no actor push it
            if actor_role is None:
                actor = CorAcquisitionFrameworkActor(
                    id_role=id_user,
                    id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                        "ROLE_ACTEUR", "1"
                    ),
                )
                new_af.cor_af_actor.append(actor)

            # # check if actor organism not already exist for this CA
            actor_organism = None
            if id_organism:
                actor_organism = CorAcquisitionFrameworkActor.get_actor(
                    id_acquisition_framework=id_acquisition_framework,
                    id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                        "ROLE_ACTEUR", "1"
                    ),
                    id_organism=id_organism,
                )
                if actor_organism is None:
                    organism = CorAcquisitionFrameworkActor(
                        id_organism=id_organism,
                        id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                            "ROLE_ACTEUR", "1"
                        ),
                    )
                    new_af.cor_af_actor.append(organism)

            # finnaly merge the CA
            new_af.id_acquisition_framework = id_acquisition_framework
            DB.session.merge(new_af)

        # its a new AF
        else:
            actor = CorAcquisitionFrameworkActor(
                id_role=id_user,
                id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                    "ROLE_ACTEUR", "1"
                ),
            )
            new_af.cor_af_actor.append(actor)
            if id_organism:
                organism = CorAcquisitionFrameworkActor(
                    id_organism=id_organism,
                    id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                        "ROLE_ACTEUR", "1"
                    ),
                )
                new_af.cor_af_actor.append(organism)

            # Add the new CA
            DB.session.add(new_af)
        # try to commit
        try:
            DB.session.commit()
        # TODO catch db error ?
        except SQLAlchemyError as e:
            DB.session.flush()
            DB.session.rollback()
            error_msg = """
                Error posting an aquisition framework {} \n\n Trace: \n {}
                """.format(
                uuid, e
            )
            log.error(error_msg)

        return new_af.as_dict()

    return {"message": "Not found"}, 404


def add_dataset_module(dataset_obj):
    if not dataset_obj.modules:
        dataset_obj.modules.extend(
            DB.session.query(TModules)
            .filter(
                TModules.module_code.in_(
                    current_app.config["CAS"]["JDD_MODULE_CODE_ASSOCIATION"]
                )
            )
            .all()
        )


def post_jdd_from_user(id_user=None, id_organism=None):
    """ Post a jdd from the mtd XML"""
    xml_jdd = None
    xml_jdd = get_jdd_by_user_id(id_user)
    dataset_list_model = []
    if xml_jdd:
        dataset_list = parse_jdd_xml(xml_jdd)
        posted_af_uuid = {}
        for ds in dataset_list:
            # prevent to not fetch, post or merge the same acquisition framework multiple times
            if ds["uuid_acquisition_framework"] not in posted_af_uuid:
                new_af = post_acquisition_framework(
                    uuid=ds["uuid_acquisition_framework"],
                    id_user=id_user,
                    id_organism=id_organism,
                )
                # build a cached dict like {'<uuid>': 'id_acquisition_framework}
                posted_af_uuid[ds["uuid_acquisition_framework"]] = new_af[
                    "id_acquisition_framework"
                ]
            # get the id from the uuid
            ds["id_acquisition_framework"] = posted_af_uuid.get(
                ds["uuid_acquisition_framework"]
            )

            ds.pop("uuid_acquisition_framework")
            # get the id of the dataset to check if exists
            id_dataset = TDatasets.get_id(ds["unique_dataset_id"])
            ds["id_dataset"] = id_dataset
            # search nomenclature
            for key, value in ds.items():
                if key.startswith("id_nomenclature"):
                    ds[key] = func.ref_nomenclatures.get_id_nomenclature(
                        NOMENCLATURE_MAPPING.get(key), value
                    )
            #  set validable = true
            ds["validable"] = True
            dataset = TDatasets(**ds)
            # if the dataset already exist
            if id_dataset:
                # check if actor exist:
                actor_role = CorDatasetActor.get_actor(
                    id_dataset=id_dataset,
                    id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                        "ROLE_ACTEUR", "1"
                    ),
                    id_role=id_user,
                )

                if actor_role is None:
                    actor = CorDatasetActor(
                        id_role=id_user,
                        id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                            "ROLE_ACTEUR", "1"
                        ),
                    )
                    dataset.cor_dataset_actor.append(actor)

                organism_role = None
                if id_organism:
                    organism_role = CorDatasetActor.get_actor(
                        id_dataset=id_dataset,
                        id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                            "ROLE_ACTEUR", "1"
                        ),
                        id_organism=id_organism,
                    )
                    if organism_role is None:
                        actor = CorDatasetActor(
                            id_organism=id_organism,
                            id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                                "ROLE_ACTEUR", "1"
                            ),
                        )
                        dataset.cor_dataset_actor.append(actor)
                add_dataset_module(dataset)
                # finnaly merge
                DB.session.merge(dataset)
            # if not dataset already in database
            else:
                actor = CorDatasetActor(
                    id_role=id_user,
                    id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                        "ROLE_ACTEUR", "1"
                    ),
                )
                dataset.cor_dataset_actor.append(actor)
                # id_organism in cor_dataset_actor
                if id_organism:
                    actor = CorDatasetActor(
                        id_organism=id_organism,
                        id_nomenclature_actor_role=func.ref_nomenclatures.get_id_nomenclature(
                            "ROLE_ACTEUR", "1"
                        ),
                    )
                    dataset.cor_dataset_actor.append(actor)
                add_dataset_module(dataset)
                DB.session.add(dataset)

        try:
            DB.session.commit()
            DB.session.flush()
            dataset_list_model.append(dataset)
        except SQLAlchemyError as e:
            DB.session.rollback()
            error_msg = """
            Error posting JDD {} \n\n Trace: \n {}
            """.format(
                ds["unique_dataset_id"], e
            )
            log.error(error_msg)
            raise GeonatureApiError(error_msg)

        return [d.as_dict() for d in dataset_list_model]
    return {"message": "Not found"}, 404

