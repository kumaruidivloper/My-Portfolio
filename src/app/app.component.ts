
import { Component, ViewChild, ElementRef, OnInit, OnDestroy, HostListener, Renderer2, Inject, DOCUMENT, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { delay, Subscription, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AppOptions } from './model/model';
import { DataService } from './shared/service/data.service';
import { ApiKeyGuard } from './service/api-key.guard';
import { ApiEncryptionService } from './shared/service/api-encryption.service';
import { ApiKeyValidationService } from './shared/service/api-key-validation.service';
import { AccessKeyValidation } from './shared/key-validation/access-key-validation';
import { DashboardAccessGuard, ProtectedDestination } from './service/dashboard-access.guard';
import { ConfirmationCodeService } from './shared/service/confirmation-code.service';
import { TimeService } from './shared/service/time.service';
import { environment } from '../environments/environment';
import { formatProfileTitle } from './shared/profile-title';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    host: { '[style.--startup-rewind-duration]': 'startupRewindDurationMs + "ms"' },
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  readonly dashboardCodeDigits = Array.from({ length: 14 }, () => '');
  dashboardBlurEnabled = true;
  isDashboardPromptOpen = false;
  dashboardCodeError = '';
  readonly keyValidation: AccessKeyValidation;
  apiKeyTarget: ProtectedDestination | null = null;
  accessTarget: ProtectedDestination = 'dashboard';
  private accessPromptVersion = 0;

  data: any;
  isDataLoaded: boolean = false;
  portfolioLoadFailed = false;
  portfolioLoadError = 'Couldn’t load the portfolio.';
  startupFillDurationMs: number | null = null;
  startupRewind = false;
  readonly startupRewindDurationMs = 650;
  private readonly startupDelayMs = 3500;
  title = 'Kumar UI';
  profileTitle(title = ''): string {
    return formatProfileTitle(title);
  }

  appOptions = AppOptions;
  transition = ['width 3s', 'width 4s', 'width 5s', 'width 6s', 'width 7s', 'width 8s', 'width 9s', 'width 10s', 'width 11s', 'width 12s'];
  barAnimation = false;
  isVisible = true;
  isDarkeMode = true;
  isScrollBottom = true;
  profileScrollProgress = 0;
  currentYear: number=new Date().getFullYear();
  currentTime: Date | undefined;
  greeting = '';
  isDaytime: boolean | undefined;
  isThemeModeClicked: boolean = true;
  inputValue: string = '';
  isButtonDisabled: boolean = true;
  private cdr = inject(ChangeDetectorRef);
  private barAnimationTimeout?: ReturnType<typeof setTimeout>;
  private timeUpdateTimeout?: ReturnType<typeof setTimeout>;
  private timeUpdateInterval?: ReturnType<typeof setInterval>;
  private dataSubscription?: Subscription;
  private apiKeyRequestSubscription?: Subscription;
  private startupRewindTimeout?: ReturnType<typeof setTimeout>;

  get showAutoScroll(): boolean {
    return !this.router.url.startsWith('/dashboard') && !this.router.url.startsWith('/my-access') && !this.isOverlay;
  }

  get isOverlay(): boolean {
    return this.router.url.startsWith('/interview-qa');
  }

  get requiresEncryptionKey(): boolean {
    return !this.apiEncryptionService.hasPassphrase;
  }


  @ViewChild('menubtn') menubtn!: ElementRef;
  @ViewChild('header') header!: ElementRef;
  @ViewChild('themeToggler') themeToggler!: ElementRef;
  @ViewChild('overlay') overlay!: ElementRef;
  @ViewChild('firstDashboardCodeInput')
  set firstDashboardCodeInput(input: ElementRef<HTMLInputElement> | undefined) {
    if (!this.requiresEncryptionKey) {
      input?.nativeElement.focus();
    }
  }
  @ViewChild('apiEncryptionKeyInput')
  set apiEncryptionKeyInput(input: ElementRef<HTMLInputElement> | undefined) {
    input?.nativeElement.focus();
  }

  @HostListener('window:scroll')
    scrollHandler(): void {
      this.menubtn?.nativeElement.classList.remove('fa-time');
      this.header?.nativeElement.classList.remove('active');
      if(window.pageYOffset === 0) {
        this.isScrollBottom = true  ;
      }
      if(window.pageYOffset >= 200) {
        this.isVisible = false;
      } else {
        this.isVisible = true;
      }
      if (window.pageYOffset >= 1000 && window.pageYOffset <= 2000) {
        this.selectedOption('about');
      } else {
        this.selectedOption('home');
      }
    }

    constructor(
    @Inject(DOCUMENT) private document: 
    Document, private renderer: Renderer2, 
    private dataService: DataService,
    private timeService: TimeService,
    private router: Router,
    private dashboardAccessGuard: DashboardAccessGuard,
    private confirmationCodeService: ConfirmationCodeService,
    private apiKeyGuard: ApiKeyGuard,
    private apiEncryptionService: ApiEncryptionService,
    apiKeyValidationService: ApiKeyValidationService
    ) {
      this.keyValidation = new AccessKeyValidation(apiKeyValidationService, () => this.cdr.markForCheck());
      this.renderer.removeClass(document.body, 'active');
      this.setDashboardBlur(this.dashboardBlurEnabled);
    }

  ngOnInit(): void {
    this.checkTimeCondition();
    this.apiKeyRequestSubscription = this.apiKeyGuard.requested$.subscribe((target) => {
      this.accessPromptVersion++;
      this.apiKeyTarget = target;
      this.keyValidation.clear();
      if (target) {
        this.accessTarget = target;
        this.dashboardCodeError = '';
        this.isDashboardPromptOpen = true;
      } else {
        this.isDashboardPromptOpen = false;
      }
      this.cdr.markForCheck();
    });
    this.loadPortfolioData();
    window.scrollTo({ top: 0, behavior: 'smooth' })
    //console.log(Math.max( this.body.scrollHeight, this.body.offsetHeight))
    this.renderer.removeClass(this.document.body, 'active');
    this.barAnimationTimeout = setTimeout(() => this.barAnimation = true, 2000);
    this.updateTime();
    this.timeUpdateTimeout = setTimeout(() => {
      this.timeUpdateInterval = setInterval(() => {
        if (this.updateTime()) {
          if(this.isThemeModeClicked) {
            this.themeToggler?.nativeElement.classList.remove('fa-sun');
            this.renderer.removeClass(document.body, 'active');
            this.isDarkeMode = true;
          }
        } else {
          if(this.isThemeModeClicked) {
            this.themeToggler?.nativeElement.classList.add('fa-sun');
            //this.renderer.addClass(document.body, 'active');
            this.isDarkeMode = false;
          }
        }
      }, 1000);
    }, 3500);

  }

  loadPortfolioData(): void {
    this.portfolioLoadFailed = false;
    this.portfolioLoadError = 'Couldn’t load the portfolio.';
    this.startupFillDurationMs = null;
    this.dataSubscription = this.dataService.getData().pipe(
      tap(() => {
        this.startupFillDurationMs = this.startupDelayMs;
        this.cdr.markForCheck();
      }),
      delay(this.startupDelayMs)
    ).subscribe({
      next: (data) => {
        this.data = data;
        this.startupRewind = this.showAutoScroll;
        if (this.startupRewind) {
          this.startupRewindTimeout = setTimeout(() => {
            this.startupRewind = false;
            this.cdr.markForCheck();
          }, this.startupRewindDurationMs);
        }
        this.isDataLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.portfolioLoadFailed = true;
        this.cdr.markForCheck();
      }
    });
  }

  onEncryptionKeyChange(): void {
    this.accessPromptVersion++;
    this.keyValidation.onChange(() => this.accessTarget);
  }

  ngOnDestroy(): void {
    this.accessPromptVersion++;
    this.keyValidation.reset();
    this.dataSubscription?.unsubscribe();
    this.apiKeyRequestSubscription?.unsubscribe();
    this.apiKeyGuard.cancel();
    clearTimeout(this.startupRewindTimeout);
    this.renderer.removeClass(this.document.body, 'scrollOff');
    this.renderer.removeClass(this.document.body, 'dashboard-values-blurred');
    if (this.barAnimationTimeout) {
      clearTimeout(this.barAnimationTimeout);
    }
    if (this.timeUpdateTimeout) {
      clearTimeout(this.timeUpdateTimeout);
    }
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  checkTimeCondition(): void {
    if (this.timeService.getState().isDaytime) {
      this.renderer.addClass(document.body, 'day');
      this.renderer.removeClass(document.body, 'night');
    } else {
      this.renderer.addClass(document.body, 'night');
      this.renderer.removeClass(document.body, 'day');
    }
  }

  /* invoking*/
  addExperienceCount(startYear: number, baseValue: number): number { 
    const today = new Date();
    const currentYear = today.getFullYear();
    const may1ThisYear = new Date(currentYear, 4, 1);

    let yearsPassed = currentYear - startYear;

    if (today < may1ThisYear) {
      yearsPassed -= 1;
    }

    return baseValue + Math.max(0, yearsPassed);
  }

  
  introParts(value: string): { before: string; years: string; after: string } {
    const text = this.introText(value);
    const match = /^(.*?last\s+)(\d+)(\s+years.*)$/is.exec(text);
    return match ? { before: match[1], years: match[2], after: match[3] } : { before: text, years: '', after: '' };
  }

  introText(value: string) {
      // console.log(value);
      const years = this.addExperienceCount(2007, 0);
      return value
        .replace(/16\+\s*/, '') // removes '16+ ' (with optional space)
        .replace(/(last\s+)\d+\+?(\s+years)/i, `$1${years}$2`);
  }

  /* Slow invoking*/
  updateTime() {
    this.currentTime = new Date();
    this.greeting = this.getGreeting(this.currentTime);
    this.isDaytime = this.timeService.getState(this.currentTime).isDaytime;
    return this.isDaytime;
  }

  getGreeting(time: Date = new Date()): string {
    const hour = time.getHours();

    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    }

    if (hour >= 12 && hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }

  menuClick(): void {
    this.menubtn.nativeElement.classList.toggle('fa-times');
    this.header.nativeElement.classList.toggle('active');
  }

  qrValueCheck(): void {
    this.isButtonDisabled = this.inputValue.length === 0;
  }

  QrReset() {
    this.inputValue = '';
    this.isButtonDisabled = true;
  }

  themeTogglerClick(): void {
    this.isThemeModeClicked = false;
    this.themeToggler.nativeElement.classList.toggle('fa-sun');
    if(this.themeToggler.nativeElement.classList.contains('fa-sun')) {
      this.renderer.addClass(document.body, 'active');
      this.isDarkeMode = false;
      this.renderer.removeClass(document.body, 'night');
      this.renderer.removeClass(document.body, 'day');
    } else {
      this.renderer.removeClass(document.body, 'active');
      this.renderer.addClass(document.body, 'day');
      this.isDarkeMode = true;
      this.renderer.removeClass(document.body, 'night');
    } 
  }

  /* invoking */
  barRange(value: number): string {
      return value + '%'; 
  }

  selectedOption(value: string) {
    if(value === 'about') {
      this.barAnimation = true;
    } else {
      this.barAnimation = false;
    }
  }

  scrollTop(): void {
    this.isScrollBottom = !this.isScrollBottom;
    this.isScrollBottom ?  window.scrollTo({ top: 0, behavior: 'smooth' }) :  window.scrollTo(0, document.body.scrollHeight);
  }

  getNote(): void {
    this.closeSideMenu();
    // The InterviewQaModule chunk is lazy-loaded by the router on first visit.
    void this.router.navigateByUrl('/interview-qa');
  }

  private closeSideMenu(): void {
    this.menubtn?.nativeElement.classList.remove('fa-times');
    this.header?.nativeElement.classList.remove('active');
  }

  openDashboardPrompt(): void {
    this.setDashboardBlur(true);
    this.openProtectedPrompt('dashboard');
  }

  openMyAccessPrompt(): void {
    this.openProtectedPrompt('my-access');
  }

  private openProtectedPrompt(target: ProtectedDestination): void {
    this.closeSideMenu();
    this.accessTarget = target;
    this.accessPromptVersion++;
    if (!environment.production && !environment.showAccessCodePromptLocally) {
      this.isDashboardPromptOpen = false;
      this.dashboardCodeError = '';
      this.dashboardAccessGuard.grantOneTimeAccess(target);
      void this.router.navigateByUrl(`/${target}`);
      return;
    }

    this.dashboardCodeDigits.fill('');
    this.dashboardCodeError = '';
    this.keyValidation.clear();
    this.isDashboardPromptOpen = true;
  }

  setDashboardBlur(enabled: boolean): void {
    this.dashboardBlurEnabled = enabled;
    if (enabled) {
      this.renderer.addClass(this.document.body, 'dashboard-values-blurred');
    } else {
      this.renderer.removeClass(this.document.body, 'dashboard-values-blurred');
    }
  }

  closeDashboardPrompt(): void {
    this.accessPromptVersion++;
    this.isDashboardPromptOpen = false;
    this.dashboardCodeError = '';
    this.keyValidation.clear();
    if (this.apiKeyTarget) {
      this.apiKeyGuard.cancel();
    }
  }

  onDashboardCodeInput(event: Event, index: number): void {
    this.accessPromptVersion++;
    const input = event.target as HTMLInputElement;
    const digit = input.value.replace(/\D/g, '').slice(-1);
    this.dashboardCodeDigits[index] = digit;
    input.value = digit;
    this.dashboardCodeError = '';

    if (digit) {
      this.dashboardCodeInputs()[index + 1]?.focus();
    }

    if (this.dashboardCodeDigits.every((codeDigit) => codeDigit !== '')) {
      void this.submitDashboardCode();
    }
  }

  onDashboardCodeKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.dashboardCodeDigits[index]) {
      this.dashboardCodeInputs()[index - 1]?.focus();
    }

    if (event.key === 'ArrowLeft') {
      this.dashboardCodeInputs()[index - 1]?.focus();
    } else if (event.key === 'ArrowRight') {
      this.dashboardCodeInputs()[index + 1]?.focus();
    }
  }

  onDashboardCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.accessPromptVersion++;
    const digits = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, this.dashboardCodeDigits.length) ?? '';
    this.dashboardCodeDigits.fill('');
    Array.from(digits).forEach((digit, index) => {
      this.dashboardCodeDigits[index] = digit;
    });
    this.dashboardCodeInputs()[Math.min(digits.length, this.dashboardCodeDigits.length - 1)]?.focus();
    this.dashboardCodeError = '';
    if (this.dashboardCodeDigits.every((digit) => digit !== '')) {
      void this.submitDashboardCode();
    }
  }

  async submitDashboardCode(): Promise<void> {
    const promptVersion = ++this.accessPromptVersion;
    const target = this.accessTarget;
    if (this.apiKeyTarget) {
      if (!await this.keyValidation.validate(target) || promptVersion !== this.accessPromptVersion) {
        return;
      }
      this.apiKeyGuard.unlock(this.keyValidation.key);
      return;
    }

    const enteredCode = this.dashboardCodeDigits.join('');
    if (!/^\d{14}$/.test(enteredCode)) {
      this.dashboardCodeError = 'Enter all 14 digits to continue.';
      return;
    }

    let isValid: boolean;
    try {
      isValid = await this.confirmationCodeService.verify(enteredCode);
    } catch {
      if (promptVersion === this.accessPromptVersion) {
        this.dashboardCodeError = 'Code verification is unavailable. Please try again.';
      }
      return;
    }

    if (promptVersion !== this.accessPromptVersion) {
      return;
    }

    if (!isValid) {
      this.dashboardCodeError = 'Incorrect code. Check the 14 digits and try again.';
      return;
    }

    if (this.requiresEncryptionKey) {
      if (!await this.keyValidation.validate(target) || promptVersion !== this.accessPromptVersion) {
        return;
      }
      this.apiEncryptionService.setPassphrase(this.keyValidation.key);
    }
    this.dashboardAccessGuard.grantOneTimeAccess(target);
    this.closeDashboardPrompt();
    this.closeSideMenu();
    void this.router.navigateByUrl(`/${target}`);
  }

  private dashboardCodeInputs(): NodeListOf<HTMLInputElement> {
    return this.document.querySelectorAll<HTMLInputElement>('.dashboard-code-input');
  }

}
