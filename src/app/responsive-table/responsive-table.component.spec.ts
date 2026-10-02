import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResponsiveGridColumn, ResponsiveGridRow, ResponsiveTableComponent } from './responsive-table.component';

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
    { key: 'actions', label: 'Actions', actions: true }
  ];
  rows: readonly ResponsiveGridRow[] = [
    { month: 'Sep 2026', actionIndex: 1 },
    { month: 'Jan 2026', actionIndex: 0 },
    ...Array.from({ length: 10 }, (_, index) => ({
      month: 'Apr 2026',
      actionIndex: index + 2
    }))
  ];
  sortKey: string | null = null;
}

describe('ResponsiveTableComponent', () => {
  let fixture: ComponentFixture<ResponsiveTableHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ResponsiveTableComponent, ResponsiveTableHostComponent]
    });
    fixture = TestBed.createComponent(ResponsiveTableHostComponent);
    fixture.detectChanges();
  });

  it('renders configured columns, row values, and action template', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('thead th')?.textContent).toContain('Month');
    expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe('Sep 2026');
    expect(host.querySelector('tbody tr td:last-child button')?.textContent?.trim())
      .toBe('Action 1 Sep 2026');
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
    expect(host.querySelector('[aria-label="Previous page"] svg')).not.toBeNull();
    expect(host.querySelector('[aria-label="Next page"] svg')).not.toBeNull();

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
  });

  it('allows a custom page size while enforcing a minimum of 5 rows', () => {
    const host = fixture.nativeElement as HTMLElement;
    const pageSizeInput = host.querySelector('[aria-label="Rows per page"]') as HTMLInputElement;
    pageSizeInput.value = '1';
    pageSizeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelectorAll('tbody tr').length).toBe(5);

    pageSizeInput.value = '12';
    pageSizeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelectorAll('tbody tr').length).toBe(12);

    pageSizeInput.value = '5';
    pageSizeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelectorAll('tbody tr').length).toBe(5);

    pageSizeInput.value = '4';
    pageSizeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelectorAll('tbody tr').length).toBe(5);

    pageSizeInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(pageSizeInput.value).toBe('5');
    expect(host.querySelectorAll('tbody tr').length).toBe(5);
  });
});
