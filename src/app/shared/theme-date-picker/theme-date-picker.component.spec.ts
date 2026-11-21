import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { ThemeDatePickerComponent } from './theme-date-picker.component';

describe('ThemeDatePickerComponent', () => {
  let fixture: ComponentFixture<ThemeDatePickerComponent>;
  let component: ThemeDatePickerComponent;
  let changes: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [ThemeDatePickerComponent], imports: [OverlayModule] });
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

  it('closes the other range picker when opened without changing either value', () => {
    const otherFixture = TestBed.createComponent(ThemeDatePickerComponent);
    const other = otherFixture.componentInstance;
    component.writeValue('2026-10-03');
    other.writeValue('2026-10-15');
    component.opened.subscribe(() => other.close());
    other.opened.subscribe(() => component.close());
    component.toggle();
    expect(component.isOpen).toBeTrue();
    other.toggle();
    expect(component.isOpen).toBeFalse();
    expect(other.isOpen).toBeTrue();
    component.toggle();
    expect(component.isOpen).toBeTrue();
    expect(other.isOpen).toBeFalse();
    component.toggle();
    expect(component.isOpen).toBeFalse();
    expect(component.value).toBe('2026-10-03');
    expect(other.value).toBe('2026-10-15');
    expect(changes).toEqual([]);
    otherFixture.destroy();
  });

  it('does not emit opened when disabled or closing an already open picker', () => {
    const opened = jasmine.createSpy('opened');
    const touched = jasmine.createSpy('touched');
    component.opened.subscribe(opened);
    component.registerOnTouched(touched);
    component.close();
    expect(touched).not.toHaveBeenCalled();
    component.isDisabled = true;
    component.toggle();
    expect(opened).not.toHaveBeenCalled();
    component.isDisabled = false;
    component.toggle();
    component.toggle();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(touched).toHaveBeenCalledTimes(1);
  });

  it('removes the previously rendered calendar when switching picker triggers', async () => {
    const otherFixture = TestBed.createComponent(ThemeDatePickerComponent);
    const other = otherFixture.componentInstance;
    component.ariaLabel = 'From';
    other.ariaLabel = 'To';
    component.opened.subscribe(() => other.close());
    other.opened.subscribe(() => component.close());
    fixture.autoDetectChanges();
    otherFixture.autoDetectChanges();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const otherTrigger = otherFixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
    otherTrigger.click();
    await otherFixture.whenStable();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('To');
    trigger.click();
    await fixture.whenStable();
    await otherFixture.whenStable();
    expect(otherTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('From');
    trigger.click();
    await fixture.whenStable();
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(0);
    otherFixture.destroy();
  });

  it('keeps the overlay open for calendar navigation and closes on Escape', async () => {
    fixture.autoDetectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const next = container.querySelector('[aria-label="Next"]') as HTMLButtonElement;
    next.click();
    await fixture.whenStable();
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(1);
    next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(container.querySelectorAll('[role="dialog"]').length).toBe(0);
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

  it('jumps to a bounded year without committing a date and clamps the viewed month', () => {
    component.min = '2023-09-23';
    component.max = '2026-02-15';
    component.writeValue('2023-10-03');
    component.toggle();
    component.toggleYearChooser();
    expect(component.years).toContain(2026);
    expect(component.isYearAllowed(2022)).toBeFalse();
    expect(component.isYearAllowed(2027)).toBeFalse();
    expect(() => component.selectYear(2027)).toThrowError(RangeError);
    component.selectYear(2026);
    expect(component.viewYear).toBe(2026);
    expect(component.viewMonth).toBe(1);
    expect(component.isChoosingYear).toBeFalse();
    expect(component.isOpen).toBeTrue();
    expect(component.value).toBe('2023-10-03');
    expect(changes).toEqual([]);
    component.selectYear(2023);
    expect(component.viewMonth).toBe(8);
  });

  it('pages through years quickly in month mode and resets the chooser when reopened', () => {
    component.mode = 'month';
    component.writeValue('2026-07');
    component.toggle();
    component.toggleYearChooser();
    const start = component.yearPageStart;
    component.shift(-1);
    expect(component.yearPageStart).toBe(start - 12);
    component.shift(1);
    component.selectYear(2028);
    component.selectMonth(2);
    expect(changes).toEqual(['2028-03']);
    component.toggle();
    component.toggleYearChooser();
    component.close();
    component.toggle();
    expect(component.isChoosingYear).toBeFalse();
  });

  it('disables year-page navigation outside the available history', () => {
    component.min = '2015-09';
    component.max = '2026-02';
    component.mode = 'month';
    component.writeValue('2026-01');
    component.toggle();
    component.toggleYearChooser();
    expect(component.canShift(-1)).toBeTrue();
    expect(component.canShift(1)).toBeFalse();
    component.shift(-1);
    expect(component.canShift(-1)).toBeFalse();
    expect(component.canShift(1)).toBeTrue();
  });

  it('disables dates and navigation outside the inclusive bounds', () => {
    component.min = '2026-10-03';
    component.max = '2026-10-15';
    component.writeValue('2026-10-03');
    component.toggle();
    expect(component.canShift(-1)).toBeFalse();
    expect(component.canShift(1)).toBeFalse();
    expect(component.isAllowed('2026-10-02')).toBeFalse();
    expect(component.isAllowed('2026-10-03')).toBeTrue();
    expect(component.isAllowed('2026-10-15')).toBeTrue();
    expect(component.isAllowed('2026-10-16')).toBeFalse();
    expect(() => component.selectDay({ day: 16, value: '2026-10-16', inMonth: true, isToday: false }))
      .toThrowError(RangeError);
    expect(changes).toEqual([]);
    component.shift(1);
    expect(component.viewMonth).toBe(9);
  });

  it('restricts month selection and prevents clearing required range values', () => {
    component.mode = 'month';
    component.min = '2025-12';
    component.max = '2026-02';
    component.allowClear = false;
    component.writeValue('2026-01');
    component.toggle();
    expect(component.isAllowed(component.monthValue(2))).toBeFalse();
    expect(component.canShift(-1)).toBeTrue();
    expect(component.canShift(1)).toBeFalse();
    expect(() => component.clear()).toThrowError(RangeError);
    const emitted = jasmine.createSpy('valueChange');
    component.valueChange.subscribe(emitted);
    component.selectMonth(1);
    expect(changes).toEqual(['2026-02']);
    expect(emitted).toHaveBeenCalledWith('2026-02');
  });
});
