import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-about-skills',
  templateUrl: './about-skills.component.html',
  styleUrls: ['./about-skills.component.scss'],
  standalone: false
})
export class AboutSkillsComponent implements AfterViewInit, OnDestroy {
  @Input() technology: any;
  @Input() barAnimation = false;
  @Input() transition: string[] = [];
  @Input() barRange: (value: number) => string = (value: number) => `${value}%`;
  private visibleBars = new Set<number>();
  private visibilityObserver?: IntersectionObserver;
  private barChangesSubscription?: Subscription;

  @ViewChildren('barElement', { read: ElementRef })
  private barElements!: QueryList<ElementRef<HTMLElement>>;

  constructor(private changeDetectorRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.visibilityObserver = new IntersectionObserver((entries) => {
      const barElements = this.barElements.toArray();
      entries.forEach(entry => {
        const barIndex = barElements.findIndex(({ nativeElement }) => nativeElement === entry.target);
        if (barIndex === -1) {
          return;
        }

        if (entry.isIntersecting) {
          this.visibleBars.add(barIndex);
        } else {
          this.visibleBars.delete(barIndex);
        }
      });
      this.changeDetectorRef.detectChanges();
    }, { threshold: 0.15 });

    this.observeBars();
    this.barChangesSubscription = this.barElements.changes.subscribe(() => this.observeBars());
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
    this.barChangesSubscription?.unsubscribe();
  }

  isBarInViewport(index: number): boolean {
    return this.visibleBars.has(index);
  }

  animationDuration(transitionValue = ''): number {
    const durationMatch = transitionValue.match(/(\d+(?:\.\d+)?)\s*(ms|s)/);

    if (!durationMatch) {
      return 3000;
    }

    const duration = Number(durationMatch[1]);
    return durationMatch[2] === 's' ? duration * 1000 : duration;
  }

  private observeBars(): void {
    this.barElements.forEach(({ nativeElement }) => this.visibilityObserver?.observe(nativeElement));
  }
}
