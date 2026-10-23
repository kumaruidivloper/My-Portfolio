import {
  Component, OnInit, Input, ChangeDetectionStrategy, DestroyRef, ElementRef, Injector, afterNextRender, inject
} from '@angular/core';
import { Config, Menu, MenuItem } from '../types';

export interface TextSegment {
  text: string;
  code: boolean;
}

@Component({
    selector: 'app-accordion',
    templateUrl: './accordion.component.html',
    styleUrls: ['./accordion.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AccordionComponent implements OnInit {
  @Input()
  options!: Config;
  @Input()
  menus!: Menu[];
  config!: Config;
  private selectedTopics = new Map<Menu, number>();
  private segmentCache = new Map<string, TextSegment[]>();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelPendingScroll?.());
  }
  
  ngOnInit() {
    this.config = this.mergeConfig(this.options);
  }

  mergeConfig(options: Config | undefined) {
    // 기본 옵션
    const config = {
      // selector: '#accordion',
      multi: true
    };

    return { ...config, ...options };
  }

  toggle(index: number) {
    // 멀티 오픈을 허용하지 않으면 타깃 이외의 모든 submenu를 클로즈한다.
    if (!this.config.multi) {
      this.menus.filter(
        (menu, i) => i !== index && menu.active
      ).forEach(menu => menu.active = !menu.active);
    }

    // Menu의 active를 반전
    this.menus[index].active = !this.menus[index].active;

    if (this.menus[index].active) {
      this.scrollToWidget(index);
    }
  }

  /**
   * Opened widgets move to the top of the grid (CSS order), so bring the opened one into view.
   * Scrolls instantly (smooth scrolling gets cancelled by the collapse animation and by touch
   * momentum on mobile), then re-applies once the panel animation has finished.
   */
  private scrollToWidget(index: number) {
    this.cancelPendingScroll?.();
    afterNextRender(() => {
      const widget = this.host.nativeElement.querySelectorAll<HTMLElement>('.widget')[index];
      if (!widget) {
        return;
      }
      const scroller = this.scrollParent(widget);
      const apply = () => {
        // In single-open mode the active widget is always first, so go straight to the top.
        if (!this.config.multi) {
          scroller.scrollTop = 0;
        } else {
          widget.scrollIntoView({ block: 'start' });
        }
      };
      apply();

      const panel = widget.querySelector<HTMLElement>('.widget-panel');
      const userEvents = ['wheel', 'touchstart', 'keydown'];
      let timer = 0;
      const cleanup = () => {
        window.clearTimeout(timer);
        panel?.removeEventListener('transitionend', settle);
        userEvents.forEach(type => scroller.removeEventListener(type, cleanup));
        if (this.cancelPendingScroll === cleanup) {
          this.cancelPendingScroll = undefined;
        }
      };
      const settle = (event?: Event) => {
        if (event && event.target !== panel) {
          return;
        }
        cleanup();
        apply();
      };
      panel?.addEventListener('transitionend', settle);
      // Fallback in case transitionend doesn't fire (e.g. reduced motion).
      timer = window.setTimeout(settle, 500);
      // Don't fight the user if they start scrolling again.
      userEvents.forEach(type => scroller.addEventListener(type, cleanup, { passive: true }));
      this.cancelPendingScroll = cleanup;
    }, { injector: this.injector });
  }

  private cancelPendingScroll?: () => void;

  private scrollParent(element: HTMLElement): HTMLElement {
    for (let el = element.parentElement; el; el = el.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
        return el;
      }
    }
    return (document.scrollingElement ?? document.documentElement) as HTMLElement;
  }

  questionCount(menu: Menu): number {
    return menu.submenu.reduce((sum, item) => sum + (item.questions?.length ?? 0), 0);
  }

  openTopic(menuIndex: number, topicIndex: number) {
    const menu = this.menus[menuIndex];
    this.selectTopic(menu, topicIndex);
    if (!menu.active) {
      this.toggle(menuIndex);
    } else {
      this.scrollToWidget(menuIndex);
    }
  }

  selectedTopicIndex(menu: Menu): number {
    return this.selectedTopics.get(menu) ?? 0;
  }

  selectTopic(menu: Menu, index: number) {
    this.selectedTopics.set(menu, index);
  }

  selectedTopic(menu: Menu): MenuItem | undefined {
    return menu.submenu[this.selectedTopicIndex(menu)];
  }

  /** Splits text on backticks; odd parts are inline code. Cached so change detection reuses arrays. */
  codeSegments(text: string): TextSegment[] {
    let segments = this.segmentCache.get(text);
    if (!segments) {
      segments = text
        .split('`')
        .map((part, i) => ({ text: part, code: i % 2 === 1 }))
        .filter(segment => segment.text.length > 0);
      this.segmentCache.set(text, segments);
    }
    return segments;
  }
}
