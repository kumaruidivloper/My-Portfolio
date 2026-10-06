import { Component, ContentChild, EventEmitter, Input, Output, TemplateRef, ViewEncapsulation } from '@angular/core';

export interface ResponsiveGridColumn {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  numeric?: boolean;
  actions?: boolean;
}

export type ResponsiveGridRow = Record<string, string | number | undefined> & { actionIndex?: number };

@Component({
  selector: 'app-responsive-table',
  templateUrl: './responsive-table.component.html',
  styleUrls: ['./responsive-table.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false
})
export class ResponsiveTableComponent {
  @Input() columns: readonly ResponsiveGridColumn[] = [];
  @Input() rows: readonly ResponsiveGridRow[] = [];
  @Input() ariaLabel = 'Records';
  @Input() sortKey: string | null = null;
  @Input() sortDirection: 'asc' | 'desc' = 'asc';
  @Input() sortMode: 'client' | 'external' = 'client';
  @ContentChild('gridActions') actionsTemplate?: TemplateRef<{ $implicit: ResponsiveGridRow; index: number }>;

  @Output() sortChange = new EventEmitter<string>();

  pageSize = 5;
  readonly pageSizeOptions = [5, 10, 25, 50, 100];
  readonly pageSizeSelectOptions = this.pageSizeOptions.map((size) => ({
    label: String(size),
    value: String(size)
  }));
  currentPageIndex = 0;
  private clientSortKey: string | null = null;
  private clientSortDirection: 'asc' | 'desc' = 'asc';

  get displayedRows(): readonly ResponsiveGridRow[] {
    if (this.sortMode === 'external' || this.clientSortKey === null) {
      return this.rows;
    }

    const column = this.columns.find((item) => (item.sortKey || item.key) === this.clientSortKey);
    if (!column) {
      return this.rows;
    }

    return this.rows
      .map((row, index) => ({ row, index }))
      .sort(({ row: left, index: leftIndex }, { row: right, index: rightIndex }) => {
        const comparison = this.compareValues(left[column.key], right[column.key], column.numeric ?? false);
        const orderedComparison = this.clientSortDirection === 'asc' ? comparison : -comparison;
        return orderedComparison || leftIndex - rightIndex;
      })
      .map(({ row }) => row);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  get activePageIndex(): number {
    return Math.min(this.currentPageIndex, this.pageCount - 1);
  }

  get pageRows(): readonly ResponsiveGridRow[] {
    const startIndex = this.activePageIndex * this.pageSize;
    return this.displayedRows.slice(startIndex, startIndex + this.pageSize);
  }

  get firstDisplayedRow(): number {
    return this.rows.length === 0 ? 0 : this.activePageIndex * this.pageSize + 1;
  }

  get lastDisplayedRow(): number {
    return Math.min((this.activePageIndex + 1) * this.pageSize, this.rows.length);
  }

  get activeSortKey(): string | null {
    return this.sortMode === 'external' ? this.sortKey : this.clientSortKey;
  }

  get activeSortDirection(): 'asc' | 'desc' {
    return this.sortMode === 'external' ? this.sortDirection : this.clientSortDirection;
  }

  requestSort(column: ResponsiveGridColumn): void {
    const key = column.sortKey || column.key;
    this.sortChange.emit(key);
    if (this.sortMode === 'external') {
      return;
    }

    if (this.clientSortKey === key) {
      this.clientSortDirection = this.clientSortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.clientSortKey = key;
    this.clientSortDirection = 'asc';
  }

  setPageSize(value: string): void {
    const requestedPageSize = Number(value);
    if (!this.pageSizeOptions.includes(requestedPageSize)) {
      throw new Error('Unsupported rows-per-page selection.');
    }
    this.pageSize = requestedPageSize;
    this.currentPageIndex = 0;
  }

  previousPage(): void {
    this.currentPageIndex = Math.max(0, this.activePageIndex - 1);
  }

  firstPage(): void {
    this.currentPageIndex = 0;
  }

  nextPage(): void {
    this.currentPageIndex = Math.min(this.pageCount - 1, this.activePageIndex + 1);
  }

  lastPage(): void {
    this.currentPageIndex = this.pageCount - 1;
  }

  sortIndicator(key: string): string {
    if (this.activeSortKey !== key) {
      return '↕';
    }
    return this.activeSortDirection === 'asc' ? '↑' : '↓';
  }

  sortLabel(key: string): string {
    if (this.activeSortKey !== key) {
      return 'none';
    }
    return this.activeSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  private compareValues(left: string | number | undefined, right: string | number | undefined, numeric: boolean): number {
    if (left === undefined || right === undefined) {
      return left === right ? 0 : left === undefined ? -1 : 1;
    }

    if (numeric) {
      const leftNumber = this.toNumericValue(left);
      const rightNumber = this.toNumericValue(right);
      if (leftNumber !== null && rightNumber !== null) {
        return leftNumber - rightNumber;
      }
    }

    if (typeof left === 'string' && typeof right === 'string') {
      const leftDate = Date.parse(left);
      const rightDate = Date.parse(right);
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
        return leftDate - rightDate;
      }
    }

    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  }

  private toNumericValue(value: string | number): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = value.replace(/[^0-9.+-]/g, '');
    if (!normalized || !/[0-9]/.test(normalized)) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
