import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeSelectComponent } from './theme-select.component';

describe('ThemeSelectComponent', () => {
  let component: ThemeSelectComponent;

  beforeEach(() => {
    component = new ThemeSelectComponent(new ElementRef(document.createElement('div')));
    component.options = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }];
    component.value = '1';
  });

  it('shows the selected label and emits the chosen value', () => {
    const emitted: string[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));

    expect(component.selectedLabel).toBe('One');
    component.toggle();
    component.select(component.options[1]);

    expect(emitted).toEqual(['2']);
    expect(component.isOpen).toBeFalse();
  });

  it('supports keyboard navigation', () => {
    const emitted: string[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitted).toEqual(['2']);
  });

  it('reserves every option label only when option-based sizing is enabled', () => {
    TestBed.configureTestingModule({ declarations: [ThemeSelectComponent] });
    const fixture = TestBed.createComponent(ThemeSelectComponent);
    fixture.componentRef.setInput('options', [{ label: 'Bar', value: 'bar' }, { label: 'Doughnut', value: 'doughnut' }]);
    fixture.componentRef.setInput('value', 'bar');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.theme-select-measure')).toBeNull();
    fixture.componentRef.setInput('sizeToOptions', true);
    fixture.detectChanges();
    expect(Array.from(host.querySelectorAll('.theme-select-measure')).map(el => el.textContent?.trim()))
      .toEqual(['Bar', 'Doughnut']);
    expect(host.querySelectorAll('.theme-select-measure[aria-hidden="true"]').length).toBe(2);
    fixture.componentRef.setInput('value', 'doughnut');
    fixture.detectChanges();
    expect(host.querySelector('.theme-select-sized-label > span')?.textContent?.trim()).toBe('Doughnut');
    expect(host.querySelectorAll('.theme-select-measure').length).toBe(2);
    fixture.destroy();
  });
});
