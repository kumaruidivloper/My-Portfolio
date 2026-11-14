import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectorRef, ElementRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, Subject, throwError } from 'rxjs';
import { TransferRecord } from '../model/transfer';
import { GratuityApiDocument } from '../model/gratuity-record';
import { GratuityDataService } from '../service/gratuity-data.service';
import { PfDataService } from '../service/pf-data.service';
import { SalaryDataService } from '../service/salary-data.service';
import { DashboardRecordRefreshService } from '../service/dashboard-record-refresh.service';
import { TransferService } from '../service/transfer.service';
import { CentralRecordFormComponent } from './central-record-form.component';
import { FormStepperComponent } from '../form-stepper/form-stepper.component';
import { TotalBalanceService } from '../service/total-balance.service';
import { ThemeDatePickerComponent } from '../theme-date-picker/theme-date-picker.component';

describe('CentralRecordFormComponent', () => {
  let transferService: jasmine.SpyObj<TransferService>;
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let gratuityDataService: jasmine.SpyObj<GratuityDataService>;
  let salaryDataService: jasmine.SpyObj<SalaryDataService>;
  let totalBalanceService: jasmine.SpyObj<TotalBalanceService>;
  let component: CentralRecordFormComponent;
  let transferUpdates: Subject<void>;
  let pfUpdates: Subject<'2' | '3'>;
  let gratuityUpdates: Subject<'4' | '5' | '6'>;
  let salaryUpdates: Subject<void>;
  let totalsUpdates: Subject<void>;

  beforeEach(() => {
    transferUpdates = new Subject<void>();
    pfUpdates = new Subject<'2' | '3'>();
    gratuityUpdates = new Subject<'4' | '5' | '6'>();
    salaryUpdates = new Subject<void>();
    totalsUpdates = new Subject<void>();
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
    totalBalanceService = jasmine.createSpyObj<TotalBalanceService>(
      'TotalBalanceService', ['getOtherBalanceSources', 'getTotals'],
      { totalsUpdated$: totalsUpdates.asObservable() }
    );
    totalBalanceService.getOtherBalanceSources.and.returnValue(of([]));
    totalBalanceService.getTotals.and.returnValue(of({ id: '7', name: '', type: '', totalRecords: [] }));
    component = new CentralRecordFormComponent(
      transferService,
      pfDataService,
      gratuityDataService,
      salaryDataService,
      totalBalanceService,
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

  it('updates the saved overall comparison and handles missing or invalid previous records', () => {
    transferService.getTransfers.and.returnValue(of([]));
    pfDataService.getPfData.and.returnValue(of({ id: '2', name: '', description: '', pfRecords: [] }));
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '4', name: '', title: '', description: '', type: '', gratuityRecords: []
    }));
    salaryDataService.getSalaryData.and.returnValue(of({
      id: '8', name: '', title: '', description: '', type: '', salaryRecords: []
    }));
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDate = `${monthNames[now.getMonth()]}'${String(now.getFullYear()).slice(-2)}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const previousRecordDate = `${monthNames[previousDate.getMonth()]}'${String(previousDate.getFullYear()).slice(-2)}`;
    const twoMonthsPriorDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsPriorMonth = `${twoMonthsPriorDate.getFullYear()}-${String(twoMonthsPriorDate.getMonth() + 1).padStart(2, '0')}`;
    const twoMonthsPriorRecordDate = `${monthNames[twoMonthsPriorDate.getMonth()]}'${String(twoMonthsPriorDate.getFullYear()).slice(-2)}`;
    const records = [
      { date: currentDate, total: 2200, difference: 150 },
      { date: previousRecordDate, total: 2000, difference: 200 },
      { date: twoMonthsPriorRecordDate, total: 1800, difference: 100 }
    ];
    totalBalanceService.getTotals.and.returnValue(of({ id: '7', name: '', type: '', totalRecords: records }));
    component.ngOnInit();
    expect(component.overallSummary).toEqual({
      status: 'ready',
      currentMonth,
      current: { date: currentMonth, total: 2200, difference: 150 },
      previous: { date: previousMonth, total: 2000, difference: 200 },
      previousMonths: [
        { date: previousMonth, total: 2000, difference: 200 },
        { date: twoMonthsPriorMonth, total: 1800, difference: 100 }
      ],
      monthChanges: { [currentMonth]: -50, [previousMonth]: 100 }
    });
    expect(records.length).toBe(3);

    totalBalanceService.getTotals.and.returnValue(of({ id: '7', name: '', type: '', totalRecords: [records[0], records[2]] }));
    totalsUpdates.next();
    expect(component.overallSummary.status).toBe('ready');
    if (component.overallSummary.status === 'ready') {
      expect(component.overallSummary.monthChanges[currentMonth]).toBeUndefined();
    }

    totalBalanceService.getTotals.and.returnValue(of({ id: '7', name: '', type: '', totalRecords: [records[1]] }));
    totalsUpdates.next();
    expect(component.overallSummary).toEqual({
      status: 'ready', currentMonth, current: null,
      previous: { date: previousMonth, total: 2000, difference: 200 },
      previousMonths: [{ date: previousMonth, total: 2000, difference: 200 }],
      monthChanges: {}
    });
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [{ date: 'invalid', total: 0, difference: 0 }]
    }));
    totalsUpdates.next();
    expect(component.overallSummary.status).toBe('unavailable');
    component.ngOnDestroy();
    totalBalanceService.getTotals.calls.reset();
    totalsUpdates.next();
    expect(totalBalanceService.getTotals).not.toHaveBeenCalled();
  });

  it('compares each month difference with the previous month, including across years', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 9, 14));
      transferService.getTransfers.and.returnValue(of([]));
      pfDataService.getPfData.and.returnValue(of({ id: '2', name: '', description: '', pfRecords: [] }));
      gratuityDataService.getGratuityData.and.returnValue(of({
        id: '4', name: '', title: '', description: '', type: '', gratuityRecords: []
      }));
      salaryDataService.getSalaryData.and.returnValue(of({
        id: '8', name: '', title: '', description: '', type: '', salaryRecords: []
      }));
      totalBalanceService.getTotals.and.returnValue(of({
        id: '7', name: '', type: '', totalRecords: [
          { date: "Sep'26", total: 1000, difference: 65527 },
          { date: "Oct'26", total: 2000, difference: 64052 },
          { date: "Nov'26", total: 3000, difference: 60000 },
          { date: "Dec'26", total: 4000, difference: 61000 },
          { date: "Jan'27", total: 5000, difference: 62000 }
        ]
      }));
      component.ngOnInit();
      expect(component.overallSummary.status).toBe('ready');
      if (component.overallSummary.status === 'ready') {
        expect(component.overallSummary.monthChanges['2026-10']).toBe(-1475);
      }

      jasmine.clock().mockDate(new Date(2027, 0, 14));
      totalsUpdates.next();
      expect(component.overallSummary.status).toBe('ready');
      if (component.overallSummary.status === 'ready') {
        expect(component.overallSummary.monthChanges).toEqual({
          '2026-11': -4052,
          '2026-12': 1000,
          '2027-01': 1000
        });
      }
      component.ngOnDestroy();
    } finally {
      jasmine.clock().uninstall();
    }
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

  it('uses the latest existing PF record within the current and prior two months', () => {
    pfDataService.getPfData.and.returnValue(of({
      id: '3', name: 'Vasuki', description: '',
      pfRecords: [
        { date: "Mar'26", pfAmount: 500000, difference: 0 },
        { date: "Jan'26", pfAmount: 100000, difference: 0 }
      ]
    }));
    component.changeCategory('vasukiPf');
    component.form.patchValue({ date: '2026-03', amount: 125000 });

    expect(component.form.controls.difference.value).toBe(-375000);

    pfDataService.getPfData.and.returnValue(of({
      id: '3', name: 'Vasuki', description: '',
      pfRecords: [
        { date: "Feb'26", pfAmount: 120000, difference: 0 },
        { date: "Jan'26", pfAmount: 100000, difference: 0 }
      ]
    }));
    component.changeCategory('vasukiPf');
    component.form.patchValue({ date: '2026-03', amount: 125000 });

    expect(component.form.controls.difference.value).toBe(5000);

    pfDataService.getPfData.and.returnValue(of({
      id: '3', name: 'Vasuki', description: '',
      pfRecords: [{ date: "Dec'25", pfAmount: 90000, difference: 0 }]
    }));
    component.changeCategory('vasukiPf');
    component.form.patchValue({ date: '2026-03', amount: 125000 });

    expect(component.form.controls.difference.value).toBe(0);
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

  it('uses the previous existing gratuity entry when the immediately prior month is missing', () => {
    gratuityDataService.getCachedGratuityData.and.returnValue(null);
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '4', name: 'Kumar', title: '', description: '', type: 'Gratuity',
      gratuityRecords: [{ date: "Jan'26", gratuity: 1000, difference: 100 }]
    }));
    component.changeCategory('kumarGratuity');
    component.form.patchValue({ date: '2026-03', amount: 1250 });

    expect(component.form.controls.difference.value).toBe(250);
  });

  it('previews overall totals and monthly differences using the unsaved Super amount', () => {
    const december = (amount: number, difference: number) => ({ date: "Dec'26", amount, difference });
    totalBalanceService.getOtherBalanceSources.and.returnValue(of([
      [{ date: "Jan'27", amount: 120, difference: 20 }, december(100, 10)],
      [december(200, 20)],
      [december(300, 30)],
      [december(400, 40)]
    ]));
    gratuityDataService.getCachedGratuityData.and.returnValue({
      id: '6', name: '', title: '', description: '', type: 'Super',
      gratuityRecords: [{ date: "Dec'26", gratuity: 1000, difference: 100 }]
    });

    component.changeCategory('vasukiSuper');
    component.form.patchValue({ date: '2027-01', amount: 1200 });
    expect(component.superOverallPreview).toEqual({
      previousMonth: '2026-12', currentMonth: '2027-01',
      previous: { date: "Dec'26", total: 2000, difference: 200 },
      current: { date: "Jan'27", total: 2220, difference: 220 }
    });

    component.form.controls.amount.setValue(900);
    expect(component.superOverallPreview?.current).toEqual({ date: "Jan'27", total: 1920, difference: -80 });
    component.form.controls.date.setValue('2026-12');
    expect(component.superOverallPreview).toBeNull();
    component.form.controls.date.setValue('2027-03');
    expect(component.superOverallPreview).toBeNull();
    expect(gratuityDataService.updateGratuityData).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('reports an overall preview loading error without blocking Super entry', () => {
    totalBalanceService.getOtherBalanceSources.and.returnValue(throwError(() => new Error('Unavailable')));
    gratuityDataService.getCachedGratuityData.and.returnValue({
      id: '6', name: '', title: '', description: '', type: 'Super',
      gratuityRecords: [{ date: "Dec'26", gratuity: 1000, difference: 100 }]
    });
    component.changeCategory('vasukiSuper');
    component.form.patchValue({ date: '2027-01', amount: 1200 });

    expect(component.overallPreviewError).toContain('Unable to load');
    expect(component.superOverallPreview).toBeNull();
    expect(component.canReview).toBeTrue();
    component.changeCategory(null);
    expect(component.overallPreviewError).toBe('');
    component.ngOnDestroy();
  });

  it('renders the overall preview within Super and updates it when the balance changes', () => {
    transferService.getTransfers.and.returnValue(of([]));
    pfDataService.getPfData.and.returnValue(of({ id: '2', name: '', description: '', pfRecords: [] }));
    const superHistory = new Subject<GratuityApiDocument>();
    let superRequests = 0;
    gratuityDataService.getGratuityData.and.callFake((id) => {
      if (id === '6' && ++superRequests > 1) { return superHistory; }
      return of({ id: id ?? '4', name: '', title: '', description: '', type: '', gratuityRecords: [] });
    });
    salaryDataService.getSalaryData.and.returnValue(of({
      id: '8', name: '', title: '', description: '', type: '', salaryRecords: []
    }));
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentRecordDate = `${monthNames[now.getMonth()]}'${String(now.getFullYear()).slice(-2)}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousRecordDate = `${monthNames[previousDate.getMonth()]}'${String(previousDate.getFullYear()).slice(-2)}`;
    const earlierDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const earlierRecordDate = `${monthNames[earlierDate.getMonth()]}'${String(earlierDate.getFullYear()).slice(-2)}`;
    const oldestDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const oldestRecordDate = `${monthNames[oldestDate.getMonth()]}'${String(oldestDate.getFullYear()).slice(-2)}`;
    const futureDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const futureRecordDate = `${monthNames[futureDate.getMonth()]}'${String(futureDate.getFullYear()).slice(-2)}`;
    const previousMonthLabel = `${monthNames[previousDate.getMonth()]} ${previousDate.getFullYear()}`;
    const currentMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const futureMonthLabel = `${monthNames[futureDate.getMonth()]} ${futureDate.getFullYear()}`;
    const december = (amount: number, difference: number) => ({ date: "Dec'26", amount, difference });
    totalBalanceService.getOtherBalanceSources.and.returnValue(of([
      [december(100, 10)], [december(200, 20)], [december(300, 30)], [december(400, 40)]
    ]));
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [
        { date: currentRecordDate, total: 11345678, difference: 90000 },
        { date: previousRecordDate, total: 12000000, difference: 75000 }
      ]
    }));
    gratuityDataService.getCachedGratuityData.and.returnValue(null);
    TestBed.configureTestingModule({
      declarations: [CentralRecordFormComponent, FormStepperComponent, ThemeDatePickerComponent],
      imports: [CommonModule, ReactiveFormsModule, OverlayModule],
      providers: [
        { provide: TransferService, useValue: transferService },
        { provide: PfDataService, useValue: pfDataService },
        { provide: GratuityDataService, useValue: gratuityDataService },
        { provide: SalaryDataService, useValue: salaryDataService },
        { provide: TotalBalanceService, useValue: totalBalanceService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    const fixture = TestBed.createComponent(CentralRecordFormComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const nextButton: HTMLButtonElement = fixture.nativeElement.querySelector('.stepper-actions .primary-action');
    const transferToggle: HTMLInputElement = fixture.nativeElement.querySelector('input[aria-label="Australia to India transfer"]');
    const cancel = jasmine.createSpy('cancel');
    fixture.componentInstance.cancel.subscribe(cancel);
    expect(nextButton.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.stepper-actions button')?.textContent).toContain('Cancel');
    transferToggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.hasTriedToReview).toBeFalse();
    transferToggle.click();
    fixture.detectChanges();
    expect(nextButton.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.stepper-actions button')?.textContent).toContain('Back');
    nextButton.click();
    expect(fixture.componentInstance.hasTriedToReview).toBeTrue();
    fixture.componentInstance.form.patchValue({
      dateOfTransfer: '2026-01-01', receivedDate: '2026-01-02', amountTransferredAUD: 100, conversionRate: 50
    });
    fixture.detectChanges();
    nextButton.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.stepper?.step).toBe(1);
    const reviewActions: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.stepper-actions button'));
    expect(reviewActions.filter((button) => button.textContent?.includes('Back')).length).toBe(1);
    expect(reviewActions.some((button) => button.textContent?.includes('Cancel'))).toBeFalse();
    reviewActions.find((button) => button.textContent?.includes('Back'))!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.category).toBe('transfer');
    expect(fixture.componentInstance.form.controls.amountTransferredAUD.value).toBe(100);
    fixture.nativeElement.querySelector('.stepper-actions button').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.category).toBeNull();
    expect(fixture.nativeElement.querySelector('.stepper-actions button')?.textContent).toContain('Cancel');
    expect((fixture.nativeElement.querySelector('.stepper-actions .primary-action') as HTMLButtonElement).disabled).toBeTrue();
    expect(cancel).not.toHaveBeenCalled();
    const summary: HTMLElement = fixture.nativeElement.querySelector('.overall-summary');
    expect(summary.closest('[hidden]')).toBeNull();
    expect(summary.textContent).toContain(currentMonthLabel);
    expect(summary.textContent).toContain(previousMonthLabel);
    expect(summary.textContent).toContain('₹ 1,13,45,678');
    expect(summary.textContent).toContain('₹ 1,20,00,000');
    expect(summary.textContent).toContain('₹ 90,000');
    expect(summary.textContent).toContain('₹ 75,000');
    expect(summary.querySelectorAll('tbody tr').length).toBe(2);
    expect(summary.querySelectorAll('tbody tr')[1].querySelector('td:last-child [aria-label]')?.getAttribute('aria-label'))
      .toBe('Previous month difference unavailable');
    expect(summary.querySelector('.overall-changes .down')?.getAttribute('aria-label')).toContain('Balance decreased by');
    expect(summary.querySelector('.overall-changes .up')?.getAttribute('aria-label')).toContain('Monthly difference increased by');
    const transferCard = summary.closest<HTMLElement>('.record-type-group')!;
    expect(transferCard.querySelector('.record-type-group-title')?.textContent).toContain('Transfer');
    transferCard.style.minHeight = '350px';
    summary.style.width = '280px';
    const differencePills = summary.querySelectorAll('tbody tr td:nth-child(3) .summary-trend');
    expect(differencePills[1].getBoundingClientRect().top - differencePills[0].getBoundingClientRect().bottom).toBeGreaterThan(0);
    expect(summary.getBoundingClientRect().height).toBeLessThan(180);
    expect(summary.getBoundingClientRect().top - transferCard.getBoundingClientRect().top).toBeLessThan(160);
    summary.style.width = '220px';
    expect(summary.getBoundingClientRect().height).toBeLessThan(190);
    transferCard.style.minHeight = '';
    summary.style.width = '';
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [
        { date: currentRecordDate, total: 11345678, difference: 90000 },
        { date: previousRecordDate, total: 11345678, difference: -75000 },
        { date: earlierRecordDate, total: 10000000, difference: 0 },
        { date: oldestRecordDate, total: 11000000, difference: 0 },
        { date: futureRecordDate, total: 11345678, difference: 90000 }
      ]
    }));
    totalsUpdates.next();
    fixture.detectChanges();
    expect(summary.textContent).toContain(currentMonthLabel);
    expect(summary.textContent).toContain(previousMonthLabel);
    expect(summary.textContent).not.toContain(futureMonthLabel);
    const rows = summary.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('.summary-trend.up')?.getAttribute('aria-label')).toContain('increased by ₹ 90,000');
    expect(rows[1].querySelector('.summary-trend.down')?.getAttribute('aria-label')).toContain('decreased by ₹ 75,000');
    expect(rows[2].querySelector('.summary-trend')?.getAttribute('aria-label')).toContain('unchanged at ₹ 0');
    expect(rows[2].querySelector('.summary-trend')?.textContent).toContain('▬');
    expect(summary.querySelector('thead')?.textContent).toContain('Month change');
    expect(rows[0].querySelector('td:last-child .summary-trend.up')?.getAttribute('aria-label')).toContain('positive ₹ 1,65,000');
    expect(rows[1].querySelector('td:last-child .summary-trend.down')?.getAttribute('aria-label')).toContain('negative ₹ 75,000');
    expect(rows[2].querySelector('td:last-child .summary-trend')?.getAttribute('aria-label')).toContain('previous month difference: ₹ 0');
    expect(summary.querySelector('.overall-changes')?.textContent).toContain('▬');

    const mobileFrame = document.createElement('iframe');
    mobileFrame.style.cssText = 'position: fixed; left: -10000px; width: 320px; height: 800px; border: 0';
    document.body.appendChild(mobileFrame);
    try {
      const mobileDocument = mobileFrame.contentDocument!;
      document.querySelectorAll('style').forEach((style) => mobileDocument.head.appendChild(style.cloneNode(true)));
      const mobileSummary = summary.cloneNode(true) as HTMLElement;
      mobileSummary.style.width = '220px';
      mobileDocument.body.appendChild(mobileSummary);
      const mobileRows = mobileSummary.querySelectorAll('tbody tr');
      const mobileScroll = mobileSummary.querySelector<HTMLElement>('.overall-table-scroll')!;
      const cells = mobileRows[0].querySelectorAll('td');
      expect(mobileRows.length).toBe(3);
      expect(mobileScroll.scrollWidth).toBeLessThanOrEqual(mobileScroll.clientWidth);
      expect(mobileFrame.contentWindow!.getComputedStyle(cells[0], '::before').content).toBe('"Total"');
      expect(mobileFrame.contentWindow!.getComputedStyle(cells[1], '::before').content).toBe('"Difference"');
      expect(mobileFrame.contentWindow!.getComputedStyle(cells[2], '::before').content).toBe('"Month change"');
      expect(cells[1].getBoundingClientRect().top).toBeGreaterThanOrEqual(cells[0].getBoundingClientRect().bottom);
      expect(cells[2].getBoundingClientRect().top).toBeGreaterThanOrEqual(cells[1].getBoundingClientRect().bottom);
    } finally {
      mobileFrame.remove();
    }

    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [{ date: previousRecordDate, total: 0, difference: 0 }]
    }));
    totalsUpdates.next();
    fixture.detectChanges();
    expect(summary.querySelectorAll('tbody tr').length).toBe(1);
    expect(summary.querySelector('tbody')?.textContent).toContain(previousMonthLabel);
    expect(summary.querySelector('tbody')?.textContent).not.toContain(currentMonthLabel);
    expect(summary.querySelector('tbody')?.textContent).toContain('₹ 0');

    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [{ date: futureRecordDate, total: 100, difference: 10 }]
    }));
    totalsUpdates.next();
    fixture.detectChanges();
    expect(summary.querySelector('table')).toBeNull();
    expect(summary.textContent).toContain('No overall balance records in the last three months.');

    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: '', type: '', totalRecords: [{ date: currentRecordDate, total: 100, difference: 10 }]
    }));
    totalsUpdates.next();
    fixture.detectChanges();
    expect(summary.querySelectorAll('tbody tr').length).toBe(1);
    expect(summary.querySelector('tbody')?.textContent).toContain(currentMonthLabel);
    expect(summary.textContent).not.toContain('No earlier month');

    fixture.componentInstance.changeCategory('vasukiSuper');
    fixture.componentInstance.form.patchValue({ date: '2027-01', amount: 1200 });
    fixture.detectChanges();
    const preview: HTMLElement = fixture.nativeElement.querySelector('.overall-preview');
    expect(preview.textContent).toContain('Loading balance history');
    superHistory.next({
      id: '6', name: '', title: '', description: '', type: 'Super',
      gratuityRecords: [{ date: "Dec'26", gratuity: 1000, difference: 100 }]
    });
    fixture.detectChanges();
    expect(preview.textContent).toContain('Dec 2026');
    expect(preview.textContent).toContain('₹ 2,000');
    expect(preview.textContent).toContain('Jan 2027');
    expect(preview.textContent).toContain('₹ 2,200');
    expect(preview.textContent).toContain('Change in overall balance');
    expect(preview.textContent).toContain('Change in monthly difference');
    expect(preview.getBoundingClientRect().height).toBeLessThan(300);

    const amountInput: HTMLInputElement = fixture.nativeElement.querySelector('input[formControlName="amount"]');
    amountInput.value = '900';
    amountInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(preview.textContent).toContain('₹ 1,900');

    const historyOpened = jasmine.createSpy('historyOpened');
    fixture.componentInstance.openHistory.subscribe(historyOpened);
    preview.click();
    expect(historyOpened).not.toHaveBeenCalled();
    fixture.componentInstance.changeCategory(null);
    fixture.detectChanges();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.summary-button');
    expect(buttons.length).toBe(8);
    buttons.forEach((button) => button.click());
    expect(historyOpened.calls.allArgs()).toEqual([
      ['transfer'], ['kumarPf'], ['vasukiPf'], ['kumarGratuity'],
      ['vasukiGratuity'], ['vasukiSuper'], ['kumarSalary'], ['vasukiSalary']
    ]);
    historyOpened.calls.reset();
    const superSummary = buttons[5];
    const superCard = superSummary.closest<HTMLElement>('.record-type-group')!;
    superCard.querySelector<HTMLInputElement>('.toggle-input')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.category).toBe('vasukiSuper');
    expect(historyOpened).not.toHaveBeenCalled();
    superCard.querySelector<HTMLInputElement>('.toggle-input')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.category).toBeNull();
    expect(historyOpened).not.toHaveBeenCalled();
    superCard.querySelector<HTMLElement>('.record-type-group-title')!.click();
    superCard.click();
    expect(historyOpened).not.toHaveBeenCalled();
    superSummary.click();
    expect(historyOpened).toHaveBeenCalledOnceWith('vasukiSuper');
    fixture.componentInstance.isSaving = true;
    fixture.detectChanges();
    superCard.click();
    superSummary.click();
    expect(historyOpened).toHaveBeenCalledTimes(1);
    fixture.destroy();
    fixture.nativeElement.remove();
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