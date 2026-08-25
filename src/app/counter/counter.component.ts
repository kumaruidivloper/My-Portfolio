import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy } from '@angular/core';

@Component({
    selector: 'app-counter',
    templateUrl: './counter.component.html',
    styleUrls: ['./counter.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CounterComponent implements AfterViewInit, OnDestroy {
  @Input() stopRange: number[] = [];

  counters: { value: number, intervalId: number }[] = [];
  private visibilityObserver?: IntersectionObserver;

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        this.startCounters();
      } else {
        this.resetCounters();
      }
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
    this.resetCounters();
  }

  startCounters(): void {
    this.resetCounters();
    this.counters = [];
    for (let stopRange of this.stopRange) {
      this.counters.push({ value: 0, intervalId: setInterval(() => this.incrementCounter(stopRange), 50, stopRange) });
    }
  }

  private resetCounters(): void {
    this.counters.forEach(counter => {
      clearInterval(counter.intervalId);
      counter.value = 0;
      counter.intervalId = 0;
    });
  }

  incrementCounter(stopRange: number): void {
    for (let counter of this.counters) {
      if (counter.value < stopRange) {
        counter.value++;
      } else {
        clearInterval(counter.intervalId);
      }
    }
  }
}
