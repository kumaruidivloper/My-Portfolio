/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterComponent } from './counter.component';

// Typed via ReturnType so the spec compiles whether DOM or Node timer typings are in scope.
const fakeIntervalId = 1 as unknown as ReturnType<typeof setInterval>;

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
    component.counters = [{ value: 1, intervalId: fakeIntervalId, flip: false }];

    component.incrementCounter(3);
    component.incrementCounter(3);
    component.incrementCounter(3);

    expect(component.counters[0].value).toBe(3);
  });

  it('starts a counter immediately when viewport observation is disabled', () => {
    component.stopRange = [59];
    component.startCounters(true);

    expect(component.counters.length).toBe(1);
    expect(component.counters[0].value).toBe(0);
    expect(component.counters[0].intervalId).not.toBeNull();
  });

  it('initializes counter rows before the first view check', () => {
    const counterFixture = TestBed.createComponent(CounterComponent);
    const counterComponent = counterFixture.componentInstance;
    counterFixture.componentRef.setInput('stopRange', [42]);
    counterFixture.componentRef.setInput('observeViewport', false);

    expect(() => counterFixture.detectChanges()).not.toThrow();
    expect(counterComponent.counters[0].value).toBe(0);

    counterFixture.destroy();
  });

  it('counts back to zero when the counter leaves the viewport', () => {
    component.counters = [{ value: 3, intervalId: fakeIntervalId, flip: false }];

    component.incrementCounter(3, false);
    component.incrementCounter(3, false);
    component.incrementCounter(3, false);

    expect(component.counters[0].value).toBe(0);
  });

  it('clears counter intervals when destroyed', () => {
    component.counters = [{ value: 1, intervalId: fakeIntervalId, flip: false }];
    spyOn(window, 'clearInterval');

    component.ngOnDestroy();

    expect(window.clearInterval).toHaveBeenCalledWith(1);
  });

  it('rotates drums forward through nine to zero and backward when counting down', () => {
    expect(component.wheelRotation(19, 1)).toBe(684);
    expect(component.wheelRotation(20, 1)).toBe(720);
    expect(component.wheelRotation(20, 0)).toBe(72);
    expect(component.wheelRotation(19, 0)).toBe(36);
    expect(component.wheelRotation(0, 0)).toBe(0);
  });

  it('renders ten 3D faces per digit with a single accessible counter value', () => {
    component.counters = [{ value: 19, intervalId: null, flip: false }];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.digit-tile').length).toBe(20);
    expect(element.querySelector('.counter-element')?.getAttribute('aria-label')).toBe('19');
    expect(element.querySelector('.digit-strip')?.getAttribute('aria-hidden')).toBe('true');
    expect((element.querySelectorAll('.digit-strip')[1] as HTMLElement).style.transform)
      .toBe('translateZ(-2.077em) rotateX(684deg)');
  });
});
