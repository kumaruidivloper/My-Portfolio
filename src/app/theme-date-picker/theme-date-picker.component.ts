import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
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

  readonly months = MONTHS;
  readonly weekdays = WEEKDAYS;

  value = '';
  isOpen = false;
  isDisabled = false;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>) {}

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
    return this.mode === 'month' ? `${this.viewYear}` : `${MONTHS[this.viewMonth]} ${this.viewYear}`;
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

  @HostListener('document:click', ['$event'])
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
    const parts = this.parse(this.value);
    const base = parts ?? { year: new Date().getFullYear(), month: new Date().getMonth(), day: 1 };
    this.viewYear = base.year;
    this.viewMonth = base.month;
    this.isOpen = true;
  }

  private close(): void {
    this.isOpen = false;
    this.onTouched();
  }

  private commit(value: string): void {
    this.value = value;
    this.onChange(value);
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
