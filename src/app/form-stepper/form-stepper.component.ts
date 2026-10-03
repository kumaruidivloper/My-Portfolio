import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-form-stepper',
  templateUrl: './form-stepper.component.html',
  styleUrls: ['./form-stepper.component.scss'],
  host: { '(keydown.enter)': 'onEnter($event)' },
  standalone: false
})
export class FormStepperComponent implements OnInit {
  @Input() labels: readonly string[] = [];
  @Input() startStep = 0;
  @Input() stepValid = true;
  @Input() submitLabel = 'Save';
  @Input() submitClass = 'primary-action';
  @Input() submitDisabled = false;
  @Input() saving = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() invalidNext = new EventEmitter<number>();

  step = 0;

  ngOnInit(): void {
    this.step = Math.min(Math.max(this.startStep, 0), Math.max(this.labels.length - 1, 0));
  }

  get isFirst(): boolean {
    return this.step === 0;
  }

  get isLast(): boolean {
    return this.step >= this.labels.length - 1;
  }

  next(): void {
    if (this.isLast) {
      return;
    }
    if (!this.stepValid) {
      this.invalidNext.emit(this.step);
      return;
    }
    this.step += 1;
  }

  back(): void {
    if (!this.isFirst) {
      this.step -= 1;
    }
  }

  goTo(index: number): void {
    if (index < this.step) {
      this.step = index;
    }
  }

  onEnter(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isLast || target.tagName === 'BUTTON') {
      return;
    }
    event.preventDefault();
    this.next();
  }
}
