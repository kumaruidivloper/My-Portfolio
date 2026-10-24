import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

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
      this.isInViewport = entry.isIntersecting;
      this.startCounters(this.isInViewport);
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stopRange']) {
      this.stopCounters();
      this.counters = this.stopRange.map(() => ({ value: 0, intervalId: null, flip: false }));
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
      counter.intervalId = setInterval(() => this.incrementCounter(stopRange, countUp), this.stepMs(index));
    });
  }

  /** Time per count step; also used as the drum roll duration so the digits roll at the counting speed. */
  stepMs(index: number): number {
    const stopRange = this.stopRange[index];
    return stopRange > 0 ? Math.max(1, Math.round(this.durationMs / stopRange)) : this.durationMs;
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
    const previous = this.counters[0]?.value;
    for (let counter of this.counters) {
      if (countUp && counter.value < stopRange) {
        counter.value++;
        counter.flip = !counter.flip;
      } else if (!countUp && counter.value > 0) {
        counter.value--;
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
