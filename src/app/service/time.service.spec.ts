/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { TimeService } from './time.service';

describe('TimeService', () => {
  let service: TimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeService);
  });

  it('identifies weekday working hours', () => {
    const state = service.getState(new Date(2026, 7, 24, 10, 0));

    expect(state.isWeekend).toBeFalse();
    expect(state.isWorkingHours).toBeTrue();
  });

  it('identifies evenings and weekends as off-hours', () => {
    expect(service.getState(new Date(2026, 7, 24, 18, 0)).isWorkingHours).toBeFalse();
    expect(service.getState(new Date(2026, 7, 29, 10, 0)).isWorkingHours).toBeFalse();
  });

  it('identifies daytime independently of work hours', () => {
    expect(service.getState(new Date(2026, 7, 24, 7, 0)).isDaytime).toBeTrue();
    expect(service.getState(new Date(2026, 7, 24, 19, 0)).isDaytime).toBeFalse();
  });
});
