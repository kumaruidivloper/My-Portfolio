import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, inject } from '@angular/core';

@Component({
    selector: 'app-stopwatch',
    templateUrl: './stopwatch.component.html',
    styleUrls: ['./stopwatch.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class StopwatchComponent implements OnInit, OnDestroy {
  startTime!: number;
  elapsedTime!: number;
  isRunning!: boolean;
  private frameId: number | null = null;
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.reset();
  }

  ngOnDestroy() {
    this.stop();
  }

  start() {
    if (!this.isRunning) {
      this.startTime = Date.now() - this.elapsedTime;
      this.isRunning = true;
      // Tick once per frame outside Angular and refresh only this component, not the whole app.
      this.zone.runOutsideAngular(() => this.tick());
    }
  }

  stop() {
    if (this.isRunning) {
      this.cancelFrame();
      this.elapsedTime = Date.now() - this.startTime;
      this.isRunning = false;
    }
  }

  reset() {
    this.startTime = Date.now();
    this.elapsedTime = 0;
  }

  formatTime(): string {
    const minutes = Math.floor(this.elapsedTime / 60000);
    const seconds = Math.floor((this.elapsedTime % 60000) / 1000);
    const milliseconds = Math.floor((this.elapsedTime % 1000) / 10);

    return `${this.padNumber(minutes)}:${this.padNumber(seconds)}.${this.padNumber(milliseconds)}`;
  }

  private tick = () => {
    this.elapsedTime = Date.now() - this.startTime;
    this.cdr.detectChanges();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private cancelFrame() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private padNumber(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
