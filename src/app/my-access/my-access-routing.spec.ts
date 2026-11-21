import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppRoutingModule } from '../app-routing.module';
import { MyAccessComponent } from './my-access.component';
import { DashboardAccessGuard } from '../service/dashboard-access.guard';
import { ApiKeyGuard } from '../service/api-key.guard';
import { ApiEncryptionService } from '../shared/service/api-encryption.service';
import { ConfirmationCodeService } from '../shared/service/confirmation-code.service';
import { UnmaskCodeService } from '../shared/service/unmask-code.service';
import { environment } from '../../environments/environment';
import { filter, firstValueFrom } from 'rxjs';

describe('My Access routing', () => {
  let originalProduction: boolean;
  const endpoint = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/10';
  const accessDetails = {
    name: 'Test Access',
    type: 'Bank Access Details',
    bankAccessDetails: [{
      type: 'Bank', customerName: 'Test User', bankName: 'Sample Bank',
      branch: 'Sample Branch', accountName: 'Test Account', accountNumber: '1234567890',
      ifsc: 'TEST0001234', upi: 'test@example', accountType: 'Savings',
      userName: 'sample-user', password: 'sample-password', profilePassword: 'NA'
    }]
  };

  beforeEach(() => {
    originalProduction = environment.production;
    TestBed.configureTestingModule({
      providers: [{ provide: ApiKeyGuard, useValue: { canMatch: () => true } }]
    });
  });

  afterEach(() => {
    environment.production = originalProduction;
  });

  it('loads access records directly in local development', async () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule, HttpClientTestingModule] });
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/my-access');
    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);
    const loader = harness.routeNativeElement?.querySelector('app-dashboard-loader');
    expect(loader?.getAttribute('aria-label')).toBe('Loading access details');
    expect(loader?.querySelector('.loader-ring')).not.toBeNull();
    request.flush(accessDetails);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/my-access');
    expect(harness.routeDebugElement?.injector.get(MyAccessComponent).isLoading).toBeFalse();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('My Access');
    expect(harness.routeNativeElement?.textContent).toContain('Sample Bank');
    expect(harness.routeNativeElement?.textContent).not.toContain('sample-password');
    const bankIcon = harness.routeNativeElement?.querySelector<SVGElement>('.access-bank-value svg');
    expect(bankIcon?.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('waits for the encryption key before requesting access records', async () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule, HttpClientTestingModule] });
    TestBed.overrideProvider(ApiKeyGuard, {
      useFactory: (encryption: ApiEncryptionService, router: Router) => new ApiKeyGuard(encryption, router),
      deps: [ApiEncryptionService, Router]
    });
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const guard = TestBed.inject(ApiKeyGuard);
    const http = TestBed.inject(HttpTestingController);
    const prompt = firstValueFrom(guard.requested$.pipe(filter((target) => target !== null)));

    const navigation = router.navigateByUrl('/my-access');
    expect(await prompt).toBe('my-access');
    http.expectNone(endpoint);
    guard.unlock('runtime test key');

    expect(await navigation).toBeTrue();
    harness.detectChanges();
    http.expectOne(endpoint).flush(accessDetails);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Sample Bank');
    http.verify();
  });

  it('requires a one-time grant for My Access in production', async () => {
    environment.production = true;
    TestBed.configureTestingModule({ imports: [AppRoutingModule, HttpClientTestingModule] });
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const guard = TestBed.inject(DashboardAccessGuard);
    const http = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/my-access');
    expect(router.url).toBe('/');

    guard.grantOneTimeAccess('dashboard');
    await harness.navigateByUrl('/my-access');
    expect(router.url).toBe('/');

    guard.grantOneTimeAccess('my-access');
    await harness.navigateByUrl('/my-access');
    expect(router.url).toBe('/my-access');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('My Access');
    http.expectOne(endpoint).flush({ ...accessDetails, bankAccessDetails: [] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeDebugElement?.injector.get(MyAccessComponent).isLoading).toBeFalse();
    expect(harness.routeNativeElement?.textContent).toContain('No access records are available');

    await harness.navigateByUrl('/');
    await harness.navigateByUrl('/my-access');
    expect(router.url).toBe('/');
  });

  it('updates the routed page when the request fails and is retried', async () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule, HttpClientTestingModule] });
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/my-access');
    http.expectOne(endpoint).flush('Unavailable', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Unable to load access details');

    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.my-access-retry')?.click();
    http.expectOne(endpoint).flush(accessDetails);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Sample Bank');
  });

  it('reveals only the requested password after an 8-digit code is verified', async () => {
    const unmaskCodes = jasmine.createSpyObj<UnmaskCodeService>('UnmaskCodeService', ['verify']);
    unmaskCodes.verify.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [AppRoutingModule, HttpClientTestingModule],
      providers: [{ provide: UnmaskCodeService, useValue: unmaskCodes }]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/my-access');
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(accessDetails);
    harness.detectChanges();

    harness.routeNativeElement?.querySelector<HTMLButtonElement>('[aria-label="Show Password"]')?.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('sample-password');
    const input = harness.routeNativeElement?.querySelector<HTMLInputElement>('.access-unmask-code-entry');
    expect(input).not.toBeNull();
    input!.value = '12345678';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(unmaskCodes.verify).toHaveBeenCalledOnceWith('12345678');
    expect(harness.routeNativeElement?.querySelector('.access-unmask-modal')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('sample-password');
    expect(harness.routeNativeElement?.textContent).not.toContain('1234567890');
  });

  it('saves an edited card through the routed form', async () => {
    const codes = jasmine.createSpyObj<ConfirmationCodeService>('ConfirmationCodeService', ['verify']);
    codes.verify.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [AppRoutingModule, HttpClientTestingModule],
      providers: [{ provide: ConfirmationCodeService, useValue: codes }]
    });
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);

    await harness.navigateByUrl('/my-access');
    http.expectOne(endpoint).flush(accessDetails);
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.access-edit')?.click();
    harness.detectChanges();

    const bankName = harness.routeNativeElement?.querySelector<HTMLInputElement>('#access-input-bankName');
    expect(bankName?.value).toBe('Sample Bank');
    const bankIcon = bankName?.parentElement?.querySelector<SVGElement>('.access-input-icon');
    expect(bankIcon?.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(bankIcon!).zIndex).toBe('1');
    bankName!.value = 'Updated Bank';
    bankName!.dispatchEvent(new Event('input'));
    const code = harness.routeNativeElement?.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    expect(harness.routeNativeElement?.querySelector<HTMLButtonElement>('.access-save')?.disabled).toBeTrue();
    code!.value = '12345678901234';
    code!.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector<HTMLButtonElement>('.access-save')?.disabled).toBeFalse();
    harness.routeNativeElement?.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Saving');
    http.expectOne(endpoint).flush(accessDetails);
    const save = http.expectOne(endpoint);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.bankAccessDetails[0].bankName).toBe('Updated Bank');
    save.flush({
      ...accessDetails,
      bankAccessDetails: [{ ...accessDetails.bankAccessDetails[0], bankName: 'Updated Bank' }]
    });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Updated Bank');
  });

  it('keeps the edit dialog within the viewport', async () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule, HttpClientTestingModule] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/my-access');
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(accessDetails);
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.access-edit')?.click();
    harness.detectChanges();

    const dialog = harness.routeNativeElement?.querySelector<HTMLElement>('.access-edit-modal');
    expect(dialog).not.toBeNull();
    const bounds = dialog!.getBoundingClientRect();
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(bounds.height).toBeLessThan(window.innerHeight);
  });
});
