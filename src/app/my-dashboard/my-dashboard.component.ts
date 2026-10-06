import { announceAccordionOpened, collapseWhenAnotherOpens } from '../service/accordion-group';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin, merge, Subscription, timer } from 'rxjs';
import { ColorHelper, ScaleType } from '@swimlane/ngx-charts';
import { chartColorScheme, CHART_TYPE_OPTIONS, ChartType, isChartType } from '../model/chart-type';
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
  const monthYear = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value.trim());
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
export class MyDashboardComponent implements OnInit, OnDestroy {
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
    validators: [Validators.required, Validators.pattern(/^\d{8}$/)]
  });

  readonly chartTypeOptions = CHART_TYPE_OPTIONS;

  get metricOptions(): { label: string; value: string }[] {
    return this.metrics.map((metric) => ({ label: metric.label, value: metric.key }));
  }

  get allDashboardMetricOptions(): { label: string; value: string }[] {
    return this.allDashboardMetrics.map(({ label, key }) => ({ label, value: key }));
  }

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
  sortKey: TransferSortKey | null = null;
  sortDirection: SortDirection = 'asc';
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

  ngOnDestroy(): void {
    this.toastTimeout?.unsubscribe();
    this.amountCalculation?.unsubscribe();
    this.allDashboardChartsSubscription?.unsubscribe();
    this.accordionSubscription.unsubscribe();
  }

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
    if (isTransferMetric(this.selectedAllDashboardMetric)) {
      return this.chartData;
    }
    return this.allDashboardChartDataByMetric[this.selectedAllDashboardMetric] ?? [];
  }

  get allDashboardSummaryCards(): DashboardSummaryCard[] {
    const metric = this.selectedAllDashboardMetric;
    const transactionCount = this.transfers.length;

    if (metric === 'conversionRate') {
      const eligible = this.transfers.filter(({ conversionRate }) =>
        Number.isFinite(conversionRate) && conversionRate >= 1
      );
      const lowest = eligible.reduce<TransferRecord | undefined>((result, transfer) =>
        !result || transfer.conversionRate < result.conversionRate ? transfer : result, undefined);
      const highest = eligible.reduce<TransferRecord | undefined>((result, transfer) =>
        !result || transfer.conversionRate > result.conversionRate ? transfer : result, undefined);
      return [
        this.createExchangeRateSummaryCard('Lowest exchange rate', lowest),
        this.createExchangeRateSummaryCard('Highest exchange rate', highest),
        { label: 'Transfers', value: new Intl.NumberFormat('en-AU').format(transactionCount) }
      ];
    }

    if (isTransferMetric(metric)) {
      const totalSent = this.transfers.reduce((sum, transfer) => sum + transfer.amountTransferredAUD, 0);
      const totalReceived = this.transfers.reduce((sum, transfer) => sum + transfer.amountReceivedINR, 0);
      return [
        {
          label: 'Transfers',
          value: new Intl.NumberFormat('en-AU').format(transactionCount)
        },
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
    const recordCount = this.getDataForMetric(metric).length;
    cards.push({
      label: 'Recorded periods',
      value: new Intl.NumberFormat('en-AU').format(recordCount)
    });
    return cards;
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

  get colorScheme() {
    return chartColorScheme(this.chartData, 'transfers');
  }

  get chartData(): ChartDatum[] {
    return this.transfers.map((transfer) => ({
      name: this.formatDate(transfer.dateOfTransfer),
      value: transfer[this.selectedMetric]
    }));
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
    return [{
      name: this.selectedMetricOption.label,
      series: this.chartData
    }];
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
    const rows = this.transfers.map((transfer, index) => ({ transfer, index }));
    const sortKey = this.sortKey;
    if (sortKey === null) {
      return rows;
    }
    return rows.sort((left, right) => {
      const comparison = this.compareTransferValues(left.transfer, right.transfer, sortKey);
      return comparison === 0
        ? left.index - right.index
        : this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  get transferGridRows(): ResponsiveGridRow[] {
    return this.sortedTransfers.map(({ transfer }, actionIndex) => ({
      actionIndex,
      transferDate: this.formatDate(transfer.dateOfTransfer),
      sent: this.formatTransferCurrency(transfer.amountTransferredAUD, 'AUD'),
      rate: transfer.conversionRate.toFixed(2),
      receivedDate: this.formatDate(transfer.receivedDate),
      received: this.formatTransferCurrency(transfer.amountReceivedINR, 'INR')
    }));
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
    if (isTransferMetric(this.selectedAllDashboardMetric)) {
      this.selectedMetric = this.selectedAllDashboardMetric;
    }
  }

  openAllDetailsModal(): void {
    this.isAllDetailsModalOpen = true;
    this.selectedAllDashboardMetric = this.selectedMetric;
    if (!Object.keys(this.allDashboardChartDataByMetric).length) {
      this.loadAllDashboardCharts();
    }
  }

  closeAllDetails(): void {
    this.isAllDetailsModalOpen = false;
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
    const latest = data[data.length - 1];
    return {
      label,
      value: latest ? this.formatDashboardMetricValue(metric, latest.value) : '—',
      ...this.getSummaryColor(latest)
    };
  }

  private createExchangeRateSummaryCard(label: string, transfer: TransferRecord | undefined): DashboardSummaryCard {
    const date = transfer ? this.formatDate(transfer.dateOfTransfer) : '';
    return {
      label,
      value: transfer ? this.formatChartValue(transfer.conversionRate, 'conversionRate') : '—',
      detail: date ? `Transfer date: ${date}` : 'No exchange rates of 1 or above',
      ...this.getSummaryColor(transfer ? { name: date, value: transfer.conversionRate } : undefined)
    };
  }

  private createPreviousPeriodSummaryCard(metric: DashboardMetric): DashboardSummaryCard {
    const data = this.getDataForMetric(metric);
    const previous = data[data.length - 2];
    return {
      label: 'Previous period',
      value: previous ? this.formatDashboardMetricValue(metric, previous.value) : '—',
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
