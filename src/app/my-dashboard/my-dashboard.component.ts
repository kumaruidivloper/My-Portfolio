import { announceAccordionOpened, collapseWhenAnotherOpens } from '../service/accordion-group';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin, merge, Subscription, timer } from 'rxjs';
import { ColorHelper, ScaleType } from '@swimlane/ngx-charts';
import { chartColorScheme, CHART_TYPE_OPTIONS, ChartType, isChartType, formatCompactAxisValue } from '../model/chart-type';
import { memoizeLast } from '../model/memoize';
import { PreviewViewOption } from '../widget-preview-chart/widget-preview-chart.component';
import { TransferRecord } from '../model/transfer';
import { TransferService } from '../service/transfer.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { ResponsiveGridColumn, ResponsiveGridRow } from '../responsive-table/responsive-table.component';
import { PfDataService } from '../service/pf-data.service';
import { GratuityDataService } from '../service/gratuity-data.service';
import { TotalBalanceService } from '../service/total-balance.service';
import { PfApiDocument } from '../model/pf-record';
import { GratuityApiDocument } from '../model/gratuity-record';

type DashboardChartType = ChartType;
type TransferMetric = 'amountTransferredAUD' | 'amountReceivedINR' | 'conversionRate';
type DashboardMetric =
  | TransferMetric
  | 'kumarPfAmount' | 'kumarPfDifference' | 'vasukiPfAmount' | 'vasukiPfDifference'
  | 'combinedPfInterest' | 'combinedPfAmount'
  | 'kumarGratuity' | 'vasukiGratuity' | 'vasukiSuper'
  | 'overallInterest' | 'overallBalance';
type TransferSortKey = keyof TransferRecord;
type SortDirection = 'asc' | 'desc';

interface IndexedTransfer {
  transfer: TransferRecord;
  index: number;
}

interface ChartDatum {
  name: string;
  value: number;
}

interface DashboardSummaryCard {
  label: string;
  value: string;
  detail?: string;
  color?: string;
  colorLabel?: string;
}

interface MetricOption {
  label: string;
  key: TransferMetric;
  axisLabel: string;
  format: (value: number) => string;
}

interface DashboardMetricOption {
  label: string;
  key: DashboardMetric;
  axisLabel: string;
}

interface MonthTotal {
  key: string;
  name: string;
  pfAmount: number;
  difference: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateInputValue(value: string): string {
  if (isValidDateInput(value)) {
    return value;
  }

  const match = /^(\d{1,2})-([A-Za-z]{3,9})-(\d{2}|\d{4})$/.exec(value);
  if (!match) {
    return '';
  }

  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[2].slice(0, 3).toLowerCase()) + 1;
  if (month === 0) {
    return '';
  }

