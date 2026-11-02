import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';

interface TechnologySkills {
  technology: string[];
  level: number[];
}

const AI_SKILLS = [
  { name: 'Claude / Claude Code', level: 83 },
  { name: 'Prompt Engineering', level: 76 },
  { name: 'AI-Assisted Development', level: 85 },
  { name: 'Generative AI', level: 72 },
  { name: 'MCP (Model Context Protocol)', level: 68 },
  { name: 'AI Agents', level: 79 }
];

@Component({
  selector: 'app-about-skills',
  templateUrl: './about-skills.component.html',
  styleUrls: ['./about-skills.component.scss'],
  standalone: false
})
export class AboutSkillsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() technology: TechnologySkills | null = null;
  skills: { name: string; level: number }[] = [];
  get columnSplit(): number { return Math.ceil(this.skills.length / 2); }
  @Input() barAnimation = false;
  @Input() transition: string[] = [];
  @Input() barRange: (value: number) => string = (value: number) => `${value}%`;
  /** Current counter value per skill; the bar width follows it so bar and digits stay in sync. */
  barValues: number[] = [];
  private visibleBars = new Set<number>();
  private visibilityObserver?: IntersectionObserver;
  private barChangesSubscription?: Subscription;

  @ViewChildren('barElement', { read: ElementRef })
  private barElements!: QueryList<ElementRef<HTMLElement>>;

  constructor(private changeDetectorRef: ChangeDetectorRef) {}

  ngOnChanges(): void {
    const data = this.technology;
    const existing = data?.technology ?? [];
    this.skills = data ? existing.map((name, index) => ({
      name, level: data.level[index]
    })) : [];
    for (const { name, level } of AI_SKILLS) {
      if (!existing.some((skill) => skill.trim().toLowerCase() === name.toLowerCase())) {
        this.skills.push({ name, level });
      }
    }
  }

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

  /** Slows the bar, counter and digit wheel together (1 = original speed). */
  speedFactor = 1.5;

  animationDuration(transitionValue = ''): number {
    const durationMatch = transitionValue.match(/(\d+(?:\.\d+)?)\s*(ms|s)/);

    if (!durationMatch) {
      return 3000 * this.speedFactor;
    }

    const duration = Number(durationMatch[1]);
    return (durationMatch[2] === 's' ? duration * 1000 : duration) * this.speedFactor;
  }

  /** Matches the counter's step time so each 1% width change glides into the next. */
  stepMs(index: number): number {
    const level = this.skills[index]?.level;
    return level > 0 ? Math.max(1, Math.round(this.animationDuration(this.transition[index]) / level)) : 0;
  }

  private observeBars(): void {
    this.barElements.forEach(({ nativeElement }) => this.visibilityObserver?.observe(nativeElement));
  }
}
