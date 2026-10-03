import { ElementRef } from '@angular/core';
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
});
