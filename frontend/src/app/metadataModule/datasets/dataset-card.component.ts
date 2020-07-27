import { Component, OnInit, ViewChild, AfterContentInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataFormService } from '@geonature_common/form/data-form.service';
import { ModuleService } from '@geonature/services/module.service';
import { BaseChartDirective } from 'ng2-charts';
import { AppConfig } from "@geonature_config/app.config";
import { DataService } from "../../../../../external_modules/import/frontend/app/services/data.service";
import { CommonService } from "@geonature_common/service/common.service";

@Component({
  selector: 'pnx-datasets-card',
  templateUrl: './dataset-card.component.html',
  styleUrls: ['./dataset-card.scss'],
})

export class DatasetCardComponent implements OnInit {
  public organisms: Array<any>;
  public id_dataset: number;
  public dataset: any;
  public nbTaxons: number;
  public nbObservations: number;
<<<<<<< HEAD
  public history;
  public empty: boolean = false;
=======
  public geojsonData: any = null;
>>>>>>> feature/GINCO2-47-53

  @ViewChild(BaseChartDirective) public chart: BaseChartDirective;

  // Type de graphe
  public pieChartType = 'doughnut';
  // Tableau contenant les labels du graphe
  public pieChartLabels = [];
  // Tableau contenant les données du graphe
  public pieChartData = [];
  // Tableau contenant les couleurs et la taille de bordure du graphe
  public pieChartColors = [];
  // Dictionnaire contenant les options à implémenter sur le graphe (calcul des pourcentages notamment)
  public pieChartOptions = {
    cutoutPercentage: 80,
    legend: {
      display: 'true',
      position: 'left',
      labels: {
        fontSize: 15,
        filter: function (legendItem, chartData) {
          return chartData.datasets[0].data[legendItem.index] != 0;
        }
      },
    },
    plugins: {
      labels: [
        {
          render: 'label',
          arc: true,
          fontSize: 14,
          position: 'outside',
          overlap: false
        },
        {
          render: 'percentage',
          fontColor: 'white',
          fontSize: 14,
          fontStyle: 'bold',
          precision: 2,
          textShadow: true,
          overlap: false
        }
      ]
    }
  }

  public spinner = true;

  constructor(
    private _route: ActivatedRoute,
    private _dfs: DataFormService,
    public moduleService: ModuleService,
    private _commonService: CommonService,
    private _ds : DataService,
  ) { }

  ngOnInit() {
    // get the id from the route
    this._route.params.subscribe(params => {
      this.id_dataset = params['id'];
      if (this.id_dataset) {
        this.getDataset(this.id_dataset);
      }
    });

      this.ImportList();
    
  }

   ImportList() {
    this._ds.getListDatasets().subscribe(
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
  

  getDataset(id) {

    this._dfs.getDatasetDetails(id).subscribe(data => {
      this.dataset = data;
      if (this.dataset.modules) {
        this.dataset.modules = this.dataset.modules.map(e => e.module_code).join(", ");
      }
      if ('bbox' in data) {
        this.geojsonData = data['bbox']
      }
    });
    this._dfs.getTaxaDistribution('group2_inpn', { 'id_dataset': id }).subscribe(data => {

      this.pieChartData = []
      this.pieChartLabels = []
      for (let row of data) {
        this.pieChartData.push(row["count"]);
        this.pieChartLabels.push(row["group"]);
      }
      // in order to have chart instance
      setTimeout(() => {
        this.chart.chart.update();

      }, 1000)
    });

  }

  getPdf() {

    const url = `${AppConfig.API_ENDPOINT}/meta/dataset/export_pdf/${this.id_dataset}`;
    const dataUrl = this.chart ? this.chart.ctx.canvas.toDataURL("image/png") : "";
    this._dfs.uploadCanvas(dataUrl).subscribe(
      data => {
        window.open(url);
      }
    );

  }

}
