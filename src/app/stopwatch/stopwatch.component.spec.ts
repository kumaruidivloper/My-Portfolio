/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { StopwatchComponent } from './stopwatch.component';

describe('StopwatchComponent', () => {
  let component: StopwatchComponent;
  let fixture: ComponentFixture<StopwatchComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StopwatchComponent],
      providers: [provideNoopAnimations()]
    });
    fixture = TestBed.createComponent(StopwatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with a zeroed display', () => {
    expect(component.formatTime()).toBe('00:00.00');
  });

  it('formats elapsed time with padding', () => {
    component.elapsedTime = 61_230;

    expect(component.formatTime()).toBe('01:01.23');
  });

  it('starts and stops the timer', () => {
    jasmine.clock().install();
    component.start();
    jasmine.clock().tick(25);
    component.stop();

    expect(component.isRunning).toBeFalse();
    jasmine.clock().uninstall();
  });
});
