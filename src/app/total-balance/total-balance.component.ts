import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import { Subscription } from 'rxjs';
import { ResponsiveGridColumn, ResponsiveGridRow } from '../responsive-table/responsive-table.component';
import { TotalRecord } from '../model/total-record';
import { TotalBalanceService } from '../service/total-balance.service';

interface ChartDatum {
  name: string;
  value: number;
}

@Component({
  selector: 'app-total-balance',
  templateUrl: './total-balance.component.html',
  styleUrls: ['../sum-of-value/sum-of-value.component.scss'],
  standalone: false
})
export class TotalBalanceComponent implements OnDestroy {
  isExpanded = false;
  isLoading = false;
  errorMessage = '';
  // Stored oldest-first so charts read left to right.
  records: TotalRecord[] = [];
  interestChartData: ChartDatum[] = [];
  totalChartData: ChartDatum[] = [];
  readonly gridColumns: readonly ResponsiveGridColumn[] = [
    { key: 'month', label: 'Month', sortable: true },
    { key: 'total', label: 'Overall balance', sortable: true, numeric: true },
    { key: 'difference', label: 'Difference', sortable: true, numeric: true }
  ];
  gridRows: ResponsiveGridRow[] = [];
  readonly colorScheme: Color = {
    name: 'overall-balance',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#046a38']
  };
  private loadSubscription?: Subscription;

  constructor(
    private totalBalanceService: TotalBalanceService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.load();
    }
  }

  get totalInterest(): number {
    return this.records.reduce((total, record) => total + record.difference, 0);
  }

  get currentBalance(): number | null {
    return this.records[this.records.length - 1]?.total ?? null;
  }

  get currentBalanceMonth(): string | null {
    return this.records[this.records.length - 1]?.date ?? null;
  }

  formatRupees(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value).replace('₹', '₹ ');
  }

  private load(): void {
    this.loadSubscription?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';
    this.loadSubscription = this.totalBalanceService.getTotals().subscribe({
      next: (document) => {
        this.records = [...document.totalRecords].reverse();
        this.interestChartData = this.records.map(({ date, difference }) => ({ name: date, value: difference }));
        this.totalChartData = this.records.map(({ date, total }) => ({ name: date, value: total }));
        this.gridRows = document.totalRecords.map((record) => ({
          month: record.date,
          total: this.formatRupees(record.total),
          difference: this.formatRupees(record.difference)
        }));
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.errorMessage = error instanceof Error ? error.message : 'Unable to load the overall balance.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }
}
