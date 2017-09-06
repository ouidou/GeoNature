<?php

/**
 * BaseCorRoleFicheInv
 * 
 * This class has been auto-generated by the Doctrine ORM Framework
 * 
 * @property integer $id_role
 * @property integer $id_inv
 * @property TRoles $TRoles
 * @property TFichesInv $TFichesInv
 * 
 * @method integer         get()           Returns the current record's "id_role" value
 * @method integer         get()           Returns the current record's "id_inv" value
 * @method TRoles          get()           Returns the current record's "TRoles" value
 * @method TFichesInv      get()           Returns the current record's "TFichesInv" value
 * @method CorRoleFicheInv set()           Sets the current record's "id_role" value
 * @method CorRoleFicheInv set()           Sets the current record's "id_inv" value
 * @method CorRoleFicheInv set()           Sets the current record's "TRoles" value
 * @method CorRoleFicheInv set()           Sets the current record's "TFichesInv" value
 * 
 * @package    geonature
 * @subpackage model
 * @author     Gil Deluermoz
 * @version    SVN: $Id: Builder.php 7490 2010-03-29 19:53:27Z jwage $
 */
abstract class BaseCorRoleFicheInv extends sfDoctrineRecord
{
    public function setTableDefinition()
    {
        $this->setTableName('contactinv.cor_role_fiche_inv');
        $this->hasColumn('id_role', 'integer', 4, array(
             'type' => 'integer',
             'primary' => true,
             'length' => 4,
             ));
        $this->hasColumn('id_inv', 'integer', 5, array(
             'type' => 'integer',
             'notnull' => true,
             'length' => 5,
             ));
    }

    public function setUp()
    {
        parent::setUp();
        $this->hasOne('TRoles', array(
             'local' => 'id_role',
             'foreign' => 'id_role'));

        $this->hasOne('TFichesInv', array(
             'local' => 'id_inv',
             'foreign' => 'id_inv'));
    }
}