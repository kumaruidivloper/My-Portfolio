import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import { forkJoin, Subscription } from 'rxjs';
import { PfApiDocument, PfRecord } from '../model/pf-record';
import { PfDataService } from '../service/pf-data.service';

interface MonthlyTotal {
  key: string;
  name: string;
  difference: number;
  pfAmount: number;
}

interface ChartDatum {
  name: string;
  value: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(value: string): string | null {
  const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const monthIndex = MONTHS.findIndex((month) =>
    month.toLowerCase() === match[1].slice(0, 3).toLowerCase()
  );
  if (monthIndex < 0) {
    return null;
  }

  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

@Component({
  selector: 'app-sum-of-value',
  templateUrl: './sum-of-value.component.html',
  styleUrls: ['./sum-of-value.component.scss'],
  standalone: false
})
export class SumOfValueComponent implements OnDestroy {
  isExpanded = false;
  isLoading = false;
  errorMessage = '';
  monthlyTotals: MonthlyTotal[] = [];
  readonly colorScheme: Color = {
    name: 'combined-pf-totals',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#046a38']
  };
  private loadSubscription?: Subscription;

  constructor(
    private pfDataService: PfDataService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.loadMonthlyTotals();
    }
  }

  get interestChartData(): ChartDatum[] {
    return this.monthlyTotals.map(({ name, difference }) => ({ name, value: difference }));
  }

  get totalPfChartData(): ChartDatum[] {
    return this.monthlyTotals.map(({ name, pfAmount }) => ({ name, value: pfAmount }));
  }

  get totalInterest(): number {
    return this.monthlyTotals.reduce((total, month) => total + month.difference, 0);
  }

  get finalTotalPfAmount(): number | null {
    return this.monthlyTotals[this.monthlyTotals.length - 1]?.pfAmount ?? null;
  }

  get finalTotalPfMonth(): string | null {
    return this.monthlyTotals[this.monthlyTotals.length - 1]?.name ?? null;
  }

  formatRupees(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value).replace('₹', '₹ ');
  }

  private loadMonthlyTotals(): void {
    if (this.isLoading) {
      return;
    }

    this.loadSubscription?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';
    this.monthlyTotals = [];
    this.loadSubscription = forkJoin([
      this.pfDataService.getPfData('2'),
      this.pfDataService.getPfData('3')
    ]).subscribe({
      next: (documents) => {
        try {
          this.monthlyTotals = this.aggregateRecords(documents);
        } catch (error: unknown) {
          this.errorMessage = error instanceof Error
            ? error.message
            : 'Unable to combine the PF records.';
        }
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Unable to load the combined PF records.';
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  private aggregateRecords(documents: PfApiDocument[]): MonthlyTotal[] {
    const totals = new Map<string, MonthlyTotal>();
    for (const document of documents) {
      for (const record of document.pfRecords) {
        this.addRecord(totals, record);
      }
    }

    return [...totals.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  private addRecord(totals: Map<string, MonthlyTotal>, record: PfRecord): void {
    const key = monthKey(record.date);
    if (!key) {
      throw new Error(`Cannot combine PF records because "${record.date}" is not a supported month.`);
    }

    const total = totals.get(key) ?? {
      key,
      name: formatMonth(key),
      difference: 0,
      pfAmount: 0
    };
    total.difference += record.difference;
    total.pfAmount += record.pfAmount;
    totals.set(key, total);
  }
}
