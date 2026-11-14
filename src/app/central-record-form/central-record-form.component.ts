import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { catchError, filter, firstValueFrom, map, Observable, of, startWith, Subscription, switchMap } from 'rxjs';
import { GratuityApiDocument, GratuityRecord } from '../model/gratuity-record';
import { PfApiDocument, PfRecord } from '../model/pf-record';
import { SalaryRecord, salaryMonthKey, salaryMonthLabel } from '../model/salary-record';
import { TransferRecord } from '../model/transfer';
import { TotalRecord } from '../model/total-record';
import { GratuityDataService, GratuityResourceId } from '../service/gratuity-data.service';
import { PfDataService, PfResourceId } from '../service/pf-data.service';
import { SalaryDataService } from '../service/salary-data.service';
import { DashboardRecordRefreshService } from '../service/dashboard-record-refresh.service';
import { TransferService } from '../service/transfer.service';
import { isOverlayOpen } from '../service/escape-dismiss';
import { FormStepperComponent } from '../form-stepper/form-stepper.component';
import { calculateTotals, SourceEntry, TotalBalanceService } from '../service/total-balance.service';

export type RecordCategory = 'transfer' | 'kumarPf' | 'vasukiPf' | 'kumarGratuity' | 'vasukiGratuity' | 'vasukiSuper' | 'kumarSalary' | 'vasukiSalary';
interface ItemSummary { headline: string; detail: string; loading?: boolean; trend?: 'up' | 'down' | 'flat'; change?: string }
interface CategoryOption { value: RecordCategory; label: string; group: string; short: string }
type OverallSummary =
  | { status: 'loading' | 'unavailable' | 'empty' }
  | { status: 'ready'; currentMonth: string; current: TotalRecord | null; previous: TotalRecord | null; previousMonths: TotalRecord[]; monthChanges: Record<string, number> };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthInputToRecordDate(value: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) { throw new Error('Choose a valid month.'); }
  return `${MONTHS[Number(match[2]) - 1]}'${match[1].slice(-2)}`;
}

function monthRecordKey(value: string): string {
  const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value);
  if (!match) { return value; }
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].slice(0, 3).toLowerCase());
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return month < 0 ? value : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function previousMonthKey(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

function findPreviousRecord<T>(records: T[], value: string, recordDate: (record: T) => string): T | undefined {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) { return undefined; }

  for (const offset of [0, 1, 2]) {
    const previous = new Date(Number(match[1]), Number(match[2]) - 1 - offset, 1);
    const key = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    const record = records.find((entry) => monthRecordKey(recordDate(entry)) === key);
    if (record) { return record; }
  }
  return undefined;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function backendDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { throw new Error('Choose a valid date.'); }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Choose a valid date.');
  }
  const [year, month, day] = value.split('-');
  return `${day}-${MONTHS[Number(month) - 1]}-${year.slice(-2)}`;
}

@Component({
  selector: 'app-central-record-form',
  templateUrl: './central-record-form.component.html',
  styleUrls: ['./record-type-picker.scss', './central-record-form.component.scss'],
  standalone: false
})
export class CentralRecordFormComponent implements OnInit, OnDestroy {
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() openHistory = new EventEmitter<RecordCategory>();
  @ViewChild(FormStepperComponent) stepper?: FormStepperComponent;

