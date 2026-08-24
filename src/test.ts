// This file is required by karma.conf.js and loads all specs.

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

import './app/app.component.spec';
import './app/accordion/accordion.component.spec';
import './app/counter/counter.component.spec';
import './app/service/data.service.spec';
import './app/service/time.service.spec';
import './app/service/total-work-hours.service.spec';
import './app/stopwatch/stopwatch.component.spec';
import './app/timer/timer.component.spec';
import './app/work-hours/work-hours.component.spec';
