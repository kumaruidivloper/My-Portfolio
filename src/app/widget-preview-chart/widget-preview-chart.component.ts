import { Component, Input, OnChanges } from '@angular/core';
import { ChartDatum, formatCompactAxisValue } from '../model/chart-type';

const WIDTH = 300;
const HEIGHT = 72;
const PADDING = 4;

let nextGradientId = 0;

/** Compact, dependency-free area chart shown on a collapsed dashboard widget card. */
@Component({
  selector: 'app-widget-preview-chart',
  templateUrl: './widget-preview-chart.component.html',
  styleUrls: ['./widget-preview-chart.component.scss'],
  standalone: false
})
export class WidgetPreviewChartComponent implements OnChanges {
  @Input() data: readonly ChartDatum[] = [];
  @Input() label = '';
  @Input() loading = false;
  @Input() formatValue: (value: number) => string = (value) => `₹ ${formatCompactAxisValue(value)}`;

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly gradientId = `widget-preview-gradient-${nextGradientId++}`;
  linePath = '';
  areaPath = '';
  lastPoint: { x: number; y: number } | null = null;
  latest: ChartDatum | null = null;
  first: ChartDatum | null = null;
  change: number | null = null;

  ngOnChanges(): void {
    const values = this.data.map(({ value }) => value).filter(Number.isFinite);
    const data = this.data.filter(({ value }) => Number.isFinite(value));
    this.first = data[0] ?? null;
    this.latest = data[data.length - 1] ?? null;
    const previous = data[data.length - 2];
    this.change = previous && previous.value !== 0 && this.latest
      ? ((this.latest.value - previous.value) / Math.abs(previous.value)) * 100
      : null;

    if (values.length < 2) {
      this.linePath = '';
      this.areaPath = '';
      this.lastPoint = null;
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const step = (WIDTH - PADDING * 2) / (values.length - 1);
    const points = values.map((value, index) => ({
      x: PADDING + index * step,
      y: range ? PADDING + (1 - (value - min) / range) * (HEIGHT - PADDING * 2) : HEIGHT / 2
    }));
    this.linePath = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    this.areaPath = `${this.linePath} L${points[points.length - 1].x.toFixed(1)} ${HEIGHT} L${PADDING} ${HEIGHT} Z`;
    this.lastPoint = points[points.length - 1];
  }

  get summary(): string {
    if (!this.latest) {
      return `${this.label}: no data`;
    }
    const trend = this.change === null ? '' : `, ${this.change > 0 ? 'up' : this.change < 0 ? 'down' : 'unchanged'} ${Math.abs(this.change).toFixed(1)}% from previous`;
    return `${this.label} trend, ${this.data.length} points. Latest ${this.latest.name}: ${this.formatValue(this.latest.value)}${trend}`;
  }
}
