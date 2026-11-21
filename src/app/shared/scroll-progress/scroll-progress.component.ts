import { ChangeDetectorRef, Component, DOCUMENT, EventEmitter, HostListener, Inject, Input, OnDestroy, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  templateUrl: './scroll-progress.component.html',
  styleUrls: ['./scroll-progress.component.scss']
})
export class ScrollProgressComponent implements OnInit, OnDestroy {
  @Input() loading = false;
  @Input() loadingDurationMs: number | null = null;
  @Input() startupRewind = false;
  @Input() scrollContainer?: HTMLElement;
  @Input() resizeTarget?: HTMLElement;
  @Output() scrollProgressChange = new EventEmitter<number>();
  scrollProgress = 0;
  private scrollResizeObserver?: ResizeObserver;
  private readonly onContainerScroll = () => {
    this.updateScrollProgress();
    this.changeDetector.markForCheck();
  };

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.loading) {
      return;
    }

    this.updateScrollProgress();
    this.scrollContainer?.addEventListener('scroll', this.onContainerScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.scrollResizeObserver = new ResizeObserver(() => {
        this.updateScrollProgress();
        this.changeDetector.markForCheck();
      });
      this.scrollResizeObserver.observe(this.scrollContainer ?? this.document.body);
      if (this.resizeTarget) {
        this.scrollResizeObserver.observe(this.resizeTarget);
      }
    }
  }

  ngOnDestroy(): void {
    this.scrollContainer?.removeEventListener('scroll', this.onContainerScroll);
    this.scrollResizeObserver?.disconnect();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateScrollProgress(): void {
    if (this.loading) {
      return;
    }

    const scrollingElement = this.scrollContainer ?? this.document.scrollingElement;
    if (!scrollingElement) {
      this.scrollProgress = 0;
      this.scrollProgressChange.emit(this.scrollProgress);
      return;
    }
    const viewportHeight = this.scrollContainer
      ? this.scrollContainer.clientHeight
      : this.document.documentElement.clientHeight;
    const scrollableHeight = scrollingElement.scrollHeight - viewportHeight;
    this.scrollProgress = scrollableHeight > 0
      ? Math.min(1, Math.max(0, scrollingElement.scrollTop / scrollableHeight))
      : 0;
    this.scrollProgressChange.emit(this.scrollProgress);
  }
}
