import { chartColorScheme, formatCompactAxisValue } from './chart-type';

describe('formatCompactAxisValue', () => {
  it('abbreviates thousands, millions, billions and trillions', () => {
    for (const [value, label] of [
      [1000, '1k'], [1500, '1.5k'], [10000, '10k'], [100000, '100k'],
      [1000000, '1M'], [2500000, '2.5M'], [1000000000, '1B'], [1000000000000, '1T']
    ] as const) {
      expect(formatCompactAxisValue(value)).toBe(label);
    }
  });

  it('handles small values, negatives and rounded unit boundaries', () => {
    expect(formatCompactAxisValue(0)).toBe('0');
    expect(formatCompactAxisValue(53.5)).toBe('53.5');
    expect(formatCompactAxisValue(999)).toBe('999');
    expect(formatCompactAxisValue(-1500)).toBe('-1.5k');
    expect(formatCompactAxisValue(999999)).toBe('1M');
  });
});

describe('chartColorScheme', () => {
  it('generates a different stable color for each month category', () => {
    const monthlyData = Array.from({ length: 18 }, (_, index) => ({
      name: `Month ${index + 1} 2026`,
      value: index
    }));

    const firstScheme = chartColorScheme(monthlyData, 'monthly-values');
    const secondScheme = chartColorScheme(monthlyData, 'monthly-values');

    expect(firstScheme.domain.length).toBe(monthlyData.length);
    expect(new Set(firstScheme.domain).size).toBe(monthlyData.length);
    expect(secondScheme.domain).toEqual(firstScheme.domain);
  });

  it('uses a fallback color when there are no chart categories', () => {
    expect(chartColorScheme([], 'empty-chart').domain).toEqual(['#046a38']);
  });
});
