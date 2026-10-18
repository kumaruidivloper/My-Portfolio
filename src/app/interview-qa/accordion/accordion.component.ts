import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
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
  }

  questionCount(menu: Menu): number {
    return menu.submenu.reduce((sum, item) => sum + (item.questions?.length ?? 0), 0);
  }

  openTopic(menuIndex: number, topicIndex: number) {
    const menu = this.menus[menuIndex];
    this.selectTopic(menu, topicIndex);
    if (!menu.active) {
      this.toggle(menuIndex);
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
