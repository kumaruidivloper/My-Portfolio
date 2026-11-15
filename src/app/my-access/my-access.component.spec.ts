import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { AccessDetails, AccessRecordChangedError, MyAccessDataService } from './my-access-data.service';
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

  beforeEach(() => {
    accessData = jasmine.createSpyObj<MyAccessDataService>('MyAccessDataService', ['getAccessDetails', 'updateAccessRecord']);
    accessData.getAccessDetails.and.returnValue(of(accessDetails));
    codes = jasmine.createSpyObj<ConfirmationCodeService>('ConfirmationCodeService', ['verify']);
    codes.verify.and.resolveTo(true);
    TestBed.configureTestingModule({
      declarations: [MyAccessComponent],
      imports: [A11yModule, CommonModule, ReactiveFormsModule, RouterModule.forRoot([])],
      providers: [
        { provide: MyAccessDataService, useValue: accessData },
        { provide: ConfirmationCodeService, useValue: codes }
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

  it('loads records and keeps sensitive values masked until explicitly revealed', () => {
    fixture.detectChanges();

    expect(accessData.getAccessDetails).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Sample Bank');
    expect(fixture.nativeElement.textContent).toContain('Test User');
    expect(fixture.nativeElement.querySelector('.access-bank-value svg[aria-hidden="true"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
    expect(fixture.nativeElement.textContent).not.toContain('1234567890');

    const revealPassword = fixture.nativeElement.querySelector('[aria-label="Show Password"]') as HTMLButtonElement;
    revealPassword.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('sample-password');

    revealPassword.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('sample-password');
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
    (dialog.querySelector('[aria-label="Show confirmation code"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(profile.type).toBe('password');
    expect(code.type).toBe('text');
    expect((dialog.querySelector('[aria-label="Hide Password"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    (dialog.querySelector('[aria-label="Show Profile password"]') as HTMLButtonElement).click();
    fixture.detectChanges();
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
    fixture.componentInstance.closeEdit();
    expect(fixture.componentInstance.editingIndex).toBe(1);

    response.next(saved);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Updated Bank');
    expect(fixture.nativeElement.textContent).toContain('Sample Bank');
    expect(fixture.nativeElement.textContent).toContain('Access record updated successfully.');
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
