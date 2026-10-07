import { announceAccordionOpened, collapseWhenAnotherOpens } from '../service/accordion-group';
import { ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import {
  chartColorScheme, CHART_TYPE_OPTIONS, ChartDatum, ChartType, isChartType, toLineChartSeries
} from '../model/chart-type';
import { GratuityApiDocument, GratuityRecord } from '../model/gratuity-record';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { GratuityDataService, GratuityResourceId } from '../service/gratuity-data.service';
import { ResponsiveGridColumn, ResponsiveGridRow } from '../responsive-table/responsive-table.component';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthParts(value: string): { year: string; monthIndex: number } | null {
  const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value);
  if (!match) {
    return null;
  }
  const monthIndex = MONTHS.findIndex((month) =>
    month.toLowerCase() === match[1].slice(0, 3).toLowerCase()
  );
  if (monthIndex < 0) {
    return null;
  }
  return {
    year: match[2].length === 2 ? `20${match[2]}` : match[2],
    monthIndex
  };
}

@Component({
  selector: 'app-kumar-gratuity',
  templateUrl: './kumar-gratuity.component.html',
  styleUrls: ['./kumar-gratuity.component.scss'],
  standalone: false
})
export class KumarGratuityComponent implements OnDestroy {
  @Input() resourceId: GratuityResourceId = '4';
  @Input() ownerName = 'Kumar';

