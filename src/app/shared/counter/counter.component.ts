import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

/** Shortest time per count step, so the digit drums visibly roll even for very large totals. */
const MIN_STEP_MS = 40;

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
  /** When false, the count keeps running after the counter scrolls out of view instead of rolling back to 0. */
  @Input() countDownOnLeave = true;
  /** Emits the first counter's value on every step, so linked visuals (e.g. a skill bar) move in lockstep. */
  @Output() valueChange = new EventEmitter<number>();

  counters: { value: number, intervalId: ReturnType<typeof setInterval> | null, flip: boolean }[] = [];
  digitWheel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
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
      if (!entry.isIntersecting && !this.countDownOnLeave) {
        return;
      }
      this.isInViewport = entry.isIntersecting;
      this.startCounters(this.isInViewport);
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stopRange']) {
      this.stopCounters();
      // Keep the current reading when the target moves (e.g. work hours ticking up) instead of restarting at 0.
      const previous = this.counters;
      this.counters = this.stopRange.map((stop, index) =>
        ({ value: Math.min(previous[index]?.value ?? 0, Math.max(0, stop)), intervalId: null, flip: false }));
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
      this.counters = this.stopRange.map(() => ({ value: 0, intervalId: null, flip: false }));
    }

    this.counters.forEach((counter, index) => {
      const stopRange = this.stopRange[index];
      const step = this.stepSize(index);
      counter.intervalId = setInterval(() => this.incrementCounter(stopRange, countUp, step), this.stepMs(index));
    });
  }

  /** Time per count step; also used as the drum roll duration so the digits roll at the counting speed. */
  stepMs(index: number): number {
    const stopRange = this.stopRange[index];
    return stopRange > 0 ? Math.max(MIN_STEP_MS, Math.round(this.durationMs / stopRange)) : this.durationMs;
  }

  /** Large totals advance several units per step so they still finish within the duration. */
  stepSize(index: number): number {
    const stopRange = this.stopRange[index];
    return stopRange > 0 ? Math.max(1, Math.ceil(stopRange * this.stepMs(index) / this.durationMs)) : 1;
  }

  private stopCounters(): void {
    this.counters.forEach(counter => {
      if (counter.intervalId !== null) {
        clearInterval(counter.intervalId);
      }
      counter.intervalId = null;
    });
  }

  incrementCounter(stopRange: number, countUp = true, step = 1): void {
    const previous = this.counters[0]?.value;
    for (let counter of this.counters) {
      if (countUp && counter.value < stopRange) {
        counter.value = Math.min(stopRange, counter.value + step);
        counter.flip = !counter.flip;
      } else if (!countUp && counter.value > 0) {
        counter.value = Math.max(0, counter.value - step);
        counter.flip = !counter.flip;
      } else if (counter.intervalId !== null) {
        clearInterval(counter.intervalId);
        counter.intervalId = null;
      }
    }
    this.changeDetectorRef.detectChanges();
    if (this.counters[0] && this.counters[0].value !== previous) {
      this.valueChange.emit(this.counters[0].value);
    }
  }

  private resetCounters(): void {
    this.stopCounters();
    this.counters.forEach(counter => {
      counter.value = 0;
      counter.flip = false;
    });
  }

  formatCounter(value: number): string {
    return String(Math.max(0, Math.floor(value)));
  }

  digitValue(digit: string): number {
    return Number(digit);
  }

  wheelRotation(value: number, digitIndex: number): number {
    const place = this.formatCounter(value).length - digitIndex - 1;
    return Math.floor(Math.max(0, Math.floor(value)) / 10 ** place) * 36;
  }
}
