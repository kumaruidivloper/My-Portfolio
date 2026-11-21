import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { ConnectedPosition } from '@angular/cdk/overlay';

export interface ThemeSelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-theme-select',
  templateUrl: './theme-select.component.html',
  styleUrls: ['./theme-select.component.scss'],
  standalone: false
})
export class ThemeSelectComponent {
  @Input() options: readonly ThemeSelectOption[] = [];
  @Input() value = '';
  @Input() ariaLabel = 'Select option';
  @Input() sizeToOptions = false;
  @Output() valueChange = new EventEmitter<string>();

  readonly popupPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
  ];

  isOpen = false;
  activeIndex = 0;

  constructor(private host: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '';
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.isOpen = true;
      this.activeIndex = Math.max(0, this.options.findIndex((option) => option.value === this.value));
    }
  }

  select(option: ThemeSelectOption): void {
    this.valueChange.emit(option.value);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen) {
          this.toggle();
        } else {
          this.activeIndex = Math.min(this.activeIndex + 1, this.options.length - 1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isOpen) {
          this.toggle();
        } else {
          this.activeIndex = Math.max(this.activeIndex - 1, 0);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.isOpen) {
          this.select(this.options[this.activeIndex]);
        } else {
          this.toggle();
        }
        break;
      case 'Escape':
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private close(): void {
    this.isOpen = false;
  }
}
