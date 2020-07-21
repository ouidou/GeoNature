import { Component, OnInit, ViewChild } from '@angular/core';
import { PageEvent, MatPaginator, MatPaginatorIntl } from '@angular/material';
import { CruvedStoreService } from '../GN2CommonModule/service/cruved-store.service';
import { DataFormService } from '@geonature_common/form/data-form.service';

import { DataService } from "../../../../external_modules/import/frontend/app/services/data.service";
import { CommonService } from "@geonature_common/service/common.service";

export class MetadataPaginator extends MatPaginatorIntl {
  constructor() {
    super();
    this.nextPageLabel = 'Page suivante';
    this.previousPageLabel = 'Page précédente';
    this.itemsPerPageLabel = 'Éléments par page';
    this.getRangeLabel = (page: number, pageSize: number, length: number) => {
      if (length == 0 || pageSize == 0) {
        return `0 sur ${length}`;
      }
      length = Math.max(length, 0);
      const startIndex = page * pageSize;
      const endIndex =
        startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
      return `${startIndex + 1} - ${endIndex} sur ${length}`;
    };
  }
}

@Component({
  selector: 'pnx-metadata',
  templateUrl: './metadata.component.html',
  styleUrls: ['./metadata.component.scss'],
  providers: [
    {
      provide:MatPaginatorIntl,
      useClass: MetadataPaginator
    }

  ]
})
export class MetadataComponent /* extends ImportComponent */ implements OnInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;

  datasets = [];
  acquisitionFrameworks = [];
  tempAF = [];
  public history;
  public empty: boolean = false;
  expandAccordions = false;
  private researchTerm: string = '';

  pageSize: number = 10;
  activePage: number = 0;
  pageSizeOptions: Array<number> = [10, 25, 50, 100];


  constructor(public _cruvedStore: CruvedStoreService, private _dfs: DataFormService,public _ds: DataService,private _commonService: CommonService) { 
  
  }

  ngOnInit() {
    this.getAcquisitionFrameworksAndDatasets();
    this.getImportList();
  }

  //recuperation cadres d'acquisition
  getAcquisitionFrameworksAndDatasets() {
    this._dfs.getAfAndDatasetListMetadata().subscribe(data => {
      this.acquisitionFrameworks = data.data;
      this.tempAF = this.acquisitionFrameworks;
      //this.getDatasets();
      this.acquisitionFrameworks.forEach(af => {
        af['datasetsTemp'] = af['datasets'];
      })

    });
  }

  // recuperer la liste des imports 

  getImportList(){
    this._ds.getImportList().subscribe(
      res => {
        this.history = res.history;
        this.empty = res.empty;
      },
      error => {
        if (error.statusText === "Unknown Error") {
          // show error message if no connexion
          this._commonService.regularToaster(
            "error",
            "ERROR: IMPOSSIBLE TO CONNECT TO SERVER (check your connexion)"
          );
        } else {
          // show error message if other server error
          this._commonService.regularToaster("error", error.error.message);
        }
      }
    );
  }
  

  /**
   *	Filtre les éléments CA et JDD selon la valeur de la barre de recherche
   **/
  updateSearchbar(event) {
    this.researchTerm = event.target.value.toLowerCase();

    //recherche des cadres d'acquisition qui matchent
    this.tempAF = this.acquisitionFrameworks.filter(af => {
      //si vide => affiche tout et ferme le panel
      if (this.researchTerm === '') {
        // 'dé-expand' les accodions pour prendre moins de place
        this.expandAccordions = false;
        //af.datasets.filter(ds=>true);
        af.datasetsTemp = af.datasets;
        return true;
      } else {
        // expand tout les accordion recherchés pour voir le JDD des CA
        this.expandAccordions = true;
        if (af.acquisition_framework_name.toLowerCase().indexOf(this.researchTerm) !== -1) {
          //si un cadre matche on affiche tout ses JDD
          af.datasetsTemp = af.datasets;
          return true;
        }

        //Sinon on on filtre les JDD qui matchent eventuellement.
        if (af.datasets) {
          af.datasetsTemp = af.datasets.filter(
            ds => ds.dataset_name.toLowerCase().indexOf(this.researchTerm) !== -1
          );
          return af.datasetsTemp.length;
        }
        return false;
      }
    });
    //retour à la premiere page du tableau pour voir les résultats
    this.paginator.pageIndex = 0;
    this.activePage = 0;
  }

  isDisplayed(idx: number) {
    //numero du CA à partir de 1
    let element = idx + 1;
    //calcule des tranches active à afficher
    let idxMin = this.pageSize * this.activePage;
    let idxMax = this.pageSize * (this.activePage + 1);

    return idxMin < element && element <= idxMax;
  }

  changePaginator(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.activePage = event.pageIndex;
  } 
  
}
