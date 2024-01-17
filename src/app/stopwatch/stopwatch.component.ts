import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-stopwatch',
  templateUrl: './stopwatch.component.html',
  styleUrls: ['./stopwatch.component.scss']
})
export class StopwatchComponent implements OnInit, OnDestroy {
  startTime!: number;
  elapsedTime!: number;
  isRunning!: boolean;
  timer!: any;

  ngOnInit() {
    this.reset();
  }

  ngOnDestroy() {
    this.stop();
  }

  start() {
    if (!this.isRunning) {
      this.startTime = new Date().getTime() - this.elapsedTime;
      this.timer = setInterval(() => {
        this.elapsedTime = new Date().getTime() - this.startTime;
      }, 10); // Update every 10 milliseconds
      this.isRunning = true;
    }
  }

  stop() {
    if (this.isRunning) {
      clearInterval(this.timer);
      this.isRunning = false;
    }
  }

  reset() {
    this.startTime = new Date().getTime();
    this.elapsedTime = 0;
    if (!this.isRunning) {
      clearInterval(this.timer);
    }
  }

  formatTime(): string {
    const minutes = Math.floor(this.elapsedTime / 60000);
    const seconds = Math.floor((this.elapsedTime % 60000) / 1000);
    const milliseconds = Math.floor((this.elapsedTime % 1000) / 10);

    return `${this.padNumber(minutes)}:${this.padNumber(seconds)}.${this.padNumber(milliseconds)}`;
  }

  private padNumber(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}