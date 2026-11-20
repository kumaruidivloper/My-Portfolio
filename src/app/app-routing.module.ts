import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardAccessGuard } from './service/dashboard-access.guard';
import { ApiKeyGuard } from './service/api-key.guard';

const routes: Routes = [
  {
    path: 'dashboard',
    canMatch: [DashboardAccessGuard, ApiKeyGuard],
    loadChildren: () =>
      import('./my-dashboard/my-dashboard.module').then(
        (module) => module.MyDashboardModule
      )
  },
  {
    path: 'my-access',
    canMatch: [DashboardAccessGuard, ApiKeyGuard],
    loadChildren: () =>
      import('./my-access/my-access.module').then(
        (module) => module.MyAccessModule
      )
  },
  {
    path: 'interview-qa',
    loadChildren: () =>
      import('./interview-qa/interview-qa.module').then(
        (module) => module.InterviewQaModule
      )
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