  const parsedYear = Number(match[3]);
  const year = match[3].length === 4
    ? parsedYear
    : parsedYear >= 70 ? 1900 + parsedYear : 2000 + parsedYear;
  const dateValue = `${year}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
  return isValidDateInput(dateValue) ? dateValue : '';
}

function toBackendDate(value: string): string | null {
  if (!isValidDateInput(value)) {
    return null;
  }

  const [year, month, day] = value.split('-');
  return `${day}-${MONTHS[Number(month) - 1]}-${year.slice(-2)}`;
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateSortValue(value: string): number | null {
  const match = /^(\d{1,2})-([A-Za-z]+)-(\d{2}|\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[2].slice(0, 3).toLowerCase());
  if (month < 0) {
    return null;
  }

  const shortYear = Number(match[3]);
  const year = match[3].length === 4
    ? shortYear
    : shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear;
  const date = new Date(Date.UTC(year, month, Number(match[1])));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === Number(match[1])
    ? date.getTime()
    : null;
}

function isTransferSortKey(key: string): key is TransferSortKey {
  return ['dateOfTransfer', 'amountTransferredAUD', 'conversionRate', 'receivedDate', 'amountReceivedINR'].includes(key);
}

function isTransferMetric(metric: DashboardMetric): metric is TransferMetric {
  return metric === 'amountTransferredAUD' || metric === 'amountReceivedINR' || metric === 'conversionRate';
}

function isDashboardMetric(metric: string): metric is DashboardMetric {
  return [
    'amountTransferredAUD', 'amountReceivedINR', 'conversionRate',
    'kumarPfAmount', 'kumarPfDifference', 'vasukiPfAmount', 'vasukiPfDifference',
    'combinedPfInterest', 'combinedPfAmount', 'kumarGratuity', 'vasukiGratuity',
    'vasukiSuper', 'overallInterest', 'overallBalance'
  ].includes(metric);
}

function monthDetails(value: string): { key: string; label: string } | null {
  const monthYear = /^([A-Za-z]+)(?:'|\s+)(\d{2}|\d{4})$/.exec(value.trim());
  if (monthYear) {
    const monthIndex = MONTHS.findIndex((month) =>
      month.toLowerCase() === monthYear[1].slice(0, 3).toLowerCase()
    );
    if (monthIndex < 0) {
      return null;
    }
    const year = monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2];
    return {
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      label: `${MONTHS[monthIndex]} ${year}`
    };
  }

  const isoMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (isoMonth) {
    const monthIndex = Number(isoMonth[2]) - 1;
    return { key: value.trim(), label: `${MONTHS[monthIndex]} ${isoMonth[1]}` };
  }
  return null;
}

@Component({
  selector: 'app-my-dashboard',
  templateUrl: './my-dashboard.component.html',
  styleUrls: ['./my-dashboard.component.scss'],
  standalone: false
})
export class MyDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('widgetGrid') private widgetGrid?: ElementRef<HTMLElement>;

  readonly editForm = new FormGroup({
    dateOfTransfer: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]
    }),
    amountTransferredAUD: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    conversionRate: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
    receivedDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]
    }),
    amountReceivedINR: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] })
  });
  readonly deleteConfirmationCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{14}$/)]
  });

  readonly chartTypeOptions = CHART_TYPE_OPTIONS;
  readonly formatYAxisTick = formatCompactAxisValue;

  get metricOptions(): { label: string; value: string }[] {
    return this.previewViews;
  }

  get previewViews(): PreviewViewOption[] {
    return this.metricViewOptions ??= this.metrics.map(({ label, key }) => ({ label, value: key }));
  }

  get allDashboardMetricOptions(): { label: string; value: string }[] {
    return this.allDashboardViewOptions ??= this.allDashboardMetrics.map(({ label, key }) => ({ label, value: key }));
  }

  private metricViewOptions?: PreviewViewOption[];
  private allDashboardViewOptions?: { label: string; value: string }[];

  readonly metrics: MetricOption[] = [
    {
      label: 'Amount sent (AUD)',
      key: 'amountTransferredAUD',
      axisLabel: 'Amount (AUD)',
      format: (value) => this.formatCurrency(value, 'AUD')
    },
    {
      label: 'Amount received (INR)',
      key: 'amountReceivedINR',
      axisLabel: 'Amount (INR)',
      format: (value) => this.formatCurrency(value, 'INR')
    },
    {
      label: 'Exchange rate',
      key: 'conversionRate',
      axisLabel: 'INR per AUD',
      format: (value) => `${value.toFixed(2)} INR/AUD`
    }
  ];
  readonly allDashboardMetrics: readonly DashboardMetricOption[] = [
    ...this.metrics,
    { label: 'Kumar PF balance', key: 'kumarPfAmount', axisLabel: 'PF balance (INR)' },
    { label: 'Kumar PF monthly difference', key: 'kumarPfDifference', axisLabel: 'Monthly difference (INR)' },
    { label: 'Vasuki PF balance', key: 'vasukiPfAmount', axisLabel: 'PF balance (INR)' },
    { label: 'Vasuki PF monthly difference', key: 'vasukiPfDifference', axisLabel: 'Monthly difference (INR)' },
    { label: 'Combined PF monthly interest', key: 'combinedPfInterest', axisLabel: 'Monthly interest (INR)' },
    { label: 'Combined PF amount', key: 'combinedPfAmount', axisLabel: 'Total PF amount (INR)' },
    { label: 'Kumar gratuity', key: 'kumarGratuity', axisLabel: 'Gratuity (INR)' },
    { label: 'Vasuki gratuity', key: 'vasukiGratuity', axisLabel: 'Gratuity (INR)' },
    { label: 'Vasuki super', key: 'vasukiSuper', axisLabel: 'Super (INR)' },
    { label: 'Overall monthly interest', key: 'overallInterest', axisLabel: 'Monthly interest (INR)' },
    { label: 'Overall balance', key: 'overallBalance', axisLabel: 'Overall balance (INR)' }
  ];
  readonly gridColumns: readonly ResponsiveGridColumn[] = [
    { key: 'transferDate', label: 'Transfer date', sortable: true, sortKey: 'dateOfTransfer' },
    { key: 'sent', label: 'Sent (AUD)', sortable: true, sortKey: 'amountTransferredAUD', numeric: true },
    { key: 'rate', label: 'Rate', sortable: true, sortKey: 'conversionRate', numeric: true },
    { key: 'receivedDate', label: 'Received date', sortable: true, sortKey: 'receivedDate' },
    { key: 'received', label: 'Received (INR)', sortable: true, sortKey: 'amountReceivedINR', numeric: true },
    { key: 'actions', label: 'Actions', actions: true }
  ];
  selectedChartType: DashboardChartType = 'bar';
  selectedMetric: TransferMetric = 'amountTransferredAUD';
  selectedAllDashboardMetric: DashboardMetric = 'amountTransferredAUD';
  allDashboardFrom = '';
  allDashboardTo = '';
  allDashboardRangeError = '';
  selectedAllDashboardDatum: ChartDatum | null = null;
  isAllDetailsModalOpen = false;
  isAllDashboardChartsLoading = false;
  allDashboardChartsError = '';
  transfers: TransferRecord[] = [];
  isLoading = true;
  errorMessage = '';
  editingTransferIndex: number | null = null;
  isAddingTransfer = false;
  isTransferSectionExpanded = false;
  areRecordsExpanded = false;
  isSaving = false;
  pendingDeleteIndex: number | null = null;
  isDeleteCodeVerifying = false;
  isDeleteCodeVerified = false;
  isDeleteCodeIncorrect = false;
  saveError = '';
  toastMessage = '';
  sortKey: TransferSortKey | null = 'dateOfTransfer';
  sortDirection: SortDirection = 'desc';
  private toastTimeout?: Subscription;
  private amountCalculation?: Subscription;
  private allDashboardChartsSubscription?: Subscription;
  private allDashboardChartDataByMetric: Partial<Record<DashboardMetric, ChartDatum[]>> = {};
  private deleteCodeValidationAttempt = 0;
  private verifiedDeleteCode = '';
  private readonly accordionSubscription = collapseWhenAnotherOpens(
    () => 'transfer',
    () => this.collapseTransferSection()
  );

  constructor(
    private transferService: TransferService,
    private changeDetectorRef: ChangeDetectorRef,
    private confirmationCodeService: ConfirmationCodeService,
    private pfDataService: PfDataService,
    private gratuityDataService: GratuityDataService,
    private totalBalanceService: TotalBalanceService
  ) {}

  ngOnInit(): void {
    this.amountCalculation = merge(
      this.editForm.controls.amountTransferredAUD.valueChanges,
      this.editForm.controls.conversionRate.valueChanges
    ).subscribe(() => this.updateReceivedAmount());

    this.transferService.getTransfers().subscribe({
      next: (transfers) => {
        this.transfers = transfers;
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Unable to load transfer records.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  ngAfterViewInit(): void {
    // Capture phase runs before the card's own toggle handler, so the observer below never misses the change.
    this.widgetGrid?.nativeElement.addEventListener('click', this.onWidgetGridClick, true);
  }

  ngOnDestroy(): void {
    this.widgetGrid?.nativeElement.removeEventListener('click', this.onWidgetGridClick, true);
    this.toastTimeout?.unsubscribe();
    this.amountCalculation?.unsubscribe();
    this.allDashboardChartsSubscription?.unsubscribe();
    this.accordionSubscription.unsubscribe();
  }

  readonly onWidgetGridClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    const widget = target?.closest<HTMLElement>('.dashboard-widget-grid > *');
    const trigger = target?.closest('.accordion-toggle, app-widget-preview-chart');
    const mainToggle = widget?.querySelector('.accordion-toggle');

    // Only the card's own (first) toggle or its preview chart moves the card; inner toggles don't.
    if (!widget || !trigger || !mainToggle || (trigger.matches('.accordion-toggle') && trigger !== mainToggle)) {
      return;
    }

    // Wait until the card has actually re-rendered (and moved in the grid) before scrolling to it.
    const scrollToWidget = () => {
      observer.disconnect();
      clearTimeout(fallback);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      widget.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    };
    const observer = new MutationObserver(scrollToWidget);
    const fallback = setTimeout(() => observer.disconnect(), 1000);
    observer.observe(mainToggle, { attributes: true, attributeFilter: ['aria-expanded'] });
  };

  dismissToast(): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = '';
  }

  get selectedMetricOption(): MetricOption {
    return this.metrics.find((metric) => metric.key === this.selectedMetric) ?? this.metrics[0];
  }

  get selectedAllDashboardMetricOption(): DashboardMetricOption {
    return this.allDashboardMetrics.find((metric) => metric.key === this.selectedAllDashboardMetric) ??
      this.allDashboardMetrics[0];
  }

  get allDashboardChartData(): ChartDatum[] {
    return this.getDataForMetric(this.selectedAllDashboardMetric);
  }

  get allDashboardDateMode(): 'date' | 'month' {
    return isTransferMetric(this.selectedAllDashboardMetric) ? 'date' : 'month';
  }

  get allDashboardDateBounds(): { min: string; max: string } {
    const dates = this.getUnfilteredDataForMetric(this.selectedAllDashboardMetric)
      .map(({ name }) => this.chartDateValue(name)).sort();
    return { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' };
  }

  get allDashboardFromValue(): string {
    return this.allDashboardFrom || this.allDashboardDateBounds.min;
  }

  get allDashboardToValue(): string {
    return this.allDashboardTo || this.allDashboardDateBounds.max;
  }

  get allDashboardSliderMax(): number {
    const { min, max } = this.allDashboardDateBounds;
    return min && max ? this.dateRangePosition(max) - this.dateRangePosition(min) : 0;
  }

  get allDashboardSliderFrom(): number {
    const min = this.allDashboardDateBounds.min;
    return min ? this.dateRangePosition(this.allDashboardFromValue) - this.dateRangePosition(min) : 0;
  }

  get allDashboardSliderTo(): number {
    const min = this.allDashboardDateBounds.min;
    return min ? this.dateRangePosition(this.allDashboardToValue) - this.dateRangePosition(min) : 0;
  }

  get allDashboardFromLabel(): string {
    return this.dateRangeLabel(this.allDashboardFromValue);
  }

  get allDashboardToLabel(): string {
    return this.dateRangeLabel(this.allDashboardToValue);
  }

  private dateLabelDrag: { pointerId: number; endpoint: 'from' | 'to'; startX: number; position: number; width: number } | null = null;

  startDateTrackDrag(event: PointerEvent): void {
    if (event.button !== 0 || !this.allDashboardSliderMax || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    const track = event.currentTarget;
    const { left, width } = track.getBoundingClientRect();
    if (!width) {
      return;
    }
    const position = Math.max(0, Math.min(this.allDashboardSliderMax,
      Math.round((event.clientX - left) / width * this.allDashboardSliderMax)));
    const endpoint = Math.abs(position - this.allDashboardSliderFrom) <= Math.abs(position - this.allDashboardSliderTo)
      ? 'from' : 'to';
    this.setAllDashboardSliderRange(endpoint, position);
    track.setPointerCapture(event.pointerId);
    this.dateLabelDrag = { pointerId: event.pointerId, endpoint, startX: event.clientX, position, width };
    track.parentElement?.querySelector<HTMLInputElement>(`input[aria-label="Chart range ${endpoint}"]`)?.focus();
  }

  startDateLabelDrag(endpoint: 'from' | 'to', event: PointerEvent): void {
    if (event.button !== 0 || !this.allDashboardSliderMax || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    const width = event.currentTarget.parentElement?.getBoundingClientRect().width;
    if (!width) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    this.dateLabelDrag = {
      pointerId: event.pointerId, endpoint, startX: event.clientX, width,
      position: endpoint === 'from' ? this.allDashboardSliderFrom : this.allDashboardSliderTo
    };
  }

  moveDateLabelDrag(event: PointerEvent): void {
    const drag = this.dateLabelDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const position = Math.round(drag.position + (event.clientX - drag.startX) / drag.width * this.allDashboardSliderMax);
    this.setAllDashboardSliderRange(drag.endpoint, Math.max(0, Math.min(this.allDashboardSliderMax, position)));
  }

  endDateLabelDrag(event: PointerEvent): void {
    if (this.dateLabelDrag?.pointerId === event.pointerId) {
      this.dateLabelDrag = null;
    }
  }

  onDateLabelKeydown(endpoint: 'from' | 'to', event: KeyboardEvent): void {
    const current = endpoint === 'from' ? this.allDashboardSliderFrom : this.allDashboardSliderTo;
    const step = Math.max(1, Math.round(this.allDashboardSliderMax / 10));
    const positions: Record<string, number> = {
      ArrowLeft: current - 1, ArrowDown: current - 1,
      ArrowRight: current + 1, ArrowUp: current + 1,
      PageDown: current - step, PageUp: current + step,
      Home: 0, End: this.allDashboardSliderMax
    };
    if (event.key in positions && this.allDashboardSliderMax) {
      event.preventDefault();
      this.setAllDashboardSliderRange(endpoint, Math.max(0, Math.min(this.allDashboardSliderMax, positions[event.key])));
    }
  }

  setAllDashboardSliderRange(endpoint: 'from' | 'to', position: number): void {
    const min = this.allDashboardDateBounds.min;
    if (!min || !Number.isInteger(position) || position < 0 || position > this.allDashboardSliderMax) {
      this.allDashboardRangeError = 'Choose a valid range within the available dates.';
      return;
    }
    const bounded = endpoint === 'from'
      ? Math.min(position, this.allDashboardSliderTo)
      : Math.max(position, this.allDashboardSliderFrom);
    const absolute = this.dateRangePosition(min) + bounded;
    const value = this.allDashboardDateMode === 'month'
      ? `${Math.floor(absolute / 12)}-${String(absolute % 12 + 1).padStart(2, '0')}`
      : new Date(absolute * 86400000).toISOString().slice(0, 10);
    this.setAllDashboardDateRange(endpoint, value);
  }

  private dateRangePosition(value: string): number {
    if (this.allDashboardDateMode === 'month') {
      const [year, month] = value.split('-').map(Number);
      return year * 12 + month - 1;
    }
    return Date.parse(`${value}T00:00:00Z`) / 86400000;
  }

  private dateRangeLabel(value: string): string {
    if (!value) {
      return 'No data';
    }
    if (this.allDashboardDateMode === 'date') {
      return this.formatDate(value);
    }
    const month = monthDetails(value);
    if (!month) {
      throw new Error(`Unable to display date range month "${value}".`);
    }
    return month.label;
  }

  setAllDashboardDateRange(endpoint: 'from' | 'to', value: string): void {
    const bounds = this.allDashboardDateBounds;
    const from = endpoint === 'from' ? value : this.allDashboardFromValue;
    const to = endpoint === 'to' ? value : this.allDashboardToValue;
    const valid = this.allDashboardDateMode === 'date'
      ? isValidDateInput(value) : /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    if (!valid || !bounds.min || value < bounds.min || value > bounds.max || from > to) {
      this.allDashboardRangeError = 'Choose a valid range within the available dates; From must not be after To.';
      return;
    }
    this.allDashboardFrom = from;
    this.allDashboardTo = to;
    this.allDashboardRangeError = '';
    this.clearAllDashboardSelection();
  }

  resetAllDashboardDateRange(): void {
    this.dateLabelDrag = null;
    this.allDashboardFrom = '';
    this.allDashboardTo = '';
    this.allDashboardRangeError = '';
    this.clearAllDashboardSelection();
  }

  private chartDateValue(name: string): string {
    const month = monthDetails(name);
    if (month) {
      return month.key;
    }
    const displayDate = /^(\d{2}) ([A-Za-z]+) (\d{4})$/.exec(name);
    const date = toDateInputValue(displayDate ? `${displayDate[1]}-${displayDate[2]}-${displayDate[3]}` : name);
    if (!date) {
      throw new Error(`Unable to filter records with date "${name}".`);
    }
    return date;
  }

  private isInAllDashboardRange(date: string): boolean {
    return (!this.allDashboardFrom || date >= this.allDashboardFrom) &&
      (!this.allDashboardTo || date <= this.allDashboardTo);
  }

  private get allDashboardTransfers(): TransferRecord[] {
    return this.transfers.filter(({ dateOfTransfer }) =>
      this.isInAllDashboardRange(toDateInputValue(dateOfTransfer)));
  }

  get allDashboardSummaryCards(): DashboardSummaryCard[] {
    const metric = this.selectedAllDashboardMetric;
    const transfers = this.allDashboardTransfers;
    const transactionCount = transfers.length;
    const selectedIndex = this.selectedAllDashboardIndex;
    if (isTransferMetric(metric) && selectedIndex >= 0) {
      const transfer = transfers[selectedIndex];
      const datum = this.allDashboardChartData[selectedIndex];
      const countCard = this.createRecordCountSummaryCard(metric, transactionCount);
      if (metric === 'conversionRate') {
        return [
          this.createExchangeRateSummaryCard('Selected exchange rate', transfer),
          this.createExchangeRateSummaryCard('Previous exchange rate', transfers[selectedIndex - 1]),
          countCard
        ];
      }
      return [
        countCard,
        { label: 'Selected amount sent', value: this.formatCurrency(transfer.amountTransferredAUD, 'AUD'),
          detail: datum.name, ...this.getSummaryColor(datum) },
        { label: 'Selected amount received', value: this.formatCurrency(transfer.amountReceivedINR, 'INR'),
          detail: datum.name, ...this.getSummaryColor(datum) }
      ];
    }

    if (metric === 'conversionRate') {
      const eligible = transfers.filter(({ conversionRate }) =>
        Number.isFinite(conversionRate) && conversionRate >= 1
      );
      const lowest = eligible.reduce<TransferRecord | undefined>((result, transfer) =>
        !result || transfer.conversionRate < result.conversionRate ? transfer : result, undefined);
      const highest = eligible.reduce<TransferRecord | undefined>((result, transfer) =>
        !result || transfer.conversionRate > result.conversionRate ? transfer : result, undefined);
      return [
        this.createExchangeRateSummaryCard('Lowest exchange rate', lowest),
        this.createExchangeRateSummaryCard('Highest exchange rate', highest),
        this.createRecordCountSummaryCard(metric, transactionCount)
      ];
    }

    if (isTransferMetric(metric)) {
      const totalSent = transfers.reduce((sum, transfer) => sum + transfer.amountTransferredAUD, 0);
      const totalReceived = transfers.reduce((sum, transfer) => sum + transfer.amountReceivedINR, 0);
      return [
        this.createRecordCountSummaryCard(metric, transactionCount),
        {
          label: 'Total sent',
          value: this.formatCurrency(totalSent, 'AUD')
        },
        {
          label: 'Total received',
          value: this.formatCurrency(totalReceived, 'INR')
        }
      ];
    }

    const primaryLabel = this.getSummaryLabel(metric);
    const cards = [this.createMetricSummaryCard(metric, primaryLabel)];
    const pairedMetric = this.getPairedSummaryMetric(metric);
    if (pairedMetric) {
      cards.push(this.createMetricSummaryCard(pairedMetric, this.getSummaryLabel(pairedMetric)));
    } else {
      cards.push(this.createPreviousPeriodSummaryCard(metric));
    }
    const data = this.getDataForMetric(metric);
    const recordCount = data.length;
    cards.push(this.createRecordCountSummaryCard(metric, recordCount));
    if (metric === 'overallBalance' || metric === 'overallInterest') {
      cards.push(this.createOverallInterestComparisonCard());
    }
    if (metric === 'vasukiSuper') {
      const index = selectedIndex >= 0 ? selectedIndex : data.length - 1;
      const latest = data[index];
      const previous = data[index - 1];
      cards[0].detail = latest && previous
        ? `Difference: ${this.formatDashboardMetricValue(metric, latest.value - previous.value)} (${latest.name} minus ${previous.name})`
        : selectedIndex >= 0 ? 'Difference: — (No previous recorded period)'
          : 'Difference: — (Two recorded periods are needed)';
    }
    return cards;
  }

  private get selectedAllDashboardIndex(): number {
    const selected = this.selectedAllDashboardDatum;
    return selected ? this.allDashboardChartData.findIndex(({ name, value }) =>
      name === selected.name && value === selected.value) : -1;
  }

  private createRecordCountSummaryCard(metric: DashboardMetric, count: number): DashboardSummaryCard {
    const index = this.selectedAllDashboardIndex;
    const format = (value: number) => new Intl.NumberFormat('en-AU').format(value);
    if (index >= 0) {
      return {
        label: isTransferMetric(metric) ? 'Selected transaction' : 'Selected record',
        value: `${format(index + 1)} of ${format(count)}`,
        detail: this.allDashboardChartData[index].name
      };
    }
    return {
      label: isTransferMetric(metric) ? 'Transfers' : 'Recorded periods',
      value: format(count)
    };
  }

  get allDashboardChartColorScheme() {
    return chartColorScheme(this.allDashboardChartData, this.selectedAllDashboardMetric);
  }

  get allDashboardLineChartData(): { name: string; series: ChartDatum[] }[] {
    return [{
      name: this.selectedAllDashboardMetricOption.label,
      series: this.allDashboardChartData
    }];
  }

  private readonly buildChartData = memoizeLast((transfers: TransferRecord[], metric: TransferMetric): ChartDatum[] =>
    transfers.map((transfer) => ({
      name: this.formatDate(transfer.dateOfTransfer),
      value: transfer[metric]
    })));
  private readonly buildColorScheme = memoizeLast((data: ChartDatum[]) => chartColorScheme(data, 'transfers'));
  private readonly buildLineChartData = memoizeLast((data: ChartDatum[], name: string) => [{ name, series: data }]);
  private readonly buildSortedTransfers = memoizeLast(
    (transfers: TransferRecord[], sortKey: TransferSortKey | null, direction: SortDirection): IndexedTransfer[] => {
      const rows = transfers.map((transfer, index) => ({ transfer, index }));
      if (sortKey === null) {
        return rows;
      }
      return rows.sort((left, right) => {
        const comparison = this.compareTransferValues(left.transfer, right.transfer, sortKey);
        return comparison === 0
          ? left.index - right.index
          : direction === 'asc' ? comparison : -comparison;
      });
    });
  private readonly buildTransferGridRows = memoizeLast((rows: IndexedTransfer[]): ResponsiveGridRow[] =>
    rows.map(({ transfer }, actionIndex) => ({
      actionIndex,
      transferDate: this.formatDate(transfer.dateOfTransfer),
      sent: this.formatTransferCurrency(transfer.amountTransferredAUD, 'AUD'),
      rate: transfer.conversionRate.toFixed(2),
      receivedDate: this.formatDate(transfer.receivedDate),
      received: this.formatTransferCurrency(transfer.amountReceivedINR, 'INR')
    })));

  get colorScheme() {
    return this.buildColorScheme(this.chartData);
  }

  readonly formatPreviewValue = (value: number): string => this.formatChartValue(value);

  get chartData(): ChartDatum[] {
    return this.buildChartData(this.transfers, this.selectedMetric);
  }

  formatDate(value: string): string {
    const dateInputValue = toDateInputValue(value);
    if (!dateInputValue) {
      return value;
    }

    const [year, month, day] = dateInputValue.split('-');
    return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
  }

  formatChartValue(value: number, metric: TransferMetric = this.selectedMetric): string {
    const locale = metric === 'amountReceivedINR' || metric === 'conversionRate'
      ? 'en-IN'
      : 'en-AU';
    const formattedValue = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

    if (metric === 'amountTransferredAUD') {
      return `$ ${formattedValue}`;
    }
    if (metric === 'amountReceivedINR') {
      return `₹ ${formattedValue}`;
    }
    return `₹ ${formattedValue} / AUD`;
  }

  formatAllDashboardChartValue(value: number): string {
    if (isTransferMetric(this.selectedAllDashboardMetric)) {
      return this.selectedMetricOption.format(value);
    }
    return `₹ ${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}`;
  }

  formatTransferCurrency(value: number, currency: 'AUD' | 'INR'): string {
    const formattedValue = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return `${currency === 'AUD' ? '$' : '₹'} ${formattedValue}`;
  }

  get lineChartData(): { name: string; series: ChartDatum[] }[] {
    return this.buildLineChartData(this.chartData, this.selectedMetricOption.label);
  }

  get totalTransferredAUD(): number {
    return this.transfers.reduce((total, transfer) => total + transfer.amountTransferredAUD, 0);
  }

  get totalReceivedINR(): number {
    return this.transfers.reduce((total, transfer) => total + transfer.amountReceivedINR, 0);
  }

  get formattedTotalTransferredAUD(): string {
    return this.formatCurrency(this.totalTransferredAUD, 'AUD');
  }

  get formattedTotalReceivedINR(): string {
    return this.formatCurrency(this.totalReceivedINR, 'INR');
  }

  get sortedTransfers(): IndexedTransfer[] {
    return this.buildSortedTransfers(this.transfers, this.sortKey, this.sortDirection);
  }

  get transferGridRows(): ResponsiveGridRow[] {
    return this.buildTransferGridRows(this.sortedTransfers);
  }

  sortGrid(key: string): void {
    if (isTransferSortKey(key)) {
      this.sortTransfers(key);
    }
  }

  sortTransfers(key: TransferSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDirection = 'asc';
  }

  selectChartType(type: string): void {
    if (isChartType(type)) {
      this.selectedChartType = type;
    }
  }

  selectMetric(metric: TransferMetric): void {
    this.resetAllDashboardDateRange();
    this.selectedMetric = metric;
    if (this.isAllDetailsModalOpen) {
      this.selectedAllDashboardMetric = metric;
    }
  }

  selectAllDashboardMetric(metric: string): void {
    if (!isDashboardMetric(metric)) {
      return;
    }
    this.selectedAllDashboardMetric = metric;
    this.resetAllDashboardDateRange();
    if (isTransferMetric(this.selectedAllDashboardMetric)) {
      this.selectedMetric = this.selectedAllDashboardMetric;
    }
  }

  openAllDetailsModal(): void {
    this.resetAllDashboardDateRange();
    this.isAllDetailsModalOpen = true;
    this.selectedAllDashboardMetric = this.selectedMetric;
    if (!Object.keys(this.allDashboardChartDataByMetric).length) {
      this.loadAllDashboardCharts();
    }
  }

  closeAllDetails(): void {
    this.isAllDetailsModalOpen = false;
    this.clearAllDashboardSelection();
  }

  selectAllDashboardChartItem(event: unknown): void {
    if (typeof event !== 'object' || event === null || !('name' in event)) {
      this.showToast('Unable to select this chart item.');
      return;
    }
    const matches = this.allDashboardChartData.filter(({ name, value }) =>
      name === event.name && (!('value' in event) || value === event.value));
    if (matches.length !== 1) {
      this.showToast('Select a specific chart item to view its period values.');
      return;
    }
    this.selectedAllDashboardDatum = { ...matches[0] };
  }

  clearAllDashboardSelection(): void {
    this.selectedAllDashboardDatum = null;
  }

  editTransfer(index: number): void {
    const transfer = this.transfers[index];
    if (!transfer) {
      return;
    }

    this.editingTransferIndex = index;
    this.isAddingTransfer = false;
    this.saveError = '';
    this.dismissToast();
    this.resetDeleteConfirmationCode();
    this.editForm.reset({
      ...transfer,
      dateOfTransfer: toDateInputValue(transfer.dateOfTransfer),
      receivedDate: toDateInputValue(transfer.receivedDate)
    });
    this.updateReceivedAmount();
  }

  addTransfer(): void {
    this.editingTransferIndex = null;
    this.isAddingTransfer = true;
    this.saveError = '';
    this.dismissToast();
    this.resetDeleteConfirmationCode();
    this.editForm.reset({
      dateOfTransfer: '',
      amountTransferredAUD: 0,
      conversionRate: 0,
      receivedDate: '',
      amountReceivedINR: 0
    });
    this.updateReceivedAmount();
  }

  toggleRecords(): void {
    this.areRecordsExpanded = !this.areRecordsExpanded;
  }

  toggleTransferSection(): void {
    this.isTransferSectionExpanded = !this.isTransferSectionExpanded;
    if (this.isTransferSectionExpanded) {
      announceAccordionOpened('transfer');
    }
  }

  private collapseTransferSection(): void {
    if (this.isTransferSectionExpanded) {
      this.isTransferSectionExpanded = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private loadAllDashboardCharts(): void {
    this.allDashboardChartsSubscription?.unsubscribe();
    this.isAllDashboardChartsLoading = true;
    this.allDashboardChartsError = '';
    this.allDashboardChartsSubscription = forkJoin({
      kumarPf: this.pfDataService.getPfData('2'),
      vasukiPf: this.pfDataService.getPfData('3'),
      kumarGratuity: this.gratuityDataService.getGratuityData('4'),
      vasukiGratuity: this.gratuityDataService.getGratuityData('5'),
      vasukiSuper: this.gratuityDataService.getGratuityData('6'),
      overallBalance: this.totalBalanceService.getTotals()
    }).subscribe({
      next: ({ kumarPf, vasukiPf, kumarGratuity, vasukiGratuity, vasukiSuper, overallBalance }) => {
        try {
          const combinedPf = this.combinePfRecords([kumarPf, vasukiPf]);
          const byMonth = (date: string, value: number): ChartDatum => ({
            name: monthDetails(date)?.label ?? date,
            value
          });
          this.allDashboardChartDataByMetric = {
            kumarPfAmount: [...kumarPf.pfRecords].reverse().map(({ date, pfAmount }) => byMonth(date, pfAmount)),
            kumarPfDifference: [...kumarPf.pfRecords].reverse().map(({ date, difference }) => byMonth(date, difference)),
            vasukiPfAmount: [...vasukiPf.pfRecords].reverse().map(({ date, pfAmount }) => byMonth(date, pfAmount)),
            vasukiPfDifference: [...vasukiPf.pfRecords].reverse().map(({ date, difference }) => byMonth(date, difference)),
            combinedPfInterest: combinedPf.map(({ name, difference }) => ({ name, value: difference })),
            combinedPfAmount: combinedPf.map(({ name, pfAmount }) => ({ name, value: pfAmount })),
            kumarGratuity: [...kumarGratuity.gratuityRecords].reverse().map(({ date, gratuity }) => byMonth(date, gratuity)),
            vasukiGratuity: [...vasukiGratuity.gratuityRecords].reverse().map(({ date, gratuity }) => byMonth(date, gratuity)),
            vasukiSuper: [...vasukiSuper.gratuityRecords].reverse().map(({ date, gratuity }) => byMonth(date, gratuity)),
            overallInterest: [...overallBalance.totalRecords].reverse().map(({ date, difference }) => byMonth(date, difference)),
            overallBalance: [...overallBalance.totalRecords].reverse().map(({ date, total }) => byMonth(date, total))
          };
        } catch (error: unknown) {
          this.allDashboardChartsError = error instanceof Error
            ? error.message
            : 'Unable to prepare the dashboard charts.';
        }

        this.isAllDashboardChartsLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isAllDashboardChartsLoading = false;
        this.allDashboardChartsError = error instanceof Error
          ? error.message
          : 'Unable to load all dashboard chart data.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private createMetricSummaryCard(metric: DashboardMetric, label: string): DashboardSummaryCard {
    const data = this.getDataForMetric(metric);
    if (metric === 'overallInterest') {
      return {
        label: 'Total interest',
        value: data.length
          ? this.formatDashboardMetricValue(metric, data.reduce((sum, { value }) => sum + value, 0))
          : '—',
        detail: this.allDashboardFrom || this.allDashboardTo
          ? 'Sum of monthly interest in the selected range' : 'Sum of all recorded monthly interest'
      };
    }
    const selected = this.selectedAllDashboardDatum;
    const latest = selected
      ? data.find(({ name }) => name === selected.name)
      : data[data.length - 1];
    return {
      label: selected ? (this.allDashboardMetrics.find(({ key }) => key === metric)?.label ?? label) : label,
      value: latest ? this.formatDashboardMetricValue(metric, latest.value) : '—',
      ...(selected ? { detail: selected.name } : {}),
      ...this.getSummaryColor(latest)
    };
  }

  private createOverallInterestComparisonCard(): DashboardSummaryCard {
    const data = this.getDataForMetric('overallInterest');
    const selected = this.selectedAllDashboardDatum;
    const index = selected ? data.findIndex(({ name }) => name === selected.name) : data.length - 1;
    const current = data[index];
    const previous = data[index - 1];
    return {
      label: selected ? 'Selected monthly interest' : 'Current monthly interest',
      value: current ? this.formatDashboardMetricValue('overallInterest', current.value) : '—',
      detail: current && previous
        ? `${current.name} | Previous (${previous.name}): ${this.formatDashboardMetricValue('overallInterest', previous.value)} | Difference: ${this.formatDashboardMetricValue('overallInterest', current.value - previous.value)}`
        : current ? `${current.name} | Difference: — (No previous recorded month)` : 'No recorded interest',
      ...this.getSummaryColor(current)
    };
  }

  private createExchangeRateSummaryCard(label: string, transfer: TransferRecord | undefined): DashboardSummaryCard {
    const date = transfer ? this.formatDate(transfer.dateOfTransfer) : '';
    return {
      label,
      value: transfer ? this.formatChartValue(transfer.conversionRate, 'conversionRate') : '—',
      detail: date ? `Transfer date: ${date}` : label === 'Previous exchange rate'
        ? 'No previous recorded transfer' : 'No exchange rates of 1 or above',
      ...this.getSummaryColor(transfer ? { name: date, value: transfer.conversionRate } : undefined)
    };
  }

  private createPreviousPeriodSummaryCard(metric: DashboardMetric): DashboardSummaryCard {
    const data = this.getDataForMetric(metric);
    const index = this.selectedAllDashboardIndex;
    const previous = data[(index >= 0 ? index : data.length - 1) - 1];
    return {
      label: 'Previous period',
      value: previous ? this.formatDashboardMetricValue(metric, previous.value) : '—',
      ...(this.selectedAllDashboardDatum ? { detail: previous?.name ?? 'No previous recorded period' } : {}),
      ...this.getSummaryColor(previous)
    };
  }

  private getSummaryColor(datum: ChartDatum | undefined): Pick<DashboardSummaryCard, 'color' | 'colorLabel'> {
    if (!datum) {
      return {};
    }
    const data = this.allDashboardChartData;
    if (!data.some(({ name }) => name === datum.name)) {
      return {};
    }
    const isLine = this.selectedChartType === 'line';
    const category = isLine ? this.selectedAllDashboardMetricOption.label : datum.name;
    const domain = isLine ? [category] : data.map(({ name }) => name);
    const colors = new ColorHelper(this.allDashboardChartColorScheme, ScaleType.Ordinal, domain);
    return {
      color: colors.getColor(category),
      colorLabel: `Chart color for ${category}`
    };
  }

  private getDataForMetric(metric: DashboardMetric): ChartDatum[] {
    return this.getUnfilteredDataForMetric(metric).filter(({ name }) =>
      this.isInAllDashboardRange(this.chartDateValue(name)));
  }

  private getUnfilteredDataForMetric(metric: DashboardMetric): ChartDatum[] {
    if (isTransferMetric(metric)) {
      return this.transfers.map((transfer) => ({
        name: this.formatDate(transfer.dateOfTransfer),
        value: transfer[metric]
      }));
    }
    return this.allDashboardChartDataByMetric[metric] ?? [];
  }

  private formatDashboardMetricValue(metric: DashboardMetric, value: number): string {
    if (isTransferMetric(metric)) {
      return this.metrics.find((option) => option.key === metric)?.format(value) ?? String(value);
    }
    return `₹ ${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}`;
  }

  private getPairedSummaryMetric(metric: DashboardMetric): DashboardMetric | null {
    switch (metric) {
      case 'kumarPfAmount': return 'kumarPfDifference';
      case 'kumarPfDifference': return 'kumarPfAmount';
      case 'vasukiPfAmount': return 'vasukiPfDifference';
      case 'vasukiPfDifference': return 'vasukiPfAmount';
      case 'combinedPfAmount': return 'combinedPfInterest';
      case 'combinedPfInterest': return 'combinedPfAmount';
      case 'overallBalance': return 'overallInterest';
      case 'overallInterest': return 'overallBalance';
      default: return null;
    }
  }

  private getSummaryLabel(metric: DashboardMetric): string {
    switch (metric) {
      case 'kumarPfAmount':
      case 'vasukiPfAmount':
        return 'Current PF balance';
      case 'kumarPfDifference':
      case 'vasukiPfDifference':
        return 'Latest monthly difference';
      case 'combinedPfAmount':
        return 'Combined PF balance';
      case 'combinedPfInterest':
        return 'Latest PF interest';
      case 'kumarGratuity':
      case 'vasukiGratuity':
        return 'Current gratuity';
      case 'vasukiSuper':
        return 'Current super balance';
      case 'overallBalance':
        return 'Current total balance';
      case 'overallInterest':
        return 'Latest monthly interest';
      default:
        return this.selectedAllDashboardMetricOption.label;
    }
  }

  private combinePfRecords(documents: PfApiDocument[]): MonthTotal[] {
    const totals = new Map<string, MonthTotal>();
    for (const document of documents) {
      for (const record of document.pfRecords) {
        const month = monthDetails(record.date);
        if (!month) {
          throw new Error(`Cannot combine PF records because "${record.date}" is not a supported month.`);
        }
        const total = totals.get(month.key) ?? {
          key: month.key,
          name: month.label,
          pfAmount: 0,
          difference: 0
        };
        total.pfAmount += record.pfAmount;
        total.difference += record.difference;
        totals.set(month.key, total);
      }
    }
    return [...totals.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  requestDeleteTransfer(index: number): void {
    if (!this.transfers[index] || this.isSaving) {
      return;
    }

    this.pendingDeleteIndex = index;
    this.saveError = '';
    this.resetDeleteConfirmationCode();
    this.dismissToast();
  }

  cancelDeleteTransfer(): void {
    if (this.isSaving) {
      return;
    }

    this.pendingDeleteIndex = null;
    this.saveError = '';
    this.resetDeleteConfirmationCode();
  }

  validateDeleteConfirmationCode(): void {
    const code = this.deleteConfirmationCode.value;
    const attempt = ++this.deleteCodeValidationAttempt;
    this.isDeleteCodeVerifying = false;
    this.isDeleteCodeVerified = false;
    this.isDeleteCodeIncorrect = false;
    this.verifiedDeleteCode = '';
    this.saveError = '';

    if (this.deleteConfirmationCode.invalid) {
      return;
    }

    this.isDeleteCodeVerifying = true;
    void this.confirmationCodeService.verify(code).then((isValid) => {
      if (attempt !== this.deleteCodeValidationAttempt) {
        return;
      }
      this.isDeleteCodeVerifying = false;
      this.isDeleteCodeVerified = isValid;
      this.isDeleteCodeIncorrect = !isValid;
      this.verifiedDeleteCode = isValid ? code : '';
      this.changeDetectorRef.detectChanges();
    }).catch(() => {
      if (attempt !== this.deleteCodeValidationAttempt) {
        return;
      }
      this.isDeleteCodeVerifying = false;
      this.saveError = 'Code verification is unavailable. Please try again.';
      this.changeDetectorRef.detectChanges();
    });
  }

  async deleteTransfer(): Promise<void> {
    const index = this.pendingDeleteIndex;
    if (index === null || !this.transfers[index] || this.isSaving) {
      return;
    }
    if (this.deleteConfirmationCode.invalid) {
      this.deleteConfirmationCode.markAsTouched();
      return;
    }
    if (
      this.isDeleteCodeVerifying ||
      !this.isDeleteCodeVerified ||
      this.verifiedDeleteCode !== this.deleteConfirmationCode.value
    ) {
      return;
    }

    const updatedTransfers = this.transfers.filter((_, transferIndex) => transferIndex !== index);
    this.setSavingState(true);
    this.saveError = '';
    this.dismissToast();
    this.transferService.updateTransfers(updatedTransfers).subscribe({
      next: (transfers) => {
        this.transfers = transfers;
        this.setSavingState(false);
        this.pendingDeleteIndex = null;
        this.resetDeleteConfirmationCode();
        this.showToast('Transfer deleted successfully.');
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.setSavingState(false);
        this.saveError = error instanceof Error
          ? error.message
          : 'Unable to delete this transfer. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private resetDeleteConfirmationCode(): void {
    this.deleteCodeValidationAttempt += 1;
    this.deleteConfirmationCode.reset('');
    this.isDeleteCodeVerifying = false;
    this.isDeleteCodeVerified = false;
    this.isDeleteCodeIncorrect = false;
    this.verifiedDeleteCode = '';
  }

  private setSavingState(isSaving: boolean): void {
    this.isSaving = isSaving;
    if (isSaving) {
      this.editForm.disable();
      this.deleteConfirmationCode.disable();
    } else {
      this.editForm.enable();
      this.deleteConfirmationCode.enable();
    }
  }

  closeEditModal(): void {
    if (this.isSaving) {
      return;
    }

    this.editingTransferIndex = null;
    this.isAddingTransfer = false;
    this.saveError = '';
    this.editForm.reset();
    this.resetDeleteConfirmationCode();
  }

  get canSaveChanges(): boolean {
    return this.editingTransferIndex !== null &&
      !this.isSaving &&
      !this.isDeleteCodeVerifying &&
      this.isDeleteCodeVerified &&
      this.deleteConfirmationCode.valid &&
      this.verifiedDeleteCode === this.deleteConfirmationCode.value;
  }

  saveTransfer(): void {
    const index = this.editingTransferIndex;
    if ((!this.isAddingTransfer && index === null) || this.editForm.invalid || this.isSaving) {
      this.editForm.markAllAsTouched();
      return;
    }
    if (!this.isAddingTransfer && !this.canSaveChanges) {
      if (this.deleteConfirmationCode.invalid) {
        this.deleteConfirmationCode.markAsTouched();
      }
      return;
    }

    this.updateReceivedAmount();
    const formValue = this.editForm.getRawValue();
    const dateOfTransfer = toBackendDate(formValue.dateOfTransfer);
    const receivedDate = toBackendDate(formValue.receivedDate);
    if (dateOfTransfer === null || receivedDate === null) {
      if (dateOfTransfer === null) {
        this.editForm.controls.dateOfTransfer.setErrors({ invalidDate: true });
        this.editForm.controls.dateOfTransfer.markAsTouched();
      }
      if (receivedDate === null) {
        this.editForm.controls.receivedDate.setErrors({ invalidDate: true });
        this.editForm.controls.receivedDate.markAsTouched();
      }
      return;
    }

    const formTransfer: TransferRecord = { ...formValue, dateOfTransfer, receivedDate };
    const updatedTransfers = this.isAddingTransfer
      ? [...this.transfers, formTransfer]
      : this.transfers.map((transfer, transferIndex) =>
        transferIndex === index ? formTransfer : transfer
      );
    const isAddingTransfer = this.isAddingTransfer;

    this.setSavingState(true);
    this.saveError = '';
    this.dismissToast();
    this.transferService.updateTransfers(updatedTransfers).subscribe({
      next: (transfers) => {
        this.transfers = transfers;
        this.setSavingState(false);
        this.editingTransferIndex = null;
        this.isAddingTransfer = false;
        this.resetDeleteConfirmationCode();
        const message = isAddingTransfer
          ? 'New transfer added successfully.'
          : 'Transfer updated successfully.';
        this.showToast(message);
        if (isAddingTransfer) {
          this.isTransferSectionExpanded = true;
          this.areRecordsExpanded = true;
        }
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.setSavingState(false);
        this.saveError = error instanceof Error
          ? error.message
          : 'Unable to update this transfer. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  formatCurrency(value: number, currency: 'AUD' | 'INR'): string {
    if (currency === 'INR') {
      return `₹ ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;
    }
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }

  private updateReceivedAmount(): void {
    const amount = this.editForm.controls.amountTransferredAUD.value;
    const rate = this.editForm.controls.conversionRate.value;
    const receivedAmount = Number.isFinite(amount) && Number.isFinite(rate)
      ? Math.round(amount * rate * 100) / 100
      : 0;

    this.editForm.controls.amountReceivedINR.setValue(receivedAmount, { emitEvent: false });
  }

  private compareTransferValues(left: TransferRecord, right: TransferRecord, key: TransferSortKey): number {
    const leftValue = left[key];
    const rightValue = right[key];
    if ((key === 'dateOfTransfer' || key === 'receivedDate')
      && typeof leftValue === 'string'
      && typeof rightValue === 'string') {
      const leftDate = dateSortValue(leftValue);
      const rightDate = dateSortValue(rightValue);
      if (leftDate !== null && rightDate !== null) {
        return leftDate - rightDate;
      }
    }

    return typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
  }

  private showToast(message: string): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = message;
    this.toastTimeout = timer(4000).subscribe(() => {
      this.toastMessage = '';
      this.changeDetectorRef.detectChanges();
    });
  }
}
