import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-counter',
    templateUrl: './counter.component.html',
    styleUrls: ['./counter.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CounterComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() stopRange: number[] = [];
  @Input() durationMs = 3000;
  @Input() active = false;
  @Input() observeViewport = true;

  counters: {
    value: number,
    intervalId: ReturnType<typeof setInterval> | null,
    flip: boolean,
    previousValue?: number,
    hasFlipped?: boolean
  }[] = [];
  private visibilityObserver?: IntersectionObserver;
  private viewInitialized = false;
  private isInViewport = false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (!this.observeViewport) {
      this.startCounters(this.active);
      return;
    }

    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.isInViewport = entry.isIntersecting;
      this.startCounters(this.isInViewport);
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stopRange']) {
      this.stopCounters();
      this.counters = this.stopRange.map(() => ({
        value: 0,
        intervalId: null,
        flip: false,
        previousValue: 0,
        hasFlipped: false
      }));
    }

    if (this.viewInitialized && changes['active']) {
      this.startCounters(this.active);
    } else if (this.viewInitialized && changes['stopRange']) {
      this.startCounters(this.observeViewport ? this.isInViewport : this.active);
    }
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
    this.resetCounters();
  }

  startCounters(countUp: boolean): void {
    this.stopCounters();
    if (this.counters.length !== this.stopRange.length) {
      this.counters = this.stopRange.map(() => ({
        value: 0,
        intervalId: null,
        flip: false,
        previousValue: 0,
        hasFlipped: false
      }));
    }

    this.counters.forEach((counter, index) => {
      const stopRange = this.stopRange[index];
      const intervalMs = stopRange > 0 ? Math.max(1, Math.round(this.durationMs / stopRange)) : this.durationMs;
      counter.intervalId = setInterval(() => this.incrementCounter(stopRange, countUp), intervalMs);
    });
  }

  private stopCounters(): void {
    this.counters.forEach(counter => {
      if (counter.intervalId !== null) {
        clearInterval(counter.intervalId);
      }
      counter.intervalId = null;
    });
  }

  incrementCounter(stopRange: number, countUp = true): void {
    for (let counter of this.counters) {
      if (countUp && counter.value < stopRange) {
        counter.previousValue = counter.value;
        counter.value++;
        counter.flip = !counter.flip;
        counter.hasFlipped = true;
      } else if (!countUp && counter.value > 0) {
        counter.previousValue = counter.value;
        counter.value--;
        counter.flip = !counter.flip;
        counter.hasFlipped = true;
      } else if (counter.intervalId !== null) {
        clearInterval(counter.intervalId);
        counter.intervalId = null;
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  private resetCounters(): void {
    this.stopCounters();
    this.counters.forEach(counter => {
      counter.value = 0;
      counter.flip = false;
      counter.previousValue = 0;
      counter.hasFlipped = false;
    });
  }

  formatCounter(value: number): string {
    return String(Math.max(0, Math.floor(value)));
  }

  previousDigit(value: number, previousValue: number, digitIndex: number): string {
    const currentDigits = this.formatCounter(value);
    const previousDigits = this.formatCounter(previousValue)
      .padStart(currentDigits.length, '0')
      .slice(-currentDigits.length);
    return previousDigits[digitIndex] ?? currentDigits[digitIndex] ?? '0';
  }

  digitChanged(value: number, previousValue: number, digitIndex: number): boolean {
    return this.previousDigit(value, previousValue, digitIndex) !== this.formatCounter(value)[digitIndex];
  }
}
