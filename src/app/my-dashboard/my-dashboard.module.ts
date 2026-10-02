import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MyDashboardComponent } from './my-dashboard.component';
import { KumarPfDataComponent } from '../kumar-pf-data/kumar-pf-data.component';
import { VasukiPfDataComponent } from '../vasuki-pf-data/vasuki-pf-data.component';
import { SumOfValueComponent } from '../sum-of-value/sum-of-value.component';

@NgModule({
  declarations: [MyDashboardComponent, KumarPfDataComponent, VasukiPfDataComponent, SumOfValueComponent],
  imports: [
    CommonModule,
    NgxChartsModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: MyDashboardComponent }])
  ]
})
export class MyDashboardModule {}
