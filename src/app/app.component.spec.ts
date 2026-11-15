/// <reference types="jasmine" />

import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { DataService } from './service/data.service';
import { DashboardAccessGuard } from './service/dashboard-access.guard';
import { ConfirmationCodeService } from './service/confirmation-code.service';
import { TimeService } from './service/time.service';

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

  it('shows an enabled blur switch beside the dashboard link without triggering navigation', async () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const grantOneTimeAccess = jasmine.createSpy('grantOneTimeAccess');
    spyOn(AppComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { url: '/', navigateByUrl } },
        { provide: DashboardAccessGuard, useValue: { grantOneTimeAccess } },
        { provide: DataService, useValue: {} },
        { provide: TimeService, useValue: {} },
        { provide: ConfirmationCodeService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(AppComponent);
    document.body.appendChild(fixture.nativeElement);
    try {
      fixture.componentInstance.isDataLoaded = true;
      fixture.componentInstance.data = { intro: [{}], themeMode: [{}], aboutMe: {}, content: { intro: '' } };
      fixture.detectChanges();
      const row = fixture.nativeElement.querySelector('.dashboard-nav-item') as HTMLElement;
      const toggle = row.querySelector('input[role="switch"]') as HTMLInputElement;
      const track = row.querySelector('.toggle-switch') as HTMLElement;
      const thumb = track.querySelector('.toggle-switch-thumb') as HTMLElement;
      const hint = track.querySelector('.dashboard-blur-hint') as SVGElement;
      const link = row.querySelector('a') as HTMLAnchorElement;
      expect(toggle.getAttribute('aria-label')).toBe('Blur dashboard values');
      expect(row.textContent?.trim()).toBe('My Dashboard');
      expect(track.getBoundingClientRect().width).toBeGreaterThan(4 * parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(toggle.checked).toBeTrue();
      fixture.componentInstance.isDashboardPromptOpen = true;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#dashboard-visibility-notice')).toBeNull();
      fixture.componentInstance.closeDashboardPrompt();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(track.querySelectorAll('.toggle-switch-thumb svg path').length).toBe(2);
      expect(track.querySelectorAll('.dashboard-blur-hint path').length).toBe(1);
      await Promise.all(thumb.getAnimations().map((animation) => animation.finished));
      expect(getComputedStyle(track, '::before').opacity).toBe('0');
      expect(hint.getBoundingClientRect().right).toBeLessThan(thumb.getBoundingClientRect().left);
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeTrue();
      expect(link.getBoundingClientRect().right).toBeLessThanOrEqual(toggle.getBoundingClientRect().left);
      expect(toggle.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right);
      toggle.click();
      fixture.detectChanges();
      expect(toggle.checked).toBeFalse();
      expect(track.querySelectorAll('.toggle-switch-thumb svg path').length).toBe(1);
      expect(track.querySelectorAll('.dashboard-blur-hint path').length).toBe(2);
      await Promise.all(thumb.getAnimations().map((animation) => animation.finished));
      expect(getComputedStyle(track, '::before').opacity).toBe('0');
      expect(thumb.getBoundingClientRect().right).toBeLessThan(hint.getBoundingClientRect().left);
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeFalse();
      expect(navigateByUrl).not.toHaveBeenCalled();
      fixture.componentInstance.isDashboardPromptOpen = true;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const notice = fixture.nativeElement.querySelector('#dashboard-visibility-notice') as HTMLElement;
      expect(notice.textContent?.trim()).toBe('Blur is off');
      const noticeText = notice.querySelector('span') as HTMLElement;
      const noticeIcon = notice.querySelector('svg') as SVGElement;
      expect(noticeIcon.getAttribute('aria-hidden')).toBe('true');
      expect(noticeIcon.getBoundingClientRect().top).toBeGreaterThan(noticeText.getBoundingClientRect().bottom);
      const modal = fixture.nativeElement.querySelector('.dashboard-code-modal') as HTMLElement;
      expect(modal.getAttribute('aria-describedby')).toBe('dashboard-visibility-notice');
      expect(getComputedStyle(notice).textAlign).toBe('center');
      for (const width of ['60rem', '25rem']) {
        modal.style.width = width;
        const modalRect = modal.getBoundingClientRect();
        const noticeRect = notice.getBoundingClientRect();
        expect(Math.abs((modalRect.left + modalRect.right - noticeRect.left - noticeRect.right) / 2)).toBeLessThan(1);
        expect(noticeRect.width).toBeLessThanOrEqual(modalRect.width);
      }
      fixture.componentInstance.closeDashboardPrompt();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      toggle.click();
      fixture.detectChanges();
      expect(document.body.classList.contains('dashboard-values-blurred')).toBeTrue();
      expect(track.querySelectorAll('.toggle-switch-thumb svg path').length).toBe(2);
      expect(track.querySelectorAll('.dashboard-blur-hint path').length).toBe(1);
      toggle.click();
      fixture.detectChanges();
      link.click();
      expect(grantOneTimeAccess).toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
      expect(fixture.componentInstance.isDashboardPromptOpen).toBeFalse();
    } finally {
      fixture.destroy();
      fixture.nativeElement.remove();
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
