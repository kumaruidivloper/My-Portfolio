/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterComponent } from '../counter/counter.component';
import { AboutSkillsComponent } from './about-skills.component';

describe('AboutSkillsComponent', () => {
  let component: AboutSkillsComponent;
  let fixture: ComponentFixture<AboutSkillsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AboutSkillsComponent, CounterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AboutSkillsComponent);
    component = fixture.componentInstance;
    component.technology = {
      technology: ['Angular', 'React', 'Node', 'CSS', 'HTML', 'TypeScript', 'JavaScript', 'Testing', 'UX', 'API', 'SQL', 'CI'],
      level: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 25, 45]
    };
    component.barAnimation = true;
    component.transition = ['width 1s', 'width 2s', 'width 3s', 'width 4s', 'width 5s', 'width 6s', 'width 7s'];
    fixture.detectChanges();
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
});
