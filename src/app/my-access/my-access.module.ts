import { NgModule } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DashboardLoaderComponent } from '../dashboard-loader/dashboard-loader.component';
import { ScrollProgressComponent } from '../scroll-progress/scroll-progress.component';
import { MyAccessComponent } from './my-access.component';

@NgModule({
  declarations: [MyAccessComponent],
  imports: [A11yModule, DashboardLoaderComponent, ReactiveFormsModule, ScrollProgressComponent, RouterModule.forChild([{ path: '', component: MyAccessComponent }])]
})
export class MyAccessModule {}
