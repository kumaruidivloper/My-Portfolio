/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { WidgetPreviewChartComponent } from './widget-preview-chart.component';

describe('WidgetPreviewChartComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [WidgetPreviewChartComponent] });
  });

  function render(inputs: Partial<Pick<WidgetPreviewChartComponent, 'data' | 'label' | 'loading'>>) {
    const fixture = TestBed.createComponent(WidgetPreviewChartComponent);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  }

  function renderWithViews() {
    const fixture = TestBed.createComponent(WidgetPreviewChartComponent);
    fixture.componentRef.setInput('data', [{ name: 'Jan', value: 1 }, { name: 'Feb', value: 2 }]);
    fixture.componentRef.setInput('views', [
      { value: 'a', label: 'Balance' }, { value: 'b', label: 'Difference' }, { value: 'c', label: 'Rate' }
    ]);
    fixture.componentRef.setInput('view', 'a');
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.viewChange.subscribe((value) => emitted.push(value));
    const hostClick = jasmine.createSpy('hostClick');
    (fixture.nativeElement as HTMLElement).addEventListener('click', hostClick);
    return { fixture, element: fixture.nativeElement as HTMLElement, emitted, hostClick };
  }

  it('cycles views with the arrows without bubbling the click to the card', () => {
    const { element, emitted, hostClick } = renderWithViews();
    const [prev, next] = Array.from(element.querySelectorAll<HTMLButtonElement>('.preview-arrow'));

    expect(element.querySelector('.preview-label')?.textContent?.trim()).toBe('Balance');
    expect(prev.getAttribute('aria-label')).toBe('Previous view: Rate');
    expect(next.getAttribute('aria-label')).toBe('Next view: Difference');

    next.click();
    prev.click();

    expect(emitted).toEqual(['b', 'c']);
    expect(hostClick).not.toHaveBeenCalled();
  });

  it('switches views with arrow keys and horizontal swipes', () => {
    const { fixture, element, emitted, hostClick } = renderWithViews();
    element.querySelector('.preview-switcher')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    const preview = element.querySelector('.preview')!;
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y } as Touch);
    fixture.componentInstance.onTouchStart({ touches: [touch(200, 10)] } as unknown as TouchEvent);
    fixture.componentInstance.onTouchEnd({ changedTouches: [touch(100, 15)] } as unknown as TouchEvent);
    preview.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    fixture.componentInstance.onTouchStart({ touches: [touch(100, 10)] } as unknown as TouchEvent);
    fixture.componentInstance.onTouchEnd({ changedTouches: [touch(110, 200)] } as unknown as TouchEvent);

    expect(emitted).toEqual(['b', 'b']);
    expect(hostClick).not.toHaveBeenCalled();
  });

  it('hides the view toggle when fewer than two views are given', () => {
    const fixture = render({ data: [{ name: 'Jan', value: 1 }, { name: 'Feb', value: 2 }] });
    expect((fixture.nativeElement as HTMLElement).querySelector('.preview-switcher')).toBeNull();
  });

  it('draws a trend line with the latest value and change', () => {
    const fixture = render({
      label: 'PF Balance',
      data: [{ name: 'Jan', value: 100 }, { name: 'Feb', value: 150 }, { name: 'Mar', value: 165 }]
    });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.preview-line')?.getAttribute('d')).toMatch(/^M.* L.* L/);
    expect(element.querySelector('.preview-value')?.textContent).toContain('165');
    expect(element.querySelector('.preview-change')?.textContent).toContain('10%');
    expect(element.querySelector('.preview')?.getAttribute('aria-label'))
      .toContain('Latest Mar');
  });

  it('draws dashed grid lines like the full chart, thinning columns for long series', () => {
    const short = render({ data: [{ name: 'Jan', value: 1 }, { name: 'Feb', value: 2 }, { name: 'Mar', value: 3 }] });
    const shortLines = (short.nativeElement as HTMLElement).querySelectorAll('.preview-grid line');
    expect(shortLines.length).toBe(5 + 3);

    const long = render({ data: Array.from({ length: 50 }, (_, index) => ({ name: `M${index}`, value: index })) });
    const columns = long.componentInstance.gridColumns;
    expect(columns.length).toBeLessThanOrEqual(13);
    expect(columns[columns.length - 1]).toBe(long.componentInstance.lastPoint!.x);
  });

  it('centres a flat series and shows no direction arrow', () => {
    const fixture = render({ label: 'Gratuity', data: [{ name: 'Jan', value: 5 }, { name: 'Feb', value: 5 }] });
    const component = fixture.componentInstance;

    expect(component.lastPoint?.y).toBe(component.height / 2);
    expect(fixture.nativeElement.querySelector('.preview-change').textContent.trim()).toBe('0%');
  });

  it('shows a tooltip for the point nearest the mouse and hides it on leave', () => {
    const fixture = render({ data: [{ name: 'Jan', value: 100 }, { name: 'Feb', value: 150 }, { name: 'Mar', value: 165 }] });
    const element: HTMLElement = fixture.nativeElement;
    const plot = element.querySelector<HTMLElement>('.preview-plot')!;
    plot.style.width = '300px';
    const { left } = plot.getBoundingClientRect();
    const move = (x: number, pointerType = 'mouse') =>
      plot.dispatchEvent(new PointerEvent('pointermove', { clientX: left + x, pointerType, bubbles: true }));

    move(160);
    fixture.detectChanges();
    expect(element.querySelector('.preview-tooltip')?.textContent).toContain('Feb');
    expect(element.querySelector('.preview-tooltip')?.textContent).toContain('150');

    move(295);
    fixture.detectChanges();
    expect(element.querySelector('.preview-tooltip')?.textContent).toContain('Mar');

    plot.dispatchEvent(new PointerEvent('pointerleave'));
    fixture.detectChanges();
    expect(element.querySelector('.preview-tooltip')).toBeNull();

    move(10, 'touch');
    fixture.detectChanges();
    expect(element.querySelector('.preview-tooltip')).toBeNull();
  });

  it('shows a loading skeleton until data arrives', () => {
    const fixture = render({ loading: true, data: [] });

    expect(fixture.nativeElement.querySelector('.preview-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.preview')).toBeNull();
  });

  describe('time range slider', () => {
    const series = ['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((name, index) => ({ name, value: (index + 1) * 10 }));

    it('narrows the preview to the chosen window without expanding the card', () => {
      const fixture = render({ data: series, label: 'Balance' });
      const element = fixture.nativeElement as HTMLElement;
      const hostClick = jasmine.createSpy('hostClick');
      element.addEventListener('click', hostClick);
      expect(element.querySelector('figure .preview-slider')).toBeNull();
      expect(element.querySelector('figure + .preview-footer .preview-slider')).not.toBeNull();
      const [from, to] = Array.from(element.querySelectorAll<HTMLInputElement>('.preview-slider-input'));

      from.value = '1';
      from.dispatchEvent(new Event('input'));
      to.value = '3';
      to.dispatchEvent(new Event('input'));
      from.click();
      fixture.detectChanges();

      const labels = Array.from(element.querySelectorAll('.preview-range span')).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Feb', 'Apr']);
      expect(element.querySelector('.preview-value')?.textContent).toContain('40');
      expect(hostClick).not.toHaveBeenCalled();

      (element.querySelector('.preview-range-reset') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(Array.from(element.querySelectorAll('.preview-range span')).map((el) => el.textContent?.trim())).toEqual(['Jan', 'May']);
      expect(element.querySelector('.preview-range-reset')).toBeNull();
      expect(hostClick).not.toHaveBeenCalled();
    });

    it('keeps at least two points and resets when the series changes', () => {
      const fixture = render({ data: series });
      const component = fixture.componentInstance;
      component.setRange('to', 3);
      component.setRange('from', 4);
      expect([component.rangeFrom, component.rangeTo]).toEqual([2, 3]);

      fixture.componentRef.setInput('data', series.slice(0, 4));
      fixture.detectChanges();
      expect([component.rangeFrom, component.rangeTo]).toEqual([0, 3]);
    });

    it('moves the nearest knob to a click on the bar and drags it', () => {
      const fixture = render({ data: series });
      const component = fixture.componentInstance;
      const hitArea = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.preview-slider-hit-area')!;
      spyOn(hitArea, 'getBoundingClientRect').and.returnValue({ left: 0, width: 400 } as DOMRect);
      const pointer = (type: string, clientX: number) =>
        hitArea.dispatchEvent(new PointerEvent(type, { clientX, button: 0, pointerId: 1, bubbles: true }));

      pointer('pointerdown', 110);
      expect([component.rangeFrom, component.rangeTo]).toEqual([1, 4]);
      pointer('pointermove', 200);
      expect(component.rangeFrom).toBe(2);
      pointer('pointerup', 200);

      pointer('pointerdown', 390);
      pointer('pointermove', 300);
      expect([component.rangeFrom, component.rangeTo]).toEqual([2, 3]);
    });

    it('reports how many points the slider window covers for the widget count label', async () => {
      const fixture = render({ data: series });
      const component = fixture.componentInstance;
      const counts: (number | null)[] = [];
      component.rangeCountChange.subscribe((count) => counts.push(count));

      component.setRange('from', 1);
      component.setRange('to', 3);
      component.resetRange();
      component.setRange('from', 2);
      fixture.componentRef.setInput('data', series.slice(0, 4));
      fixture.detectChanges();
      await Promise.resolve();

      expect(counts).toEqual([4, 3, null, 3, null]);
    });

    it('hides the slider when there are too few points to filter', () => {
      const fixture = render({ data: series.slice(0, 2) });
      expect((fixture.nativeElement as HTMLElement).querySelector('.preview-slider')).toBeNull();
    });
  });
});
