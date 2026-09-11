/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterComponent } from './counter.component';

describe('CounterComponent', () => {
  let component: CounterComponent;
  let fixture: ComponentFixture<CounterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CounterComponent]
    });
    fixture = TestBed.createComponent(CounterComponent);
    component = fixture.componentInstance;
    component.observeViewport = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('increments until the requested value', () => {
    component.counters = [{ value: 1, intervalId: 1 }];

    component.incrementCounter(3);
    component.incrementCounter(3);
    component.incrementCounter(3);

    expect(component.counters[0].value).toBe(3);
  });

  it('starts a counter immediately when viewport observation is disabled', () => {
    component.stopRange = [59];
    component.startCounters();

    expect(component.counters.length).toBe(1);
    expect(component.counters[0].value).toBe(0);
    expect(component.counters[0].intervalId).not.toBeNull();
  });

  it('clears counter intervals when destroyed', () => {
    component.counters = [{ value: 1, intervalId: 1 }];
    spyOn(window, 'clearInterval');

    component.ngOnDestroy();

    expect(window.clearInterval).toHaveBeenCalledWith(1);
  });
});
