import { TestBed } from '@angular/core/testing';

import { TotalWorkHoursService } from './total-work-hours.service';

describe('TotalWorkHoursService', () => {
  let service: TotalWorkHoursService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TotalWorkHoursService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
