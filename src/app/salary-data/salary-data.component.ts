import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Subscription, forkJoin, map } from 'rxjs';
import { SALARY_FIELDS, SalaryApiDocument, SalaryField, SalaryRecord, SalaryResourceId, salaryFields, salaryMonthKey, salaryMonthLabel } from '../model/salary-record';
import { CHART_TYPE_OPTIONS, ChartType, chartColorScheme, formatCompactAxisValue, isChartType, toLineChartSeries } from '../model/chart-type';
import { memoizeLast } from '../model/memoize';
import { ResponsiveGridColumn, ResponsiveGridRow } from '../responsive-table/responsive-table.component';
import { SalaryDataService } from '../service/salary-data.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { announceAccordionOpened, collapseWhenAnotherOpens } from '../service/accordion-group';
import { combineSalaryRecords } from '../model/combined-salary';

const finiteAmount: ValidatorFn = (control) =>
  typeof control.value === 'number' && Number.isFinite(control.value) ? null : { invalidAmount: true };
const amountControl = () => new FormControl(0, { nonNullable: true, validators: [Validators.required, finiteAmount] });

@Component({
  selector: 'app-salary-data',
  templateUrl: './salary-data.component.html',
  styleUrls: ['../kumar-gratuity/kumar-gratuity.component.scss', '../widget-preview-chart/widget-preview-slider.scss', './salary-data.component.scss'],
  standalone: false
})
export class SalaryDataComponent implements OnInit, OnDestroy {
  @Input() resourceId: SalaryResourceId = '8';
  @Input() ownerName = 'Kumar';
  @Input() combined = false;
  readonly editForm = new FormGroup({
    date: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)] }),
    initialAdvanceRepayment: amountControl(),
    totalSalary: amountControl(),
    ausHealthInsurance: amountControl(),
    ausTax: amountControl(),
    indiaDeduction: amountControl(),
    totalDeduction: amountControl(),
    ausSalary: amountControl()
  });
  readonly confirmationCode = new FormControl('', {
    nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{14}$/)]
  });
  readonly chartTypes = CHART_TYPE_OPTIONS;
  readonly formatAxis = formatCompactAxisValue;
  readonly formatAmount = (value: number) => new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);
  readonly monthLabel = salaryMonthLabel;
  data: SalaryApiDocument | null = null;
  isLoading = false;
  isSaving = false;
  isExpanded = false;
  areRecordsExpanded = false;
  errorMessage = '';
  saveError = '';
  toastMessage = '';
  selectedField: SalaryField = 'ausSalary';
  chartType: ChartType = 'bar';
  previewRangeCount: number | null = null;
  rangeFrom: number | null = null;
  rangeTo: number | null = null;
  rangeError = '';
  selectedColumns: readonly SalaryField[] = ['ausSalary'];
  isAdding = false;
  editingIndex: number | null = null;
  deletingIndex: number | null = null;
  isCodeVerifying = false;
  isCodeVerified = false;
  isCodeIncorrect = false;
  private verifiedCode = '';
  private codeAttempt = 0;
  private destroyed = false;
  private readonly subscriptions = new Subscription();
  private loadSubscription?: Subscription;
  private sourceDocuments: SalaryApiDocument[] = [];
  private readonly accordionSubscription = collapseWhenAnotherOpens(
    () => this.widgetId, () => {
      if (!this.isExpanded) { return; }
      this.isExpanded = false;
      this.areRecordsExpanded = false;
      this.previewRangeCount = null;
      this.changeDetector.detectChanges();
    }
  );
  private readonly buildChart = memoizeLast((records: SalaryRecord[], field: SalaryField) =>
    [...records].sort((a, b) => salaryMonthKey(a.date).localeCompare(salaryMonthKey(b.date)))
      .map((record) => ({ name: salaryMonthLabel(record.date), value: record[field] ?? 0 })));
  private readonly buildColors = memoizeLast(chartColorScheme);
  private readonly buildLine = memoizeLast(toLineChartSeries);
  private readonly buildRows = memoizeLast((records: SalaryRecord[], from: string, to: string): ResponsiveGridRow[] =>
    records.map((record, actionIndex) => ({
      ...record, date: salaryMonthLabel(record.date), actionIndex
    })).filter((row) => {
      const month = salaryMonthKey(row.date);
      return month >= from && month <= to;
    }));
  private readonly buildBounds = memoizeLast((records: SalaryRecord[]) => {
    const months = records.map(({ date }) => salaryMonthKey(date)).sort();
    return { min: months[0] ?? '', max: months[months.length - 1] ?? '' };
  });
  private readonly filterRecords = memoizeLast((records: SalaryRecord[], from: string, to: string) =>
    records.filter(({ date }) => {
      const month = salaryMonthKey(date);
      return month >= from && month <= to;
    }));
  private readonly sumRecords = memoizeLast((records: SalaryRecord[]) => records.reduce((totals, record) => ({
    credited: totals.credited + record.ausSalary,
    gross: totals.gross + record.totalSalary,
    deductions: totals.deductions + record.totalDeduction
  }), { credited: 0, gross: 0, deductions: 0 }));
  private readonly buildFields = memoizeLast(salaryFields);
  private readonly buildViews = memoizeLast((resourceId: SalaryResourceId) =>
    salaryFields(resourceId).map(({ key, label }) => ({ value: key, label })));
  private readonly buildColumns = memoizeLast((resourceId: SalaryResourceId, readOnly: boolean, selected: readonly SalaryField[]): ResponsiveGridColumn[] => [
    { key: 'date', label: 'Month', sortable: true },
    ...salaryFields(resourceId).map(({ key, label }) => ({
      key, label, numeric: true, sortable: true,
      hiddenOnDesktop: key !== 'totalSalary' && key !== 'ausTax' && !selected.includes(key)
    })),
    ...(!readOnly ? [{ key: 'actions', label: 'Actions', actions: true }] : [])
  ]);
  private readonly buildBreakdown = memoizeLast((documents: SalaryApiDocument[], from: string, to: string): ResponsiveGridRow[] =>
    documents.flatMap((document) => document.salaryRecords
      .filter(({ date }) => salaryMonthKey(date) >= from && salaryMonthKey(date) <= to)
      .map((record) => ({
        ...record, date: salaryMonthLabel(record.date),
        owner: document.id === '8' ? 'Kumar' : 'Vasuki',
        ausHealthInsurance: record.ausHealthInsurance ?? 0
      }))));
  private readonly buildBreakdownColumns = memoizeLast((columns: ResponsiveGridColumn[]): ResponsiveGridColumn[] => [
    columns[0], { key: 'owner', label: 'Owner', sortable: true }, ...columns.slice(1)
  ]);
  private readonly emptyRecords: SalaryRecord[] = [];

  constructor(
    private salaryService: SalaryDataService,
    private confirmationService: ConfirmationCodeService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
    if (this.combined) {
      this.subscriptions.add(this.salaryService.salaryUpdated$.subscribe(() => this.loadData()));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.codeAttempt++;
    this.subscriptions.unsubscribe();
    this.loadSubscription?.unsubscribe();
    this.accordionSubscription.unsubscribe();
  }

  get widgetId(): string { return this.combined ? 'salary-combined' : `salary-${this.resourceId}`; }
  get title(): string { return `${this.combined ? 'Combined' : this.ownerName} Australia Salary`; }
  get fields() { return this.buildFields(this.combined ? '9' : this.resourceId); }
  get records(): SalaryRecord[] { return this.data?.salaryRecords ?? this.emptyRecords; }
  get views() { return this.buildViews(this.combined ? '9' : this.resourceId); }
  get selectedLabel(): string { return SALARY_FIELDS.find(({ key }) => key === this.selectedField)!.label; }
  get chartData() { return this.buildChart(this.isExpanded ? this.filteredRecords : this.records, this.selectedField); }
  get colors() { return this.buildColors(this.chartData, this.widgetId); }
  get lineData() { return this.buildLine(this.chartData, this.selectedLabel); }
  get gridRows() { return this.buildRows(this.records, this.fromMonth, this.toMonth); }
  get gridColumns(): ResponsiveGridColumn[] {
    return this.buildColumns(this.combined ? '9' : this.resourceId, this.combined, this.selectedColumns);
  }
  get breakdownColumns() { return this.buildBreakdownColumns(this.gridColumns); }
  get visibleColumnCount(): number { return this.gridColumns.filter(({ hiddenOnDesktop }) => !hiddenOnDesktop).length; }
  get tableMinWidth(): string { return `${this.visibleColumnCount * 17}rem`; }
  get breakdownMinWidth(): string { return `${(this.visibleColumnCount + 1) * 17}rem`; }
  isRequiredColumn(key: SalaryField): boolean { return key === 'totalSalary' || key === 'ausTax'; }
  isColumnSelected(key: SalaryField): boolean { return this.isRequiredColumn(key) || this.selectedColumns.includes(key); }
  toggleColumn(key: SalaryField): void {
    if (this.isRequiredColumn(key)) { return; }
    this.selectedColumns = this.selectedColumns.includes(key)
      ? this.selectedColumns.filter((column) => column !== key) : [...this.selectedColumns, key];
  }
  get breakdownRows() { return this.buildBreakdown(this.sourceDocuments, this.fromMonth, this.toMonth); }
  get dateBounds() { return this.buildBounds(this.records); }
  get rangeMax(): number {
    return this.dateBounds.min ? this.monthPosition(this.dateBounds.max) - this.monthPosition(this.dateBounds.min) : 0;
  }
  get fromPosition(): number { return this.rangeFrom ?? 0; }
  get toPosition(): number { return this.rangeTo ?? this.rangeMax; }
  get fromMonth(): string { return this.rangeMonth(this.fromPosition); }
  get toMonth(): string { return this.rangeMonth(this.toPosition); }
  get fromLabel(): string { return this.fromMonth ? salaryMonthLabel(this.fromMonth) : 'No data'; }
  get toLabel(): string { return this.toMonth ? salaryMonthLabel(this.toMonth) : 'No data'; }
  get isRangeFiltered(): boolean { return this.fromPosition > 0 || this.toPosition < this.rangeMax; }
  get filteredRecords(): SalaryRecord[] { return this.filterRecords(this.records, this.fromMonth, this.toMonth); }
  get totals() { return this.sumRecords(this.filteredRecords); }
  get amountsValid(): boolean { return this.fields.every(({ key }) => this.editForm.controls[key].valid); }
  get confirmed(): boolean {
    return this.isCodeVerified && !this.isCodeVerifying && this.confirmationCode.valid &&
      this.verifiedCode === this.confirmationCode.value;
  }
  get formOpen(): boolean { return this.isAdding || this.editingIndex !== null; }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    this.previewRangeCount = null;
    if (this.isExpanded) { announceAccordionOpened(this.widgetId); }
  }

  selectField(value: string): void {
    if (this.fields.some(({ key }) => key === value)) { this.selectedField = value as SalaryField; }
  }

  selectChartType(value: string): void { if (isChartType(value)) { this.chartType = value; } }

  setRange(endpoint: 'from' | 'to', value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > this.rangeMax) {
      this.rangeError = 'Choose a month within the available salary history.';
      return;
    }
    this.rangeError = '';
    if (endpoint === 'from') { this.rangeFrom = Math.min(value, this.toPosition); }
    else { this.rangeTo = Math.max(value, this.fromPosition); }
  }

  resetRange(): void {
    this.rangeFrom = null;
    this.rangeTo = null;
    this.rangeError = '';
  }

  selectRecentMonths(months: number): void {
    this.rangeTo = null;
    this.setRange('from', Math.max(0, this.rangeMax - months + 1));
  }

  isRecentMonths(months: number): boolean {
    return this.isRangeFiltered && this.toPosition === this.rangeMax &&
      this.fromPosition === this.rangeMax - months + 1;
  }

  setRangeMonth(endpoint: 'from' | 'to', value: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || !this.dateBounds.min) {
      this.rangeError = 'Choose a valid salary month.';
      return;
    }
    const position = this.monthPosition(value) - this.monthPosition(this.dateBounds.min);
    if ((endpoint === 'from' && position > this.toPosition) ||
        (endpoint === 'to' && position < this.fromPosition)) {
      this.rangeError = 'From month must be on or before To month.';
      return;
    }
    this.setRange(endpoint, position);
  }

  selectRangeOnTrack(event: PointerEvent): void {
    if (event.button !== 0 || !this.rangeMax || !(event.currentTarget instanceof HTMLElement)) { return; }
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (!width) { return; }
    const position = Math.max(0, Math.min(this.rangeMax, Math.round((event.clientX - left) / width * this.rangeMax)));
    this.setRange(Math.abs(position - this.fromPosition) <= Math.abs(position - this.toPosition) ? 'from' : 'to', position);
  }

  private monthPosition(value: string): number {
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month - 1;
  }

  private rangeMonth(position: number): string {
    if (!this.dateBounds.min) { return ''; }
    const month = this.monthPosition(this.dateBounds.min) + position;
    return `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
  }

  loadData(): void {
    this.loadSubscription?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';
    const source = this.combined
      ? forkJoin([this.salaryService.getSalaryData('8'), this.salaryService.getSalaryData('9')]).pipe(
        map((documents): SalaryApiDocument => {
          this.sourceDocuments = documents;
          return {
            id: 'combined', name: this.title, title: '', description: '', type: 'Salary',
            salaryRecords: combineSalaryRecords(documents[0].salaryRecords, documents[1].salaryRecords)
          };
        }))
      : this.salaryService.getSalaryData(this.resourceId);
    this.loadSubscription = source.subscribe({
      next: (data) => { this.data = data; this.resetRange(); this.isLoading = false; this.changeDetector.detectChanges(); },
      error: (error: unknown) => {
        this.isLoading = false;
        if (this.combined) {
          this.data = null;
          this.sourceDocuments = [];
        }
        this.errorMessage = error instanceof Error ? error.message : 'Unable to load salary records.';
        this.changeDetector.detectChanges();
      }
    });
  }

  addRecord(): void {
    if (this.combined) { return; }
    if (this.isSaving || !this.data) { return; }
    this.closeDialog();
    this.isAdding = true;
    this.editForm.reset();
  }

  editRecord(index: number): void {
    if (this.combined) { return; }
    const record = this.records[index];
    if (this.isSaving || !record) { return; }
    this.closeDialog();
    this.editingIndex = index;
    this.editForm.reset({ ...record, date: salaryMonthKey(record.date), ausHealthInsurance: record.ausHealthInsurance ?? 0 });
  }

  requestDelete(index: number): void {
    if (this.combined) { return; }
    if (this.isSaving || !this.records[index]) { return; }
    this.closeDialog();
    this.deletingIndex = index;
  }

  closeDialog(): void {
    if (this.isSaving) { return; }
    this.isAdding = false;
    this.editingIndex = null;
    this.deletingIndex = null;
    this.saveError = '';
    this.confirmationCode.reset();
    this.codeAttempt++;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.isCodeVerifying = false;
    this.verifiedCode = '';
  }

  async validateCode(): Promise<void> {
    const attempt = ++this.codeAttempt;
    const code = this.confirmationCode.value;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.isCodeVerifying = false;
    this.verifiedCode = '';
    this.saveError = '';
    if (this.confirmationCode.invalid) { return; }
    this.isCodeVerifying = true;
    try {
      const valid = await this.confirmationService.verify(code);
      if (attempt !== this.codeAttempt || this.destroyed) { return; }
      this.isCodeVerified = valid;
      this.isCodeIncorrect = !valid;
      this.verifiedCode = valid ? code : '';
    } catch {
      if (attempt !== this.codeAttempt || this.destroyed) { return; }
      this.saveError = 'Code verification is unavailable. Please try again.';
    } finally {
      if (attempt === this.codeAttempt && !this.destroyed) {
        this.isCodeVerifying = false;
        this.changeDetector.detectChanges();
      }
    }
  }

  saveRecord(): void {
    if (this.combined) { return; }
    if (this.isSaving || !this.data || !this.formOpen) { return; }
    if (this.editForm.invalid || !this.amountsValid) { this.editForm.markAllAsTouched(); return; }
    if (!this.isAdding && !this.confirmed) {
      this.saveError = 'Verify the confirmation code before saving changes.';
      return;
    }
    const value = this.editForm.getRawValue();
    if (this.records.some((record, index) => index !== this.editingIndex && salaryMonthKey(record.date) === value.date)) {
      this.editForm.controls.date.setErrors({ duplicateMonth: true });
      this.editForm.controls.date.markAsTouched();
      this.saveError = 'A salary record already exists for this month.';
      return;
    }
    const { ausHealthInsurance, ...common } = value;
    const record: SalaryRecord = {
      ...(this.editingIndex !== null ? this.records[this.editingIndex] : {}),
      ...common, date: salaryMonthLabel(value.date),
      ...(this.resourceId === '9' ? { ausHealthInsurance } : {})
    };
    const records = [...this.records];
    if (this.editingIndex !== null) { records[this.editingIndex] = record; }
    else { records.unshift(record); }
    this.persist(records, this.isAdding ? 'Salary record added successfully.' : 'Salary record updated successfully.');
  }

  deleteRecord(): void {
    if (this.combined) { return; }
    if (this.deletingIndex === null || this.isSaving || !this.confirmed) { return; }
    this.persist(this.records.filter((_, index) => index !== this.deletingIndex), 'Salary record deleted successfully.');
  }

  private persist(salaryRecords: SalaryRecord[], message: string): void {
    if (!this.data) { return; }
    this.isSaving = true;
    this.editForm.disable({ emitEvent: false });
    this.confirmationCode.disable({ emitEvent: false });
    this.saveError = '';
    this.toastMessage = '';
    this.subscriptions.add(this.salaryService.updateSalaryData({ ...this.data, salaryRecords }, this.resourceId).subscribe({
      next: (data) => {
        this.data = data;
        this.resetRange();
        this.finishSaving();
        this.closeDialog();
        this.areRecordsExpanded = true;
        this.toastMessage = message;
        this.changeDetector.detectChanges();
      },
      error: (error: unknown) => {
        this.finishSaving();
        this.saveError = error instanceof Error ? error.message : 'Unable to save salary records.';
        this.changeDetector.detectChanges();
      }
    }));
  }

  private finishSaving(): void {
    this.isSaving = false;
    this.editForm.enable({ emitEvent: false });
    this.confirmationCode.enable({ emitEvent: false });
  }
}
