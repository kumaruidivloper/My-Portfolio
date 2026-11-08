import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { TransferRecord } from '../model/transfer';
import { GratuityDataService } from '../service/gratuity-data.service';
import { PfDataService } from '../service/pf-data.service';
import { SalaryDataService } from '../service/salary-data.service';
import { DashboardRecordRefreshService } from '../service/dashboard-record-refresh.service';
import { TransferService } from '../service/transfer.service';
import { CentralRecordFormComponent } from './central-record-form.component';
import { FormStepperComponent } from '../form-stepper/form-stepper.component';

describe('CentralRecordFormComponent', () => {
  let transferService: jasmine.SpyObj<TransferService>;
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let gratuityDataService: jasmine.SpyObj<GratuityDataService>;
  let salaryDataService: jasmine.SpyObj<SalaryDataService>;
  let component: CentralRecordFormComponent;
  let transferUpdates: Subject<void>;
  let pfUpdates: Subject<'2' | '3'>;
  let gratuityUpdates: Subject<'4' | '5' | '6'>;
  let salaryUpdates: Subject<void>;

  beforeEach(() => {
    transferUpdates = new Subject<void>();
    pfUpdates = new Subject<'2' | '3'>();
    gratuityUpdates = new Subject<'4' | '5' | '6'>();
    salaryUpdates = new Subject<void>();
    transferService = jasmine.createSpyObj<TransferService>('TransferService', ['getTransfers', 'updateTransfers'],
      { transferUpdated$: transferUpdates.asObservable() });
    pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'getCachedPfData', 'updatePfData'],
      { pfUpdated$: pfUpdates.asObservable() });
    gratuityDataService = jasmine.createSpyObj<GratuityDataService>(
      'GratuityDataService', ['getGratuityData', 'getCachedGratuityData', 'updateGratuityData'],
      { gratuityUpdated$: gratuityUpdates.asObservable() }
    );
    salaryDataService = jasmine.createSpyObj<SalaryDataService>('SalaryDataService', ['getSalaryData', 'updateSalaryData'],
      { salaryUpdated$: salaryUpdates.asObservable() });
    component = new CentralRecordFormComponent(
      transferService,
      pfDataService,
      gratuityDataService,
      salaryDataService,
      new DashboardRecordRefreshService(),
      new ElementRef(document.createElement("div")),
      { markForCheck: () => undefined, detectChanges: () => undefined } as ChangeDetectorRef
    );
  });

  it('refreshes the relevant summaries on local updates and stops after destruction', () => {
    transferService.getTransfers.and.returnValue(of([]));
    pfDataService.getPfData.and.callFake((id) => of({
      id: id ?? '2', name: '', description: '', pfRecords: [{ date: "Jan'26", pfAmount: 100, difference: 10 }]
    }));
    gratuityDataService.getGratuityData.and.callFake((id) => of({
      id: id ?? '4', name: '', title: '', description: '', type: '',
      gratuityRecords: [{ date: "Jan'26", gratuity: 100, difference: 10 }]
    }));
    salaryDataService.getSalaryData.and.callFake((id) => of({
      id, name: '', title: '', description: '', type: '', salaryRecords: []
    }));

    component.ngOnInit();
    expect(component.summaryFor('kumarPf').headline).toContain('100');
    pfDataService.getPfData.calls.reset();
    pfDataService.getPfData.and.returnValue(of({
      id: '2', name: '', description: '', pfRecords: [{ date: "Feb'26", pfAmount: 250, difference: 150 }]
    }));
    pfUpdates.next('2');
    expect(component.summaryFor('kumarPf').headline).toContain('250');
    expect(pfDataService.getPfData).toHaveBeenCalledOnceWith('2');
    expect(component.summaryFor('vasukiPf').headline).toContain('100');

    gratuityDataService.getGratuityData.calls.reset();
    gratuityUpdates.next('6');
    expect(gratuityDataService.getGratuityData).toHaveBeenCalledOnceWith('6');
    transferService.getTransfers.calls.reset();
    transferUpdates.next();
    expect(transferService.getTransfers).toHaveBeenCalledTimes(1);
    salaryDataService.getSalaryData.calls.reset();
    salaryUpdates.next();
    expect(salaryDataService.getSalaryData).toHaveBeenCalledTimes(2);

    component.ngOnDestroy();
    pfUpdates.next('2');
    expect(pfDataService.getPfData).toHaveBeenCalledTimes(1);
  });

  it('recovers a summary on the next update after a load error', () => {
    transferService.getTransfers.and.returnValue(throwError(() => new Error('Unavailable')));
    pfDataService.getPfData.and.returnValue(of({ id: '2', name: '', description: '', pfRecords: [] }));
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '4', name: '', title: '', description: '', type: '', gratuityRecords: []
    }));
    salaryDataService.getSalaryData.and.returnValue(of({
      id: '8', name: '', title: '', description: '', type: '', salaryRecords: []
    }));
    component.ngOnInit();
    expect(component.summaryFor('transfer').detail).toBe('Unavailable');
    transferService.getTransfers.and.returnValue(of([]));
    transferUpdates.next();
    expect(component.summaryFor('transfer').headline).toBe('No records');
    component.ngOnDestroy();
  });

  it('ignores an older response after a newer update starts', () => {
    const oldRequest = new Subject<TransferRecord[]>();
    const newRequest = new Subject<TransferRecord[]>();
    const record = { dateOfTransfer: '01-Jan-26', receivedDate: '01-Jan-26', amountTransferredAUD: 1, conversionRate: 1, amountReceivedINR: 1 };
    transferService.getTransfers.and.returnValues(oldRequest, newRequest);
    pfDataService.getPfData.and.returnValue(of({ id: '2', name: '', description: '', pfRecords: [] }));
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '4', name: '', title: '', description: '', type: '', gratuityRecords: []
    }));
    salaryDataService.getSalaryData.and.returnValue(of({
      id: '8', name: '', title: '', description: '', type: '', salaryRecords: []
    }));
    component.ngOnInit();
    transferUpdates.next();
    newRequest.next([{ ...record, amountReceivedINR: 250 }]);
    oldRequest.next([{ ...record, amountReceivedINR: 100 }]);
    expect(component.summaryFor('transfer').headline).toContain('250');
    component.ngOnDestroy();
  });

  it('converts transfer dates and calculates received INR before saving', async () => {
    transferService.getTransfers.and.returnValue(of([]));
    transferService.updateTransfers.and.returnValue(of([]));
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-01-02',
      amountTransferredAUD: 1000,
      conversionRate: 90.5,
      receivedDate: '2026-01-04'
    });

    await component.submit();

    expect(transferService.updateTransfers).toHaveBeenCalledWith([{
      dateOfTransfer: '02-Jan-26',
      amountTransferredAUD: 1000,
      conversionRate: 90.5,
      receivedDate: '04-Jan-26',
      amountReceivedINR: 90500
    }]);
    expect(component.errorMessage).toBe('');
  });

  it('returns to the card picker after saving and allows another record', async () => {
    transferService.getTransfers.and.returnValue(of([]));
    transferService.updateTransfers.and.returnValue(of([]));
    const stepper = new FormStepperComponent();
    stepper.labels = ['Details', 'Review'];
    stepper.step = 1;
    component.stepper = stepper;
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-01-02', amountTransferredAUD: 1000,
      conversionRate: 90.5, receivedDate: '2026-01-04'
    });

    await component.submit();

    expect(saved).toHaveBeenCalledTimes(1);
    expect(component.category).toBeNull();
    expect(stepper.step).toBe(0);
    expect(component.form.controls.amountTransferredAUD.value).toBe(0);
    expect(component.successMessage).toBe('Record added successfully.');
    expect(component.isSaving).toBeFalse();
    component.changeCategory('transfer');
    expect(component.successMessage).toBe('');
    component.form.patchValue({
      dateOfTransfer: '2026-02-02', amountTransferredAUD: 200,
      conversionRate: 90, receivedDate: '2026-02-04'
    });
    stepper.step = 1;
    await component.submit();
    expect(saved).toHaveBeenCalledTimes(2);
    expect(component.category).toBeNull();
    expect(stepper.step).toBe(0);
  });

  it('keeps entered details and review step when saving fails', async () => {
    transferService.getTransfers.and.returnValue(of([]));
    transferService.updateTransfers.and.returnValue(throwError(() => new Error('Save failed')));
    const stepper = new FormStepperComponent();
    stepper.labels = ['Details', 'Review'];
    stepper.step = 1;
    component.stepper = stepper;
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-01-02', amountTransferredAUD: 1000,
      conversionRate: 90.5, receivedDate: '2026-01-04'
    });

    await component.submit();

    expect(component.category).toBe('transfer');
    expect(component.form.controls.amountTransferredAUD.value).toBe(1000);
    expect(stepper.step).toBe(1);
    expect(component.errorMessage).toBe('Save failed');
    expect(component.successMessage).toBe('');
    expect(saved).not.toHaveBeenCalled();
  });

  it('formats transfer review rows with padded dates and currency values', () => {
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-11-05',
      amountTransferredAUD: 555,
      conversionRate: 69,
      receivedDate: '2026-11-05'
    });

    expect(component.reviewFields).toEqual([
      { label: 'Transfer Date', value: '05 Nov 2026' },
      { label: 'Amount Sent', value: '$555.00' },
      { label: 'Exchange Rate', value: '69' },
      { label: 'Received Date', value: '05 Nov 2026' },
      { label: 'Amount Received', value: '₹ 38,295' }
    ]);
  });

  it('adds a PF record in the API month format', async () => {
    const document = {
      id: '2', name: 'Kumar', description: '',
      pfRecords: [{ date: "Dec'25", pfAmount: 120000, difference: 3000 }]
    };
    pfDataService.getPfData.and.returnValue(of(document));
    pfDataService.updatePfData.and.returnValue(of(document));
    component.changeCategory('kumarPf');
    component.form.patchValue({ date: '2026-01', amount: 125000, difference: 5000 });

    await component.submit();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...document,
      pfRecords: [
        { date: "Jan'26", pfAmount: 125000, difference: 5000 },
        ...document.pfRecords
      ]
    }, '2');
  });

  it('updates PF monthly difference when the balance changes', () => {
    pfDataService.getPfData.and.returnValue(of({
      id: '3', name: 'Vasuki', description: '',
      pfRecords: [{ date: "Dec'25", pfAmount: 120000, difference: 3000 }]
    }));
    component.changeCategory('vasukiPf');
    component.form.patchValue({ date: '2026-01', amount: 125000 });
    expect(component.form.controls.difference.value).toBe(5000);

    component.form.controls.amount.setValue(118000);

    expect(component.form.controls.difference.value).toBe(-2000);
  });

  it('calculates Kumar and Vasuki gratuity differences from their own previous months', () => {
    const kumarDocument = {
      id: '4', name: 'Kumar', title: '', description: '', type: 'Gratuity',
      gratuityRecords: [{ date: "Dec'25", gratuity: 1000, difference: 100 }]
    };
    const vasukiDocument = {
      id: '5', name: 'Vasuki', title: '', description: '', type: 'Gratuity',
      gratuityRecords: [{ date: "Dec'25", gratuity: 7000, difference: 500 }]
    };
    gratuityDataService.getCachedGratuityData.and.returnValue(null);
    gratuityDataService.getGratuityData.and.returnValues(of(kumarDocument), of(vasukiDocument));

    component.changeCategory('kumarGratuity');
    component.form.patchValue({ date: '2026-01', amount: 1250 });
    expect(component.form.controls.difference.value).toBe(250);

    component.changeCategory('vasukiGratuity');
    component.form.patchValue({ date: '2026-01', amount: 8000 });
    expect(component.form.controls.difference.value).toBe(1000);

    component.form.controls.amount.setValue(8500);
    expect(component.form.controls.difference.value).toBe(1500);
    expect(gratuityDataService.getGratuityData).toHaveBeenCalledWith('4');
    expect(gratuityDataService.getGratuityData).toHaveBeenCalledWith('5');
  });

  it('rejects duplicate salary months regardless of the stored month label format', async () => {
    const document = {
      id: '8', name: 'Kumar', title: '', description: '', type: 'Salary',
      salaryRecords: [{
        date: 'Jan 2026', initialAdvanceRepayment: 0, totalSalary: 1,
        ausTax: 0, indiaDeduction: 0, totalDeduction: 0, ausSalary: 1
      }]
    };
    salaryDataService.getSalaryData.and.returnValue(of(document));
    component.changeCategory('kumarSalary');
    component.form.patchValue({ date: '2026-01' });

    await component.submit();

    expect(salaryDataService.updateSalaryData).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('A salary record already exists for this month.');
  });
});