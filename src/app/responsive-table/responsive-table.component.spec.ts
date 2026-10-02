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
    { month: 'Jan 2026', actionIndex: 0 }
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
});
