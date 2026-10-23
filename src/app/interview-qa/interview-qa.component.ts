import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, Renderer2, ViewChild, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { Config, Menu } from './types';
import { loadInterviewMenus } from './data/interview-menus';

@Component({
  selector: 'app-interview-qa',
  templateUrl: './interview-qa.component.html',
  styleUrls: ['./interview-qa.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Interview Q&A'
  }
})
export class InterviewQaComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  readonly options: Config = { multi: false };
  readonly menus = signal<Menu[] | null>(null);
  readonly practiceUrl = 'https://interviewdepth.com';

  ngOnInit(): void {
    this.renderer.addClass(this.document.body, 'scrollOff');
    void loadInterviewMenus().then(menus => this.menus.set(menus));
  }

  ngAfterViewInit(): void {
    this.closeButton?.nativeElement.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'scrollOff');
  }

  @HostListener('document:keydown.escape')
  close(): void {
    void this.router.navigateByUrl('/');
  }
}
