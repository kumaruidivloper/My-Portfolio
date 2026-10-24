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
  styleUrls: ['./widget-preview-chart.component.scss', './widget-preview-slider.scss'],
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
  /** Number of points inside the slider window, or null when the full series is shown. */
  @Output() rangeCountChange = new EventEmitter<number | null>();

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
  hovered: { datum: ChartDatum; x: number; y: number } | null = null;
  private points: { x: number; y: number }[] = [];
  private plotData: ChartDatum[] = [];

  /** Selected time window (indexes into the finite data points); the full series by default. */
  rangeFrom = 0;
  rangeTo = 0;
  totalPoints = 0;
  private rangeKey = '';

  ngOnChanges(): void {
    const allData = this.data.filter(({ value }) => Number.isFinite(value));
    const key = `${this.view}|${allData.length}`;
    if (key !== this.rangeKey) {
      if (this.isRangeFiltered) {
        // Deferred so the host's count label isn't changed mid change-detection.
        Promise.resolve().then(() => this.rangeCountChange.emit(null));
      }
      this.rangeKey = key;
      this.rangeFrom = 0;
      this.rangeTo = Math.max(0, allData.length - 1);
    }
    this.totalPoints = allData.length;
    this.render(allData.slice(this.rangeFrom, this.rangeTo + 1));
  }

  get hasRangeSlider(): boolean {
    return this.totalPoints > 2;
  }

  get rangeMax(): number {
    return Math.max(0, this.totalPoints - 1);
  }

  get isRangeFiltered(): boolean {
    return this.rangeFrom > 0 || this.rangeTo < this.rangeMax;
  }

  /** Moves one end of the time window, keeping at least two points so a trend line can be drawn. */
  setRange(endpoint: 'from' | 'to', position: number): void {
    const value = Math.round(position);
    if (!Number.isFinite(value)) {
      return;
    }
    if (endpoint === 'from') {
      this.rangeFrom = Math.max(0, Math.min(value, this.rangeTo - 1));
    } else {
      this.rangeTo = Math.min(this.rangeMax, Math.max(value, this.rangeFrom + 1));
    }
    this.render(this.data.filter(({ value: v }) => Number.isFinite(v)).slice(this.rangeFrom, this.rangeTo + 1));
    this.rangeCountChange.emit(this.isRangeFiltered ? this.rangeTo - this.rangeFrom + 1 : null);
  }

  private trackDrag: { pointerId: number; endpoint: 'from' | 'to'; left: number; width: number } | null = null;

  /** Clicking the bar jumps the nearest knob there; keep holding to drag it. */
  startTrackDrag(event: PointerEvent): void {
    if (event.button !== 0 || !this.rangeMax || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    const target = event.currentTarget;
    const { left, width } = target.getBoundingClientRect();
    if (!width) {
      return;
    }
    const position = this.trackPosition(event.clientX, left, width);
    const endpoint = Math.abs(position - this.rangeFrom) <= Math.abs(position - this.rangeTo) &&
      !(position > this.rangeTo) ? 'from' : 'to';
    this.setRange(endpoint, position);
    target.setPointerCapture?.(event.pointerId);
    this.trackDrag = { pointerId: event.pointerId, endpoint, left, width };
  }

  moveTrackDrag(event: PointerEvent): void {
    const drag = this.trackDrag;
    if (drag && drag.pointerId === event.pointerId) {
      this.setRange(drag.endpoint, this.trackPosition(event.clientX, drag.left, drag.width));
    }
  }

  endTrackDrag(event: PointerEvent): void {
    if (this.trackDrag?.pointerId === event.pointerId) {
      this.trackDrag = null;
    }
  }

  private trackPosition(clientX: number, left: number, width: number): number {
    return Math.max(0, Math.min(this.rangeMax, Math.round((clientX - left) / width * this.rangeMax)));
  }

  resetRange(event?: Event): void {
    event?.stopPropagation();
    this.rangeFrom = 0;
    this.rangeTo = this.rangeMax;
    this.render(this.data.filter(({ value }) => Number.isFinite(value)));
    this.rangeCountChange.emit(null);
  }

  /** Keeps slider gestures from expanding the card or switching the preview view. */
  stopEvent(event: Event): void {
    event.stopPropagation();
  }

  private render(data: ChartDatum[]): void {
    const values = data.map(({ value }) => value);
    this.first = data[0] ?? null;
    this.latest = data[data.length - 1] ?? null;
    this.hovered = null;
    const previous = data[data.length - 2];
    this.change = previous && previous.value !== 0 && this.latest
      ? ((this.latest.value - previous.value) / Math.abs(previous.value)) * 100
      : null;

    if (values.length < 2) {
      this.linePath = '';
      this.areaPath = '';
      this.lastPoint = null;
      this.gridColumns = [];
      this.points = [];
      this.plotData = [];
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
    this.points = points;
    this.plotData = data;
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

  /** Tracks the data point nearest the pointer so the tooltip can show its period and value. */
  onPlotPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !this.points.length) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.width ? ((event.clientX - rect.left) / rect.width) * WIDTH : 0;
    const step = this.points.length > 1 ? this.points[1].x - this.points[0].x : 1;
    const index = Math.min(this.points.length - 1, Math.max(0, Math.round((x - PADDING) / step)));
    if (this.hovered?.datum !== this.plotData[index]) {
      this.hovered = { datum: this.plotData[index], ...this.points[index] };
    }
  }

  clearHover(): void {
    this.hovered = null;
  }

  get summary(): string {
    if (!this.latest) {
      return `${this.label}: no data`;
    }
    const trend = this.change === null ? '' : `, ${this.change > 0 ? 'up' : this.change < 0 ? 'down' : 'unchanged'} ${Math.abs(this.change).toFixed(1)}% from previous`;
    return `${this.label} trend, ${this.rangeTo - this.rangeFrom + 1} points. Latest ${this.latest.name}: ${this.formatValue(this.latest.value)}${trend}`;
  }
}
