import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardAccessGuard } from './service/dashboard-access.guard';

const routes: Routes = [
  {
    path: 'dashboard',
    canMatch: [DashboardAccessGuard],
    loadChildren: () =>
      import('./my-dashboard/my-dashboard.module').then(
        (module) => module.MyDashboardModule
      )
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
