/// <reference types="jasmine" />

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';

import { CounterComponent } from '../counter/counter.component';
import { AboutSkillsComponent } from './about-skills.component';

describe('AboutSkillsComponent', () => {
  let component: AboutSkillsComponent;
  let fixture: ComponentFixture<AboutSkillsComponent>;
  let observerCallback: IntersectionObserverCallback;
  let originalIntersectionObserver: typeof IntersectionObserver;
  let observedBars: Element[];

  beforeEach(async () => {
    originalIntersectionObserver = window.IntersectionObserver;
    observedBars = [];
    (window as any).IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe(target: Element): void {
        observedBars.push(target);
      }
      disconnect(): void {}
    };

    await TestBed.configureTestingModule({
      declarations: [AboutSkillsComponent, CounterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AboutSkillsComponent);
    component = fixture.componentInstance;
    component.technology = {
      technology: ['Angular', 'React', 'Node', 'CSS', 'HTML', 'TypeScript', 'JavaScript', 'Testing', 'UX', 'API', 'SQL', 'CI'],
      level: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 25, 45]
    };
    component.transition = ['width 1s', 'width 2s', 'width 3s', 'width 4s', 'width 5s', 'width 6s', 'width 7s'];
    fixture.detectChanges();
  });

  afterEach(() => {
    (window as any).IntersectionObserver = originalIntersectionObserver;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render skill labels and bars', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Angular');
    expect(compiled.textContent).toContain('React');
    expect(compiled.querySelectorAll('.progress').length).toBe(2);
  });

  it('should format the bar width using the provided range function', () => {
    expect(component.barRange(40)).toBe('40%');
  });

  const showBar = (index: number, isIntersecting: boolean) => {
    observerCallback([{ target: observedBars[index], isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();
  };
  const firstBar = () => fixture.nativeElement.querySelector('.progress > .bar > span') as HTMLElement;
  const firstCounter = () => fixture.nativeElement.querySelector('app-counter .counter-element') as HTMLElement;

  it('fills each bar in lockstep with its counter while the skills section is in view', fakeAsync(() => {
    showBar(0, true);
    expect(fixture.nativeElement.querySelectorAll('app-counter').length).toBe(12);

    // Level 10 over 1s: one 1% step every 100ms, at constant speed.
    tick(500);
    fixture.detectChanges();
    expect(firstBar().style.width).toBe('5%');
    expect(firstCounter().getAttribute('aria-label')).toBe('5');
    expect(firstBar().style.transition).toMatch(/^width (100ms|0.1s) linear$/);
    expect(firstCounter().style.getPropertyValue('--roll-ms')).toBe('100ms');

    tick(1000);
    fixture.detectChanges();
    expect(firstBar().style.width).toBe('10%');
    expect(firstCounter().getAttribute('aria-label')).toBe('10');
    discardPeriodicTasks();
  }));

  it('drains an individual bar with its counter when it leaves the view', fakeAsync(() => {
    showBar(0, true);
    tick(1100);
    showBar(0, false);
    tick(300);
    fixture.detectChanges();
    expect(firstBar().style.width).toBe('7%');
    expect(firstCounter().getAttribute('aria-label')).toBe('7');

    tick(1000);
    fixture.detectChanges();
    expect(firstBar().style.width).toBe('0%');
    discardPeriodicTasks();
  }));

  it('starts a bar in the desktop second column independently', fakeAsync(() => {
    showBar(6, true);
    tick(7100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect((compiled.querySelector('.progress:nth-child(2) > .bar > span') as HTMLElement).style.width).toBe('70%');
    expect(firstBar().style.width).toBe('0%');
    discardPeriodicTasks();
  }));
});
