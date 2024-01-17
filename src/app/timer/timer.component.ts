import { Component, Input, OnInit } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss'],
  animations: [
    trigger('timerAnimation', [
      state('running', style({ opacity: 1 })),
      state('paused', style({ opacity: 0.5 })),
      transition('running <=> paused', animate('300ms ease-out')),
    ]),
    trigger('millisecondsAnimation', [
      state('running', style({ transform: 'scale(1.2)' })),
      state('paused', style({ transform: 'scale(1.0)' })),
      transition('running <=> paused', animate('300ms ease-out')),
    ]),
  ],
})
export class TimerComponent implements OnInit {
  @Input() duration: number = 0; // duration in milliseconds
  userInputDuration: number = 0;
  timerState: 'running' | 'paused' = 'paused';
  minutes: number = 0;
  seconds: number = 0;
  milliseconds: number = 0;
  private timerInterval: any;

  ngOnInit() {
    this.updateTimer();
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
    this.timerState = 'running';
    this.timerInterval = setInterval(() => {
      this.duration -= 10;
      this.updateTimer();
      if (this.duration <= 0) {
        this.pauseTimer();
      }
    }, 10);
  }

  stopTimer() {
    this.pauseTimer();
  }

  resetTimer() {
    this.pauseTimer();
    this.duration = 0;
    this.updateTimer();
  }

  private updateTimer() {
    this.minutes = Math.floor(this.duration / 60000);
    this.seconds = Math.floor((this.duration % 60000) / 1000);
    this.milliseconds = this.duration % 1000;
  }

  private pauseTimer() {
    clearInterval(this.timerInterval);
    this.timerState = 'paused';
  }
}