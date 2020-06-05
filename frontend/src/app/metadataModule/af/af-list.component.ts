import { Component, OnInit, ViewChild } from '@angular/core';
import { DataFormService } from '@geonature_common/form/data-form.service';
import { Router } from '@angular/router';
import { DatatableComponent } from '@swimlane/ngx-datatable';
import { CruvedStoreService } from '../../GN2CommonModule/service/cruved-store.service';

@Component({
  selector: 'pnx-af-list',
  templateUrl: './af-list.component.html'
})
export class AfListComponent implements OnInit {
  public acquisitionFrameworks = [];
  public temp = [];
  @ViewChild(DatatableComponent) table: DatatableComponent;

  constructor(
    private _dfs: DataFormService,
    private _router: Router,
    public cruvedStore: CruvedStoreService
  ) { }

  ngOnInit() {
    this._dfs.getAcquisitionFrameworks().subscribe(data => {
      this.acquisitionFrameworks = data;
      this.temp = data;
    });
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    // filter our data
    this.acquisitionFrameworks = this.temp.filter(function (d) {
      return d.acquisition_framework_name.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // Whenever the filter changes, always go back to the first page
    this.table.offset = 0;
  }
}
