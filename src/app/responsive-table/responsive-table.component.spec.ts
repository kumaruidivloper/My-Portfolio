import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResponsiveGridColumn, ResponsiveGridRow, ResponsiveTableComponent } from './responsive-table.component';
import { ThemeSelectComponent } from '../theme-select/theme-select.component';

@Component({
  template: `
    <app-responsive-table
      [columns]="columns"
      [rows]="rows"
      [sortKey]="sortKey"
      (sortChange)="sortKey = $event">
      <ng-template #gridActions let-row let-index="index">
        <button type="button">Action {{ index }} {{ row['month'] }}</button>
      </ng-template>
    </app-responsive-table>
  `,
  standalone: false
})
class ResponsiveTableHostComponent {
  columns: readonly ResponsiveGridColumn[] = [
    { key: 'month', label: 'Month', sortable: true, sortKey: 'monthDate' },
    { key: 'balance', label: 'Balance', numeric: true },
    { key: 'actions', label: 'Actions', actions: true }
  ];
  rows: readonly ResponsiveGridRow[] = [
    { month: 'Sep 2026', balance: 100, actionIndex: 1 },
    { month: 'Jan 2026', balance: 100, actionIndex: 0 },
    ...Array.from({ length: 10 }, (_, index) => ({
      month: 'Apr 2026',
      balance: 100,
      actionIndex: index + 2
    }))
  ];
  sortKey: string | null = null;
}

describe('ResponsiveTableComponent', () => {
  let fixture: ComponentFixture<ResponsiveTableHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ResponsiveTableComponent, ResponsiveTableHostComponent, ThemeSelectComponent]
    });
    fixture = TestBed.createComponent(ResponsiveTableHostComponent);
    fixture.detectChanges();
  });

  it('renders configured columns, row values, and action template', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('thead th')?.textContent).toContain('Month');
    expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe('Sep 2026');
    expect(host.querySelector('tbody tr td')?.classList.contains('numeric-column')).toBeFalse();
    expect(host.querySelector('tbody tr td:last-child button')?.textContent?.trim())
      .toBe('Action 1 Sep 2026');
  });

  it('marks numeric headers and cells for consistent alignment', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('thead th:nth-child(2)')?.classList.contains('numeric-column')).toBeTrue();
    expect(host.querySelector('tbody tr td:nth-child(2)')?.classList.contains('numeric-column')).toBeTrue();
  });

  it('sorts rows and emits the configured sort key when a sortable header is clicked', () => {
    const host = fixture.nativeElement as HTMLElement;
    const sortButton = host.querySelector('thead button') as HTMLButtonElement;
    sortButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sortKey).toBe('monthDate');
    expect(host.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe('Jan 2026');
    expect(host.querySelector('tbody tr td:last-child button')?.textContent?.trim())
      .toBe('Action 0 Jan 2026');

    sortButton.click();
    fixture.detectChanges();

    expect(host.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
    expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe('Sep 2026');
  });

  it('shows 5 rows per page by default and paginates the remaining rows', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('tbody tr').length).toBe(5);
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 1–5 of 12');
    expect(host.querySelector('[aria-label="First page"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Previous page"] svg')).not.toBeNull();
    expect(host.querySelector('[aria-label="Next page"] svg')).not.toBeNull();
    expect((host.querySelector('[aria-label="First page"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((host.querySelector('[aria-label="Last page"]') as HTMLButtonElement).disabled).toBeFalse();

    (host.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelectorAll('tbody tr').length).toBe(5);
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 6–10 of 12');
    expect(host.querySelector('tbody tr td:last-child button')?.textContent?.trim())
      .toBe('Action 5 Apr 2026');

    (host.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelectorAll('tbody tr').length).toBe(2);
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 11–12 of 12');

    (host.querySelector('[aria-label="First page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 1–5 of 12');

    (host.querySelector('[aria-label="Last page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 11–12 of 12');
    expect((host.querySelector('[aria-label="Last page"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('offers page sizes in a dropdown and resets to the first page on selection', () => {
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector('button[aria-label="Rows per page"]') as HTMLButtonElement;
    const selectSize = (size: string): void => {
      trigger.click();
      fixture.detectChanges();
      const option = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
        .find((element) => element.textContent?.trim() === size);
      expect(option).toBeDefined();
      option?.click();
      fixture.detectChanges();
    };
    expect(trigger.textContent?.trim()).toBe('5');
    trigger.click();
    fixture.detectChanges();
    expect(Array.from(host.querySelectorAll('[role="option"]'), (option) => option.textContent?.trim()))
      .toEqual(['5', '10', '25', '50', '100']);
    expect(host.querySelector('.responsive-grid-scroll app-theme-select')).toBeNull();
    trigger.click();
    fixture.detectChanges();

    (host.querySelector('[aria-label="Last page"]') as HTMLButtonElement).click();
    selectSize('10');
    expect(host.querySelectorAll('tbody tr').length).toBe(10);
    expect(host.querySelector('.responsive-grid-page-summary')?.textContent?.trim()).toBe('Showing 1–10 of 12');

    selectSize('25');
    expect(host.querySelectorAll('tbody tr').length).toBe(12);
    expect((host.querySelector('[aria-label="Next page"]') as HTMLButtonElement).disabled).toBeTrue();

    selectSize('5');
    expect(host.querySelectorAll('tbody tr').length).toBe(5);
  });
});
