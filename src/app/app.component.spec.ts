/// <reference types="jasmine" />

import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { AccessKeyValidation } from './shared/key-validation/access-key-validation';
import { DataService } from './shared/service/data.service';
import { ApiEncryptionService, ApiPayloadDecryptionError } from './shared/service/api-encryption.service';
import { ApiKeyGuard } from './service/api-key.guard';
import { ApiKeyValidationService } from './shared/service/api-key-validation.service';
import { DashboardAccessGuard } from './service/dashboard-access.guard';
import { ConfirmationCodeService } from './shared/service/confirmation-code.service';
import { TimeService } from './shared/service/time.service';
import { ScrollProgressComponent } from './shared/scroll-progress/scroll-progress.component';
import { DashboardLoaderComponent } from './shared/dashboard-loader/dashboard-loader.component';
import { QrCodeViewComponent } from './qr-code-view/qr-code-view.component';
import { environment } from '../environments/environment';

describe('AppComponent', () => {
  let component: AppComponent;
  let originalLocalCodePrompt: boolean;
  let originalDashboardBlur: boolean;

  beforeEach(() => {
    originalLocalCodePrompt = environment.showAccessCodePromptLocally;
    originalDashboardBlur = document.body.classList.contains('dashboard-values-blurred');
    document.body.classList.remove('dashboard-values-blurred');
    environment.showAccessCodePromptLocally = true;
    TestBed.configureTestingModule({
      providers: [{ provide: ApiKeyValidationService, useValue: { verify: () => Promise.resolve() } }]
    });
    component = Object.create(AppComponent.prototype) as AppComponent;
    Object.assign(component, {
      accessTarget: 'dashboard', accessPromptVersion: 0,
      apiEncryptionService: { hasPassphrase: true },
      keyValidation: new AccessKeyValidation({ verify: () => Promise.resolve() }, () => undefined, true),
      cdr: { markForCheck: () => undefined }
    });
  });

  afterEach(() => {
    environment.showAccessCodePromptLocally = originalLocalCodePrompt;
    document.body.classList.toggle('dashboard-values-blurred', originalDashboardBlur);
  });

  it('calculates experience from the May anniversary', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 7, 24));

    expect(component.addExperienceCount(2007, 0)).toBe(19);

    jasmine.clock().uninstall();
  });

  it('splits the dynamic experience years out of the intro text for styling', () => {
    const years = component.addExperienceCount(2007, 0);
    expect(component.introParts('For the last 15 years I have worked')).toEqual({
      before: 'For the last ', years: String(years), after: ' years I have worked'
    });
    expect(component.introParts('No number here')).toEqual({ before: 'No number here', years: '', after: '' });
  });

  it('removes the legacy experience prefix from intro text', () => {
    expect(component.introText('16+ years of experience')).toBe('years of experience');
    const years = component.addExperienceCount(2007, 0);
    expect(component.introText('For the last 15 years I have dedicated my life')).toBe(`For the last ${years} years I have dedicated my life`);
  });

  it('formats progress values as percentages', () => {
    expect(component.barRange(89)).toBe('89%');
  });

  it('shows auto-scroll on the portfolio page but not in the dashboard', () => {
    Object.assign(component, { router: { url: '/' } });
    expect(component.showAutoScroll).toBeTrue();

    Object.assign(component, { router: { url: '/dashboard' } });
    expect(component.showAutoScroll).toBeFalse();

    Object.assign(component, { router: { url: '/dashboard?tab=pf' } });
    expect(component.showAutoScroll).toBeFalse();
  });

  it('shows both startup loaders, allows retry, and switches to scroll progress 3.5 seconds after data arrives', () => {
    const firstRequest = new Subject<object>();
    const retryRequest = new Subject<object>();
    const getData = jasmine.createSpy('getData').and.returnValues(firstRequest, retryRequest);
    spyOn(window, 'scrollTo');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule, ScrollProgressComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: DataService, useValue: { getData } },
        { provide: ApiEncryptionService, useValue: { setPassphrase: jasmine.createSpy('setPassphrase'), clearPassphrase: jasmine.createSpy('clearPassphrase') } },
        { provide: TimeService, useValue: { getState: () => ({ isDaytime: true }) } },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const originalBodyClasses = document.body.className;
    const fixture = TestBed.createComponent(AppComponent);
    const host: HTMLElement = fixture.nativeElement;

    jasmine.clock().install();
    try {
      fixture.detectChanges();
      expect(host.querySelector('.api-key-gate')).toBeNull();

      const progress = host.querySelector('[role="progressbar"]');
      expect(progress?.getAttribute('aria-label')).toBe('Loading portfolio');
      expect(progress?.hasAttribute('aria-valuenow')).toBeFalse();
      expect(progress?.querySelector('.scroll-progress-filling')).toBeNull();
      expect(host.querySelector('.custom-loader')).not.toBeNull();
      expect(host.querySelector('.dashboard-nav-link')).toBeNull();

      firstRequest.error(new Error('Network failed'));
      fixture.detectChanges();
      expect(host.querySelector('[role="progressbar"]')).toBeNull();
      expect(host.querySelector('.custom-loader')).toBeNull();
      expect(host.querySelector('[role="alert"]')?.textContent).toContain('load the portfolio');

      host.querySelector('button')!.click();
      fixture.detectChanges();
      expect(host.querySelector('[role="progressbar"]')).not.toBeNull();
      expect(host.querySelector('.custom-loader')).not.toBeNull();
      expect(host.querySelector('[role="alert"]')).toBeNull();

      retryRequest.next({ intro: [{}], themeMode: [{}], aboutMe: {}, content: { intro: '' } });
      retryRequest.complete();
      jasmine.clock().tick(3499);
      fixture.detectChanges();
      expect(host.querySelector('[role="progressbar"]')).not.toBeNull();
      expect(host.querySelector('.custom-loader')).not.toBeNull();

      const fill = host.querySelector<HTMLElement>('.scroll-progress-filling');
      expect(fill?.style.animationDuration).toBe('3500ms');
      jasmine.clock().tick(1);
      fixture.detectChanges();
      expect(getData).toHaveBeenCalledTimes(2);
      expect(host.querySelector('[role="progressbar"]')).toBeNull();
      expect(host.querySelector('.custom-loader')).toBeNull();
      expect(host.querySelector('.scroll-progress[aria-hidden="true"]')).not.toBeNull();
      expect(host.querySelector('.dashboard-nav-link')).not.toBeNull();
      const profile = host.querySelector('.profile-startup-rewind');
      expect(profile).not.toBeNull();
      expect(host.querySelector('.scroll-progress-rewinding')).not.toBeNull();
      jasmine.clock().tick(649);
      fixture.detectChanges();
      expect(host.querySelector('.scroll-progress-rewinding')).not.toBeNull();
      jasmine.clock().tick(1);
      fixture.detectChanges();
      expect(host.querySelector('.profile-startup-rewind, .scroll-progress-rewinding')).toBeNull();
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
      document.body.className = originalBodyClasses;
    }
  });

  it('explains why the encryption key is unavailable on an insecure connection', () => {
    const crypto = globalThis.crypto;
    const original = Object.getOwnPropertyDescriptor(crypto, 'subtle');
    Object.defineProperty(crypto, 'subtle', { configurable: true, value: undefined });
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: DataService, useValue: {} },
        { provide: ApiEncryptionService, useValue: {} },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const originalBodyClasses = document.body.className;
    try {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.componentInstance.apiKeyTarget = 'dashboard';
      fixture.componentInstance.isDashboardPromptOpen = true;
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;
      expect(host.querySelector('[role="alert"]')?.textContent).toContain('Use HTTPS');
      expect(host.querySelector('#api-encryption-key')).toBeNull();
      expect(host.querySelector('.dashboard-code-modal')).not.toBeNull();
      expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
      fixture.destroy();
    } finally {
      if (original) {
        Object.defineProperty(crypto, 'subtle', original);
      } else {
        Reflect.deleteProperty(crypto, 'subtle');
      }
      document.body.className = originalBodyClasses;
    }
  });

  it('switches profile photos with the light and dark themes', () => {
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: DataService, useValue: {} },
        { provide: ApiEncryptionService, useValue: { setPassphrase: () => undefined, clearPassphrase: () => undefined } },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const originalBodyClasses = document.body.className;
    const fixture = TestBed.createComponent(AppComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.componentInstance.isDataLoaded = true;
      fixture.componentInstance.data = { intro: [{ name: 'Profile', userImage: 'assets/img/user-img.jpg' }], themeMode: [{}], aboutMe: {}, content: { intro: '' } };
      fixture.detectChanges();
      const light = fixture.nativeElement.querySelector('.profile-image-light') as HTMLImageElement;
      const dark = fixture.nativeElement.querySelector('.profile-image-dark') as HTMLImageElement;
      expect(light.getAttribute('src')).toBe('assets/img/user-img.jpg');
      expect(dark.getAttribute('src')).toBe('assets/img/user-img-dark.jpg');
      expect(dark.alt).toBe(light.alt);

      for (const theme of ['day', 'night', 'active']) {
        document.body.classList.remove('day', 'night', 'active');
        document.body.classList.add(theme);
        expect(getComputedStyle(light).display).toBe(theme === 'day' ? 'block' : 'none');
        expect(getComputedStyle(dark).display).toBe(theme === 'day' ? 'none' : 'block');
      }
    } finally {
      fixture.destroy();
      fixture.nativeElement.remove();
      document.body.className = originalBodyClasses;
    }
  });

  it('generates the hero QR code on input and clears it with the reset button', async () => {
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule, QrCodeViewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: DataService, useValue: {} },
        { provide: ApiEncryptionService, useValue: { setPassphrase: () => undefined, clearPassphrase: () => undefined } },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    try {
      fixture.componentInstance.isDataLoaded = true;
      fixture.componentInstance.data = { intro: [{}], themeMode: [{}], aboutMe: {}, content: { intro: '' } };
      fixture.detectChanges();
      await fixture.whenStable();
      const input = fixture.nativeElement.querySelector('#hero-qr-input') as HTMLInputElement;
      expect(input.labels?.[0].textContent).toContain('Create a QR code');

      input.value = 'https://example.com/Hello?code=Ab12';
      input.dispatchEvent(new Event('input'));
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      input.value = 'https://example.com/latest';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.inputValue).toBe(input.value);
      expect(fixture.componentInstance.isButtonDisabled).toBeFalse();
      expect(fixture.nativeElement.querySelector('.qrcodeImage')).not.toBeNull();
      const qrCanvas = fixture.nativeElement.querySelector('.qrcodeImage canvas') as HTMLCanvasElement;
      expect(qrCanvas).not.toBeNull();
      expect(qrCanvas.width).toBe(200);
      expect(qrCanvas.getAttribute('aria-label')).toContain(input.value);
      const pixels = qrCanvas.getContext('2d')!.getImageData(0, 0, 200, 200).data;
      expect(pixels.some((value, index) => index % 4 === 3 && value === 255)).toBeTrue();

      spyOn(console, 'error');
      input.value = 'x'.repeat(3000);
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.qrcodeImage [role="alert"]').textContent)
        .toContain('Could not generate');
      expect(console.error).toHaveBeenCalled();

      input.value = 'https://example.com/again';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.qrcodeImage [role="alert"]')).toBeNull();
      expect(qrCanvas.getAttribute('aria-label')).toContain(input.value);

      const clear = fixture.nativeElement.querySelector('button[aria-label="Clear QR text"]') as HTMLButtonElement;
      clear.click();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(input.value).toBe('');
      expect(fixture.nativeElement.querySelector('.qrcodeImage')).toBeNull();

      input.value = 'https://example.com/cleared';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      clear.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.qrcodeImage')).toBeNull();

      input.value = 'x'.repeat(3000);
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.qrcodeImage [role="alert"]').textContent)
        .toContain('Could not generate');
    } finally {
      fixture.destroy();
    }
  });

  it('keeps the dashboard prompt open for an incorrect code', async () => {
    const verify = jasmine.createSpy('verify').and.resolveTo(false);
    Object.assign(component, {
      dashboardCodeDigits: Array.from({ length: 14 }, () => ''),
      document,
      confirmationCodeService: { verify }
    });
    component.isDashboardPromptOpen = true;
    component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');

    await component.submitDashboardCode();

    expect(component.isDashboardPromptOpen).toBeTrue();
    expect(component.dashboardCodeError).toBe('Incorrect code. Check the 14 digits and try again.');
    expect(verify).toHaveBeenCalledWith('12345678901234');
  });

  it('opens the dashboard directly without a code prompt in local development', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    Object.assign(component, {
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      document,
      renderer: { addClass: (element: HTMLElement, name: string) => element.classList.add(name) }
    });

    environment.showAccessCodePromptLocally = false;
    component.dashboardBlurEnabled = false;
    component.openDashboardPrompt();

    expect(grantOneTimeAccess).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.isDashboardPromptOpen).toBeFalse();
    expect(component.dashboardBlurEnabled).toBeTrue();
    document.body.classList.remove('dashboard-values-blurred');
  });

  it('requires the dashboard code locally when the local prompt is enabled', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const verify = jasmine.createSpy('verify').and.resolveTo(false);
    Object.assign(component, {
      dashboardCodeDigits: Array.from({ length: 14 }, () => ''),
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      confirmationCodeService: { verify },
      document,
      renderer: { addClass: (element: HTMLElement, name: string) => element.classList.add(name) }
    });

    try {
      component.openDashboardPrompt();
      expect(component.isDashboardPromptOpen).toBeTrue();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(grantOneTimeAccess).not.toHaveBeenCalled();

      component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      await component.submitDashboardCode();
      expect(component.isDashboardPromptOpen).toBeTrue();
      expect(navigateByUrl).not.toHaveBeenCalled();

      verify.and.resolveTo(true);
      await component.submitDashboardCode();
      expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('dashboard');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/dashboard');
      expect(component.isDashboardPromptOpen).toBeFalse();
    } finally {
      document.body.classList.remove('dashboard-values-blurred');
    }
  });

  it('opens My Access directly when the local prompt is disabled', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    environment.showAccessCodePromptLocally = false;
    Object.assign(component, { router: { navigateByUrl }, dashboardAccessGuard: { grantOneTimeAccess } });

    component.openMyAccessPrompt();

    expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('my-access');
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/my-access');
    expect(component.isDashboardPromptOpen).toBeFalse();
  });

  it('requires the My Access code locally when the local prompt is enabled', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const verify = jasmine.createSpy('verify').and.resolveTo(false);
    Object.assign(component, {
      dashboardCodeDigits: Array.from({ length: 14 }, () => ''),
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      confirmationCodeService: { verify }
    });

    component.openMyAccessPrompt();
    expect(component.isDashboardPromptOpen).toBeTrue();
    expect(component.accessTarget).toBe('my-access');
    expect(grantOneTimeAccess).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();

    component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
    await component.submitDashboardCode();
    expect(component.isDashboardPromptOpen).toBeTrue();
    expect(navigateByUrl).not.toHaveBeenCalled();

    verify.and.resolveTo(true);
    await component.submitDashboardCode();
    expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('my-access');
    expect(navigateByUrl).toHaveBeenCalledOnceWith('/my-access');
    expect(component.isDashboardPromptOpen).toBeFalse();
  });

  it('collects the encryption key in the same access dialog before navigating', async () => {
    const requests = new BehaviorSubject<'dashboard' | 'my-access' | null>(null);
    const verify = jasmine.createSpy('verify').and.resolveTo(true);
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const encryption = new ApiEncryptionService();
    spyOn(window, 'scrollTo');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/', navigateByUrl } },
        { provide: DashboardAccessGuard, useValue: { grantOneTimeAccess } },
        { provide: ApiKeyGuard, useValue: { requested$: requests, cancel: () => undefined } },
        { provide: ApiEncryptionService, useValue: encryption },
        { provide: DataService, useValue: { getData: () => new Subject() } },
        { provide: TimeService, useValue: { getState: () => ({ isDaytime: true }) } },
        { provide: ConfirmationCodeService, useValue: { verify } }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    const instance = fixture.componentInstance;
    const originalBodyClasses = document.body.className;
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.detectChanges();
      instance.openMyAccessPrompt();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('.dashboard-code-modal') as HTMLElement;
      expect(dialog.querySelector('#api-encryption-key')).not.toBeNull();
      expect(dialog.querySelectorAll('.dashboard-code-input').length).toBe(14);
      const keyInput = dialog.querySelector<HTMLInputElement>('#api-encryption-key')!;
      for (const dark of [false, true]) {
        document.body.classList.toggle('active', dark);
        expect(getComputedStyle(keyInput).backgroundColor).toBe(getComputedStyle(dialog).backgroundColor);
        expect(getComputedStyle(keyInput).color).toBe(getComputedStyle(dialog).color);
      }
      expect(getComputedStyle(keyInput).textTransform).toBe('none');

      instance.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      await instance.submitDashboardCode();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(dialog.textContent).toContain('Enter the encryption key');
      expect(keyInput.getAttribute('aria-invalid')).toBe('true');
      expect(keyInput.getAttribute('aria-describedby')).toContain('api-key-error');
      expect(encryption.hasPassphrase).toBeFalse();
      expect(navigateByUrl).not.toHaveBeenCalled();

      keyInput.value = 'runtime test key';
      keyInput.dispatchEvent(new Event('input'));
      verify.and.resolveTo(false);
      await instance.submitDashboardCode();
      expect(encryption.hasPassphrase).toBeFalse();
      expect(navigateByUrl).not.toHaveBeenCalled();

      verify.and.resolveTo(true);
      await instance.submitDashboardCode();
      expect(encryption.hasPassphrase).toBeTrue();
      expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('my-access');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/my-access');
      expect(instance.keyValidation.key).toBe('');

      instance.openDashboardPrompt();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#api-encryption-key')).toBeNull();
    } finally {
      fixture.destroy();
      fixture.nativeElement.remove();
      document.body.className = originalBodyClasses;
    }
  });

  it('uses the same dialog for a direct local navigation and cancels or unlocks it', async () => {
    const requests = new BehaviorSubject<'dashboard' | 'my-access' | null>(null);
    const unlock = jasmine.createSpy('unlock').and.callFake(() => requests.next(null));
    const cancel = jasmine.createSpy('cancel').and.callFake(() => requests.next(null));
    const verifyKey = jasmine.createSpy('verify').and.rejectWith(new ApiPayloadDecryptionError());
    spyOn(window, 'scrollTo');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: ApiKeyGuard, useValue: { requested$: requests, unlock, cancel } },
        { provide: ApiKeyValidationService, useValue: { verify: verifyKey } },
        { provide: ApiEncryptionService, useValue: new ApiEncryptionService() },
        { provide: DataService, useValue: { getData: () => new Subject() } },
        { provide: TimeService, useValue: { getState: () => ({ isDaytime: true }) } },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    try {
      fixture.detectChanges();
      requests.next('dashboard');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.dashboard-code-modal #api-encryption-key')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.dashboard-code-input')).toBeNull();
      fixture.componentInstance.closeDashboardPrompt();
      expect(cancel).toHaveBeenCalled();
      expect(fixture.componentInstance.isDashboardPromptOpen).toBeFalse();

      requests.next('my-access');
      fixture.componentInstance.keyValidation.key = 'runtime test key';
      await fixture.componentInstance.submitDashboardCode();
      expect(unlock).not.toHaveBeenCalled();
      expect(fixture.componentInstance.keyValidation.error).toContain('Invalid key or damaged data');
      expect(fixture.componentInstance.isDashboardPromptOpen).toBeTrue();
      fixture.detectChanges();
      const error = fixture.nativeElement.querySelector('#api-key-error') as HTMLElement;
      expect(error.getAttribute('role')).toBe('alert');
      expect(error.classList.contains('dashboard-code-error')).toBeTrue();
      expect(error.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('#api-encryption-key').getAttribute('aria-describedby')).toContain('api-key-error');
      verifyKey.and.resolveTo();
      await fixture.componentInstance.submitDashboardCode();
      expect(unlock).toHaveBeenCalledOnceWith('runtime test key');
      expect(verifyKey).toHaveBeenCalledWith('runtime test key', 'my-access');
      expect(fixture.componentInstance.isDashboardPromptOpen).toBeFalse();
    } finally {
      fixture.destroy();
    }
  });

  it('checks the eighth key character and shows progress inside the input', async () => {
    let finish!: () => void;
    const verifyKey = jasmine.createSpy('verify').and.returnValue(
      new Promise<void>((resolve) => { finish = resolve; })
    );
    const unlock = jasmine.createSpy('unlock');
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule, DashboardLoaderComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: DashboardAccessGuard, useValue: {} },
        { provide: ApiKeyGuard, useValue: { unlock, cancel: () => undefined } },
        { provide: ApiKeyValidationService, useValue: { verify: verifyKey } },
        { provide: ApiEncryptionService, useValue: new ApiEncryptionService() },
        { provide: DataService, useValue: {} },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    const instance = fixture.componentInstance;
    instance.apiKeyTarget = 'dashboard';
    instance.isDashboardPromptOpen = true;
    fixture.detectChanges();
    await fixture.whenStable();
    jasmine.clock().install();
    try {
      fixture.detectChanges();
      const keyInput = fixture.nativeElement.querySelector('#api-encryption-key') as HTMLInputElement;
      keyInput.value = '1234567';
      keyInput.dispatchEvent(new Event('input'));
      jasmine.clock().tick(400);
      expect(verifyKey).not.toHaveBeenCalled();

      keyInput.value = '        ';
      keyInput.dispatchEvent(new Event('input'));
      jasmine.clock().tick(400);
      expect(verifyKey).not.toHaveBeenCalled();
      expect(instance.keyValidation.inProgress).toBeFalse();

      keyInput.value = '12345678';
      keyInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.api-key-input [role="status"][aria-label="Checking encryption key"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.api-key-input .loader-ring')).not.toBeNull();
      const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(button.disabled).toBeFalse();
      expect(button.textContent?.trim()).toBe('Continue');
      jasmine.clock().tick(299);
      expect(verifyKey).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      expect(verifyKey).toHaveBeenCalledOnceWith('12345678', 'dashboard');

      const pending = instance.submitDashboardCode();
      expect(verifyKey).toHaveBeenCalledTimes(1);
      expect(unlock).not.toHaveBeenCalled();
      finish();
      await pending;
      fixture.detectChanges();
      expect(unlock).toHaveBeenCalledOnceWith('12345678');
      expect(fixture.nativeElement.querySelector('.api-key-input [aria-label="Encryption key verified"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.api-key-progress')).toBeNull();
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
    }
  });

  it('waits for the key check when the code is completed during validation', async () => {
    let finish!: () => void;
    const verifyKey = jasmine.createSpy('verify').and.returnValue(
      new Promise<void>((resolve) => { finish = resolve; })
    );
    const setPassphrase = jasmine.createSpy('setPassphrase');
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    Object.assign(component, {
      router: { navigateByUrl }, dashboardAccessGuard: { grantOneTimeAccess: () => undefined },
      document,
      apiEncryptionService: { hasPassphrase: false, setPassphrase },
      keyValidation: new AccessKeyValidation({ verify: verifyKey }, () => undefined, true),
      confirmationCodeService: { verify: () => Promise.resolve(true) },
      dashboardCodeDigits: [...Array.from('1234567890123'), ''],
      isDashboardPromptOpen: true
    });
    component.keyValidation.key = '12345678';
    jasmine.clock().install();
    try {
      component.onEncryptionKeyChange();
      jasmine.clock().tick(300);
      const submit = spyOn(component, 'submitDashboardCode').and.callThrough();
      component.onDashboardCodeInput({ target: { value: '4' } } as unknown as Event, 13);
      const pending = submit.calls.mostRecent().returnValue;
      await Promise.resolve();
      expect(verifyKey).toHaveBeenCalledTimes(1);
      expect(navigateByUrl).not.toHaveBeenCalled();
      finish();
      await pending;
      expect(setPassphrase).toHaveBeenCalledOnceWith('12345678');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/dashboard');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('checks the current destination when a delayed key validation starts', async () => {
    const verifyKey = jasmine.createSpy('verify').and.resolveTo();
    Object.assign(component, {
      keyValidation: new AccessKeyValidation({ verify: verifyKey }, () => undefined, true)
    });
    component.keyValidation.key = '12345678';
    jasmine.clock().install();
    try {
      component.onEncryptionKeyChange();
      component.accessTarget = 'my-access';
      jasmine.clock().tick(300);
      expect(verifyKey).toHaveBeenCalledOnceWith('12345678', 'my-access');
      await component.keyValidation.validate('my-access');
    } finally {
      component.keyValidation.clear();
      jasmine.clock().uninstall();
    }
  });

  it('does not navigate when key verification fails or completes after cancellation', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const setPassphrase = jasmine.createSpy('setPassphrase');
    const verifyKey = jasmine.createSpy('verify').and.rejectWith(new ApiPayloadDecryptionError());
    Object.assign(component, {
      router: { navigateByUrl }, dashboardAccessGuard: { grantOneTimeAccess },
      apiEncryptionService: { hasPassphrase: false, setPassphrase },
      keyValidation: new AccessKeyValidation({ verify: verifyKey }, () => undefined, true),
      confirmationCodeService: { verify: () => Promise.resolve(true) },
      dashboardCodeDigits: Array.from('12345678901234'),
      isDashboardPromptOpen: true
    });
    component.keyValidation.key = 'wrong runtime key';

    await component.submitDashboardCode();
    expect(component.keyValidation.error).toContain('Invalid key or damaged data');
    expect(setPassphrase).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();

    verifyKey.and.rejectWith(new Error('Network failed'));
    await component.submitDashboardCode();
    expect(component.keyValidation.error).toContain('verification is unavailable');
    expect(navigateByUrl).not.toHaveBeenCalled();

    let finish!: () => void;
    verifyKey.and.returnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const pending = component.submitDashboardCode();
    await Promise.resolve();
    expect(component.keyValidation.inProgress).toBeTrue();
    component.closeDashboardPrompt();
    finish();
    await pending;
    expect(setPassphrase).not.toHaveBeenCalled();
    expect(grantOneTimeAccess).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('ignores a key verification result after the key is edited', async () => {
    let finish!: () => void;
    const verifyKey = jasmine.createSpy('verify').and.returnValue(
      new Promise<void>((resolve) => { finish = resolve; })
    );
    const setPassphrase = jasmine.createSpy('setPassphrase');
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    Object.assign(component, {
      router: { navigateByUrl }, dashboardAccessGuard: { grantOneTimeAccess: () => undefined },
      apiEncryptionService: { hasPassphrase: false, setPassphrase },
      keyValidation: new AccessKeyValidation({ verify: verifyKey }, () => undefined, true),
      confirmationCodeService: { verify: () => Promise.resolve(true) },
      dashboardCodeDigits: Array.from('12345678901234'),
      isDashboardPromptOpen: true
    });
    component.keyValidation.key = 'first key';

    const pending = component.submitDashboardCode();
    await Promise.resolve();
    expect(component.keyValidation.inProgress).toBeTrue();
    component.keyValidation.key = 'updated key';
    component.onEncryptionKeyChange();
    finish();
    await pending;
    expect(setPassphrase).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(component.keyValidation.inProgress).toBeTrue();
    component.closeDashboardPrompt();
    expect(component.keyValidation.inProgress).toBeFalse();
  });

  describe('My Access production code prompt', () => {
    let originalProduction: boolean;

    beforeEach(() => {
      originalProduction = environment.production;
      environment.production = true;
    });

    afterEach(() => {
      environment.production = originalProduction;
    });

    it('requires the code for My Access and opens it only after successful verification', async () => {
      environment.showAccessCodePromptLocally = false;
      const navigateByUrl = jasmine.createSpy('navigateByUrl');
      const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
      const verify = jasmine.createSpy('verify').and.resolveTo(false);
      Object.assign(component, {
        router: { navigateByUrl },
        dashboardAccessGuard: { grantOneTimeAccess },
        confirmationCodeService: { verify },
        dashboardCodeDigits: Array.from({ length: 14 }, () => '')
      });

      component.openMyAccessPrompt();
      expect(component.isDashboardPromptOpen).toBeTrue();
      expect(navigateByUrl).not.toHaveBeenCalled();
      component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      await component.submitDashboardCode();
      expect(component.dashboardCodeError).toContain('Incorrect code.');
      expect(grantOneTimeAccess).not.toHaveBeenCalled();

      verify.and.resolveTo(true);
      await component.submitDashboardCode();
      expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('my-access');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/my-access');
      expect(component.isDashboardPromptOpen).toBeFalse();
    });

    it('does not open My Access if its code prompt is cancelled during verification', async () => {
      let resolveVerification!: (valid: boolean) => void;
      const verification = new Promise<boolean>((resolve) => { resolveVerification = resolve; });
      const navigateByUrl = jasmine.createSpy('navigateByUrl');
      const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
      Object.assign(component, {
        router: { navigateByUrl },
        dashboardAccessGuard: { grantOneTimeAccess },
        confirmationCodeService: { verify: () => verification },
        dashboardCodeDigits: Array.from({ length: 14 }, () => '')
      });
      component.openMyAccessPrompt();
      component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      const result = component.submitDashboardCode();
      component.closeDashboardPrompt();
      resolveVerification(true);
      await result;
      expect(grantOneTimeAccess).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('ignores a verification result after the entered code changes', async () => {
      let resolveVerification!: (valid: boolean) => void;
      const verification = new Promise<boolean>((resolve) => { resolveVerification = resolve; });
      const navigateByUrl = jasmine.createSpy('navigateByUrl');
      const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
      const verify = jasmine.createSpy('verify').and.returnValues(verification, Promise.resolve(false));
      Object.assign(component, {
        document,
        router: { navigateByUrl },
        dashboardAccessGuard: { grantOneTimeAccess },
        confirmationCodeService: { verify },
        dashboardCodeDigits: Array.from({ length: 14 }, () => '')
      });
      component.openMyAccessPrompt();
      component.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      const result = component.submitDashboardCode();
      component.onDashboardCodeInput({ target: { value: '5' } } as unknown as Event, 0);
      resolveVerification(true);
      await result;
      expect(verify).toHaveBeenCalledTimes(2);
      expect(grantOneTimeAccess).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  it('shows the mask switch only in the dashboard code dialog and resets it on reopening', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const verify = jasmine.createSpy('verify').and.resolveTo(true);
    const encryption = { hasPassphrase: false, setPassphrase: () => { encryption.hasPassphrase = true; } };
    const originalBodyClasses = document.body.className;
    const originalProduction = environment.production;
    environment.production = true;
    environment.showAccessCodePromptLocally = false;
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/', navigateByUrl } },
        { provide: DashboardAccessGuard, useValue: { grantOneTimeAccess } },
        { provide: DataService, useValue: {} },
        { provide: ApiEncryptionService, useValue: encryption },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: { verify } }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.componentInstance.isDataLoaded = true;
      fixture.componentInstance.data = { intro: [{}], themeMode: [{}], aboutMe: {}, content: { intro: '' } };
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.dashboard-nav-link') as HTMLAnchorElement;
      expect(fixture.nativeElement.querySelector('.navbar input[role="switch"]')).toBeNull();
      link.click();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('.dashboard-code-modal') as HTMLElement;
      const toggle = modal.querySelector('input[role="switch"]') as HTMLInputElement;
      const keyInput = modal.querySelector<HTMLInputElement>('#api-encryption-key')!;
      const codeInput = modal.querySelector<HTMLInputElement>('.dashboard-code-input')!;
      expect(keyInput.type).toBe('password');
      const maskedColors: string[] = [];
      for (const dark of [false, true]) {
        document.body.classList.toggle('active', dark);
        const color = getComputedStyle(keyInput).backgroundColor;
        expect(color).toBe(getComputedStyle(codeInput).backgroundColor);
        maskedColors.push(color);
      }
      expect(toggle.getAttribute('aria-label')).toBe('Mask dashboard values');
      expect(toggle.checked).toBeTrue();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeTrue();
      const notice = modal.querySelector('#dashboard-visibility-notice') as HTMLElement;
      expect(notice.textContent?.trim()).toBe('Value Masked');
      expect(modal.getAttribute('data-mask-state')).toBe('masked');
      toggle.click();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      for (const [index, dark] of [false, true].entries()) {
        document.body.classList.toggle('active', dark);
        const color = getComputedStyle(keyInput).backgroundColor;
        expect(color).toBe(getComputedStyle(codeInput).backgroundColor);
        expect(color).not.toBe(maskedColors[index]);
      }
      expect(keyInput.type).toBe('password');
      expect(toggle.checked).toBeFalse();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeFalse();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(notice.textContent?.trim()).toBe('Value Unmasked');
      expect(modal.getAttribute('data-mask-state')).toBe('unmasked');
      expect(modal.getAttribute('aria-describedby')).toBe('dashboard-visibility-notice');
      expect(toggle.getAttribute('aria-describedby')).toBe('dashboard-visibility-notice');
      expect(notice.getAttribute('role')).toBe('status');

      fixture.componentInstance.dashboardCodeDigits.splice(0, 14, ...'12345678901234');
      fixture.componentInstance.keyValidation.key = 'runtime test key';
      verify.and.resolveTo(false);
      await fixture.componentInstance.submitDashboardCode();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const alert = modal.querySelector('[role="alert"]');
      expect(alert?.textContent?.trim()).toBe('Incorrect code. Check the 14 digits and try again.');
      expect(alert?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(navigateByUrl).not.toHaveBeenCalled();

      verify.and.resolveTo(true);
      await fixture.componentInstance.submitDashboardCode();
      expect(grantOneTimeAccess).toHaveBeenCalledOnceWith('dashboard');
      expect(navigateByUrl).toHaveBeenCalledOnceWith('/dashboard');
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeFalse();

      link.click();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('.dashboard-code-modal input[role="switch"]') as HTMLInputElement).checked).toBeTrue();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeTrue();
      fixture.componentInstance.closeDashboardPrompt();
      fixture.componentInstance.openMyAccessPrompt();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.dashboard-code-modal input[role="switch"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('#dashboard-visibility-notice')).toBeNull();
      expect(fixture.nativeElement.querySelector('.dashboard-code-modal').hasAttribute('data-mask-state')).toBeFalse();
    } finally {
      fixture.destroy();
      fixture.nativeElement.remove();
      document.body.className = originalBodyClasses;
      environment.production = originalProduction;
    }
  });

  it('applies and removes the dashboard blur setting', async () => {
    const dashboard = document.createElement('main');
    dashboard.className = 'dashboard-page';
    dashboard.innerHTML = `
      <div class="summary-card"><h2>123456</h2><p>Total</p></div>
      <table><tbody><tr><td><span class="responsive-grid-value">123456</span></td></tr></tbody></table>
      <div class="chart-container">123456</div>
      <input type="number" value="123456">
      <button type="button">Action</button>`;
    document.body.appendChild(dashboard);
    Object.assign(component, {
      document,
      renderer: {
        addClass: (element: HTMLElement, name: string) => element.classList.add(name),
        removeClass: (element: HTMLElement, name: string) => element.classList.remove(name)
      }
    });
    try {
      const value = dashboard.querySelector('.responsive-grid-value')!;
      const card = dashboard.querySelector('.summary-card h2')!;
      const chart = dashboard.querySelector('.chart-container')!;
      const input = dashboard.querySelector('input')!;
      const action = dashboard.querySelector('button')!;
      expect(getComputedStyle(value).filter).toBe('none');
      component.setDashboardBlur(true);
      expect(component.dashboardBlurEnabled).toBeTrue();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeTrue();
      for (const element of [value, card, chart, input]) {
        expect(getComputedStyle(element).filter).toBe('blur(12px)');
      }
      expect(getComputedStyle(action).filter).toBe('none');
      component.setDashboardBlur(false);
      expect(component.dashboardBlurEnabled).toBeFalse();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeFalse();
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(getComputedStyle(value).filter).toBe('none');
    } finally {
      dashboard.remove();
      document.body.classList.remove('dashboard-values-blurred');
    }
  });

  it('routes to the dashboard only after code verification succeeds', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const verify = jasmine.createSpy('verify').and.resolveTo(true);
    Object.assign(component, {
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      confirmationCodeService: { verify },
      dashboardCodeDigits: Array.from('12345678901234')
    });
    component.isDashboardPromptOpen = true;
    Object.assign(component, { document });

    await component.submitDashboardCode();

    expect(grantOneTimeAccess).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.isDashboardPromptOpen).toBeFalse();
  });

  it('automatically routes after the final code digit is verified', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    Object.assign(component, {
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      confirmationCodeService: { verify: jasmine.createSpy('verify').and.resolveTo(true) },
      dashboardCodeDigits: [...Array.from('1234567890123'), ''],
      document
    });

    component.onDashboardCodeInput({ target: { value: '4' } } as unknown as Event, 13);
    await component.submitDashboardCode();

    expect(grantOneTimeAccess).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.isDashboardPromptOpen).toBeFalse();
  });

  it('returns a greeting based on the time of day', () => {
    expect(component.getGreeting(new Date(2026, 7, 24, 8))).toBe('Good morning');
    expect(component.getGreeting(new Date(2026, 7, 24, 14))).toBe('Good afternoon');
    expect(component.getGreeting(new Date(2026, 7, 24, 20))).toBe('Good evening');
  });

  it('rejects an eight-digit entry before requesting verification', async () => {
    const verify = jasmine.createSpy('verify');
    Object.assign(component, {
      dashboardCodeDigits: [...Array.from('12345678'), ...Array(6).fill('')],
      confirmationCodeService: { verify }
    });
    await component.submitDashboardCode();
    expect(verify).not.toHaveBeenCalled();
    expect(component.dashboardCodeError).toBe('Enter all 14 digits to continue.');
  });

  it('fills all fourteen digits from a paste and automatically verifies them', async () => {
    const verify = jasmine.createSpy('verify').and.resolveTo(false);
    Object.assign(component, {
      dashboardCodeDigits: Array.from({ length: 14 }, () => ''),
      confirmationCodeService: { verify },
      document
    });
    const data = new DataTransfer();
    data.setData('text', '12345678901234');
    component.onDashboardCodePaste(new ClipboardEvent('paste', { clipboardData: data }));
    await Promise.resolve();
    expect(component.dashboardCodeDigits.join('')).toBe('12345678901234');
    expect(verify).toHaveBeenCalledOnceWith('12345678901234');
  });

  it('routes to the lazy Interview Q&A feature and hides auto-scroll there', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    Object.assign(component, { router: { navigateByUrl, url: '/' } });

    component.getNote();

    expect(navigateByUrl).toHaveBeenCalledWith('/interview-qa');
    expect(component.isOverlay).toBeFalse();

    Object.assign(component, { router: { url: '/interview-qa' } });
    expect(component.isOverlay).toBeTrue();
    expect(component.showAutoScroll).toBeFalse();
  });
});
