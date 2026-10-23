import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, inject } from '@angular/core';

@Component({
    selector: 'app-timer',
    templateUrl: './timer.component.html',
    styleUrls: ['./timer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class TimerComponent implements OnInit, OnDestroy {
  @Input() duration: number = 0; // duration in milliseconds
  userInputDuration: number = 0;
  timerState: 'running' | 'paused' = 'paused';
  minutes: number = 0;
  seconds: number = 0;
  milliseconds: number = 0;
  private endTime = 0;
  private frameId: number | null = null;
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.updateTimer();
  }

  ngOnDestroy() {
    this.cancelFrame();
  }

  setAndStartTimer() {
    this.setTimer();
    this.startTimer();
  }

  setTimer() {
    this.duration = this.userInputDuration * 60 * 1000;
    this.updateTimer();
  }

  startTimer() {
    this.cancelFrame();
    this.timerState = 'running';
    // Count down against a fixed end time so dropped frames don't drift the clock.
    this.endTime = Date.now() + this.duration;
    this.zone.runOutsideAngular(() => this.tick());
  }

  stopTimer() {
    this.pauseTimer();
  }

  resetTimer() {
    this.pauseTimer();
    this.duration = 0;
    this.updateTimer();
  }

  private tick = () => {
    this.duration = Math.max(0, this.endTime - Date.now());
    this.updateTimer();
    if (this.duration <= 0) {
      this.zone.run(() => this.pauseTimer());
      return;
    }
    this.cdr.detectChanges();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateTimer() {
    this.minutes = Math.floor(this.duration / 60000);
    this.seconds = Math.floor((this.duration % 60000) / 1000);
    this.milliseconds = this.duration % 1000;
  }

  private pauseTimer() {
    this.cancelFrame();
    this.timerState = 'paused';
    this.cdr.markForCheck();
  }

  private cancelFrame() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}
