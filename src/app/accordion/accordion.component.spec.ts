/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccordionComponent } from './accordion.component';

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
});
