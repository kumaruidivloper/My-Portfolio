import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { ResponsiveGridColumn, ResponsiveGridRow, ResponsiveTableComponent } from './responsive-table.component';
import { ThemeSelectComponent } from '../theme-select/theme-select.component';

@Component({
  template: `
    <app-responsive-table
      [columns]="columns"
      [rows]="rows"
      [sortKey]="sortKey"
      [defaultSortKey]="defaultSortKey"
      [defaultSortDirection]="defaultSortDirection"
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
  defaultSortKey: string | null = null;
  defaultSortDirection: 'asc' | 'desc' = 'asc';
}

describe('ResponsiveTableComponent', () => {
  let fixture: ComponentFixture<ResponsiveTableHostComponent>;
  let overlayContainer: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayModule],
      declarations: [ResponsiveTableComponent, ResponsiveTableHostComponent, ThemeSelectComponent]
    });
    overlayContainer = TestBed.inject(OverlayContainer);
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

  it('uses theme-appropriate delete colors in both dark modes without changing the light theme', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.classList.add('dashboard-page');
    const button = host.querySelector('tbody button') as HTMLButtonElement;
    button.className = 'control-button transfer-action delete-action';
    button.parentElement!.classList.add('responsive-grid-action-buttons');
    button.style.transition = 'none';
    const originalClass = document.body.className;
    try {
      document.body.classList.remove('active', 'night');
      expect(getComputedStyle(button).color).toBe('rgb(192, 57, 43)');
      expect(getComputedStyle(button).backgroundColor).toBe('rgb(253, 236, 234)');
      for (const theme of ['active', 'night']) {
        document.body.classList.remove('active', 'night');
        document.body.classList.add(theme);
        expect(getComputedStyle(button).color).toBe('rgb(255, 138, 128)');
        expect(getComputedStyle(button).backgroundColor).not.toBe('rgb(253, 236, 234)');
      }
    } finally {
      document.body.className = originalClass;
    }
  });

  it('shades even rows differently using the current theme colors after pagination and sorting', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.setProperty('--bg-color', '#eeeeee');
    host.style.setProperty('--black', '#444444');
    const expectAlternatingRows = () => {
      const rows = Array.from(host.querySelectorAll<HTMLElement>('tbody tr'));
      rows.forEach((row) => row.style.transition = 'none');
      const colors = rows.map((row) => getComputedStyle(row).backgroundColor);
      expect(colors[0]).not.toBe(colors[1]);
      expect(colors[0]).toBe(colors[2]);
      expect(colors[1]).toBe(colors[3]);
      return colors;
    };
    const lightColors = expectAlternatingRows();
    host.style.setProperty('--bg-color', '#222222');
    host.style.setProperty('--black', '#ffffff');
    const darkColors = expectAlternatingRows();
    expect(darkColors[0]).not.toBe(lightColors[0]);
    expect(darkColors[1]).not.toBe(lightColors[1]);
    (host.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expectAlternatingRows();
    (host.querySelector('thead button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expectAlternatingRows();
  });

  it('defaults to descending dates across years without changing rows or action indexes', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(ResponsiveTableHostComponent);
    const rows = [
      { month: "Jan'26", actionIndex: 0 },
      { month: "Dec'25", actionIndex: 1 },
      { month: "Nov'2025", actionIndex: 2 }
    ];
    fixture.componentInstance.rows = rows;
    fixture.componentInstance.defaultSortKey = 'monthDate';
    fixture.componentInstance.defaultSortDirection = 'desc';
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
    expect(Array.from(host.querySelectorAll('tbody tr td:first-child'), (cell) => cell.textContent?.trim()))
      .toEqual(["Jan'26", "Dec'25", "Nov'2025"]);
    expect(host.querySelector('tbody tr td:last-child button')?.textContent).toContain('Action 0');
    expect(rows.map(({ month }) => month)).toEqual(["Jan'26", "Dec'25", "Nov'2025"]);
    (host.querySelector('thead button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe("Nov'2025");
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
      const option = Array.from(overlayContainer.getContainerElement().querySelectorAll<HTMLElement>('[role="option"]'))
        .find((element) => element.textContent?.trim() === size);
      expect(option).toBeDefined();
      option?.click();
      fixture.detectChanges();
    };
    expect(trigger.textContent?.trim()).toBe('5');
    trigger.click();
    fixture.detectChanges();
    expect(Array.from(overlayContainer.getContainerElement().querySelectorAll('[role="option"]'), (option) => option.textContent?.trim()))
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
