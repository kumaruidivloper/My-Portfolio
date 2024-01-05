import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-counter',
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.scss']
})
export class CounterComponent {
  @Input() stopRange: number[] = [];

  counters: { value: number, intervalId: number }[] = [];

  ngOnInit(): void {
    this.startCounters();
  }

  startCounters(): void {
    for (let stopRange of this.stopRange) {
      this.counters.push({ value: 1, intervalId: setInterval(() => this.incrementCounter(stopRange), 50, stopRange) });
    }
  }

  incrementCounter(stopRange: number): void {
    for (let counter of this.counters) {
      if (counter.value <= 35500 && counter.value <= stopRange) {
        counter.value++;
      } else {
        clearInterval(counter.intervalId);
      }
    }
  }
}
