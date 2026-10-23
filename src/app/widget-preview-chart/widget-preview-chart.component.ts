import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { ChartDatum, formatCompactAxisValue } from '../model/chart-type';

const WIDTH = 300;
const HEIGHT = 72;
const PADDING = 4;
const GRID_ROWS = 4;
const MAX_GRID_COLUMNS = 12;

let nextGradientId = 0;

export interface PreviewViewOption {
  value: string;
  label: string;
}

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
  /** Optional alternative views; with two or more, arrows (and swipe) cycle through them. */
  @Input() views: readonly PreviewViewOption[] = [];
  @Input() view = '';
  @Output() viewChange = new EventEmitter<string>();

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly gradientId = `widget-preview-gradient-${nextGradientId++}`;
  linePath = '';
  areaPath = '';
  lastPoint: { x: number; y: number } | null = null;
  readonly gridRows = Array.from({ length: GRID_ROWS + 1 }, (_, index) => PADDING + (index * (HEIGHT - PADDING * 2)) / GRID_ROWS);
  gridColumns: number[] = [];
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
      this.gridColumns = [];
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
    // One vertical line per point like the full chart, thinned out for long series.
    const every = Math.ceil(points.length / MAX_GRID_COLUMNS);
    this.gridColumns = points.filter((_, index) => index % every === 0 || index === points.length - 1).map(({ x }) => x);
  }

  private swipeStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  get hasViews(): boolean {
    return this.views.length > 1;
  }

  private get viewIndex(): number {
    return Math.max(0, this.views.findIndex(({ value }) => value === this.view));
  }

  get currentViewLabel(): string {
    return this.views[this.viewIndex]?.label ?? this.label;
  }

  adjacentView(step: number): PreviewViewOption {
    const count = this.views.length;
    return this.views[(this.viewIndex + step + count) % count];
  }

  /** Cycles through the views; stops the click so the card doesn't also expand. */
  stepView(step: number, event?: Event): void {
    event?.stopPropagation();
    if (this.hasViews) {
      this.viewChange.emit(this.adjacentView(step).value);
    }
  }

  onSwitcherKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepView(event.key === 'ArrowLeft' ? -1 : 1, event);
    }
  }

  onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.swipeStart = this.hasViews && touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  onTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start || !touch) {
      return;
    }
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.suppressClick = true;
      this.stepView(dx < 0 ? 1 : -1);
    }
  }

  /** Swallows the click that some browsers fire after a swipe so the card stays collapsed. */
  onClickCapture(event: Event): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      event.stopPropagation();
    }
  }

  get summary(): string {
    if (!this.latest) {
      return `${this.label}: no data`;
    }
    const trend = this.change === null ? '' : `, ${this.change > 0 ? 'up' : this.change < 0 ? 'down' : 'unchanged'} ${Math.abs(this.change).toFixed(1)}% from previous`;
    return `${this.label} trend, ${this.data.length} points. Latest ${this.latest.name}: ${this.formatValue(this.latest.value)}${trend}`;
  }
}
