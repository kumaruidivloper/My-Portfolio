import { DOCUMENT } from '@angular/common';
import { Component, ViewChild, ElementRef, OnInit, HostListener, Renderer2, Inject, AfterViewInit} from '@angular/core';
import { AppOptions } from './model/model';
import { Observable } from 'rxjs';
import { timer } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'Kumar UI';
  appOptions = AppOptions;
  transition = 'width 2s';
  barAnimation = false;
  knowleageValue = 0;
  numbers = timer(0, 100);

  @ViewChild('menubtn') menubtn!: ElementRef;
  @ViewChild('header') header!: ElementRef;
  @ViewChild('themeToggler') themeToggler!: ElementRef;

  @HostListener('window:scroll', ['$event']) 
    scrollHandler(event: any): void {
      this.menubtn.nativeElement.classList.remove('fa-time');
      this.header.nativeElement.classList.remove('active');
      if (window.pageYOffset >= 1000 && window.pageYOffset <= 2000) {
        this.selectedOption('about');
      } else {
        this.selectedOption('home');
      }
    }

    constructor(@Inject(DOCUMENT) private document: Document, private renderer: Renderer2) {
      this.renderer.removeClass(document.body, 'active');
      // this.numbers.subscribe(any => console.log('fired'));
    }

  ngOnInit(): void {
    this.renderer.removeClass(this.document.body, 'active');
    setTimeout(() => this.barAnimation = true, 2000);
  }

  ngAfterViewInit(): void {}

  menuClick(): void {
    this.menubtn.nativeElement.classList.toggle('fa-times');
    this.header.nativeElement.classList.toggle('active');
  }

  themeTogglerClick(): void {
    this.themeToggler.nativeElement.classList.toggle('fa-sun');
    if(this.themeToggler.nativeElement.classList.contains('fa-sun')) {
      this.renderer.addClass(document.body, 'active');
    } else {
      this.renderer.removeClass(document.body, 'active');
    } 
  }


  barRange(value: number): string {
      return value + '%'; 
  }

  selectedOption(value: string) {
    if(value === 'about') {
      this.barRange(90);
      this.barAnimation = true;
    } else {
      this.barAnimation = false;
      this.barRange(0);
    }
  }

}