  readonly editForm = new FormGroup({
    date: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]
    }),
    gratuity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)]
    }),
    previousMonthValue: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)]
    }),
    difference: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required]
    })
  });
  readonly confirmationCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{14}$/)]
  });
  gratuityData: GratuityApiDocument | null = null;
  previousMonthFound = false;
  private readonly dateSubscription: Subscription;
  private readonly accordionSubscription: Subscription;
  isExpanded = false;
  areRecordsExpanded = false;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  saveError = '';
  toastMessage = '';
  isAddingRecord = false;
  editingRecordIndex: number | null = null;
  pendingDeleteRecordIndex: number | null = null;
  isCodeVerifying = false;
  isCodeVerified = false;
  isCodeIncorrect = false;
  selectedChartType: ChartType = 'bar';
  readonly chartTypeOptions = CHART_TYPE_OPTIONS;
  private hasLoaded = false;
  private openAddAfterLoad = false;
  private codeValidationAttempt = 0;
  private verifiedCode = '';
  private toastTimeout?: Subscription;
  constructor(
    private gratuityDataService: GratuityDataService,
    private confirmationCodeService: ConfirmationCodeService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.accordionSubscription = collapseWhenAnotherOpens(
      () => `gratuity-${this.resourceId}`,
      () => this.collapse()
    );
    this.dateSubscription = this.editForm.controls.date.valueChanges.subscribe((month) =>
      this.populatePreviousMonthValue(month)
    );
  }

  ngOnDestroy(): void {
    this.dateSubscription.unsubscribe();
    this.accordionSubscription.unsubscribe();
    this.toastTimeout?.unsubscribe();
  }

  get records(): GratuityRecord[] {
    return this.gratuityData?.gratuityRecords ?? [];
  }

  get gridRows(): ResponsiveGridRow[] {
    return this.records.map((record, actionIndex) => ({
      actionIndex,
      month: this.formatMonth(record.date),
      value: this.formatRupees(record.gratuity),
      difference: this.formatRupees(record.difference)
    }));
  }

  get recordTypeLabel(): string {
    return this.gratuityData?.type || (this.resourceId === '6' ? 'Super' : 'Gratuity');
  }

  get gridColumns(): readonly ResponsiveGridColumn[] {
    return [
      { key: 'month', label: 'Month', sortable: true },
      { key: 'value', label: this.recordTypeLabel, sortable: true, numeric: true },
      { key: 'difference', label: 'Difference', sortable: true, numeric: true },
      { key: 'actions', label: 'Actions', actions: true }
    ];
  }

  get chartData(): ChartDatum[] {
    return [...this.records].reverse().map((record) => ({
      name: this.formatMonth(record.date),
      value: record.gratuity
    }));
  }

  get colorScheme() {
    return chartColorScheme(this.chartData, 'kumar-gratuity');
  }

  get lineChartData() {
    return toLineChartSeries(this.chartData, this.recordTypeLabel);
  }

  selectChartType(type: string): void {
    if (isChartType(type)) {
      this.selectedChartType = type;
    }
  }

  get latestGratuity(): number | null {
    return this.records[0]?.gratuity ?? null;
  }

  get canConfirmAction(): boolean {
    return this.pendingDeleteRecordIndex !== null &&
      !this.isSaving &&
      !this.isCodeVerifying &&
      this.isCodeVerified &&
      this.confirmationCode.valid &&
      this.verifiedCode === this.confirmationCode.value;
  }

  get canSaveChanges(): boolean {
    return this.editingRecordIndex !== null &&
      !this.isSaving &&
      !this.isCodeVerifying &&
      this.isCodeVerified &&
      this.confirmationCode.valid &&
      this.verifiedCode === this.confirmationCode.value;
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      announceAccordionOpened(`gratuity-${this.resourceId}`);
    }
    if (this.isExpanded && !this.hasLoaded && !this.isLoading) {
      this.loadData();
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

  editRecord(index: number): void {
    const record = this.records[index];
    if (!record || this.isSaving) {
      return;
    }
    const parts = monthParts(record.date);
    if (!parts) {
      this.saveError = `Cannot edit the gratuity record because "${record.date}" is not a supported month.`;
      return;
    }

    this.saveError = '';
    this.resetConfirmationCode();
    this.isAddingRecord = false;
    this.editingRecordIndex = index;
    this.editForm.reset({
      date: `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}`,
      gratuity: record.gratuity,
      previousMonthValue: 0,
      difference: record.difference
    });
  }

  addRecord(): void {
    if (this.isSaving) {
      return;
    }
    if (!this.hasLoaded || !this.gratuityData) {
      this.openAddAfterLoad = true;
      if (!this.isLoading) {
        this.loadData();
      }
      return;
    }
    this.openAddRecordForm();
  }

  private populatePreviousMonthValue(month: string): void {
    this.previousMonthFound = false;
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!this.isAddingRecord || !match) {
      return;
    }
    const previous = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    const previousRecord = this.records.find((record) => this.toMonthInputValue(record.date) === previousKey);
    if (previousRecord) {
      this.previousMonthFound = true;
      this.editForm.controls.previousMonthValue.setValue(previousRecord.gratuity, { emitEvent: false });
      this.calculateDifference();
    }
  }

  calculateDifference(): void {
    const { gratuity, previousMonthValue } = this.editForm.getRawValue();
    this.editForm.controls.difference.setValue(gratuity - previousMonthValue, { emitEvent: false });
  }

  addNewRecord(): void {
    if (!this.gratuityData || !this.isAddingRecord || this.isSaving) {
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.calculateDifference();
    const formValue = this.editForm.getRawValue();
    const date = this.toApiMonthValue(formValue.date);
    if (!date) {
      this.editForm.controls.date.setErrors({ invalidMonth: true });
      this.editForm.controls.date.markAsTouched();
      return;
    }
    if (this.records.some((record) => this.toMonthInputValue(record.date) === formValue.date)) {
      this.editForm.controls.date.setErrors({ duplicateMonth: true });
      this.editForm.controls.date.markAsTouched();
      return;
    }

    this.persistRecords([
      { date, gratuity: formValue.gratuity, difference: formValue.difference },
      ...this.records
    ], 'Gratuity record added successfully.', true);
  }

  closeEditModal(): void {
    if (this.isSaving) {
      return;
    }
    this.isAddingRecord = false;
    this.editingRecordIndex = null;
    this.saveError = '';
    this.editForm.reset({ date: '', gratuity: 0, previousMonthValue: 0, difference: 0 });
    this.resetConfirmationCode();
  }

  requestDeleteRecord(index: number): void {
    if (!this.records[index] || this.isSaving) {
      return;
    }
    this.pendingDeleteRecordIndex = index;
    this.saveError = '';
    this.resetConfirmationCode();
  }

  cancelDeleteRecord(): void {
    if (this.isSaving) {
      return;
    }
    this.pendingDeleteRecordIndex = null;
    this.saveError = '';
    this.resetConfirmationCode();
  }

  validateConfirmationCode(): void {
    const code = this.confirmationCode.value;
    const attempt = ++this.codeValidationAttempt;
    this.isCodeVerifying = false;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.verifiedCode = '';
    this.saveError = '';
    if (this.confirmationCode.invalid) {
      return;
    }

    this.isCodeVerifying = true;
    void this.confirmationCodeService.verify(code).then((isValid) => {
      if (attempt !== this.codeValidationAttempt) {
        return;
      }
      this.isCodeVerifying = false;
      this.isCodeVerified = isValid;
      this.isCodeIncorrect = !isValid;
      this.verifiedCode = isValid ? code : '';
      this.changeDetectorRef.detectChanges();
    }).catch(() => {
      if (attempt !== this.codeValidationAttempt) {
        return;
      }
      this.isCodeVerifying = false;
      this.saveError = 'Code verification is unavailable. Please try again.';
      this.changeDetectorRef.detectChanges();
    });
  }

  saveChanges(): void {
    const index = this.editingRecordIndex;
    if (!this.gratuityData || index === null || this.isSaving) {
      return;
    }
    if (!this.canSaveChanges) {
      if (this.confirmationCode.invalid) {
        this.confirmationCode.markAsTouched();
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
    const duplicateMonth = this.records.some((record, recordIndex) =>
      recordIndex !== index && this.toMonthInputValue(record.date) === formValue.date
    );
    if (duplicateMonth) {
      this.editForm.controls.date.setErrors({ duplicateMonth: true });
      this.editForm.controls.date.markAsTouched();
      return;
    }

    const gratuityRecords = [...this.records];
    gratuityRecords[index] = { date, gratuity: formValue.gratuity, difference: formValue.difference };
    this.persistRecords(gratuityRecords, 'Gratuity record updated successfully.');
  }

  deleteRecord(): void {
    const index = this.pendingDeleteRecordIndex;
    if (!this.gratuityData || index === null || !this.canConfirmAction) {
      return;
    }
    const gratuityRecords = this.records.filter((_, recordIndex) => recordIndex !== index);
    this.persistRecords(gratuityRecords, 'Gratuity record deleted successfully.');
  }

  formatMonth(value: string): string {
    const parts = monthParts(value);
    return parts ? `${MONTHS[parts.monthIndex]} ${parts.year}` : value;
  }

  formatRupees(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value).replace('₹', '₹ ');
  }

  dismissToast(): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = '';
  }

  private loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.gratuityDataService.getGratuityData(this.resourceId).subscribe({
      next: (data) => {
        this.gratuityData = data;
        this.hasLoaded = true;
        this.isLoading = false;
        if (this.openAddAfterLoad) {
          this.openAddAfterLoad = false;
          this.openAddRecordForm();
        }
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.openAddAfterLoad = false;
        this.isLoading = false;
        this.errorMessage = error instanceof Error ? error.message : 'Unable to load gratuity data.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private persistRecords(records: GratuityRecord[], message: string, expandRecords = false): void {
    if (!this.gratuityData) {
      return;
    }
    this.setSavingState(true);
    this.saveError = '';
    this.dismissToast();
    this.gratuityDataService.updateGratuityData({
      ...this.gratuityData,
      gratuityRecords: records
    }, this.resourceId).subscribe({
      next: (data) => {
        this.gratuityData = data;
        this.setSavingState(false);
        this.closeEditModal();
        this.pendingDeleteRecordIndex = null;
        if (expandRecords) {
          this.areRecordsExpanded = true;
        }
        this.resetConfirmationCode();
        this.toastMessage = message;
        this.toastTimeout = timer(4000).subscribe(() => this.dismissToast());
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.setSavingState(false);
        this.saveError = error instanceof Error ? error.message : 'Unable to save gratuity records.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private openAddRecordForm(): void {
    this.saveError = '';
    this.isAddingRecord = true;
    this.editingRecordIndex = null;
    this.resetConfirmationCode();
    this.editForm.reset({ date: '', gratuity: 0, previousMonthValue: 0, difference: 0 });
  }

  private toMonthInputValue(value: string): string {
    const parts = monthParts(value);
    return parts ? `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}` : '';
  }

  private toApiMonthValue(value: string): string | null {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) {
      return null;
    }
    return `${MONTHS[Number(match[2]) - 1]}'${match[1].slice(-2)}`;
  }

  private resetConfirmationCode(): void {
    this.codeValidationAttempt += 1;
    this.confirmationCode.reset('');
    this.isCodeVerifying = false;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.verifiedCode = '';
  }

  private setSavingState(isSaving: boolean): void {
    this.isSaving = isSaving;
    if (isSaving) {
      this.editForm.disable();
      this.confirmationCode.disable();
    } else {
      this.editForm.enable();
      this.confirmationCode.enable();
    }
  }
}
