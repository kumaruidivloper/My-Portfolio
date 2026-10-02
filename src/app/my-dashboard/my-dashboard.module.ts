import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MyDashboardComponent } from './my-dashboard.component';

@NgModule({
  declarations: [MyDashboardComponent],
  imports: [
    CommonModule,
    NgxChartsModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: MyDashboardComponent }])
  ]
})
export class MyDashboardModule {}
