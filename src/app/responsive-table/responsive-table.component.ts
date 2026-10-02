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
