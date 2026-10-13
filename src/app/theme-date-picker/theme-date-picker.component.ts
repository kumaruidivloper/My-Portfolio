import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, Output, forwardRef } from '@angular/core';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type DatePickerMode = 'date' | 'month';

interface CalendarDay {
  day: number;
  value: string;
  inMonth: boolean;
  isToday: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (value: number): string => String(value).padStart(2, '0');

@Component({
  selector: 'app-theme-date-picker',
  templateUrl: './theme-date-picker.component.html',
  styleUrls: ['./theme-date-picker.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ThemeDatePickerComponent), multi: true }],
  standalone: false
})
export class ThemeDatePickerComponent implements ControlValueAccessor {
  @Input() mode: DatePickerMode = 'date';
  @Input() ariaLabel = 'Choose date';
  @Input() min = '';
  @Input() max = '';
  @Input() allowClear = true;
  @Input() isDisabled = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() opened = new EventEmitter<void>();

  readonly months = MONTHS;
  readonly weekdays = WEEKDAYS;
  readonly popupPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
  ];

  @Input() value = '';
  isOpen = false;
  isChoosingYear = false;
  yearPageStart = 0;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>, private changeDetector: ChangeDetectorRef) {}

  get displayValue(): string {
    const parts = this.parse(this.value);
    if (!parts) {
      return '';
    }
    return this.mode === 'month'
      ? `${MONTHS[parts.month]} ${parts.year}`
      : `${pad(parts.day)} ${MONTHS[parts.month]} ${parts.year}`;
  }

  get title(): string {
    if (this.isChoosingYear) {
      return `${this.yearPageStart} - ${this.yearPageStart + 11}`;
    }
    return this.mode === 'month' ? `${this.viewYear}` : `${MONTHS[this.viewMonth]} ${this.viewYear}`;
  }

  get years(): number[] {
    return Array.from({ length: 12 }, (_, index) => this.yearPageStart + index);
  }

  toggleYearChooser(): void {
    this.yearPageStart = Math.floor(this.viewYear / 12) * 12;
    this.isChoosingYear = !this.isChoosingYear;
  }

  isYearAllowed(year: number): boolean {
    return year >= 1 && year <= 9999 &&
      (!this.min || year >= Number(this.min.slice(0, 4))) &&
      (!this.max || year <= Number(this.max.slice(0, 4)));
  }

  selectYear(year: number): void {
    if (this.isDisabled || !Number.isInteger(year) || !this.isYearAllowed(year)) {
      throw new RangeError('Year selection is outside the allowed range.');
    }
    this.viewYear = year;
    const min = this.parse(this.min);
    const max = this.parse(this.max);
    if (min?.year === year) {
      this.viewMonth = Math.max(this.viewMonth, min.month);
    }
    if (max?.year === year) {
      this.viewMonth = Math.min(this.viewMonth, max.month);
    }
    this.isChoosingYear = false;
  }

  get days(): CalendarDay[] {
    const first = new Date(this.viewYear, this.viewMonth, 1);
    const start = new Date(this.viewYear, this.viewMonth, 1 - first.getDay());
    const today = this.format(new Date());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const value = this.format(date);
      return { day: date.getDate(), value, inMonth: date.getMonth() === this.viewMonth, isToday: value === today };
    });
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
  }

  toggle(): void {
    if (this.isDisabled) {
      return;
    }
    this.isOpen ? this.close() : this.open();
  }

  shift(step: number): void {
    if (!this.canShift(step)) {
      return;
    }
    if (this.isChoosingYear) {
      this.yearPageStart += step * 12;
      return;
    }
    if (this.mode === 'month') {
      this.viewYear += step;
      return;
    }
    const date = new Date(this.viewYear, this.viewMonth + step, 1);
    this.viewYear = date.getFullYear();
    this.viewMonth = date.getMonth();
  }

  selectDay(day: CalendarDay): void {
    this.commit(day.value);
  }

  selectMonth(index: number): void {
    this.commit(`${this.viewYear}-${pad(index + 1)}`);
  }

  selectToday(): void {
    const now = new Date();
    this.commit(this.mode === 'month' ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}` : this.format(now));
  }

  clear(): void {
    this.commit('');
  }

  isSelectedMonth(index: number): boolean {
    const parts = this.parse(this.value);
    return !!parts && parts.year === this.viewYear && parts.month === index;
  }

  isSelectedDay(day: CalendarDay): boolean {
    return day.value === this.value;
  }

  isAllowed(value: string): boolean {
    return (!this.min || value >= this.min) && (!this.max || value <= this.max);
  }

  monthValue(index: number): string {
    return `${this.viewYear}-${pad(index + 1)}`;
  }

  get todayValue(): string {
    const now = new Date();
    return this.mode === 'month' ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}` : this.format(now);
  }

  canShift(step: number): boolean {
    if (this.isChoosingYear) {
      const start = this.yearPageStart + step * 12;
      return Array.from({ length: 12 }, (_, index) => start + index).some(year => this.isYearAllowed(year));
    }
    const date = new Date(this.viewYear + (this.mode === 'month' ? step : 0),
      this.viewMonth + (this.mode === 'date' ? step : 0), 1);
    const start = this.mode === 'month' ? `${date.getFullYear()}-01` : this.format(date);
    const end = this.mode === 'month' ? `${date.getFullYear()}-12`
      : this.format(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    return (!this.min || end >= this.min) && (!this.max || start <= this.max);
  }

  onDocumentClick(event: Event): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  private open(): void {
    const parts = this.parse(this.value || this.min);
    const base = parts ?? { year: new Date().getFullYear(), month: new Date().getMonth(), day: 1 };
    this.viewYear = base.year;
    this.viewMonth = base.month;
    this.isChoosingYear = false;
    this.isOpen = true;
    this.changeDetector.markForCheck();
    this.opened.emit();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.changeDetector.markForCheck();
    this.onTouched();
  }

  private commit(value: string): void {
    if (this.isDisabled || (value ? !this.isAllowed(value) : !this.allowClear)) {
      throw new RangeError('Date selection is outside the allowed range.');
    }
    this.value = value;
    this.onChange(value);
    this.valueChange.emit(value);
    this.close();
  }

  private format(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private parse(value: string): { year: number; month: number; day: number } | null {
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value ?? '');
    if (!match) {
      return null;
    }
    return { year: +match[1], month: +match[2] - 1, day: match[3] ? +match[3] : 1 };
  }
}
