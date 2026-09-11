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
  @Input() active = false;
  @Input() observeViewport = true;

  counters: { value: number, intervalId: ReturnType<typeof setInterval> | null }[] = [];
  private visibilityObserver?: IntersectionObserver;
  private viewInitialized = false;

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
      if (entry.isIntersecting) {
        this.startCounters(true);
      } else {
        this.startCounters(false);
      }
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewInitialized && changes['active']) {
      this.startCounters(this.active);
    }
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
    this.resetCounters();
  }

  startCounters(countUp: boolean): void {
    this.stopCounters();
    if (this.counters.length !== this.stopRange.length) {
      this.counters = this.stopRange.map(() => ({ value: 0, intervalId: null }));
    }

    this.counters.forEach((counter, index) => {
      const stopRange = this.stopRange[index];
      counter.intervalId = setInterval(() => this.incrementCounter(stopRange, countUp), 50);
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
        counter.value++;
      } else if (!countUp && counter.value > 0) {
        counter.value--;
      } else if (counter.intervalId !== null) {
        clearInterval(counter.intervalId);
        counter.intervalId = null;
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  private resetCounters(): void {
    this.stopCounters();
    this.counters.forEach(counter => counter.value = 0);
  }
}
