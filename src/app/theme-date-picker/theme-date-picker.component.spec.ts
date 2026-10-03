import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeDatePickerComponent } from './theme-date-picker.component';

describe('ThemeDatePickerComponent', () => {
  let fixture: ComponentFixture<ThemeDatePickerComponent>;
  let component: ThemeDatePickerComponent;
  let changes: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [ThemeDatePickerComponent] });
    fixture = TestBed.createComponent(ThemeDatePickerComponent);
    component = fixture.componentInstance;
    changes = [];
    component.registerOnChange((value) => changes.push(value));
    fixture.detectChanges();
  });

  it('formats a date value for display', () => {
    component.writeValue('2026-10-03');
    expect(component.displayValue).toBe('03 Oct 2026');
  });

  it('emits a yyyy-MM-dd value when a day is picked', () => {
    component.writeValue('2026-10-03');
    component.toggle();
    component.selectDay({ day: 15, value: '2026-10-15', inMonth: true, isToday: false });
    expect(changes).toEqual(['2026-10-15']);
    expect(component.isOpen).toBeFalse();
  });

  it('emits a yyyy-MM value in month mode', () => {
    component.mode = 'month';
    component.writeValue('2026-07');
    component.toggle();
    component.shift(1);
    component.selectMonth(2);
    expect(changes).toEqual(['2027-03']);
    expect(component.displayValue).toBe('Mar 2027');
  });

  it('builds a 6-week grid for the viewed month', () => {
    component.writeValue('2026-10-03');
    component.toggle();
    expect(component.days.length).toBe(42);
    expect(component.days.filter((d) => d.inMonth).length).toBe(31);
  });
});
