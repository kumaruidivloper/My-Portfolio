import { ChangeDetectorRef } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { TotalApiDocument } from '../model/total-record';
import { TotalBalanceService } from '../shared/service/total-balance.service';
import { TotalBalanceComponent } from './total-balance.component';

describe('TotalBalanceComponent', () => {
  let service: jasmine.SpyObj<TotalBalanceService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  let updates: Subject<void>;
  let component: TotalBalanceComponent;
  const document: TotalApiDocument = {
    id: '7', name: 'All', type: 'Total',
    totalRecords: [
      { date: "Sep'26", total: 1500, difference: 200 },
      { date: "Aug'26", total: 1300, difference: 100 }
    ]
  };

  beforeEach(() => {
    updates = new Subject<void>();
    service = jasmine.createSpyObj<TotalBalanceService>('TotalBalanceService', ['getTotals'], {
      totalsUpdated$: updates.asObservable()
    });
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    service.getTotals.and.returnValue(of(document));
    component = new TotalBalanceComponent(service, changeDetector);
  });

  afterEach(() => component.ngOnDestroy());

  it('loads records oldest-first for charts and newest-first for the table', () => {
    component.ngOnInit();

    expect(component.interestChartData).toEqual([
      { name: "Aug'26", value: 100 }, { name: "Sep'26", value: 200 }
    ]);
    expect(component.totalChartData).toEqual([
      { name: "Aug'26", value: 1300 }, { name: "Sep'26", value: 1500 }
    ]);
    expect(component.gridRows.map((row) => row['month'])).toEqual(["Sep'26", "Aug'26"]);
    expect(component.currentBalance).toBe(1500);
    expect(component.currentBalanceMonth).toBe("Sep'26");
    expect(component.totalInterest).toBe(300);
    expect(component.isLoading).toBeFalse();
  });

  it('reports a load failure and clears the error after a successful update', () => {
    service.getTotals.and.returnValues(throwError(() => new Error('API unavailable')), of(document));
    component.ngOnInit();
    expect(component.errorMessage).toBe('API unavailable');
    expect(component.isLoading).toBeFalse();

    updates.next();
    expect(component.errorMessage).toBe('');
    expect(component.currentBalance).toBe(1500);
  });

  it('cancels the previous request and stops reloading after destruction', () => {
    const first = new Subject<TotalApiDocument>();
    const second = new Subject<TotalApiDocument>();
    service.getTotals.and.returnValues(first, second);
    component.ngOnInit();
    updates.next();
    first.next(document);
    expect(component.records).toEqual([]);
    second.next(document);
    expect(component.currentBalance).toBe(1500);

    component.ngOnDestroy();
    updates.next();
    expect(service.getTotals).toHaveBeenCalledTimes(2);
  });

  it('ignores unsupported chart types', () => {
    component.selectInterestChartType('line');
    component.selectTotalChartType('pie');
    component.selectInterestChartType('unknown');
    component.selectTotalChartType('unknown');

    expect(component.selectedInterestChartType).toBe('line');
    expect(component.selectedTotalChartType).toBe('pie');
  });
});
