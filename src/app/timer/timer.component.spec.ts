/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
  let component: TimerComponent;
  let fixture: ComponentFixture<TimerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimerComponent],
      imports: [FormsModule]
    });
    fixture = TestBed.createComponent(TimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('converts input minutes into milliseconds', () => {
    component.userInputDuration = 2;

    component.setTimer();

    expect(component.duration).toBe(120000);
    expect(component.minutes).toBe(2);
  });

  it('resets to a paused zero timer', () => {
    component.duration = 5000;

    component.resetTimer();

    expect(component.duration).toBe(0);
    expect(component.timerState).toBe('paused');
  });

  it('counts down on animation frames and pauses at zero', () => {
    let frame: FrameRequestCallback | undefined;
    spyOn(window, 'requestAnimationFrame').and.callFake((cb) => { frame = cb; return 1; });
    let now = 0;
    spyOn(Date, 'now').and.callFake(() => now);
    component.duration = 2_000;

    component.startTimer();
    now = 500;
    frame!(0);
    expect(component.seconds).toBe(1);
    expect(component.timerState).toBe('running');

    now = 2_500;
    frame!(0);
    expect(component.duration).toBe(0);
    expect(component.timerState).toBe('paused');
  });
});
