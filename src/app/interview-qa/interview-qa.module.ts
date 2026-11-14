import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InterviewQaRoutingModule } from './interview-qa-routing.module';
import { InterviewQaComponent } from './interview-qa.component';
import { AccordionComponent } from './accordion/accordion.component';
import { ScrollProgressComponent } from '../scroll-progress/scroll-progress.component';

/** Lazy-loaded feature module for the /interview-qa route. */
@NgModule({
  declarations: [InterviewQaComponent, AccordionComponent],
  imports: [CommonModule, InterviewQaRoutingModule, ScrollProgressComponent]
})
export class InterviewQaModule {}
