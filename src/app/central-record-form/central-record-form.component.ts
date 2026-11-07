import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom, Observable, Subscription } from 'rxjs';
import { GratuityApiDocument, GratuityRecord } from '../model/gratuity-record';
import { PfApiDocument, PfRecord } from '../model/pf-record';
import { SalaryRecord, salaryMonthKey, salaryMonthLabel } from '../model/salary-record';
import { TransferRecord } from '../model/transfer';
import { GratuityDataService, GratuityResourceId } from '../service/gratuity-data.service';
import { PfDataService, PfResourceId } from '../service/pf-data.service';
import { SalaryDataService } from '../service/salary-data.service';
import { DashboardRecordRefreshService } from '../service/dashboard-record-refresh.service';
import { TransferService } from '../service/transfer.service';
import { isOverlayOpen } from '../service/escape-dismiss';

type RecordCategory = 'transfer' | 'kumarPf' | 'vasukiPf' | 'kumarGratuity' | 'vasukiGratuity' | 'vasukiSuper' | 'kumarSalary' | 'vasukiSalary';
interface ItemSummary { headline: string; detail: string; loading?: boolean; trend?: 'up' | 'down' | 'flat'; change?: string }
interface CategoryOption { value: RecordCategory; label: string; group: string; short: string }

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
  private readonly summarySubscription = new Subscription();
  isSaving = false;
  errorMessage = '';
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
    this.loadSummary(this.transferService.getTransfers(), 'transfer', (transfers) => {
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
      this.loadSummary(this.pfDataService.getPfData(id), category, (document) =>
        this.balanceSummary(document.pfRecords.map((r) => ({ date: r.date, amount: r.pfAmount, difference: r.difference })), 'INR'));
    }
    const gratuityIds: [RecordCategory, GratuityResourceId][] = [['kumarGratuity', '4'], ['vasukiGratuity', '5'], ['vasukiSuper', '6']];
    for (const [category, id] of gratuityIds) {
      this.loadSummary(this.gratuityDataService.getGratuityData(id), category, (document) =>
        this.balanceSummary(document.gratuityRecords.map((r) => ({ date: r.date, amount: r.gratuity, difference: r.difference })), 'INR'));
    }
    const salaryIds: [RecordCategory, 'salary8' | 'salary9'][] = [['kumarSalary', 'salary8'], ['vasukiSalary', 'salary9']];
    for (const [category, key] of salaryIds) {
      this.loadSummary(this.salaryDataService.getSalaryData(key === 'salary8' ? '8' : '9'), category, (document) => {
        const sorted = [...document.salaryRecords].sort((a, b) => salaryMonthKey(b.date).localeCompare(salaryMonthKey(a.date)));
        const [latest, previous] = sorted;
        if (!latest) { return { headline: 'No records', detail: '' }; }
        const summary: ItemSummary = { headline: this.formatReviewCurrency(latest.ausSalary, 'AUD'), detail: `${salaryMonthLabel(latest.date)} salary` };
        return previous ? { ...summary, ...this.trendOf(latest.ausSalary - previous.ausSalary, 'AUD') } : summary;
      });
    }
  }

  summaryFor(category: string): ItemSummary {
    return this.summaries[category as RecordCategory] ?? { headline: '', detail: '', loading: true };
  }

  private loadSummary<T>(source: Observable<T>, category: RecordCategory, build: (data: T) => ItemSummary): void {
    const set = (summary: ItemSummary) => { this.summaries = { ...this.summaries, [category]: summary };
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    };
    this.summarySubscription.add(source.subscribe({
      next: (data) => {
        try { set(build(data)); } catch { set({ headline: '—', detail: 'Unavailable' }); }
      },
      error: () => set({ headline: '—', detail: 'Unavailable' })
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

  private trendOf(difference: number, currency: 'AUD' | 'INR'): Pick<ItemSummary, 'trend' | 'change'> {
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
    this.pfDocument = null;
    this.isLoadingPfHistory = false;
    this.pfHistoryError = '';
    this.gratuityDocument = null;
    this.isLoadingGratuityHistory = false;
    this.gratuityHistoryError = '';
    this.category = value as RecordCategory | null;
    this.form.reset();
    this.errorMessage = '';
    this.hasTriedToReview = false;
    if (!this.category) { return; }
    if (this.isBalanceRecord) {
      this.loadPfHistory(this.category === 'kumarPf' ? '2' : '3');
    } else if (this.isGratuityRecord) {
      const resourceId: GratuityResourceId = this.category === 'kumarGratuity' ? '4' : this.category === 'vasukiGratuity' ? '5' : '6';
      this.loadGratuityHistory(resourceId);
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

  private formatReviewMonth(value: string): string {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value || 'Not set';
  }

  private formatReviewDate(value: string): string {
    const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
    return match ? `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value || 'Not set';
  }

  private formatReviewCurrency(value: number, currency: 'AUD' | 'INR'): string {
    return new Intl.NumberFormat(currency === 'AUD' ? 'en-AU' : 'en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'AUD' ? 2 : 0,
      maximumFractionDigits: currency === 'AUD' ? 2 : 2
    }).format(value).replace('₹', '₹ ');
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

    const previousMonth = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    const previousKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
    const previousRecord = this.pfDocument.pfRecords.find((record) => monthRecordKey(record.date) === previousKey);
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
      },
      error: () => {
        if (attempt !== this.gratuityLoadAttempt) { return; }
        this.isLoadingGratuityHistory = false;
        this.gratuityHistoryError = 'Unable to load previous gratuity records. Try selecting the owner again.';
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

    const previousMonth = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    const previousKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
    const previousRecord = this.gratuityDocument.gratuityRecords.find((record) => monthRecordKey(record.date) === previousKey);
    const previousValue = previousRecord?.gratuity ?? 0;
    this.form.controls.difference.setValue(this.form.controls.amount.value - previousValue, { emitEvent: false });
  }
}