import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy } from '@angular/core';

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
  isInViewport = false;
  private visibilityObserver?: IntersectionObserver;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.isInViewport = entry.isIntersecting;
      this.changeDetectorRef.detectChanges();
    }, { threshold: 0.15 });

    this.visibilityObserver.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.visibilityObserver?.disconnect();
  }
}
