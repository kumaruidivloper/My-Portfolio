/// <reference types="jasmine" />

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let component: AppComponent;

  beforeEach(() => {
    component = Object.create(AppComponent.prototype) as AppComponent;
  });

  it('calculates experience from the May anniversary', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 7, 24));

    expect(component.addExperienceCount(2007, 0)).toBe(19);

    jasmine.clock().uninstall();
  });

  it('removes the legacy experience prefix from intro text', () => {
    expect(component.introText('16+ years of experience')).toBe('years of experience');
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
    expect(component.dashboardCodeError).toContain('correct 14-digit code');
    expect(verify).toHaveBeenCalledWith('12345678901234');
  });

  it('opens the dashboard directly without a code prompt in local development', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    Object.assign(component, {
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess }
    });

    component.openDashboardPrompt();

    expect(grantOneTimeAccess).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.isDashboardPromptOpen).toBeFalse();
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
    expect(component.dashboardCodeError).toContain('14-digit');
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
});