  readonly categories: CategoryOption[] = [
    { value: 'transfer', label: 'Australia to India transfer', group: 'Transfer', short: 'AUD to INR' },
    { value: 'kumarPf', label: 'Kumar PF', group: 'Provident fund', short: 'Kumar' },
    { value: 'vasukiPf', label: 'Vasuki PF', group: 'Provident fund', short: 'Vasuki' },
    { value: 'kumarGratuity', label: 'Kumar gratuity', group: 'Gratuity', short: 'Kumar' },
    { value: 'vasukiGratuity', label: 'Vasuki gratuity', group: 'Gratuity', short: 'Vasuki' },
    { value: 'vasukiSuper', label: 'Vasuki super', group: 'Super', short: 'Vasuki' },
    { value: 'kumarSalary', label: 'Kumar Australia salary', group: 'Australia salary', short: 'Kumar' },
    { value: 'vasukiSalary', label: 'Vasuki Australia salary', group: 'Australia salary', short: 'Vasuki' }
  ];
  readonly categoryGroups = this.categories.reduce<{ title: string; items: CategoryOption[] }[]>((groups, item) => {
    const group = groups.find((entry) => entry.title === item.group);
    if (group) { group.items.push(item); } else { groups.push({ title: item.group, items: [item] }); }
    return groups;
  }, []);
  category: RecordCategory | null = null;
  summaries: Partial<Record<RecordCategory, ItemSummary>> = {};
  overallSummary: OverallSummary = { status: 'loading' };
  private readonly summarySubscription = new Subscription();
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  hasTriedToReview = false;
  isLoadingPfHistory = false;
  pfHistoryError = '';
  isLoadingGratuityHistory = false;
  gratuityHistoryError = '';
  private pfDocument: PfApiDocument | null = null;
  private pfLoadAttempt = 0;
  private pfDataSubscription?: Subscription;
  private gratuityDocument: GratuityApiDocument | null = null;
  private gratuityLoadAttempt = 0;
  private gratuityDataSubscription?: Subscription;
  private otherBalanceSources: SourceEntry[][] | null = null;
  private otherBalanceSubscription?: Subscription;
  isLoadingOverallPreview = false;
  overallPreviewError = '';
  private readonly formSubscription: Subscription;
  readonly form = new FormGroup({
    date: new FormControl('', { nonNullable: true }),
    amount: new FormControl(0, { nonNullable: true }),
    difference: new FormControl(0, { nonNullable: true }),
    dateOfTransfer: new FormControl('', { nonNullable: true }),
    amountTransferredAUD: new FormControl(0, { nonNullable: true }),
    conversionRate: new FormControl(0, { nonNullable: true }),
    receivedDate: new FormControl('', { nonNullable: true }),
    initialAdvanceRepayment: new FormControl(0, { nonNullable: true }),
    totalSalary: new FormControl(0, { nonNullable: true }),
    ausHealthInsurance: new FormControl(0, { nonNullable: true }),
    ausTax: new FormControl(0, { nonNullable: true }),
    indiaDeduction: new FormControl(0, { nonNullable: true }),
    totalDeduction: new FormControl(0, { nonNullable: true }),
    ausSalary: new FormControl(0, { nonNullable: true })
  });

