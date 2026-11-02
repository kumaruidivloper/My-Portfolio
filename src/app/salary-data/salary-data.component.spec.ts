import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { SalaryDataComponent } from './salary-data.component';
import { SalaryApiDocument, salaryMonthKey } from '../model/salary-record';
import { SalaryDataService } from '../service/salary-data.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { announceAccordionOpened } from '../service/accordion-group';
import { MyDashboardModule } from '../my-dashboard/my-dashboard.module';

describe('SalaryDataComponent', () => {
  let component: SalaryDataComponent;
  let service: jasmine.SpyObj<SalaryDataService>;
  let codes: jasmine.SpyObj<ConfirmationCodeService>;
  let detector: jasmine.SpyObj<ChangeDetectorRef>;
  const document: SalaryApiDocument = {
    id: '8', name: 'Kumar Australia Salary', title: '', description: '', type: 'Salary',
    salaryRecords: [
      { date: 'Aug 2026', initialAdvanceRepayment: 11, totalSalary: 1000, ausTax: 10, indiaDeduction: 20, totalDeduction: 31, ausSalary: 969 },
      { date: 'Sep 2026', initialAdvanceRepayment: 12, totalSalary: 2000, ausTax: 20, indiaDeduction: 40, totalDeduction: 99, ausSalary: 1850 }
    ]
  };
  beforeEach(() => {
    service = jasmine.createSpyObj<SalaryDataService>('SalaryDataService', ['getSalaryData', 'updateSalaryData']);
    service.getSalaryData.and.returnValue(of(document));
    service.updateSalaryData.and.callFake((data) => of(data));
    codes = jasmine.createSpyObj<ConfirmationCodeService>('ConfirmationCodeService', ['verify']);
    codes.verify.and.resolveTo(true);
    detector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new SalaryDataComponent(service, codes, detector);
    component.ngOnInit();
  });

  describe('Salary widget forms', () => {
    let fixture: ComponentFixture<SalaryDataComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [MyDashboardModule],
        providers: [
          provideNoopAnimations(),
          { provide: SalaryDataService, useValue: {
            getSalaryData: (id: string) => of({
              id, name: 'Salary', title: '', description: '', type: 'Salary', salaryRecords: []
            })
          } },
          { provide: ConfirmationCodeService, useValue: { verify: () => Promise.resolve(true) } }
        ]
      });
    });

    afterEach(() => fixture?.destroy());

    it('renders accessible period controls and disables them for an empty history', () => {
      fixture = TestBed.createComponent(SalaryDataComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      (host.querySelector('.accordion-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      const filter = host.querySelector('.salary-range')!;
      expect(filter.querySelector('h3')?.textContent).toBe('Salary period');
      expect(filter.querySelectorAll('app-theme-date-picker button:disabled').length).toBe(2);
      expect(filter.querySelectorAll('input[type="range"]:disabled').length).toBe(2);
      expect(filter.querySelectorAll('.salary-range-presets button:disabled').length).toBe(4);
      expect(filter.textContent).toContain('Add a salary record to start filtering.');
    });

    it('uses the themed month popup with inclusive limits and updates the salary totals', () => {
      TestBed.overrideProvider(SalaryDataService, { useValue: service });
      fixture = TestBed.createComponent(SalaryDataComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      (host.querySelector('.accordion-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      const from = host.querySelector('[aria-label="From salary month"]') as HTMLButtonElement;
      expect(from.textContent).toContain('Aug 2026');
      from.click();
      fixture.detectChanges();
      const popup = window.document.querySelector('.date-picker-popup')!;
      const months = Array.from(popup.querySelectorAll<HTMLButtonElement>('.date-picker-cell'));
      expect(months.find(button => button.textContent?.trim() === 'Jul')?.disabled).toBeTrue();
      expect(months.find(button => button.textContent?.trim() === 'Oct')?.disabled).toBeTrue();
      months.find(button => button.textContent?.trim() === 'Sep')!.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.fromMonth).toBe('2026-09');
      expect(fixture.componentInstance.totals.credited).toBe(1850);
      expect(window.document.querySelector('.date-picker-popup')).toBeNull();
    });

    it('renders the empty-state add flow with all six Kumar numeric fields and themed step buttons', () => {
      fixture = TestBed.createComponent(SalaryDataComponent);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      (host.querySelector('.accordion-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      (host.querySelector('.add-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(host.querySelectorAll('input[type="number"]').length).toBe(6);
      expect(host.querySelector('.gratuity-form-grid')?.textContent).not.toContain('Australian health insurance');
      expect(host.querySelector('app-form-stepper')).not.toBeNull();
      expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
      expect(host.querySelector('.stepper-actions .primary-action')?.textContent?.trim()).toBe('Next');
      (host.querySelector('.gratuity-modal-close') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    });

    it('renders Vasuki health insurance alongside every other existing salary field', () => {
      fixture = TestBed.createComponent(SalaryDataComponent);
      fixture.componentRef.setInput('resourceId', '9');
      fixture.componentRef.setInput('ownerName', 'Vasuki');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      (host.querySelector('.accordion-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      (host.querySelector('.add-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(host.querySelectorAll('input[type="number"]').length).toBe(7);
      expect(host.querySelector('.gratuity-form-grid')?.textContent).toContain('Australian health insurance');
      expect(host.querySelector('h2')?.textContent).toContain('Vasuki Australia Salary');
    });
  });
  afterEach(() => component.ngOnDestroy());

  async function confirm(): Promise<void> {
    component.confirmationCode.setValue('12345678901234');
    await component.validateCode();
  }

  it('loads the configured resource and charts oldest first while totals include every month', () => {
    expect(service.getSalaryData).toHaveBeenCalledWith('8');
    expect(component.chartData.map(({ value }) => value)).toEqual([969, 1850]);
    expect(component.totals).toEqual({ credited: 2819, gross: 3000, deductions: 130 });
    expect(component.gridRows.map(({ actionIndex }) => actionIndex)).toEqual([0, 1]);
    expect(component.fields.some(({ key }) => key === 'ausHealthInsurance')).toBeFalse();
    component.resourceId = '9';
    expect(component.fields.some(({ key }) => key === 'ausHealthInsurance')).toBeTrue();
    component.selectField('ausTax');
    expect(component.chartData.map(({ value }) => value)).toEqual([10, 20]);
    component.selectChartType('line');
    expect(component.lineData[0].series).toEqual(component.chartData);
  });

  it('coordinates expansion with other dashboard widgets', () => {
    component.toggleExpanded();
    expect(component.isExpanded).toBeTrue();
    component.areRecordsExpanded = true;
    announceAccordionOpened('transfer');
    expect(component.isExpanded).toBeFalse();
    expect(component.areRecordsExpanded).toBeFalse();
  });

  it('adds every manually entered field without recalculating deductions or salary', () => {
    component.addRecord();
    component.editForm.setValue({
      date: '2026-10', initialAdvanceRepayment: 1, totalSalary: 5000,
      ausHealthInsurance: 0, ausTax: 200, indiaDeduction: 50, totalDeduction: 999, ausSalary: 1234.56
    });
    component.saveRecord();
    const [saved, id] = service.updateSalaryData.calls.mostRecent().args;
    expect(id).toBe('8');
    expect(saved.salaryRecords[0]).toEqual({
      date: 'Oct 2026', initialAdvanceRepayment: 1, totalSalary: 5000,
      ausTax: 200, indiaDeduction: 50, totalDeduction: 999, ausSalary: 1234.56
    });
    expect(saved.salaryRecords.slice(1)).toEqual(document.salaryRecords);
    expect(document.salaryRecords.length).toBe(2);
    expect(component.formOpen).toBeFalse();
    expect(component.toastMessage).toContain('added');
  });

  it('includes health insurance when saving Vasuki records', () => {
    component.resourceId = '9';
    component.addRecord();
    component.editForm.patchValue({ date: '2026-10', ausHealthInsurance: 42 });
    component.saveRecord();
    expect(service.updateSalaryData.calls.mostRecent().args[1]).toBe('9');
    expect(service.updateSalaryData.calls.mostRecent().args[0].salaryRecords[0].ausHealthInsurance).toBe(42);
  });

  it('rejects duplicate months and invalid values without calling the API', () => {
    component.addRecord();
    component.editForm.patchValue({ date: '2026-09' });
    component.saveRecord();
    expect(component.editForm.controls.date.hasError('duplicateMonth')).toBeTrue();
    component.editForm.patchValue({ date: '2026-10', ausSalary: Infinity });
    component.saveRecord();
    expect(component.editForm.controls.ausSalary.invalid).toBeTrue();
    expect(service.updateSalaryData).not.toHaveBeenCalled();
  });

  it('requires a current verified code for editing and preserves the original record index', async () => {
    component.editRecord(1);
    component.editForm.controls.ausSalary.setValue(1700);
    component.saveRecord();
    expect(service.updateSalaryData).not.toHaveBeenCalled();
    await confirm();
    component.confirmationCode.setValue('00000000000000');
    component.saveRecord();
    expect(service.updateSalaryData).not.toHaveBeenCalled();
    await confirm();
    component.saveRecord();
    const saved = service.updateSalaryData.calls.mostRecent().args[0].salaryRecords;
    expect(saved[0]).toEqual(document.salaryRecords[0]);
    expect(saved[1].ausSalary).toBe(1700);
  });

  it('deletes only the requested record after confirmation', async () => {
    component.requestDelete(0);
    component.deleteRecord();
    expect(service.updateSalaryData).not.toHaveBeenCalled();
    await confirm();
    component.deleteRecord();
    expect(service.updateSalaryData.calls.mostRecent().args[0].salaryRecords).toEqual([document.salaryRecords[1]]);
  });

  it('shows save failures and retains manual form values for retry', () => {
    service.updateSalaryData.and.returnValue(throwError(() => new Error('Save unavailable')));
    component.addRecord();
    component.editForm.patchValue({ date: '2026-10', ausSalary: 55 });
    component.saveRecord();
    expect(component.saveError).toBe('Save unavailable');
    expect(component.editForm.controls.ausSalary.value).toBe(55);
    expect(component.editForm.enabled).toBeTrue();
    expect(component.isAdding).toBeTrue();
    expect(component.isSaving).toBeFalse();
  });

  it('prevents duplicate submissions and closing while saving', () => {
    const pending = new Subject<SalaryApiDocument>();
    service.updateSalaryData.and.returnValue(pending);
    component.addRecord();
    component.editForm.controls.date.setValue('2026-10');
    component.saveRecord();
    component.saveRecord();
    component.closeDialog();
    expect(service.updateSalaryData).toHaveBeenCalledTimes(1);
    expect(component.formOpen).toBeTrue();
    expect(component.editForm.disabled).toBeTrue();
  });

  it('ignores stale verification and reports verification failures', async () => {
    let resolve!: (value: boolean) => void;
    codes.verify.and.returnValue(new Promise((done) => resolve = done));
    component.editRecord(0);
    component.confirmationCode.setValue('12345678901234');
    const pending = component.validateCode();
    component.closeDialog();
    resolve(true);
    await pending;
    expect(component.confirmed).toBeFalse();
    codes.verify.and.rejectWith(new Error('Unavailable'));
    component.editRecord(0);
    await confirm();
    expect(component.saveError).toContain('verification is unavailable');
  });

  it('surfaces load errors and supports retrying empty histories', () => {
    service.getSalaryData.and.returnValue(throwError(() => new Error('Load unavailable')));
    component.loadData();
    expect(component.errorMessage).toBe('Load unavailable');
    service.getSalaryData.and.returnValue(of({ ...document, salaryRecords: [] }));
    component.loadData();
    expect(component.errorMessage).toBe('');
    component.addRecord();
    expect(component.isAdding).toBeTrue();
  });

  it('normalizes existing API month formats without losing chronological order', () => {
    expect(salaryMonthKey('Sep 2026')).toBe('2026-09');
    expect(salaryMonthKey("Sep'26")).toBe('2026-09');
    expect(salaryMonthKey('2026-09')).toBe('2026-09');
    expect(() => salaryMonthKey('Bad')).toThrowError();
  });

  it('filters totals, chart and table inclusively and preserves original action indexes', () => {
    component.toggleExpanded();
    expect(component.fromLabel).toBe('Aug 2026');
    expect(component.toLabel).toBe('Sep 2026');
    component.setRange('from', 1);
    expect(component.totals).toEqual({ credited: 1850, gross: 2000, deductions: 99 });
    expect(component.chartData).toEqual([{ name: 'Sep 2026', value: 1850 }]);
    expect(component.gridRows.map(({ actionIndex }) => actionIndex)).toEqual([1]);
    component.editRecord(component.gridRows[0].actionIndex!);
    expect(component.editingIndex).toBe(1);
    expect(component.editForm.controls.ausSalary.value).toBe(1850);
    component.closeDialog();
    component.selectField('ausTax');
    expect(component.chartData[0].value).toBe(20);
    expect(component.totals).toEqual({ credited: 1850, gross: 2000, deductions: 99 });
    component.resetRange();
    expect(component.totals).toEqual({ credited: 2819, gross: 3000, deductions: 130 });
    expect(component.gridRows.length).toBe(2);
    expect(component.isRangeFiltered).toBeFalse();
  });

  it('supports gaps in calendar months, empty selections and unsorted histories across years', () => {
    component.data = {
      ...document,
      salaryRecords: [
        { ...document.salaryRecords[0], date: 'Feb 2027' },
        { ...document.salaryRecords[1], date: 'Dec 2026' }
      ]
    };
    component.toggleExpanded();
    expect(component.rangeMax).toBe(2);
    expect(component.fromLabel).toBe('Dec 2026');
    expect(component.toLabel).toBe('Feb 2027');
    component.setRange('from', 1);
    component.setRange('to', 1);
    expect(component.fromLabel).toBe('Jan 2027');
    expect(component.filteredRecords).toEqual([]);
    expect(component.chartData).toEqual([]);
    expect(component.gridRows).toEqual([]);
    expect(component.totals).toEqual({ credited: 0, gross: 0, deductions: 0 });
    component.resetRange();
    expect(component.gridRows.map(({ actionIndex }) => actionIndex)).toEqual([0, 1]);
  });

  it('prevents handles crossing and explicitly reports invalid range values', () => {
    component.setRange('from', 1);
    component.setRange('to', 0);
    expect(component.toPosition).toBe(1);
    component.resetRange();
    component.setRange('to', 0);
    component.setRange('from', 1);
    expect(component.fromPosition).toBe(0);
    for (const invalid of [-1, 2, NaN, 0.5]) {
      component.setRange('from', invalid);
      expect(component.rangeError).toContain('Choose a month');
      expect(component.fromPosition).toBe(0);
    }
    component.resetRange();
    expect(component.rangeError).toBe('');
  });

  it('selects trailing calendar months relative to the latest salary month', () => {
    component.data = {
      ...document,
      salaryRecords: [
        { ...document.salaryRecords[0], date: 'Jan 2025' },
        { ...document.salaryRecords[1], date: 'Sep 2026' }
      ]
    };
    for (const [months, from] of [[3, '2026-07'], [6, '2026-04'], [12, '2025-10']] as const) {
      component.selectRecentMonths(months);
      expect(component.fromMonth).toBe(from);
      expect(component.toMonth).toBe('2026-09');
      expect(component.isRecentMonths(months)).toBeTrue();
      expect(component.totals.credited).toBe(1850);
    }
    component.setRangeMonth('to', '2026-08');
    expect(component.isRecentMonths(12)).toBeFalse();
    component.resetRange();
    expect(component.isRangeFiltered).toBeFalse();
  });

  it('supports exact month entry and reports invalid or reversed dates without changing the range', () => {
    component.setRangeMonth('from', '2026-09');
    expect(component.fromPosition).toBe(1);
    component.setRangeMonth('to', '2026-08');
    expect(component.rangeError).toContain('on or before');
    expect(component.toMonth).toBe('2026-09');
    component.resetRange();
    for (const invalid of ['', '2026-13', 'not-a-month', '2027-01']) {
      component.setRangeMonth('to', invalid);
      expect(component.rangeError).not.toBe('');
      expect(component.toMonth).toBe('2026-09');
    }
    component.setRangeMonth('to', '2026-08');
    expect(component.rangeError).toBe('');
    expect(component.totals.credited).toBe(969);
  });

  it('handles empty and single-month histories with finite bounds and totals', () => {
    component.data = { ...document, salaryRecords: [] };
    expect(component.rangeMax).toBe(0);
    expect(component.fromLabel).toBe('No data');
    expect(component.toLabel).toBe('No data');
    expect(component.totals).toEqual({ credited: 0, gross: 0, deductions: 0 });
    component.data = { ...document, salaryRecords: [document.salaryRecords[0]] };
    expect(component.rangeMax).toBe(0);
    expect(component.fromLabel).toBe(component.toLabel);
    expect(component.totals).toEqual({ credited: 969, gross: 1000, deductions: 31 });
  });

  it('resets the range after saving and includes a newly added month in the totals', () => {
    component.setRange('from', 1);
    component.addRecord();
    component.editForm.patchValue({ date: '2026-10', ausSalary: 10, totalSalary: 20, totalDeduction: 5 });
    component.saveRecord();
    expect(component.isRangeFiltered).toBeFalse();
    expect(component.toLabel).toBe('Oct 2026');
    expect(component.totals).toEqual({ credited: 2829, gross: 3020, deductions: 135 });
  });

  it('applies the same range totals to Vasuki including unchanged manually entered deductions', () => {
    component.resourceId = '9';
    component.data = {
      ...document, id: '9',
      salaryRecords: document.salaryRecords.map((record) => ({ ...record, ausHealthInsurance: 100 }))
    };
    component.setRange('to', 0);
    expect(component.totals).toEqual({ credited: 969, gross: 1000, deductions: 31 });
    expect(component.filteredRecords[0].ausHealthInsurance).toBe(100);
  });
});
