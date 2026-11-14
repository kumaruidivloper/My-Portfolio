import { FormStepperComponent } from '../form-stepper/form-stepper.component';
import { ThemeDatePickerComponent } from '../theme-date-picker/theme-date-picker.component';
import { ThemeSelectComponent } from '../theme-select/theme-select.component';
import { TotalBalanceComponent } from '../total-balance/total-balance.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MyDashboardComponent } from './my-dashboard.component';
import { PfDataComponent } from '../pf-data/pf-data.component';
import { SumOfValueComponent } from '../sum-of-value/sum-of-value.component';
import { KumarGratuityComponent } from '../kumar-gratuity/kumar-gratuity.component';
import { VasukiGratuityComponent } from '../vasuki-gratuity/vasuki-gratuity.component';
import { VasukiSuperComponent } from '../vasuki-super/vasuki-super.component';
import { ResponsiveTableComponent } from '../responsive-table/responsive-table.component';
import { WidgetPreviewChartComponent } from '../widget-preview-chart/widget-preview-chart.component';
import { DashboardLoaderComponent } from '../dashboard-loader/dashboard-loader.component';
import { RenderInViewDirective } from '../render-in-view/render-in-view.directive';
import { SalaryDataComponent } from '../salary-data/salary-data.component';
import { CentralRecordFormComponent } from '../central-record-form/central-record-form.component';
import { ScrollProgressComponent } from '../scroll-progress/scroll-progress.component';

@NgModule({
  declarations: [
    MyDashboardComponent,
    PfDataComponent,
    SumOfValueComponent,
    TotalBalanceComponent,
    ThemeSelectComponent,
    ThemeDatePickerComponent,
    FormStepperComponent,
    KumarGratuityComponent,
    VasukiGratuityComponent,
    VasukiSuperComponent,
    ResponsiveTableComponent,
    WidgetPreviewChartComponent,
    DashboardLoaderComponent,
    RenderInViewDirective,
    SalaryDataComponent,
    CentralRecordFormComponent
  ],
  imports: [
    CommonModule,
    OverlayModule,
    A11yModule,
    ScrollingModule,
    NgxChartsModule,
    ReactiveFormsModule,
    ScrollProgressComponent,
    RouterModule.forChild([{ path: '', component: MyDashboardComponent }])
  ]
})
export class MyDashboardModule {}
