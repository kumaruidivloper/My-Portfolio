import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { ConfirmationCodeService } from '../shared/service/confirmation-code.service';
import { UnmaskCodeService } from '../shared/service/unmask-code.service';
import { AccessDetails, AccessRecordChangedError, BankAccessDetail, MyAccessDataService } from '../shared/service/my-access-data.service';

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

type PasswordField = 'password' | 'profilePassword';
type UnmaskTarget =
  | { location: 'card'; index: number; field: PasswordField }
  | { location: 'form'; field: PasswordField };

@Component({
  selector: 'app-my-access',
  templateUrl: './my-access.component.html',
  styleUrls: ['./my-access.component.scss'],
  host: { '[class.my-access-editing]': 'editingIndex !== null || pendingUnmask !== null' },
  standalone: false
})
export class MyAccessComponent implements OnInit, OnDestroy {
  @ViewChild('firstUnmaskCodeInput')
  set firstUnmaskCodeInput(input: ElementRef<HTMLInputElement> | undefined) {
    input?.nativeElement.focus();
  }

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
  readonly unmaskCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8), Validators.maxLength(8)]
  });
  readonly unmaskCodeDigits = Array.from({ length: 8 }, () => '');
  details: AccessDetails | null = null;
  isLoading = false;
  errorMessage = '';
  editingIndex: number | null = null;
  isSaving = false;
  saveError = '';
  toastMessage = '';
  isCodeVerifying = false;
  isCodeVerified = false;
  isCodeIncorrect = false;
  codeError = '';
  showConfirmationCode = false;
  pendingUnmask: UnmaskTarget | null = null;
  isUnmaskVerifying = false;
  unmaskError = '';
  private unmaskAttempt = 0;
  private readonly visibleEditPasswords = new Set<keyof BankAccessDetail>();
  private request?: Subscription;
  private saveRequest?: Subscription;
  private toastTimeout?: Subscription;
  private readonly codeSubscription: Subscription;
  private codeAttempt = 0;
  private verifiedCode = '';
  private editingOriginal?: BankAccessDetail;
  private readonly revealedFields = new Set<string>();
  readonly scrollContainer: HTMLElement;

  constructor(
    private readonly accessData: MyAccessDataService,
    private readonly changeDetector: ChangeDetectorRef,
    elementRef: ElementRef<HTMLElement>,
    private readonly confirmationCodeService: ConfirmationCodeService,
    private readonly unmaskCodeService: UnmaskCodeService
  ) {
    this.scrollContainer = elementRef.nativeElement;
    this.codeSubscription = this.confirmationCode.valueChanges.subscribe(() => this.verifyCode());
  }

  ngOnInit(): void {
    this.loadAccessDetails();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.saveRequest?.unsubscribe();
    this.toastTimeout?.unsubscribe();
    this.codeAttempt++;
    this.unmaskAttempt++;
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
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingUnmask) {
      this.closeUnmask();
    } else if (this.editingIndex !== null) {
      this.closeEdit();
    }
  }

  closeEdit(): void {
    if (this.isSaving) {
      return;
    }
    this.editingIndex = null;
    this.closeUnmask();
    this.editingOriginal = undefined;
    this.saveError = '';
    this.resetCode();
  }

  dismissToast(): void {
    this.toastTimeout?.unsubscribe();
    this.toastTimeout = undefined;
    this.toastMessage = '';
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
    } else if (field === 'password' || field === 'profilePassword') {
      this.openUnmask({ location: 'form', field });
    }
  }

  closeUnmask(): void {
    this.unmaskAttempt++;
    this.pendingUnmask = null;
    this.unmaskCodeDigits.fill('');
    this.unmaskCode.reset('');
    this.isUnmaskVerifying = false;
    this.unmaskError = '';
  }

  get activeUnmaskCodeDigit(): number {
    return Math.min(this.unmaskCode.value.length, this.unmaskCodeDigits.length - 1);
  }

  onUnmaskCodeInput(event: Event): void {
    this.cancelPendingUnmaskVerification();
    const input = event.target as HTMLInputElement;
    const code = input.value.slice(0, this.unmaskCodeDigits.length);
    input.value = code;
    this.unmaskCode.setValue(code);
    this.updateUnmaskCodeDigits(code);
    this.unmaskError = '';

    if (code.length === this.unmaskCodeDigits.length) {
      void this.verifyUnmask();
    }
  }

  onUnmaskCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.cancelPendingUnmaskVerification();
    const code = event.clipboardData?.getData('text').slice(0, this.unmaskCodeDigits.length) ?? '';
    this.unmaskCode.setValue(code);
    this.updateUnmaskCodeDigits(code);
    this.unmaskError = '';
    const input = event.target as HTMLInputElement;
    input.value = code;
    input.focus();
    input.setSelectionRange(code.length, code.length);
    if (code.length === this.unmaskCodeDigits.length) {
      void this.verifyUnmask();
    }
  }

  focusUnmaskCode(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.setSelectionRange(input.value.length, input.value.length);
  }

  verifyUnmask(): void {
    if (!this.pendingUnmask || this.isUnmaskVerifying || this.unmaskCode.invalid) {
      this.unmaskCode.markAsTouched();
      return;
    }
    const target = this.pendingUnmask;
    const attempt = ++this.unmaskAttempt;
    this.isUnmaskVerifying = true;
    this.unmaskError = '';
    void this.unmaskCodeService.verify(this.unmaskCode.value).then((valid) => {
      if (attempt !== this.unmaskAttempt) {
        return;
      }
      this.isUnmaskVerifying = false;
      if (!valid) {
        this.unmaskError = 'The code is incorrect. Please try again.';
      } else {
        if (target.location === 'card') {
          this.revealedFields.add(`${target.index}:${target.field}`);
        } else {
          this.visibleEditPasswords.add(target.field);
        }
        this.closeUnmask();
      }
      this.changeDetector.markForCheck();
    }).catch(() => {
      if (attempt !== this.unmaskAttempt) {
        return;
      }
      this.isUnmaskVerifying = false;
      this.unmaskError = 'Code verification is unavailable. Please try again.';
      this.changeDetector.markForCheck();
    });
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
        this.showToast('Access record updated successfully.');
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
    } else if (field === 'password' || field === 'profilePassword') {
      this.openUnmask({ location: 'card', index, field });
    } else {
      this.revealedFields.add(key);
    }
  }

  isRevealed(index: number, field: keyof BankAccessDetail): boolean {
    return this.revealedFields.has(`${index}:${field}`);
  }

  bankLogoUrl(bankName: string, recordType = ''): string | null {
    const name = bankName.toLowerCase();
    if (/\b(epfo|pf|uan)\b|employees[’']?\s+provident\s+fund\s+organi[sz]ation/.test(name)
      || /\b(pf|uan)\b/i.test(recordType)) {
      return 'assets/img/banks/epfo.png';
    }
    if (/\b(sbi|state bank of india)\b/.test(name)) {
      return 'assets/img/banks/sbi.png';
    }
    if (/\bicici\b/.test(name)) {
      return 'assets/img/banks/icici-bank.png';
    }
    if (/\bcanara\b/.test(name)) {
      return 'assets/img/banks/canara-bank.png';
    }
    return null;
  }

  displayAccessLabel(value: string): string {
    return value.trim().toLowerCase() === 'pf' ? 'EPFO' : value;
  }

  showsBankNameInHeading(entry: BankAccessDetail): boolean {
    return !this.bankLogoUrl(entry.bankName, entry.type)
      || /\b(sbi|state bank of india)\b/i.test(entry.bankName);
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

  private showToast(message: string): void {
    this.toastTimeout?.unsubscribe();
    this.toastMessage = message;
    this.toastTimeout = timer(4000).subscribe(() => {
      this.toastTimeout = undefined;
      this.toastMessage = '';
      this.changeDetector.markForCheck();
    });
  }

  private openUnmask(target: UnmaskTarget): void {
    this.closeUnmask();
    this.pendingUnmask = target;
    this.changeDetector.markForCheck();
  }

  private updateUnmaskCodeDigits(code: string): void {
    this.unmaskCodeDigits.forEach((_, index) => {
      this.unmaskCodeDigits[index] = code[index] ? '•' : '';
    });
  }

  private cancelPendingUnmaskVerification(): void {
    if (this.isUnmaskVerifying) {
      this.unmaskAttempt++;
      this.isUnmaskVerifying = false;
    }
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
