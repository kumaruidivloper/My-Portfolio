import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import { merge, Subscription, timer } from 'rxjs';
import { TransferRecord } from '../model/transfer';
import { TransferService } from '../service/transfer.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';

type DashboardChartType = 'bar' | 'line' | 'pie' | 'doughnut';
type TransferMetric = 'amountTransferredAUD' | 'amountReceivedINR' | 'conversionRate';
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

interface MetricOption {
  label: string;
  key: TransferMetric;
  axisLabel: string;
  format: (value: number) => string;
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

  readonly chartTypes: { label: string; value: DashboardChartType }[] = [
    { label: 'Bar', value: 'bar' },
    { label: 'Line', value: 'line' },
    { label: 'Pie', value: 'pie' },
    { label: 'Doughnut', value: 'doughnut' }
  ];

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

  selectedChartType: DashboardChartType = 'bar';
  selectedMetric: TransferMetric = 'amountTransferredAUD';
  transfers: TransferRecord[] = [];
  isLoading = true;
  errorMessage = '';
  editingTransferIndex: number | null = null;
  isAddingTransfer = false;
  areRecordsExpanded = false;
  isSaving = false;
  pendingDeleteIndex: number | null = null;
  saveError = '';
  toastMessage = '';
  sortKey: TransferSortKey | null = null;
  sortDirection: SortDirection = 'asc';
  private toastTimeout?: Subscription;
  private amountCalculation?: Subscription;
  readonly chartView: [number, number] = [900, 430];
  readonly colorScheme: Color = {
    name: 'transfers',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#ff671f', '#046a38', '#3875d7', '#d6a514', '#8e44ad', '#16a085', '#e74c3c']
  };

  constructor(
    private transferService: TransferService,
    private changeDetectorRef: ChangeDetectorRef,
    private confirmationCodeService: ConfirmationCodeService
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
  }

  dismissToast(): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = '';
  }

  get selectedMetricOption(): MetricOption {
    return this.metrics.find((metric) => metric.key === this.selectedMetric) ?? this.metrics[0];
  }

  get chartData(): ChartDatum[] {
    return this.transfers.map((transfer) => ({
      name: transfer.dateOfTransfer,
      value: transfer[this.selectedMetric]
    }));
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

  sortTransfers(key: TransferSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDirection = 'asc';
  }

  sortIndicator(key: TransferSortKey): string {
    if (this.sortKey !== key) {
      return '↕';
    }

    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  selectChartType(type: DashboardChartType): void {
    this.selectedChartType = type;
  }

  selectMetric(metric: TransferMetric): void {
    this.selectedMetric = metric;
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

  requestDeleteTransfer(index: number): void {
    if (!this.transfers[index] || this.isSaving) {
      return;
    }

    this.pendingDeleteIndex = index;
    this.saveError = '';
    this.deleteConfirmationCode.reset('');
    this.dismissToast();
  }

  cancelDeleteTransfer(): void {
    if (this.isSaving) {
      return;
    }

    this.pendingDeleteIndex = null;
    this.saveError = '';
    this.deleteConfirmationCode.reset('');
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
    this.isSaving = true;
    let isCodeValid: boolean;
    try {
      isCodeValid = await this.confirmationCodeService.verify(this.deleteConfirmationCode.value);
    } catch {
      this.isSaving = false;
      this.saveError = 'Code verification is unavailable. Please try again.';
      return;
    }
    if (!isCodeValid) {
      this.isSaving = false;
      this.deleteConfirmationCode.setErrors({ confirmationCode: true });
      this.deleteConfirmationCode.markAsTouched();
      return;
    }

    const updatedTransfers = this.transfers.filter((_, transferIndex) => transferIndex !== index);
    this.saveError = '';
    this.dismissToast();
    this.transferService.updateTransfers(updatedTransfers).subscribe({
      next: (transfers) => {
        this.transfers = transfers;
        this.isSaving = false;
        this.pendingDeleteIndex = null;
        this.deleteConfirmationCode.reset('');
        this.showToast('Transfer deleted successfully.');
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.saveError = error instanceof Error
          ? error.message
          : 'Unable to delete this transfer. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  closeEditModal(): void {
    if (this.isSaving) {
      return;
    }

    this.editingTransferIndex = null;
    this.isAddingTransfer = false;
    this.saveError = '';
    this.editForm.reset();
  }

  saveTransfer(): void {
    const index = this.editingTransferIndex;
    if ((!this.isAddingTransfer && index === null) || this.editForm.invalid || this.isSaving) {
      this.editForm.markAllAsTouched();
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

    this.isSaving = true;
    this.saveError = '';
    this.dismissToast();
    this.transferService.updateTransfers(updatedTransfers).subscribe({
      next: (transfers) => {
        this.transfers = transfers;
        this.isSaving = false;
        this.editingTransferIndex = null;
        this.isAddingTransfer = false;
        const message = isAddingTransfer
          ? 'New transfer added successfully.'
          : 'Transfer updated successfully.';
        this.showToast(message);
        if (isAddingTransfer) {
          this.areRecordsExpanded = true;
        }
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.saveError = error instanceof Error
          ? error.message
          : 'Unable to update this transfer. Please try again.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private formatCurrency(value: number, currency: 'AUD' | 'INR'): string {
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
