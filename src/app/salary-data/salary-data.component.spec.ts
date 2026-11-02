import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('loads the configured resource and charts oldest first while the summary uses the latest month', () => {
    expect(service.getSalaryData).toHaveBeenCalledWith('8');
    expect(component.chartData.map(({ value }) => value)).toEqual([969, 1850]);
    expect(component.latestRecord?.date).toBe('Sep 2026');
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
});
