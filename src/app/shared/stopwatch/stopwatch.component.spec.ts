/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StopwatchComponent } from './stopwatch.component';

describe('StopwatchComponent', () => {
  let component: StopwatchComponent;
  let fixture: ComponentFixture<StopwatchComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StopwatchComponent]
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

  it('starts and stops the timer, updating once per animation frame', () => {
    let frame: FrameRequestCallback | undefined;
    spyOn(window, 'requestAnimationFrame').and.callFake((cb) => { frame = cb; return 1; });
    const cancel = spyOn(window, 'cancelAnimationFrame');
    let now = 1_000;
    spyOn(Date, 'now').and.callFake(() => now);

    component.start();
    expect(component.isRunning).toBeTrue();
    now += 1_230;
    frame!(0);
    expect(fixture.nativeElement.querySelector('.time').textContent).toContain('00:01.23');

    component.stop();
    expect(component.isRunning).toBeFalse();
    expect(cancel).toHaveBeenCalled();
  });
});
