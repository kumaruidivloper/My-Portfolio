import { Color, ScaleType } from '@swimlane/ngx-charts';

export const CHART_TYPE_OPTIONS = [
  { label: 'Bar', value: 'bar' },
  { label: 'Line', value: 'line' },
  { label: 'Pie', value: 'pie' },
  { label: 'Doughnut', value: 'doughnut' }
] as const;

export type ChartType = (typeof CHART_TYPE_OPTIONS)[number]['value'];

export interface ChartDatum {
  name: string;
  value: number;
}

export interface ChartSeries {
  name: string;
  series: ChartDatum[];
}

export function chartColorScheme(data: readonly ChartDatum[], name: string): Color {
  const usedHues = new Set<number>();
  const domain = data.map(({ name: category }) => {
    let hue = [...category].reduce((hash, character) =>
      (hash * 31 + character.charCodeAt(0)) % 360, 0);
    while (usedHues.has(hue) && usedHues.size < 360) {
      hue = (hue + 137) % 360;
    }
    usedHues.add(hue);
    return hueToHex(hue);
  });

  return {
    name,
    selectable: true,
    group: ScaleType.Ordinal,
    domain: domain.length ? domain : ['#046a38']
  };
}

export function isChartType(value: string): value is ChartType {
  return CHART_TYPE_OPTIONS.some((option) => option.value === value);
}

export function toLineChartSeries(data: ChartDatum[], name: string): ChartSeries[] {
  return [{ name, series: data }];
}

function hueToHex(hue: number): string {
  const chroma = (1 - Math.abs(2 * 0.46 - 1)) * 0.68;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs(hueSection % 2 - 1));
  const [red, green, blue] = hueSection < 1
    ? [chroma, secondary, 0]
    : hueSection < 2
      ? [secondary, chroma, 0]
      : hueSection < 3
        ? [0, chroma, secondary]
        : hueSection < 4
          ? [0, secondary, chroma]
          : hueSection < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const lightnessOffset = 0.46 - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + lightnessOffset) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
