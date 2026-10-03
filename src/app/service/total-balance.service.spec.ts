import { calculateTotals } from './total-balance.service';

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

  it('updates the same month row as more entries are added', () => {
    const result = calculateTotals([
      [entry("Oct'26", 110, 10), entry("Sep'26", 100, 10)],
      [entry("Oct'26", 210, 20), entry("Sep'26", 200, 20)]
    ]);
    expect(result.map((record) => record.date)).toEqual(["Oct'26", "Sep'26"]);
    expect(result[0]).toEqual({ date: "Oct'26", total: 320, difference: 30 });
  });
});
