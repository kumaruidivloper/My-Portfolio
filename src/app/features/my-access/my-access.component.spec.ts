import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { DashboardLoaderComponent } from '../../shared/dashboard-loader/dashboard-loader.component';
import { ScrollProgressComponent } from '../../shared/scroll-progress/scroll-progress.component';
import { ConfirmationCodeService } from '../../shared/service/confirmation-code.service';
import { UnmaskCodeService } from '../../shared/service/unmask-code.service';
import { AccessDetails, AccessRecordChangedError, MyAccessDataService } from '../../shared/service/my-access-data.service';
import { MyAccessComponent } from './my-access.component';

const accessDetails = {
  name: 'Test Access',
  type: 'Bank Access Details',
  bankAccessDetails: [{
    type: 'Bank',
    customerName: 'Test User',
    bankName: 'Sample Bank',
    branch: 'Sample Branch',
    accountName: 'Test Account',
    accountNumber: '1234567890',
    ifsc: 'TEST0001234',
    upi: 'test@example',
    accountType: 'Savings',
    userName: 'sample-user',
    password: 'sample-password',
    profilePassword: 'NA'
  }]
};

describe('MyAccessComponent', () => {
  let fixture: ComponentFixture<MyAccessComponent>;
  let accessData: jasmine.SpyObj<MyAccessDataService>;
  let codes: jasmine.SpyObj<ConfirmationCodeService>;
  let unmaskCodes: jasmine.SpyObj<UnmaskCodeService>;

  beforeEach(() => {
    accessData = jasmine.createSpyObj<MyAccessDataService>('MyAccessDataService', ['getAccessDetails', 'updateAccessRecord']);
    accessData.getAccessDetails.and.returnValue(of(accessDetails));
    codes = jasmine.createSpyObj<ConfirmationCodeService>('ConfirmationCodeService', ['verify']);
    codes.verify.and.resolveTo(true);
    unmaskCodes = jasmine.createSpyObj<UnmaskCodeService>('UnmaskCodeService', ['verify']);
    unmaskCodes.verify.and.resolveTo(true);
    TestBed.configureTestingModule({
      declarations: [MyAccessComponent],
      imports: [A11yModule, CommonModule, DashboardLoaderComponent, ReactiveFormsModule, RouterModule.forRoot([]), ScrollProgressComponent],
      providers: [
        { provide: MyAccessDataService, useValue: accessData },
        { provide: ConfirmationCodeService, useValue: codes },
        { provide: UnmaskCodeService, useValue: unmaskCodes }
      ]
    });
    fixture = TestBed.createComponent(MyAccessComponent);
  });

  afterEach(() => fixture.destroy());

  async function verifyCode(): Promise<void> {
    fixture.componentInstance.confirmationCode.setValue('12345678901234');
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function verifyUnmask(code = '12345678'): Promise<void> {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.access-unmask-code-entry') as HTMLInputElement;
    input.value = code;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the shared loader while access details are loading', () => {
    const response = new Subject<AccessDetails>();
    accessData.getAccessDetails.and.returnValue(response);
    fixture.detectChanges();

    const loader = fixture.nativeElement.querySelector('app-dashboard-loader') as HTMLElement;
    expect(loader.getAttribute('aria-label')).toBe('Loading access details');
    expect(loader.getAttribute('role')).toBe('status');

    response.next(accessDetails);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-dashboard-loader')).toBeNull();
  });

  it('tracks scroll progress on the My Access host and content', () => {
    fixture.detectChanges();

    const progress = fixture.debugElement.query(By.directive(ScrollProgressComponent))
      .componentInstance as ScrollProgressComponent;
    expect(progress.scrollContainer).toBe(fixture.nativeElement);
    expect(progress.resizeTarget).toBe(fixture.nativeElement.querySelector('.my-access-content'));
  });

  it('centers access action icons in their buttons and card headings', () => {
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.access-edit, .access-record-field .access-reveal')) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      expect(getComputedStyle(button).display).toBe('grid');
      const icon = button.querySelector('svg')!;
      const buttonBounds = button.getBoundingClientRect();
      const iconBounds = icon.getBoundingClientRect();
      expect(Math.abs(buttonBounds.left + buttonBounds.width / 2 - iconBounds.left - iconBounds.width / 2)).toBeLessThan(1);
      expect(Math.abs(buttonBounds.top + buttonBounds.height / 2 - iconBounds.top - iconBounds.height / 2)).toBeLessThan(1);
    }

    const heading = fixture.nativeElement.querySelector('.access-record-heading') as HTMLElement;
    const editButton = heading.querySelector('.access-edit') as HTMLButtonElement;
    const headingBounds = heading.getBoundingClientRect();
    const editBounds = editButton.getBoundingClientRect();
    expect(Math.abs(headingBounds.top + headingBounds.height / 2 - editBounds.top - editBounds.height / 2)).toBeLessThan(1);
  });

  it('uses local logos for supported banks and EPFO/UAN records', () => {
    const bankNames = ['SBI', 'ICICI Bank', 'Canara Bank', 'Sample Bank'];
    accessData.getAccessDetails.and.returnValue(of({
      ...accessDetails,
      bankAccessDetails: [
        ...bankNames.map((bankName) => ({ ...accessDetails.bankAccessDetails[0], bankName })),
        { ...accessDetails.bankAccessDetails[0], type: 'UAN', bankName: 'Universal Account' },
        { ...accessDetails.bankAccessDetails[0], bankName: 'EPFO India' },
        { ...accessDetails.bankAccessDetails[0], type: 'PF', bankName: 'PF' }
      ]
    }));
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.access-record-card')) as HTMLElement[];
    expect(cards.map((card) => card.querySelector('.access-record-icon img')?.getAttribute('src') ?? null))
      .toEqual([
        'assets/img/banks/sbi.png',
        'assets/img/banks/icici-bank.png',
        'assets/img/banks/canara-bank.png',
        null,
        'assets/img/banks/epfo.png',
        'assets/img/banks/epfo.png',
        'assets/img/banks/epfo.png'
      ]);
    expect(cards[3].querySelector('.access-record-icon svg')).not.toBeNull();
    expect(cards[1].querySelector('h2')?.textContent?.trim()).toBe('Bank');
    expect(cards[2].querySelector('h2')?.textContent?.trim()).toBe('Bank');
    expect(cards[3].querySelector('h2')?.textContent?.trim()).toBe('Sample Bank · Bank');
    expect(cards[4].querySelector('h2')?.textContent?.trim()).toBe('UAN');
    expect(cards[4].querySelector('.access-record-fields')?.textContent).toContain('Bank / service');
    expect(cards[4].querySelector('.access-bank-value img')?.getAttribute('src')).toBe('assets/img/banks/epfo.png');
    expect(cards[5].querySelector('.access-record-icon img')?.getAttribute('src')).toBe('assets/img/banks/epfo.png');
    expect(cards[6].querySelector('h2')?.textContent?.trim()).toBe('EPFO');
    expect(cards[6].querySelector('.access-record-fields')?.textContent).toContain('Bank / service');
    expect(cards[6].querySelector('.access-bank-value img')?.getAttribute('src')).toBe('assets/img/banks/epfo.png');
  });

  it('updates the Bank / service form icon to match the entered bank or EPFO service', async () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    fixture.detectChanges();

    const bankNameInput = fixture.nativeElement.querySelector('#access-input-bankName') as HTMLInputElement;
    expect(bankNameInput.parentElement?.querySelector('.access-input-icon[aria-hidden="true"]')).not.toBeNull();

    bankNameInput.value = 'ICICI Bank';
    bankNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.editForm.controls.bankName.value).toBe('ICICI Bank');
    expect(fixture.componentInstance.bankLogoUrl('ICICI Bank', 'Bank')).toBe('assets/img/banks/icici-bank.png');
    const bankInput = bankNameInput.closest('.access-form-input') as HTMLElement;
    expect(bankInput.querySelector('.access-input-logo')?.getAttribute('src'))
      .toBe('assets/img/banks/icici-bank.png');
    expect(bankInput.classList.contains('has-bank-logo')).toBeTrue();

    const typeInput = fixture.nativeElement.querySelector('#access-input-type') as HTMLInputElement;
    typeInput.value = 'PF';
    typeInput.dispatchEvent(new Event('input', { bubbles: true }));
    bankNameInput.value = 'PF';
    bankNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(bankNameInput.parentElement?.querySelector('.access-input-logo')?.getAttribute('src'))
      .toBe('assets/img/banks/epfo.png');
  });

  it('loads records and keeps sensitive values masked until explicitly revealed', async () => {
    fixture.detectChanges();

    expect(accessData.getAccessDetails).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Sample Bank');
    expect(fixture.nativeElement.textContent).toContain('Test User');
    expect(fixture.nativeElement.querySelector('.access-record-icon svg')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    expect(fixture.nativeElement.textContent).not.toContain('1234567890');

    const revealPassword = fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement;
    revealPassword.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.pendingUnmask).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    await verifyUnmask();
    expect(fixture.nativeElement.textContent).toContain('sample-password');

    revealPassword.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    revealPassword.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).not.toBeNull();
  });

  it('displays unavailable sensitive values without masking or reveal controls', () => {
    accessData.getAccessDetails.and.returnValue(of({
      ...accessDetails,
      bankAccessDetails: [{ ...accessDetails.bankAccessDetails[0], ifsc: 'NA', upi: '' }]
    }));
    fixture.detectChanges();

    const fields = Array.from(fixture.nativeElement.querySelectorAll('.access-record-field')) as HTMLElement[];
    const fieldFor = (label: string) => fields.find((field) => field.querySelector('dt')?.textContent?.trim() === label)!;
    for (const label of ['IFSC', 'Profile password']) {
      expect(fieldFor(label).querySelector('dd')?.textContent?.trim()).toBe('Not applicable');
      expect(fieldFor(label).querySelector('button')).toBeNull();
    }
    expect(fieldFor('UPI ID').querySelector('dd')?.textContent?.trim()).toBe('—');
    expect(fieldFor('UPI ID').querySelector('button')).toBeNull();
  });

  it('captures an 8-character text code in one input rendered as eight slots', async () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.access-unmask-code-entry') as HTMLInputElement;
    expect(fixture.nativeElement.querySelectorAll('.access-unmask-code-slot').length).toBe(8);
    expect(input.inputMode).toBe('');
    expect(input.maxLength).toBe(8);
    expect(document.activeElement).toBe(input);
    input.value = '4a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.unmaskCode.value).toBe('4a');
    expect(fixture.componentInstance.activeUnmaskCodeDigit).toBe(2);

    for (const value of ['1234567', '123456789']) {
      fixture.componentInstance.unmaskCode.setValue(value);
      fixture.componentInstance.verifyUnmask();
      expect(fixture.componentInstance.unmaskCode.invalid).toBeTrue();
    }
    expect(unmaskCodes.verify).not.toHaveBeenCalled();

    fixture.componentInstance.unmaskCode.setValue('Ab-12xyz');
    expect(fixture.componentInstance.unmaskCode.valid).toBeTrue();
    await verifyUnmask('Ab-12xyz');
    expect(unmaskCodes.verify).toHaveBeenCalledOnceWith('Ab-12xyz');
  });

  it('keeps text editable while verification is pending and ignores the stale result', async () => {
    const resolveAttempts: Array<(valid: boolean) => void> = [];
    unmaskCodes.verify.and.callFake(() => new Promise<boolean>((done) => resolveAttempts.push(done)));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.access-unmask-code-entry') as HTMLInputElement;
    input.value = 'Ab12-cde';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.isUnmaskVerifying).toBeTrue();
    expect(input.readOnly).toBeFalse();

    input.value = 'Zb12-cde';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.unmaskCode.value).toBe('Zb12-cde');
    expect(fixture.componentInstance.isUnmaskVerifying).toBeTrue();
    expect(unmaskCodes.verify).toHaveBeenCalledTimes(2);

    resolveAttempts[0](true);
    resolveAttempts[1](false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).not.toBeNull();
  });

  it('shows a load error and retries the request', () => {
    accessData.getAccessDetails.and.returnValues(
      throwError(() => new Error('Unavailable')),
      of(accessDetails)
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');

    (fixture.nativeElement.querySelector('.my-access-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(accessData.getAccessDetails).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.access-record-card')).not.toBeNull();
  });

  it('toggles form passwords and the confirmation code independently, then masks them on reopening', async () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const password = dialog.querySelector('#access-input-password') as HTMLInputElement;
    const profile = dialog.querySelector('#access-input-profilePassword') as HTMLInputElement;
    const code = dialog.querySelector('#access-confirmation-code') as HTMLInputElement;

    expect(password.type).toBe('password');
    expect(profile.type).toBe('text');
    expect(dialog.querySelector('[aria-label="Show Profile password"]')).toBeNull();
    profile.value = 'profile-value';
    profile.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(profile.type).toBe('password');

    (dialog.querySelector('[aria-label="Show Password"]') as HTMLButtonElement).click();
    await verifyUnmask();
    (dialog.querySelector('[aria-label="Show confirmation code"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(profile.type).toBe('password');
    expect(code.type).toBe('text');
    expect((dialog.querySelector('[aria-label="Hide Password"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    (dialog.querySelector('[aria-label="Show Profile password"]') as HTMLButtonElement).click();
    await verifyUnmask();
    expect(profile.type).toBe('text');
    await verifyCode();
    expect(code.value).toBe('12345678901234');
    expect(fixture.componentInstance.isCodeVerified).toBeTrue();
    expect(accessData.updateAccessRecord).not.toHaveBeenCalled();

    (dialog.querySelector('[aria-label="Hide Password"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
    fixture.componentInstance.closeEdit();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#access-input-password').type).toBe('password');
    expect(fixture.nativeElement.querySelector('#access-confirmation-code').type).toBe('password');
  });

  it('leaves passwords masked for incorrect codes and does not prompt for other fields', async () => {
    unmaskCodes.verify.and.resolveTo(false);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Show Account number"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1234567890');
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).toBeNull();

    (fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement).click();
    await verifyUnmask();
    expect(fixture.nativeElement.querySelector('.access-unmask-modal [role="alert"]')?.textContent).toContain('code is incorrect');
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    (fixture.nativeElement.querySelector('.access-unmask-modal footer button[type="button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).toBeNull();
  });

  it('ignores a verification result after the reveal dialog is cancelled', async () => {
    let resolve!: (valid: boolean) => void;
    unmaskCodes.verify.and.returnValue(new Promise<boolean>((done) => resolve = done));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.unmaskCode.setValue('12345678');
    fixture.componentInstance.verifyUnmask();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-unmask-modal footer button[type="button"]') as HTMLButtonElement).click();
    resolve(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    expect(fixture.nativeElement.querySelector('.access-unmask-modal')).toBeNull();
  });

  it('validates required fields and saves the selected card without changing the others', async () => {
    const second = { ...accessDetails.bankAccessDetails[0], bankName: 'Second Bank', customerName: 'Other User' };
    const data = { ...accessDetails, bankAccessDetails: [accessDetails.bankAccessDetails[0], second] };
    const updated = { ...second, bankName: 'Updated Bank', upi: '' };
    const saved = { ...data, bankAccessDetails: [data.bankAccessDetails[0], updated] };
    const response = new Subject<AccessDetails>();
    accessData.getAccessDetails.and.returnValue(of(data));
    accessData.updateAccessRecord.and.returnValue(response);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.access-edit') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.editForm.getRawValue()).toEqual(second);
    expect(fixture.nativeElement.querySelectorAll('.access-form-grid .access-form-field').length).toBe(12);
    expect(fixture.nativeElement.querySelector('#access-input-bankName').parentElement.querySelector('.access-input-icon[aria-hidden="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#access-input-password').type).toBe('password');
    expect(fixture.nativeElement.querySelector('#access-input-profilePassword').type).toBe('text');
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();
    await verifyCode();

    fixture.componentInstance.editForm.controls.bankName.setValue('   ');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-field-error')?.textContent).toContain('Bank / service is required');
    expect(accessData.updateAccessRecord).not.toHaveBeenCalled();

    fixture.componentInstance.editForm.patchValue({ bankName: 'Updated Bank', upi: '' });
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();
    expect(accessData.updateAccessRecord).toHaveBeenCalledOnceWith(1, second, updated);
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.access-save app-dashboard-loader')?.getAttribute('aria-label'))
      .toBe('Saving access changes');
    fixture.componentInstance.closeEdit();
    expect(fixture.componentInstance.editingIndex).toBe(1);

    response.next(saved);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Updated Bank');
    expect(fixture.nativeElement.textContent).toContain('Sample Bank');
    const toast = fixture.nativeElement.querySelector('.dashboard-toast') as HTMLElement;
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.textContent).toContain('Access record updated successfully.');
    (toast.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dashboard-toast')).toBeNull();
  });

  it('keeps the form open and shows a conflict when the record changes elsewhere', async () => {
    accessData.updateAccessRecord.and.returnValue(throwError(() => new AccessRecordChangedError()));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    await verifyCode();
    fixture.componentInstance.editForm.controls.bankName.setValue('New Bank');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('changed since it was opened');
    expect(fixture.componentInstance.editForm.controls.bankName.value).toBe('New Bank');
    expect(fixture.componentInstance.isSaving).toBeFalse();
    expect(fixture.componentInstance.details).toEqual(accessDetails);
  });

  it('keeps edited values available when a save fails', async () => {
    accessData.updateAccessRecord.and.returnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    await verifyCode();
    fixture.componentInstance.editForm.controls.branch.setValue('New Branch');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Unable to update access details');
    expect(fixture.componentInstance.editForm.controls.branch.value).toBe('New Branch');
    expect(fixture.componentInstance.isSaving).toBeFalse();
  });

  it('blocks saving until the current code is verified and resets it on close', async () => {
    codes.verify.and.resolveTo(false);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.saveEdit();
    expect(accessData.updateAccessRecord).not.toHaveBeenCalled();

    fixture.componentInstance.confirmationCode.setValue('123');
    expect(codes.verify).not.toHaveBeenCalled();
    await verifyCode();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('The confirmation code is incorrect.');
    expect(fixture.nativeElement.querySelector('.access-code-error[role="alert"] svg[aria-hidden="true"]')).not.toBeNull();

    codes.verify.and.resolveTo(true);
    fixture.componentInstance.confirmationCode.setValue('12345678901235');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.access-code-verified svg[aria-hidden="true"]')).not.toBeNull();

    fixture.componentInstance.confirmationCode.setValue('123');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.access-code-verified')).toBeNull();
    fixture.componentInstance.saveEdit();
    expect(accessData.updateAccessRecord).not.toHaveBeenCalled();

    fixture.componentInstance.closeEdit();
    fixture.componentInstance.openEdit(0);
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmationCode.value).toBe('');
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();
  });

  it('ignores stale verification and allows retry when verification fails', async () => {
    let resolveFirst!: (valid: boolean) => void;
    let attempt = 0;
    codes.verify.and.callFake(() => {
      attempt++;
      if (attempt === 1) {
        return new Promise<boolean>((resolve) => resolveFirst = resolve);
      }
      return attempt === 2 ? Promise.reject(new Error('Unavailable')) : Promise.resolve(true);
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.access-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.confirmationCode.setValue('12345678901234');
    fixture.componentInstance.saveEdit();
    expect(accessData.updateAccessRecord).not.toHaveBeenCalled();
    fixture.componentInstance.confirmationCode.setValue('12345678901235');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('verification is unavailable');
    expect(fixture.nativeElement.querySelector('.access-code-error[role="alert"] svg[aria-hidden="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();

    resolveFirst(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeTrue();

    (fixture.nativeElement.querySelector('.access-code-retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.access-save').disabled).toBeFalse();
  });
});
