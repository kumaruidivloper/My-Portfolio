import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from  '@angular/common/http';
import { AccordionComponent } from './accordion/accordion.component';
import { QRCodeModule } from 'angularx-qrcode';
import { FormsModule } from '@angular/forms';
import { CounterComponent } from './counter/counter.component';
import { StopwatchComponent } from './stopwatch/stopwatch.component';
import { TimerComponent } from './timer/timer.component';
import { WorkHoursComponent } from './work-hours/work-hours.component';
import { AboutSkillsComponent } from './about-skills/about-skills.component';
import { WorkExperienceComponent } from './work-experience/work-experience.component';
import { PortfolioComponent } from './portfolio/portfolio.component';

@NgModule({ declarations: [
        AppComponent,
        AccordionComponent,
        CounterComponent,
        StopwatchComponent,
        TimerComponent,
        WorkHoursComponent,
        AboutSkillsComponent,
        WorkExperienceComponent,
        PortfolioComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        QRCodeModule,
        FormsModule], providers: [provideHttpClient(withXhr(), withInterceptorsFromDi())] })
export class AppModule { }