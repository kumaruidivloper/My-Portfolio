import { chartColorScheme } from './chart-type';

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
