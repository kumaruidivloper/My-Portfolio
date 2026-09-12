/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { TimeService } from '../service/time.service';
import { TotalWorkHoursService } from '../service/total-work-hours.service';
import { WorkHoursComponent } from './work-hours.component';
import { CounterComponent } from '../counter/counter.component';

describe('WorkHoursComponent', () => {
  let component: WorkHoursComponent;
  let timeService: TimeService;
  let totalWorkHoursService: jasmine.SpyObj<TotalWorkHoursService>;

  beforeEach(() => {
    totalWorkHoursService = jasmine.createSpyObj('TotalWorkHoursService', ['totalWorkedHours']);
    totalWorkHoursService.totalWorkedHours.and.returnValue(12345);
    TestBed.configureTestingModule({
      declarations: [CounterComponent],
      providers: [
        TimeService,
        { provide: TotalWorkHoursService, useValue: totalWorkHoursService }
      ]
    });
    timeService = TestBed.inject(TimeService);
    component = new WorkHoursComponent(timeService, totalWorkHoursService);
  });

  afterEach(() => component.ngOnDestroy());

  it('updates the total hours and working status', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 7, 24, 10, 0));

    component.ngOnInit();

    expect(component.totalWorkedHours).toBe(12345);
    expect(component.isWorkingHours).toBeTrue();
    jasmine.clock().uninstall();
  });

  it('toggles the total-hours display', () => {
    component.toggle();

    expect(component.isTotalWorkHoursVisible).toBeTrue();
    expect(totalWorkHoursService.totalWorkedHours).toHaveBeenCalled();
  });
});
