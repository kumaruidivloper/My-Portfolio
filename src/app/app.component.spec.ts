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

  it('keeps the dashboard prompt open for an incorrect code', async () => {
    const verify = jasmine.createSpy('verify').and.resolveTo(false);
    Object.assign(component, {
      dashboardCodeDigits: Array.from({ length: 8 }, () => ''),
      document,
      confirmationCodeService: { verify }
    });
    component.isDashboardPromptOpen = true;
    component.dashboardCodeDigits.splice(0, 8, ...'12345678');

    await component.submitDashboardCode();

    expect(component.isDashboardPromptOpen).toBeTrue();
    expect(component.dashboardCodeError).toContain('correct 8-digit code');
    expect(verify).toHaveBeenCalledWith('12345678');
  });

  it('routes to the dashboard only after code verification succeeds', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    const verify = jasmine.createSpy('verify').and.resolveTo(true);
    Object.assign(component, {
      router: { navigateByUrl },
      dashboardAccessGuard: { grantOneTimeAccess },
      confirmationCodeService: { verify },
      dashboardCodeDigits: Array.from('12345678')
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
      dashboardCodeDigits: Array.from('1234567'),
      document
    });

    component.onDashboardCodeInput({ target: { value: '4' } } as unknown as Event, 7);
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
});
