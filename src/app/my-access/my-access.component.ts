import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { AccessDetails, AccessRecordChangedError, BankAccessDetail, MyAccessDataService } from './my-access-data.service';

interface AccessField {
  key: keyof BankAccessDetail;
  label: string;
  sensitive: boolean;
  required?: boolean;
}

const ACCESS_FIELDS: AccessField[] = [
  { key: 'type', label: 'Access type', sensitive: false, required: true },
  { key: 'customerName', label: 'Customer', sensitive: false, required: true },
  { key: 'bankName', label: 'Bank / service', sensitive: false, required: true },
  { key: 'branch', label: 'Branch', sensitive: false },
  { key: 'accountName', label: 'Account name', sensitive: false, required: true },
  { key: 'accountType', label: 'Account type', sensitive: false },
  { key: 'accountNumber', label: 'Account number', sensitive: true, required: true },
  { key: 'ifsc', label: 'IFSC', sensitive: true },
  { key: 'upi', label: 'UPI ID', sensitive: true },
  { key: 'userName', label: 'Username', sensitive: true },
  { key: 'password', label: 'Password', sensitive: true },
  { key: 'profilePassword', label: 'Profile password', sensitive: true }
];

const nonBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

@Component({
  selector: 'app-my-access',
  templateUrl: './my-access.component.html',
  styleUrls: ['./my-access.component.scss'],
  host: { '[class.my-access-editing]': 'editingIndex !== null' },
  standalone: false
})
export class MyAccessComponent implements OnInit, OnDestroy {
  readonly editFields = ACCESS_FIELDS;
  readonly editForm = new FormGroup({
    type: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
    customerName: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
    bankName: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
    branch: new FormControl('', { nonNullable: true }),
    accountName: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
    accountType: new FormControl('', { nonNullable: true }),
    accountNumber: new FormControl('', { nonNullable: true, validators: [nonBlank] }),
    ifsc: new FormControl('', { nonNullable: true }),
    upi: new FormControl('', { nonNullable: true }),
    userName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    profilePassword: new FormControl('', { nonNullable: true })
  });
  readonly confirmationCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{14}$/)]
  });
  details: AccessDetails | null = null;
  isLoading = false;
  errorMessage = '';
  editingIndex: number | null = null;
  isSaving = false;
  saveError = '';
  saveSuccess = '';
  isCodeVerifying = false;
  isCodeVerified = false;
  isCodeIncorrect = false;
  codeError = '';
  showConfirmationCode = false;
  private readonly visibleEditPasswords = new Set<keyof BankAccessDetail>();
  private request?: Subscription;
  private saveRequest?: Subscription;
  private readonly codeSubscription: Subscription;
  private codeAttempt = 0;
  private verifiedCode = '';
  private editingOriginal?: BankAccessDetail;
  private readonly revealedFields = new Set<string>();

  constructor(
    private readonly accessData: MyAccessDataService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly confirmationCodeService: ConfirmationCodeService
  ) {
    this.codeSubscription = this.confirmationCode.valueChanges.subscribe(() => this.verifyCode());
  }

  ngOnInit(): void {
    this.loadAccessDetails();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.saveRequest?.unsubscribe();
    this.codeAttempt++;
    this.codeSubscription.unsubscribe();
  }

  openEdit(index: number): void {
    const record = this.details?.bankAccessDetails[index];
    if (!record || this.isSaving) {
      return;
    }
    this.editingIndex = index;
    this.editingOriginal = { ...record };
    this.editForm.reset(record);
    this.resetCode();
    this.saveError = '';
    this.saveSuccess = '';
  }

  @HostListener('document:keydown.escape')
  closeEdit(): void {
    if (this.isSaving) {
      return;
    }
    this.editingIndex = null;
    this.editingOriginal = undefined;
    this.saveError = '';
    this.resetCode();
  }

  get canSaveChanges(): boolean {
    return this.editingIndex !== null && !this.isSaving && this.editForm.valid
      && !this.isCodeVerifying && this.isCodeVerified && this.confirmationCode.valid
      && this.verifiedCode === this.confirmationCode.value;
  }

  isEditPasswordVisible(field: keyof BankAccessDetail): boolean {
    return this.visibleEditPasswords.has(field);
  }

  toggleEditPassword(field: keyof BankAccessDetail): void {
    if (this.visibleEditPasswords.has(field)) {
      this.visibleEditPasswords.delete(field);
    } else {
      this.visibleEditPasswords.add(field);
    }
  }

  verifyCode(): void {
    const attempt = ++this.codeAttempt;
    const code = this.confirmationCode.value;
    this.isCodeVerifying = false;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.verifiedCode = '';
    this.codeError = '';
    if (this.confirmationCode.invalid || this.editingIndex === null) {
      return;
    }

    this.isCodeVerifying = true;
    void this.confirmationCodeService.verify(code).then((valid) => {
      if (attempt !== this.codeAttempt) {
        return;
      }
      this.isCodeVerifying = false;
      this.isCodeVerified = valid;
      this.isCodeIncorrect = !valid;
      this.verifiedCode = valid ? code : '';
      this.changeDetector.markForCheck();
    }).catch(() => {
      if (attempt !== this.codeAttempt) {
        return;
      }
      this.isCodeVerifying = false;
      this.codeError = 'Code verification is unavailable. Please try again.';
      this.changeDetector.markForCheck();
    });
  }

  saveEdit(): void {
    if (this.isSaving || this.editingIndex === null || !this.editingOriginal) {
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    if (!this.canSaveChanges) {
      return;
    }
    this.isSaving = true;
    this.saveError = '';
    this.saveRequest = this.accessData.updateAccessRecord(
      this.editingIndex, this.editingOriginal, this.editForm.getRawValue()
    ).subscribe({
      next: (details) => {
        this.details = details;
        this.revealedFields.clear();
        this.isSaving = false;
        this.closeEdit();
        this.saveSuccess = 'Access record updated successfully.';
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.saveError = error instanceof AccessRecordChangedError
          ? error.message
          : 'Unable to update access details. Please try again.';
        this.changeDetector.markForCheck();
      }
    });
  }

  loadAccessDetails(): void {
    this.request?.unsubscribe();
    this.revealedFields.clear();
    this.isLoading = true;
    this.errorMessage = '';
    this.request = this.accessData.getAccessDetails().subscribe({
      next: (details) => {
        this.details = details;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Unable to load access details. Please try again.';
        this.changeDetector.markForCheck();
      }
    });
  }

  fieldsFor(index: number, entry: BankAccessDetail): (AccessField & { value: string; revealed: boolean })[] {
    return ACCESS_FIELDS.map((field) => ({
      ...field,
      value: this.displayValue(entry[field.key]),
      revealed: !field.sensitive || this.isRevealed(index, field.key)
    }));
  }

  toggleSensitiveField(index: number, field: keyof BankAccessDetail): void {
    const key = `${index}:${field}`;
    if (this.revealedFields.has(key)) {
      this.revealedFields.delete(key);
    } else {
      this.revealedFields.add(key);
    }
  }

  isRevealed(index: number, field: keyof BankAccessDetail): boolean {
    return this.revealedFields.has(`${index}:${field}`);
  }

  maskValue(value: string, field: keyof BankAccessDetail): string {
    if (!value || value === 'NA') {
      return this.displayValue(value);
    }
    if (field === 'password' || field === 'profilePassword') {
      return '••••••••';
    }
    return `${'•'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
  }

  private displayValue(value: string): string {
    return value === 'NA' ? 'Not applicable' : value || '—';
  }

  private resetCode(): void {
    this.codeAttempt++;
    this.confirmationCode.reset('', { emitEvent: false });
    this.showConfirmationCode = false;
    this.visibleEditPasswords.clear();
    this.isCodeVerifying = false;
    this.isCodeVerified = false;
    this.isCodeIncorrect = false;
    this.verifiedCode = '';
    this.codeError = '';
  }
}
