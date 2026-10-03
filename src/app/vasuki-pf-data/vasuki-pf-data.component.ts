import { announceAccordionOpened, collapseWhenAnotherOpens } from '../service/accordion-group';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import { Subscription, timer } from 'rxjs';
import { PfDataService, PfResourceId } from '../service/pf-data.service';
import { PfApiDocument, PfRecord } from '../model/pf-record';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { ResponsiveGridColumn, ResponsiveGridRow } from '../responsive-table/responsive-table.component';

type PfMetric = 'pfAmount' | 'difference';

interface PfChartDatum {
  name: string;
  value: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-vasuki-pf-data',
  templateUrl: './vasuki-pf-data.component.html',
  styleUrls: ['./vasuki-pf-data.component.scss'],
  standalone: false
})
export class VasukiPfDataComponent implements OnDestroy {
  readonly resourceId: PfResourceId = '3';
  readonly ownerName = 'Vasuki';

  readonly editForm = new FormGroup({
    date: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}$/)]
    }),
    pfAmount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)]
    }),
    difference: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required]
    })
  });
  readonly deleteConfirmationCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{8}$/)]
  });
  pfData: PfApiDocument | null = null;
  isExpanded = false;
  areRecordsExpanded = false;
  isLoading = false;
  isSaving = false;
  isAddingRecord = false;
  editingRecordIndex: number | null = null;
  pendingDeleteRecordIndex: number | null = null;
  isDeleteCodeVerifying = false;
  isDeleteCodeVerified = false;
  isDeleteCodeIncorrect = false;
  errorMessage = '';
  saveError = '';
  toastMessage = '';
  private hasLoaded = false;
  private openAddFormAfterLoad = false;
  private deleteCodeValidationAttempt = 0;
  private verifiedDeleteCode = '';
  private toastTimeout?: Subscription;
  private readonly formSubscription: Subscription;
  private readonly accordionSubscription: Subscription;
  selectedMetric: PfMetric = 'pfAmount';
  readonly gridColumns: readonly ResponsiveGridColumn[] = [
    { key: 'month', label: 'Month', sortable: true },
    { key: 'balance', label: 'PF balance', sortable: true, numeric: true },
    { key: 'difference', label: 'Monthly difference', sortable: true, numeric: true },
    { key: 'actions', label: 'Actions', actions: true }
  ];
  readonly colorScheme: Color = {
    name: 'vasuki-pf-balance',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#046a38', '#3875d7']
  };

  constructor(
    private pfDataService: PfDataService,
    private changeDetectorRef: ChangeDetectorRef,
    private confirmationCodeService: ConfirmationCodeService
  ) {
    this.accordionSubscription = collapseWhenAnotherOpens(
      () => `pf-${this.resourceId}`,
      () => this.collapse()
    );
    this.formSubscription = this.editForm.valueChanges.subscribe(() => this.syncDifference());
  }

  ngOnDestroy(): void {
    this.formSubscription.unsubscribe();
    this.accordionSubscription.unsubscribe();
    this.toastTimeout?.unsubscribe();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      announceAccordionOpened(`pf-${this.resourceId}`);
    }
    if (this.isExpanded && !this.hasLoaded && !this.isLoading) {
      this.loadPfData();
    }
  }

  private collapse(): void {
    if (this.isExpanded) {
      this.isExpanded = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  toggleRecords(): void {
    this.areRecordsExpanded = !this.areRecordsExpanded;
  }

  private loadPfData(): void {
    this.isLoading = true;
    this.pfDataService.getPfData(this.resourceId).subscribe({
      next: (data) => {
        this.pfData = data;
        this.hasLoaded = true;
        this.isLoading = false;
        if (this.openAddFormAfterLoad) {
          this.openAddFormAfterLoad = false;
          this.openAddRecordForm();
        }
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.openAddFormAfterLoad = false;
        this.isLoading = false;
        this.errorMessage = error instanceof Error ? error.message : 'Unable to load PF data.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  get records(): PfRecord[] {
    return this.pfData?.pfRecords ?? [];
  }

  get gridRows(): ResponsiveGridRow[] {
    return this.records.map((record, actionIndex) => ({
      actionIndex,
      month: this.formatMonth(record.date),
      balance: this.formatRupeesWithSpace(record.pfAmount),
      difference: this.formatRupeesWithSpace(record.difference)
    }));
  }

  get chartData(): PfChartDatum[] {
    return [...this.records].reverse().map((record) => ({
      name: this.formatMonth(record.date),
      value: record[this.selectedMetric]
    }));
  }

  get latestBalance(): number | null {
    return this.records[0]?.pfAmount ?? null;
  }

  get latestDifference(): number | null {
    return this.records[0]?.difference ?? null;
  }

  get canDeleteRecord(): boolean {
    const index = this.pendingDeleteRecordIndex;
    return !!this.pfData &&
      index !== null &&
      !!this.records[index] &&
      !this.isSaving &&
      !this.isDeleteCodeVerifying &&
      this.isDeleteCodeVerified &&
      this.deleteConfirmationCode.valid &&
      this.verifiedDeleteCode === this.deleteConfirmationCode.value;
  }

  get canSaveChanges(): boolean {
    return this.editingRecordIndex !== null &&
      !this.isSaving &&
      !this.isDeleteCodeVerifying &&
      this.isDeleteCodeVerified &&
      this.deleteConfirmationCode.valid &&
      this.verifiedDeleteCode === this.deleteConfirmationCode.value;
  }

  get metricLabel(): string {
    return this.selectedMetric === 'pfAmount' ? 'PF balance' : 'Monthly difference';
  }

  get axisLabel(): string {
    return this.selectedMetric === 'pfAmount' ? 'PF balance (INR)' : 'Monthly difference (INR)';
  }

  selectMetric(metric: PfMetric): void {
    this.selectedMetric = metric;
  }

  addRecord(): void {
    if (this.isSaving) {
      return;
    }
    if (!this.hasLoaded || !this.pfData) {
      this.openAddFormAfterLoad = true;
      if (!this.isLoading) {
        this.loadPfData();
      }
      return;
    }
    this.openAddRecordForm();
  }

  private openAddRecordForm(): void {
    this.saveError = '';
    this.isAddingRecord = true;
    this.editingRecordIndex = null;
    this.editForm.reset({ date: '', pfAmount: 0, difference: 0 });
  }

  editRecord(index: number): void {
    const record = this.records[index];
    if (!record || this.isSaving) {
      return;
    }
    this.saveError = '';
    this.resetDeleteConfirmationCode();
    this.isAddingRecord = false;
    this.editingRecordIndex = index;
    this.editForm.reset({
      date: this.toMonthInputValue(record.date),
      pfAmount: record.pfAmount,
      difference: record.difference
    });
  }

  closeEditModal(): void {
    if (this.isSaving) {
      return;
    }
    this.isAddingRecord = false;
    this.editingRecordIndex = null;
    this.saveError = '';
    this.editForm.reset({ date: '', pfAmount: 0, difference: 0 });
    this.resetDeleteConfirmationCode();
  }

  saveRecord(): void {
    if (!this.pfData || this.isSaving || (!this.isAddingRecord && this.editingRecordIndex === null)) {
      return;
    }
    if (!this.isAddingRecord && !this.canSaveChanges) {
      if (this.deleteConfirmationCode.invalid) {
        this.deleteConfirmationCode.markAsTouched();
      }
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formValue = this.editForm.getRawValue();
    const date = this.toApiMonthValue(formValue.date);
    if (!date) {
      this.editForm.controls.date.setErrors({ invalidMonth: true });
      this.editForm.controls.date.markAsTouched();
      return;
    }

    const duplicateMonth = this.records.some((record, index) =>
      index !== this.editingRecordIndex && this.toMonthInputValue(record.date) === formValue.date
    );
    if (duplicateMonth) {
      this.editForm.controls.date.setErrors({ duplicateMonth: true });
      this.editForm.controls.date.markAsTouched();
      return;
    }

    const record: PfRecord = {
      date,
      pfAmount: formValue.pfAmount,
      difference: this.calculateDifference(formValue.date, formValue.pfAmount)
    };
    const addingRecord = this.isAddingRecord;
    const records = [...this.records];
    if (addingRecord) {
      records.unshift(record);
    } else if (this.editingRecordIndex !== null) {
      records[this.editingRecordIndex] = record;
    }

    this.setSavingState(true);
    this.saveError = '';
    this.dismissToast();
    this.pfDataService.updatePfData({ ...this.pfData, pfRecords: records }, this.resourceId).subscribe({
      next: (data) => {
        this.pfData = data;
        this.setSavingState(false);
        this.closeEditModal();
        if (addingRecord) {
          this.areRecordsExpanded = true;
        }
        this.showToast(addingRecord ? 'PF record added successfully.' : 'PF record updated successfully.');
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.setSavingState(false);
        this.saveError = error instanceof Error ? error.message : 'Unable to save the PF record.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  dismissToast(): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = '';
  }

  requestDeleteRecord(index: number): void {
    if (!this.records[index] || this.isSaving) {
      return;
    }
    this.pendingDeleteRecordIndex = index;
    this.saveError = '';
    this.resetDeleteConfirmationCode();
  }

  cancelDeleteRecord(): void {
    if (this.isSaving) {
      return;
    }
    this.pendingDeleteRecordIndex = null;
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

  deleteRecord(): void {
    const index = this.pendingDeleteRecordIndex;
    if (!this.canDeleteRecord || !this.pfData || index === null) {
      return;
    }

    const records = this.records.filter((_, recordIndex) => recordIndex !== index);
    this.setSavingState(true);
    this.saveError = '';
    this.dismissToast();
    this.pfDataService.updatePfData({ ...this.pfData, pfRecords: records }, this.resourceId).subscribe({
      next: (data) => {
        this.pfData = data;
        this.setSavingState(false);
        this.pendingDeleteRecordIndex = null;
        this.resetDeleteConfirmationCode();
        this.showToast('PF record deleted successfully.');
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.setSavingState(false);
        this.saveError = error instanceof Error ? error.message : 'Unable to delete the PF record.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  formatMonth(value: string): string {
    const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value);
    if (!match) {
      return value;
    }
    const month = MONTHS.find((item) => item.toLowerCase() === match[1].slice(0, 3).toLowerCase());
    if (!month) {
      return value;
    }
    const year = match[2].length === 2 ? `20${match[2]}` : match[2];
    return `${month} ${year}`;
  }

  // Difference = this month's balance minus the immediately previous month's balance.
  private calculateDifference(month: string, pfAmount: number): number {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) {
      return 0;
    }
    const previous = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    const previousRecord = this.records.find((record, index) =>
      index !== this.editingRecordIndex && this.toMonthInputValue(record.date) === previousKey
    );
    if (previousRecord) {
      return pfAmount - previousRecord.pfAmount;
    }
    // No previous month on record (e.g. the oldest month): keep the stored difference.
    return this.editingRecordIndex !== null ? this.records[this.editingRecordIndex]?.difference ?? 0 : 0;
  }

  private syncDifference(): void {
    const { date, pfAmount } = this.editForm.getRawValue();
    const difference = this.calculateDifference(date, pfAmount);
    if (this.editForm.controls.difference.value !== difference) {
      this.editForm.controls.difference.setValue(difference, { emitEvent: false });
    }
  }

  private toMonthInputValue(value: string): string {
    const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value);
    if (!match) {
      return '';
    }
    const monthIndex = MONTHS.findIndex((item) => item.toLowerCase() === match[1].slice(0, 3).toLowerCase());
    if (monthIndex < 0) {
      return '';
    }
    const year = match[2].length === 2 ? `20${match[2]}` : match[2];
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private toApiMonthValue(value: string): string | null {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) {
      return null;
    }
    const month = MONTHS[Number(match[2]) - 1];
    return `${month}'${match[1].slice(-2)}`;
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

  formatRupees(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatRupeesWithSpace(value: number): string {
    return this.formatRupees(value).replace('₹', '₹ ');
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
