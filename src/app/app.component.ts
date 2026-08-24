
import { Component, ViewChild, ElementRef, OnInit, OnDestroy, HostListener, Renderer2, Inject, DOCUMENT, ChangeDetectionStrategy } from '@angular/core';
import { AppOptions } from './model/model';
import { DataService } from './service/data.service';
import { Config, Menu } from './accordion/types';
import { TimeService } from './service/time.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {

      // signle open mode
      options: Config = { multi: false };
  
      menus: Menu[] = [
        { 
          name: 'Front-end',
          iconClass: 'fa fa-code',
          active: true,
          submenu: [
            { name: 'HTML', url: '#' },
            { name: 'CSS', url: '#' },
            { name: 'Javascript', url: '#' },
            { name: 'Javascript', url: '#' },
            { name: 'Javascript', url: '#' },
            { name: 'Javascript', url: '#' },
            { name: 'Javascript', url: '#' }
          ]
        },
        { 
          name: 'Responsive web',
          iconClass: 'fa fa-mobile',
          active: false,
          submenu: [
            { name: 'Tablets', url: '#' },
            { name: 'Mobiles', url: '#' },
            { name: 'Desktop', url: '#' }
          ]
        },
        { 
          name: 'Web Browser',
          iconClass: 'fa fa-globe',
          active: false,
          submenu: [
            { name: 'Chrome', url: '#' },
            { name: 'Firefox', url: '#' },
            { name: 'Desktop', url: '#' }
          ]
        }
      ];
  
  data: any;
  isDataLoaded: boolean = false;
  title = 'Kumar UI';
  appOptions = AppOptions;
  transition = ['width 3s', 'width 4s', 'width 5s', 'width 6s', 'width 7s', 'width 8s', 'width 9s', 'width 10s', 'width 11s', 'width 12s'];
  barAnimation = false;
  isVisible = true;
  isDarkeMode = true;
  isScrollBottom = true;
  currentYear: number=new Date().getFullYear();
  contentHeight: number | undefined;
  isOverlay: boolean = false;
  currentTime: Date | undefined;
  isDaytime: boolean | undefined;
  isThemeModeClicked: boolean = true;
  inputValue: string = '';
  isButtonDisabled: boolean = true;
  private barAnimationTimeout?: ReturnType<typeof setTimeout>;
  private timeUpdateTimeout?: ReturnType<typeof setTimeout>;
  private timeUpdateInterval?: ReturnType<typeof setInterval>;


  @ViewChild('menubtn') menubtn!: ElementRef;
  @ViewChild('header') header!: ElementRef;
  @ViewChild('themeToggler') themeToggler!: ElementRef;
  @ViewChild('overlay') overlay!: ElementRef;

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

    constructor(
    @Inject(DOCUMENT) private document: 
    Document, private renderer: Renderer2, 
    private dataService: DataService,
    private timeService: TimeService
    ) {
      this.renderer.removeClass(document.body, 'active');
    }

  ngOnInit(): void {
    this.checkTimeCondition();
    this.dataService.getData().subscribe((res) => {
       this.data = res;
    },() => {
    }, () => {
      setTimeout(() => {
        this.isDataLoaded = true;
        setTimeout(() => {this.contentHeight = document.body.scrollHeight}, 5000)
      },3500)
      
      //console.log("pross completed");
    });
    window.scrollTo({ top: 0, behavior: 'smooth' })
    //console.log(Math.max( this.body.scrollHeight, this.body.offsetHeight))
    this.renderer.removeClass(this.document.body, 'active');
    this.barAnimationTimeout = setTimeout(() => this.barAnimation = true, 2000);
    this.updateTime();
    this.timeUpdateTimeout = setTimeout(() => {
      this.timeUpdateInterval = setInterval(() => {
        if (this.updateTime()) {
          if(this.isThemeModeClicked) {
            this.themeToggler.nativeElement.classList.remove('fa-sun');
            this.renderer.removeClass(document.body, 'active');
            this.isDarkeMode = true;
          }
        } else {
          if(this.isThemeModeClicked) {
            this.themeToggler.nativeElement.classList.add('fa-sun');
            //this.renderer.addClass(document.body, 'active');
            this.isDarkeMode = false;
          }
        }
      }, 1000);
    }, 3500);

  }

  ngOnDestroy(): void {
    if (this.barAnimationTimeout) {
      clearTimeout(this.barAnimationTimeout);
    }
    if (this.timeUpdateTimeout) {
      clearTimeout(this.timeUpdateTimeout);
    }
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  checkTimeCondition(): void {
    if (this.timeService.getState().isDaytime) {
      this.renderer.addClass(document.body, 'day');
      this.renderer.removeClass(document.body, 'night');
    } else {
      this.renderer.addClass(document.body, 'night');
      this.renderer.removeClass(document.body, 'day');
    }
  }

  /* invoking*/
  addExperienceCount(startYear: number, baseValue: number): number { 
    const today = new Date();
    const currentYear = today.getFullYear();
    const may1ThisYear = new Date(currentYear, 4, 1);

    let yearsPassed = currentYear - startYear;

    if (today < may1ThisYear) {
      yearsPassed -= 1;
    }

    return baseValue + Math.max(0, yearsPassed);
  }

  
  introText(value: string) {
      // console.log(value);
      let updatedText = value.replace(/16\+\s*/, ''); // removes '16+ ' (with optional space)
      return updatedText
  }

  /* Slow invoking*/
  updateTime() {
    this.currentTime = new Date();
    this.isDaytime = this.timeService.getState(this.currentTime).isDaytime;
    return this.isDaytime;
  }

  menuClick(): void {
    this.menubtn.nativeElement.classList.toggle('fa-times');
    this.header.nativeElement.classList.toggle('active');
  }

  qrValueCheck(): void {
    if(this.inputValue.length > 0) {
      this.isButtonDisabled = false;
    } else {
      this.isButtonDisabled = true;
    }
  }

  QrReset() {
    this.inputValue = '';
    this.isButtonDisabled = true;
  }

  themeTogglerClick(): void {
    this.isThemeModeClicked = false;
    this.themeToggler.nativeElement.classList.toggle('fa-sun');
    if(this.themeToggler.nativeElement.classList.contains('fa-sun')) {
      this.renderer.addClass(document.body, 'active');
      this.isDarkeMode = false;
      this.renderer.removeClass(document.body, 'night');
      this.renderer.removeClass(document.body, 'day');
    } else {
      this.renderer.removeClass(document.body, 'active');
      this.isDarkeMode = true;
      this.renderer.removeClass(document.body, 'night');
      this.renderer.removeClass(document.body, 'day');
    } 
  }

  /* invoking */
  barRange(value: number): string {
      return value + '%'; 
  }

  selectedOption(value: string) {
    if(value === 'about') {
      this.barAnimation = true;
    } else {
      this.barAnimation = false;
    }
  }

  scrollTop(): void {
    this.isScrollBottom = !this.isScrollBottom;
    this.isScrollBottom ?  window.scrollTo({ top: 0, behavior: 'smooth' }) :  window.scrollTo(0, document.body.scrollHeight);
  }

  getNote(): void {
    //console.log(this.contentHeight);
    this.isOverlay = true;
    this.renderer.addClass(document.body, 'scrollOff');
  }
  closeOverlay(): void {
    this.renderer.removeClass(document.body, 'scrollOff');
    this.isOverlay = false;
  }

}
