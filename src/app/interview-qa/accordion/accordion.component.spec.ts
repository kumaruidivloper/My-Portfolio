/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccordionComponent } from './accordion.component';
import { Config, Menu } from '../types';

describe('AccordionComponent', () => {
  let component: AccordionComponent;
  let fixture: ComponentFixture<AccordionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AccordionComponent]
    });
    fixture = TestBed.createComponent(AccordionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses multi mode by default', () => {
    component.options = {};
    component.menus = [];

    component.ngOnInit();

    expect(component.config.multi).toBeTrue();
  });

  it('closes other menus when multi mode is disabled', () => {
    component.options = { multi: false };
    component.menus = [
      { name: 'One', iconClass: '', active: true, submenu: [] },
      { name: 'Two', iconClass: '', active: false, submenu: [] }
    ];
    component.ngOnInit();

    component.toggle(1);

    expect(component.menus[0].active).toBeFalse();
    expect(component.menus[1].active).toBeTrue();
  });

  function renderWidgets(menus: Menu[], options: Config = { multi: false }): ComponentFixture<AccordionComponent> {
    const widgetFixture = TestBed.createComponent(AccordionComponent);
    widgetFixture.componentRef.setInput('options', options);
    widgetFixture.componentRef.setInput('menus', menus);
    widgetFixture.detectChanges();
    return widgetFixture;
  }

  it('renders a widget card with a topic chip per topic and no chart', () => {
    const widgetFixture = renderWidgets([
      { name: 'One', iconClass: '', active: false, submenu: [{ name: 'A', url: '#' }, { name: 'B', url: '#' }] },
      { name: 'Two', iconClass: '', active: false, submenu: [{ name: 'C', url: '#' }] }
    ]);
    const element: HTMLElement = widgetFixture.nativeElement;

    expect(element.querySelectorAll('.widget').length).toBe(2);
    expect(element.querySelectorAll('.topic').length).toBe(3);
    expect(element.querySelector('.widget-chart')).toBeNull();
    widgetFixture.destroy();
  });

  it('opens a collapsed widget on the clicked topic', () => {
    const widgetFixture = renderWidgets([
      { name: 'One', iconClass: '', active: true, submenu: [] },
      { name: 'Two', iconClass: '', active: false, submenu: [
        { name: 'C', url: '#', questions: [{ question: 'Q C', answer: 'A C' }] },
        { name: 'D', url: '#', questions: [{ question: 'Q D', answer: 'A D' }] }
      ] }
    ]);
    const element: HTMLElement = widgetFixture.nativeElement;

    (element.querySelectorAll('.widget')[1].querySelectorAll('.topic')[1] as HTMLButtonElement).click();
    widgetFixture.detectChanges();

    const widgets = element.querySelectorAll('.widget');
    expect(widgets[1].classList).toContain('active');
    expect(widgets[0].classList).not.toContain('active');
    expect(widgets[1].querySelector('.qa-item summary')?.textContent).toContain('Q D');
    widgetFixture.destroy();
  });

  it('expands a widget to full width when its header is clicked', () => {
    const widgetFixture = renderWidgets([
      { name: 'One', iconClass: '', active: true, submenu: [] },
      { name: 'Two', iconClass: '', active: false, submenu: [] }
    ]);
    const element: HTMLElement = widgetFixture.nativeElement;

    (element.querySelectorAll('.widget-header')[1] as HTMLButtonElement).click();
    widgetFixture.detectChanges();

    const widgets = element.querySelectorAll('.widget');
    expect(widgets[1].classList).toContain('active');
    expect(widgets[0].classList).not.toContain('active');
    expect(widgets[1].querySelector('.widget-header')?.getAttribute('aria-expanded')).toBe('true');
    widgetFixture.destroy();
  });

  it('counts questions across topics', () => {
    const menu = { name: 'One', iconClass: '', active: false, submenu: [
      { name: 'A', url: '#', questions: [{ question: 'q1', answer: 'a1' }, { question: 'q2', answer: 'a2' }] },
      { name: 'B', url: '#' }
    ] };

    expect(component.questionCount(menu)).toBe(2);
  });

  it('shows interview questions for the selected topic', () => {
    const widgetFixture = renderWidgets([
      {
        name: 'One', iconClass: '', active: true, submenu: [
          { name: 'A', url: '#', questions: [{ question: 'What is `a`?', answer: 'Answer A' }] },
          { name: 'B', url: '#', questions: [{ question: 'Q B1', answer: 'Answer B1' }, { question: 'Q B2', answer: 'Answer B2' }] }
        ]
      }
    ]);
    const element: HTMLElement = widgetFixture.nativeElement;

    expect(element.querySelectorAll('.qa-item').length).toBe(1);
    expect(element.querySelector('.qa-item summary code')?.textContent).toBe('a');

    (element.querySelectorAll('.topic')[1] as HTMLButtonElement).click();
    widgetFixture.detectChanges();

    expect(element.querySelectorAll('.topic')[1].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelectorAll('.qa-item').length).toBe(2);
    expect(element.querySelector('.qa-panel h4')?.textContent).toContain('B');
    widgetFixture.destroy();
  });

  it('splits backtick-delimited code segments', () => {
    expect(component.codeSegments('Use `map` or `filter` now')).toEqual([
      { text: 'Use ', code: false },
      { text: 'map', code: true },
      { text: ' or ', code: false },
      { text: 'filter', code: true },
      { text: ' now', code: false }
    ]);
  });
});
