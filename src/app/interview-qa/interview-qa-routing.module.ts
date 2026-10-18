import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InterviewQaComponent } from './interview-qa.component';

const routes: Routes = [
  { path: '', component: InterviewQaComponent, title: 'Interview Q&A' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterviewQaRoutingModule {}
