import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-counter',
    templateUrl: './counter.component.html',
    styleUrls: ['./counter.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CounterComponent implements OnDestroy {
  @Input() stopRange: number[] = [];

  counters: { value: number, intervalId: number }[] = [];

  ngOnInit(): void {
    this.startCounters();
  }

  ngOnDestroy(): void {
    this.counters.forEach(counter => clearInterval(counter.intervalId));
  }

  startCounters(): void {
    for (let stopRange of this.stopRange) {
      this.counters.push({ value: 1, intervalId: setInterval(() => this.incrementCounter(stopRange), 50, stopRange) });
    }
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
