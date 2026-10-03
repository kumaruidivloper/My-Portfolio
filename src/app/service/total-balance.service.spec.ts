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

  it('drops months missing from any source', () => {
    const result = calculateTotals([
      [entry("Sep'26", 100, 10), entry("Aug'26", 90, 9)],
      [entry("Sep'26", 200, 20)]
    ]);
    expect(result).toEqual([{ date: "Sep'26", total: 300, difference: 30 }]);
  });
});
