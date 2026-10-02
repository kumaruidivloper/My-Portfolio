import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PfDataService } from '../service/pf-data.service';
import { SumOfValueComponent } from './sum-of-value.component';

describe('SumOfValueComponent', () => {
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData']);
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    pfDataService.getPfData.and.callFake((resourceId) => of({
      id: resourceId ?? '2',
      name: resourceId === '2' ? 'Kumar' : 'Vasuki',
      description: 'PF history',
      pfRecords: resourceId === '2'
        ? [
          { date: "Sep'26", pfAmount: 2000, difference: 200 },
          { date: "Aug'26", pfAmount: 1800, difference: 180 }
        ]
        : [
          { date: "Sep'26", pfAmount: 3000, difference: 300 },
          { date: "Aug'26", pfAmount: 2500, difference: 250 }
        ]
    }));
  });

  it('loads both PF resources only when expanded and sums values by month', () => {
    const component = new SumOfValueComponent(pfDataService, changeDetector);

    expect(pfDataService.getPfData).not.toHaveBeenCalled();

    component.toggleExpanded();

    expect(pfDataService.getPfData).toHaveBeenCalledTimes(2);
    expect(pfDataService.getPfData).toHaveBeenCalledWith('2');
    expect(pfDataService.getPfData).toHaveBeenCalledWith('3');
    expect(component.interestChartData).toEqual([
      { name: 'Aug 2026', value: 430 },
      { name: 'Sep 2026', value: 500 }
    ]);
    expect(component.totalPfChartData).toEqual([
      { name: 'Aug 2026', value: 4300 },
      { name: 'Sep 2026', value: 5000 }
    ]);
    expect(component.errorMessage).toBe('');
  });

  it('reports API errors instead of showing an empty or successful summary', () => {
    pfDataService.getPfData.and.returnValue(throwError(() => new Error('API unavailable')));
    const component = new SumOfValueComponent(pfDataService, changeDetector);

    component.toggleExpanded();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('API unavailable');
    expect(component.monthlyTotals).toEqual([]);
  });

  it('rejects unsupported month values instead of silently omitting records', () => {
    pfDataService.getPfData.and.returnValue(of({
      id: '2',
      name: 'Kumar',
      description: 'PF history',
      pfRecords: [{ date: 'unknown', pfAmount: 100, difference: 10 }]
    }));
    const component = new SumOfValueComponent(pfDataService, changeDetector);

    component.toggleExpanded();

    expect(component.monthlyTotals).toEqual([]);
    expect(component.errorMessage).toContain('not a supported month');
  });
});
