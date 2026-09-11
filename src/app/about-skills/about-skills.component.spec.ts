/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

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

  it('starts bars and counters while the skills section is in view', () => {
    observerCallback([{ target: observedBars[0], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('app-counter').length).toBe(1);
    expect((compiled.querySelector('.progress > .bar > span') as HTMLElement).style.width).toBe('10%');
  });

  it('resets an individual bar and counter when it leaves the view', () => {
    observerCallback([{ target: observedBars[0], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();
    observerCallback([{ target: observedBars[0], isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('app-counter').length).toBe(0);
    expect((compiled.querySelector('.progress > .bar > span') as HTMLElement).style.width).toBe('');
  });

  it('starts a bar in the desktop second column independently', () => {
    observerCallback([{ target: observedBars[6], isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('app-counter').length).toBe(1);
    expect((compiled.querySelector('.progress:nth-child(2) > .bar > span') as HTMLElement).style.width).toBe('70%');
  });
});
