import { DOCUMENT } from '@angular/common';
import { Component, ViewChild, ElementRef, OnInit, HostListener, Renderer2, Inject} from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Kumar UI';

  @ViewChild('menubtn') menubtn!: ElementRef;
  @ViewChild('header') header!: ElementRef;
  @ViewChild('themeToggler') themeToggler!: ElementRef;

  @HostListener('window:scroll', ['$event']) 
    scrollHandler(event: any) {
      this.menubtn.nativeElement.classList.remove('fa-time');
      this.header.nativeElement.classList.remove('active');
    }

    constructor(
      @Inject(DOCUMENT) private document: Document,
      private renderer: Renderer2) {
      this.renderer.removeClass(document.body, 'active');
    }

  ngOnInit() {
    this.renderer.removeClass(this.document.body, 'active');
  }

  menuClick() {
    this.menubtn.nativeElement.classList.toggle('fa-times');
    this.header.nativeElement.classList.toggle('active');
  }

  themeTogglerClick() {
    this.themeToggler.nativeElement.classList.toggle('fa-sun');
    if(this.themeToggler.nativeElement.classList.contains('fa-sun')) {
      this.renderer.addClass(document.body, 'active');
    } else {
      this.renderer.removeClass(document.body, 'active');
    } 
  }
  


}
