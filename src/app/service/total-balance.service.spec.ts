import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { calculateTotals, TotalBalanceService } from './total-balance.service';

describe('calculateTotals', () => {
  const entry = (date: string, amount: number, difference: number) => ({ date, amount, difference });

  it('sums balances and differences across all sources by month', () => {
    const result = calculateTotals([
      [entry("Sep'26", 100, 10), entry("Aug'26", 90, 9)],
      [entry("Sep'26", 200, 20), entry("Aug'26", 180, 18)]
    ]);
    expect(result).toEqual([
      { date: "Sep'26", total: 300, difference: 30 },
      { date: "Aug'26", total: 270, difference: 27 }
    ]);
  });

  describe('TotalBalanceService preview sources', () => {
    it('loads the four non-Super balance sources without updating totals', () => {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      const http = TestBed.inject(HttpTestingController);
      let result: { date: string; amount: number; difference: number }[][] | undefined;
      TestBed.inject(TotalBalanceService).getOtherBalanceSources().subscribe((sources) => result = sources);

      for (const id of ['2', '3', '4', '5']) {
        const request = http.expectOne((req) => req.url.endsWith(`/taskList/${id}`));
        expect(request.request.method).toBe('GET');
        request.flush(id === '2' || id === '3'
          ? { pfRecords: [{ date: "Dec'26", pfAmount: 100, difference: 10 }] }
          : { gratuityRecords: [{ date: "Dec'26", gratuity: 200, difference: 20 }] });
      }

      expect(result).toEqual([
        [{ date: "Dec'26", amount: 100, difference: 10 }],
        [{ date: "Dec'26", amount: 100, difference: 10 }],
        [{ date: "Dec'26", amount: 200, difference: 20 }],
        [{ date: "Dec'26", amount: 200, difference: 20 }]
      ]);
      http.verify();
    });
  });

  it('keeps older months complete-only and sums a new partial month once per month', () => {
    const result = calculateTotals([
      [entry("Oct'26", 110, 10), entry("Sep'26", 100, 10), entry("Aug'26", 90, 9), entry("Jul'26", 80, 8)],
      [entry("Sep'26", 200, 20), entry("Aug'26", 180, 18)]
    ]);
    expect(result).toEqual([
      { date: "Oct'26", total: 310, difference: 10 },
      { date: "Sep'26", total: 300, difference: 30 },
      { date: "Aug'26", total: 270, difference: 27 }
    ]);
  });

  it('ignores months before July 2026', () => {
    const result = calculateTotals([
      [entry("Jul'26", 100, 10), entry("Jun'26", 90, 9)],
      [entry("Jul'26", 200, 20), entry("Jun'26", 180, 18)]
    ]);
    expect(result.map((record) => record.date)).toEqual(["Jul'26"]);
  });

  it('updates the same month row as more entries are added', () => {
    const result = calculateTotals([
      [entry("Oct'26", 110, 10), entry("Sep'26", 100, 10)],
      [entry("Oct'26", 210, 20), entry("Sep'26", 200, 20)]
    ]);
    expect(result.map((record) => record.date)).toEqual(["Oct'26", "Sep'26"]);
    expect(result[0]).toEqual({ date: "Oct'26", total: 320, difference: 30 });
  });
});