  constructor(
    private transferService: TransferService,
    private pfDataService: PfDataService,
    private gratuityDataService: GratuityDataService,
    private salaryDataService: SalaryDataService,
    private totalBalanceService: TotalBalanceService,
    private refreshService: DashboardRecordRefreshService,
    private host: ElementRef<HTMLElement>,
    private changeDetector: ChangeDetectorRef
  ) {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.syncPfDifference();
      this.syncGratuityDifference();
    });
  }

  ngOnInit(): void {
    this.loadOverallSummary();
    this.loadSummary(() => this.transferService.getTransfers(), this.transferService.transferUpdated$, 'transfer', (transfers) => {
      if (!transfers.length) { return { headline: 'No records', detail: '' }; }
      const sent = transfers.reduce((sum, record) => sum + record.amountTransferredAUD, 0);
      const received = transfers.reduce((sum, record) => sum + record.amountReceivedINR, 0);
      return {
        headline: this.formatReviewCurrency(received, 'INR'),
        detail: `${this.formatReviewCurrency(sent, 'AUD')} sent · ${transfers.length} transfers`
      };
    });
    const pfIds: [RecordCategory, PfResourceId][] = [['kumarPf', '2'], ['vasukiPf', '3']];
    for (const [category, id] of pfIds) {
      this.loadSummary(() => this.pfDataService.getPfData(id), this.pfDataService.pfUpdated$.pipe(filter((updatedId) => updatedId === id)), category, (document) =>
        this.balanceSummary(document.pfRecords.map((r) => ({ date: r.date, amount: r.pfAmount, difference: r.difference })), 'INR'));
    }
    const gratuityIds: [RecordCategory, GratuityResourceId][] = [['kumarGratuity', '4'], ['vasukiGratuity', '5'], ['vasukiSuper', '6']];
    for (const [category, id] of gratuityIds) {
      this.loadSummary(() => this.gratuityDataService.getGratuityData(id), this.gratuityDataService.gratuityUpdated$.pipe(filter((updatedId) => updatedId === id)), category, (document) =>
        this.balanceSummary(document.gratuityRecords.map((r) => ({ date: r.date, amount: r.gratuity, difference: r.difference })), 'INR'));
    }
    const salaryIds: [RecordCategory, 'salary8' | 'salary9'][] = [['kumarSalary', 'salary8'], ['vasukiSalary', 'salary9']];
    for (const [category, key] of salaryIds) {
      this.loadSummary(() => this.salaryDataService.getSalaryData(key === 'salary8' ? '8' : '9'), this.salaryDataService.salaryUpdated$, category, (document) => {
        const sorted = [...document.salaryRecords].sort((a, b) => salaryMonthKey(b.date).localeCompare(salaryMonthKey(a.date)));
        const [latest, previous] = sorted;
        if (!latest) { return { headline: 'No records', detail: '' }; }
        const summary: ItemSummary = { headline: this.formatReviewCurrency(latest.ausSalary, 'AUD'), detail: `${salaryMonthLabel(latest.date)} salary` };
        return previous ? { ...summary, ...this.trendOf(latest.ausSalary - previous.ausSalary, 'AUD') } : summary;
      });
    }
  }

  private loadOverallSummary(): void {
    this.summarySubscription.add(this.totalBalanceService.totalsUpdated$.pipe(
      startWith(null),
      switchMap(() => this.totalBalanceService.getTotals().pipe(
        map((document): OverallSummary => {
          const records = document.totalRecords.map((record) => {
            if (!record || typeof record.date !== 'string' || !Number.isFinite(record.total) || !Number.isFinite(record.difference)) {
              throw new Error('Invalid overall balance record.');
            }
            const date = monthRecordKey(record.date);
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) {
              throw new Error('Invalid overall balance month.');
            }
            return { ...record, date };
          }).sort((a, b) => b.date.localeCompare(a.date));
          if (!records.length) { return { status: 'empty' }; }
          const month = currentMonthKey();
          const current = records.find((record) => record.date === month) ?? null;
          const [year, monthNumber] = month.split('-').map(Number);
          const previousMonths = [1, 2].map((offset) => {
            const date = new Date(year, monthNumber - 1 - offset, 1);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          }).map((previousMonth) => records.find((record) => record.date === previousMonth))
            .filter((record): record is TotalRecord => record !== undefined);
          const monthChanges: Record<string, number> = {};
          for (const record of [current, ...previousMonths]) {
            if (!record) { continue; }
            const previousRecord = records.find((candidate) => candidate.date === previousMonthKey(record.date));
            if (previousRecord) { monthChanges[record.date] = record.difference - previousRecord.difference; }
          }
          return { status: 'ready', currentMonth: month, current, previous: previousMonths[0] ?? null, previousMonths, monthChanges };
        }),
        catchError(() => of<OverallSummary>({ status: 'unavailable' })),
        startWith<OverallSummary>({ status: 'loading' })
      ))
    ).subscribe((summary) => {
      this.overallSummary = summary;
      this.changeDetector.markForCheck();
    }));
  }

  summaryFor(category: string): ItemSummary {
    return this.summaries[category as RecordCategory] ?? { headline: '', detail: '', loading: true };
  }

  private loadSummary<T>(source: () => Observable<T>, updates: Observable<unknown>, category: RecordCategory, build: (data: T) => ItemSummary): void {
    this.summarySubscription.add(updates.pipe(
      startWith(null),
      switchMap(() => source().pipe(
        map(build),
        catchError(() => of<ItemSummary>({ headline: '—', detail: 'Unavailable' }))
      ))
    ).subscribe((summary) => {
      this.summaries = { ...this.summaries, [category]: summary };
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    }));
  }

  private balanceSummary(records: { date: string; amount: number; difference: number }[], currency: 'AUD' | 'INR'): ItemSummary {
    const latest = records.reduce<typeof records[number] | null>(
      (best, record) => !best || monthRecordKey(record.date) > monthRecordKey(best.date) ? record : best, null);
    if (!latest) { return { headline: 'No records', detail: '' }; }
    return {
      headline: this.formatReviewCurrency(latest.amount, currency),
      detail: `${this.formatReviewMonth(monthRecordKey(latest.date))} vs prev. month`,
      ...this.trendOf(latest.difference, currency)
    };
  }

  trendOf(difference: number, currency: 'AUD' | 'INR'): Pick<ItemSummary, 'trend' | 'change'> {
    return {
      trend: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
      change: this.formatReviewCurrency(Math.abs(difference), currency)
    };
  }

  ngOnDestroy(): void {
    this.summarySubscription.unsubscribe();
    this.pfLoadAttempt++;
    this.pfDataSubscription?.unsubscribe();
    this.gratuityLoadAttempt++;
    this.gratuityDataSubscription?.unsubscribe();
    this.otherBalanceSubscription?.unsubscribe();
    this.formSubscription.unsubscribe();
  }

  get selectedCategoryLabel(): string {
    return this.categories.find((item) => item.value === this.category)?.label ?? '';
  }
  get isTransfer(): boolean { return this.category === 'transfer'; }
  get isSalary(): boolean { return this.category === 'kumarSalary' || this.category === 'vasukiSalary'; }
  get isBalanceRecord(): boolean { return this.category === 'kumarPf' || this.category === 'vasukiPf'; }
  get isGratuityRecord(): boolean { return this.category === 'kumarGratuity' || this.category === 'vasukiGratuity' || this.category === 'vasukiSuper'; }
  get isVasukiSalary(): boolean { return this.category === 'vasukiSalary'; }
  get monthlyDifferenceLabel(): string {
    return this.isBalanceRecord || this.isGratuityRecord ? 'Monthly difference (INR)' : 'Monthly difference';
  }

  get superOverallPreview(): { previous: TotalRecord; current: TotalRecord; previousMonth: string; currentMonth: string } | null {
    const date = this.form.controls.date.value;
    const amount = this.form.controls.amount.value;
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(date);
    if (this.category !== 'vasukiSuper' || !match || !this.otherBalanceSources || !this.gratuityDocument
        || !Number.isFinite(amount) || amount < 0
        || this.gratuityDocument.gratuityRecords.some((record) => monthRecordKey(record.date) === date)) {
      return null;
    }

    const previousMonth = previousMonthKey(date);
    if (!this.gratuityDocument.gratuityRecords.some((record) => monthRecordKey(record.date) === previousMonth)) {
      return null;
    }
    const superEntries: SourceEntry[] = this.gratuityDocument.gratuityRecords.map((record) => ({
      date: record.date, amount: record.gratuity, difference: record.difference
    }));
    superEntries.push({
      date: monthInputToRecordDate(date),
      amount,
      difference: this.form.controls.difference.value
    });
    const totals = calculateTotals([...this.otherBalanceSources, superEntries]);
    const current = totals.find((record) => monthRecordKey(record.date) === date);
    const previous = totals.find((record) => monthRecordKey(record.date) === previousMonth);
    return current && previous ? { current, previous, currentMonth: date, previousMonth } : null;
  }
  get receivedAmount(): number {
    const { amountTransferredAUD, conversionRate } = this.form.getRawValue();
    return Math.round(amountTransferredAUD * conversionRate * 100) / 100;
  }

  get canReview(): boolean {
    try {
      this.validateSelectedFields();
      return true;
    } catch {
      return false;
    }
  }

  get validationErrorMessage(): string {
    if (!this.hasTriedToReview) { return ''; }
    try {
      this.validateSelectedFields();
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Check the record details.';
    }
  }

  get reviewFields(): { label: string; value: string }[] {
    const value = this.form.getRawValue();
    const fields: { label: string; value: string }[] = [];
    const addAmount = (label: string, number: number, currency: 'AUD' | 'INR') =>
      fields.push({ label, value: this.formatReviewCurrency(number, currency) });
    const addMonth = (label = 'Month') => fields.push({ label, value: this.formatReviewMonth(value.date) });

    if (this.isTransfer) {
      fields.push({ label: 'Transfer Date', value: this.formatReviewDate(value.dateOfTransfer) });
      addAmount('Amount Sent', value.amountTransferredAUD, 'AUD');
      fields.push({
        label: 'Exchange Rate',
        value: new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4 }).format(value.conversionRate)
      });
      fields.push({ label: 'Received Date', value: this.formatReviewDate(value.receivedDate) });
      addAmount('Amount Received', this.receivedAmount, 'INR');
      return fields;
    }

    if (this.isBalanceRecord) {
      addMonth();
      addAmount('PF Balance', value.amount, 'INR');
      addAmount('Monthly Difference', value.difference, 'INR');
      return fields;
    }

    if (this.isGratuityRecord) {
      addMonth();
      addAmount(this.category === 'vasukiSuper' ? 'Super Balance' : 'Gratuity', value.amount, 'INR');
      addAmount('Monthly Difference', value.difference, 'INR');
      return fields;
    }

    addMonth();
    addAmount('Initial Advance Repayment', value.initialAdvanceRepayment, 'AUD');
    addAmount('Total Salary', value.totalSalary, 'AUD');
    if (this.isVasukiSalary) { addAmount('Australian Health Insurance', value.ausHealthInsurance, 'AUD'); }
    addAmount('Australian Tax', value.ausTax, 'AUD');
    addAmount('India Deduction', value.indiaDeduction, 'AUD');
    addAmount('Total Deduction', value.totalDeduction, 'AUD');
    addAmount('Australian Salary', value.ausSalary, 'AUD');
    return fields;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isSaving && !isOverlayOpen()) {
      this.cancel.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.isSaving && event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  toggleCategory(value: string, isOn: boolean): void {
    if (isOn) {
      this.changeCategory(value);
    } else if (this.category === value) {
      this.changeCategory(null);
    }
  }

  changeCategory(value: string | null): void {
    if (value !== null && !this.categories.some((item) => item.value === value)) { return; }
    this.pfLoadAttempt++;
    this.pfDataSubscription?.unsubscribe();
    this.gratuityLoadAttempt++;
    this.gratuityDataSubscription?.unsubscribe();
    this.otherBalanceSubscription?.unsubscribe();
    this.pfDocument = null;
    this.isLoadingPfHistory = false;
    this.pfHistoryError = '';
    this.gratuityDocument = null;
    this.isLoadingGratuityHistory = false;
    this.gratuityHistoryError = '';
    this.otherBalanceSources = null;
    this.isLoadingOverallPreview = false;
    this.overallPreviewError = '';
    this.category = value as RecordCategory | null;
    this.form.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.hasTriedToReview = false;
    if (!this.category) { return; }
    if (this.isBalanceRecord) {
      this.loadPfHistory(this.category === 'kumarPf' ? '2' : '3');
    } else if (this.isGratuityRecord) {
      const resourceId: GratuityResourceId = this.category === 'kumarGratuity' ? '4' : this.category === 'vasukiGratuity' ? '5' : '6';
      this.loadGratuityHistory(resourceId);
      if (this.category === 'vasukiSuper') {
        this.loadOverallPreviewSources();
      }
    }
    this.focusFirstField();
  }

  private focusFirstField(): void {
    setTimeout(() => {
      const field = this.host.nativeElement.querySelector<HTMLElement>(
        '.form-grid .form-field input:not([readonly]), .form-grid .form-field button'
      );
      if (!field) { return; }
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  onInvalidNext(): void {
    this.hasTriedToReview = true;
  }

  async submit(): Promise<void> {
    if (this.isSaving) { return; }
    try {
      this.validateSelectedFields();
    } catch {
      this.hasTriedToReview = true;
      return;
    }
    this.errorMessage = '';
    this.isSaving = true;
    try {
      await this.saveSelectedRecord();
      this.refreshService.notifyUpdated(!this.isSalary);
      this.changeCategory(null);
      this.stepper?.goTo(0);
      this.successMessage = 'Record added successfully.';
      const modal = this.host.nativeElement.querySelector<HTMLElement>('.central-form-modal');
      if (modal) { modal.scrollTop = 0; }
      this.saved.emit();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to save this record.';
    } finally {
      this.isSaving = false;
    }
  }

  private async saveSelectedRecord(): Promise<void> {
    this.validateSelectedFields();
    const value = this.form.getRawValue();
    if (this.isTransfer) {
      const dateOfTransfer = backendDate(value.dateOfTransfer);
      const receivedDate = backendDate(value.receivedDate);
      const transfers = await firstValueFrom(this.transferService.getTransfers());
      const record: TransferRecord = {
        dateOfTransfer,
        amountTransferredAUD: value.amountTransferredAUD,
        conversionRate: value.conversionRate,
        receivedDate,
        amountReceivedINR: this.receivedAmount
      };
      await firstValueFrom(this.transferService.updateTransfers([...transfers, record]));
      return;
    }

    const date = monthRecordKey(monthInputToRecordDate(value.date));
    if (this.isBalanceRecord) {
      const resourceId: PfResourceId = this.category === 'kumarPf' ? '2' : '3';
      const document = await firstValueFrom(this.pfDataService.getPfData(resourceId));
      if (document.pfRecords.some((record) => monthRecordKey(record.date) === date)) {
        throw new Error('A PF record already exists for this month.');
      }
      const record: PfRecord = { date: monthInputToRecordDate(value.date), pfAmount: value.amount, difference: value.difference };
      await firstValueFrom(this.pfDataService.updatePfData({ ...document, pfRecords: [record, ...document.pfRecords] }, resourceId));
      return;
    }

    if (this.isGratuityRecord) {
      const resourceId: GratuityResourceId = this.category === 'kumarGratuity' ? '4' : this.category === 'vasukiGratuity' ? '5' : '6';
      const document = this.gratuityDocument;
      if (!document) { throw new Error('Unable to load previous gratuity records. Try selecting the owner again.'); }
      if (document.gratuityRecords.some((record) => monthRecordKey(record.date) === date)) {
        throw new Error('A record already exists for this month.');
      }
      const record: GratuityRecord = { date: monthInputToRecordDate(value.date), gratuity: value.amount, difference: value.difference };
      await firstValueFrom(this.gratuityDataService.updateGratuityData({ ...document, gratuityRecords: [record, ...document.gratuityRecords] }, resourceId));
      return;
    }

    const resourceId = this.category === 'kumarSalary' ? '8' : '9';
    const document = await firstValueFrom(this.salaryDataService.getSalaryData(resourceId));
    if (document.salaryRecords.some((record) => salaryMonthKey(record.date) === value.date)) {
      throw new Error('A salary record already exists for this month.');
    }
    const record: SalaryRecord = {
      date: salaryMonthLabel(value.date),
      initialAdvanceRepayment: value.initialAdvanceRepayment,
      totalSalary: value.totalSalary,
      ausTax: value.ausTax,
      indiaDeduction: value.indiaDeduction,
      totalDeduction: value.totalDeduction,
      ausSalary: value.ausSalary,
      ...(this.isVasukiSalary ? { ausHealthInsurance: value.ausHealthInsurance } : {})
    };
    await firstValueFrom(this.salaryDataService.updateSalaryData({ ...document, salaryRecords: [record, ...document.salaryRecords] }, resourceId));
  }

  private requireAmounts(values: number[], minimum?: number): void {
    if (values.some((value) => !Number.isFinite(value) || (minimum !== undefined && value < minimum))) {
      throw new Error(minimum === undefined ? 'Enter a valid amount for every field.' : 'Enter valid amounts and a positive exchange rate.');
    }
  }

  private validateSelectedFields(): void {
    if (!this.category) { throw new Error('Please toggle a record type to add the form fields.'); }
    const value = this.form.getRawValue();
    if (this.isTransfer) {
      backendDate(value.dateOfTransfer);
      backendDate(value.receivedDate);
      this.requireAmounts([value.amountTransferredAUD], 0);
      this.requireAmounts([value.conversionRate], 0.0001);
      return;
    }

    monthInputToRecordDate(value.date);
    if (this.isBalanceRecord) {
      if (this.isLoadingPfHistory) { throw new Error('Loading previous PF records. Please wait.'); }
      if (!this.pfDocument) {
        throw new Error(this.pfHistoryError || 'Unable to load previous PF records. Try selecting the PF owner again.');
      }
      this.requireAmounts([value.amount], 0);
      this.requireAmounts([value.difference]);
      return;
    }

    if (this.isGratuityRecord) {
      if (this.isLoadingGratuityHistory) { throw new Error('Loading previous gratuity records. Please wait.'); }
      if (!this.gratuityDocument) {
        throw new Error(this.gratuityHistoryError || 'Unable to load previous gratuity records. Try selecting the owner again.');
      }
      this.requireAmounts([value.amount], 0);
      this.requireAmounts([value.difference]);
      return;
    }

    salaryMonthLabel(value.date);
    const salaryFields = [value.initialAdvanceRepayment, value.totalSalary, value.ausTax, value.indiaDeduction, value.totalDeduction, value.ausSalary];
    this.requireAmounts(this.isVasukiSalary ? [...salaryFields, value.ausHealthInsurance] : salaryFields);
  }

  formatReviewMonth(value: string): string {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value || 'Not set';
  }

  private formatReviewDate(value: string): string {
    const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
    return match ? `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value || 'Not set';
  }

  formatReviewCurrency(value: number, currency: 'AUD' | 'INR'): string {
    return new Intl.NumberFormat(currency === 'AUD' ? 'en-AU' : 'en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'AUD' ? 2 : 0,
      maximumFractionDigits: currency === 'AUD' ? 2 : 2
    }).format(value).replace('₹', '₹ ');
  }

  private loadOverallPreviewSources(): void {
    this.isLoadingOverallPreview = true;
    this.otherBalanceSubscription = this.totalBalanceService.getOtherBalanceSources().subscribe({
      next: (sources) => {
        this.otherBalanceSources = sources;
        this.isLoadingOverallPreview = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.isLoadingOverallPreview = false;
        this.overallPreviewError = 'Unable to load overall balance data. Select Super again to retry.';
        this.changeDetector.markForCheck();
      }
    });
  }

  private loadPfHistory(resourceId: PfResourceId): void {
    const attempt = ++this.pfLoadAttempt;
    const cachedDocument = this.pfDataService.getCachedPfData(resourceId);
    if (cachedDocument) {
      this.pfDocument = cachedDocument;
      this.isLoadingPfHistory = false;
      this.pfHistoryError = '';
      this.syncPfDifference();
      return;
    }

    this.isLoadingPfHistory = true;
    this.pfDataSubscription = this.pfDataService.getPfData(resourceId).subscribe({
      next: (document) => {
        if (attempt !== this.pfLoadAttempt) { return; }
        this.pfDocument = document;
        this.isLoadingPfHistory = false;
        this.pfHistoryError = '';
        this.syncPfDifference();
      },
      error: () => {
        if (attempt !== this.pfLoadAttempt) { return; }
        this.isLoadingPfHistory = false;
        this.pfHistoryError = 'Unable to load previous PF records. Try selecting the PF owner again.';
      }
    });
  }

  private syncPfDifference(): void {
    if (!this.isBalanceRecord) { return; }
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(this.form.controls.date.value);
    if (!match || !this.pfDocument) {
      this.form.controls.difference.setValue(0, { emitEvent: false });
      return;
    }

    const previousRecord = findPreviousRecord(this.pfDocument.pfRecords, this.form.controls.date.value, (record) => record.date);
    const difference = previousRecord ? this.form.controls.amount.value - previousRecord.pfAmount : 0;
    this.form.controls.difference.setValue(difference, { emitEvent: false });
  }

  private loadGratuityHistory(resourceId: GratuityResourceId): void {
    const attempt = ++this.gratuityLoadAttempt;
    const cachedDocument = this.gratuityDataService.getCachedGratuityData(resourceId);
    if (cachedDocument) {
      this.gratuityDocument = cachedDocument;
      this.isLoadingGratuityHistory = false;
      this.gratuityHistoryError = '';
      this.syncGratuityDifference();
      return;
    }

    this.isLoadingGratuityHistory = true;
    this.gratuityDataSubscription = this.gratuityDataService.getGratuityData(resourceId).subscribe({
      next: (document) => {
        if (attempt !== this.gratuityLoadAttempt) { return; }
        this.gratuityDocument = document;
        this.isLoadingGratuityHistory = false;
        this.gratuityHistoryError = '';
        this.syncGratuityDifference();
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (attempt !== this.gratuityLoadAttempt) { return; }
        this.isLoadingGratuityHistory = false;
        this.gratuityHistoryError = 'Unable to load previous gratuity records. Try selecting the owner again.';
        this.changeDetector.markForCheck();
      }
    });
  }

  private syncGratuityDifference(): void {
    if (!this.isGratuityRecord) { return; }
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(this.form.controls.date.value);
    if (!match || !this.gratuityDocument) {
      this.form.controls.difference.setValue(0, { emitEvent: false });
      return;
    }

    const previousRecord = findPreviousRecord(this.gratuityDocument.gratuityRecords, this.form.controls.date.value, (record) => record.date);
    const previousValue = previousRecord?.gratuity ?? 0;
    this.form.controls.difference.setValue(this.form.controls.amount.value - previousValue, { emitEvent: false });
  }
}