/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
  let component: TimerComponent;
  let fixture: ComponentFixture<TimerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimerComponent],
      imports: [FormsModule],
      providers: [provideNoopAnimations()]
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
});
