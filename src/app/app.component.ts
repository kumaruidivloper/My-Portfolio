import { DOCUMENT } from '@angular/common';
import { Component, ViewChild, ElementRef, OnInit, HostListener, Renderer2, Inject, AfterViewInit} from '@angular/core';
import { AppOptions } from './model/model';
import { Observable } from 'rxjs';
import { timer } from 'rxjs';
import { DataService } from './service/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  data: any;
  isDataLoaded: boolean = false;
  isError: boolean = false;
  error: any;
  title = 'Kumar UI';
  appOptions = AppOptions;
  transition = 'width 2s';
  barAnimation = false;
  isVisible = true;
  numbers = timer(0, 100);
  isDarkeMode = true;
  isScrollBottom = true;
  body = this.document.body;
  currentYear: number=new Date().getFullYear();

  @ViewChild('menubtn') menubtn!: ElementRef;
  @ViewChild('header') header!: ElementRef;
  @ViewChild('themeToggler') themeToggler!: ElementRef;

  @HostListener('window:scroll', ['$event']) 
    scrollHandler(event: any): void {
      this.menubtn.nativeElement.classList.remove('fa-time');
      this.header.nativeElement.classList.remove('active');
      if(window.pageYOffset === 0) {
        this.isScrollBottom = true  ;
      }
      if(window.pageYOffset >= 200) {
        this.isVisible = false;
      } else {
        this.isVisible = true;
      }
      if (window.pageYOffset >= 1000 && window.pageYOffset <= 2000) {
        this.selectedOption('about');
      } else {
        this.selectedOption('home');
      }
    }

    constructor(@Inject(DOCUMENT) private document: Document, private renderer: Renderer2, private dataService: DataService) {
      this.renderer.removeClass(document.body, 'active');
      // this.numbers.subscribe(any => console.log('fired'));
    }

  ngOnInit(): void {
    this.dataService.getData().subscribe((res) => {
      this.data = res;
      console.log(this.data)
    },(err) => {
      this.isError = true;
      console.log("error" + JSON.stringify(err));
      this.error = err;
    }, () => {
      setTimeout(() => {
        this.isDataLoaded = true;
      },3500)
      
      console.log("pross completed");
    });
    window.scrollTo({ top: 0, behavior: 'smooth' })
    console.log(Math.max( this.body.scrollHeight, this.body.offsetHeight))
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
      this.isDarkeMode = false;
    } else {
      this.renderer.removeClass(document.body, 'active');
      this.isDarkeMode = true;
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

  scrollTop() {
    this.isScrollBottom = !this.isScrollBottom;
    this.isScrollBottom ?  window.scrollTo({ top: 0, behavior: 'smooth' }) :  window.scrollTo(0, document.body.scrollHeight);
  }

}
