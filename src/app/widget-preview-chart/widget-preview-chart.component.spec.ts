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

  it('shows a loading skeleton until data arrives', () => {
    const fixture = render({ loading: true, data: [] });

    expect(fixture.nativeElement.querySelector('.preview-skeleton')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.preview')).toBeNull();
  });
});
