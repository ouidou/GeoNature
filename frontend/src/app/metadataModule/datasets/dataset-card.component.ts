import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataFormService } from '@geonature_common/form/data-form.service';
import { ModuleService } from '@geonature/services/module.service';
import { BaseChartDirective } from 'ng2-charts';
import { AppConfig } from "@geonature_config/app.config";

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
  public geojsonData: any = null;

  @ViewChild(BaseChartDirective) chart: BaseChartDirective;

  // Type de graphe
  public pieChartType = 'doughnut';
  // Tableau contenant les labels du graphe
  public pieChartLabels = [];
  // Tableau contenant les données du graphe
  public pieChartData = [];
  // Tableau contenant les couleurs et la taille de bordure du graphe
  public pieChartColors = [
    {
      backgroundColor: ["rgb(0,80,240)", "rgb(80,160,240)", "rgb(160,200,240)"],
    }
  ];
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
    public moduleService: ModuleService
  ) { }

  ngOnInit() {
    // get the id from the route
    this._route.params.subscribe(params => {
      this.id_dataset = params['id'];
      if (this.id_dataset) {
        this.getDataset(this.id_dataset);
      }
    });
  }

  getDataset(id) {
    this._dfs.getDatasetDetails(id).subscribe(data => {
      this.dataset = data;
      if (this.dataset.modules) {
        this.dataset.modules = this.dataset.modules.map(e => e.module_code).join(", ");
      }
    });
    this._dfs.getDatasetTaxaDistribution(id).subscribe(data => {
      this.pieChartData.length = 0;
      this.pieChartLabels.length = 0;
      for (let row of data) {
        this.pieChartData.push(row["count"]);
        this.pieChartLabels.push(row["regne"]);
      }
      this.chart.chart.update();
    });

    this._dfs.getGeojsonData(id).subscribe(data => {
      this.geojsonData = data;
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
