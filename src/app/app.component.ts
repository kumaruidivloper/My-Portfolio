import { DOCUMENT } from '@angular/common';
import { Component, ViewChild, ElementRef, OnInit, HostListener, Renderer2, Inject, AfterViewInit, Input} from '@angular/core';
import { AppOptions, AccordionItems } from './model/model';
import { timer } from 'rxjs';
import { DataService } from './service/data.service';
import { Config, Menu } from './accordion/types';
import { ChangeDetectorRef } from '@angular/core';
import { TotalWorkHoursService } from './service/total-work-hours.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {

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
  isError: boolean = false;
  error: any;
  title = 'Kumar UI';
  appOptions = AppOptions;
  transition = ['width 3s', 'width 4s', 'width 5s', 'width 6s', 'width 7s', 'width 8s', 'width 9s', 'width 10s', 'width 11s', 'width 12s'];
  barAnimation = false;
  isVisible = true;
  numbers = timer(0, 100);
  isDarkeMode = true;
  isScrollBottom = true;
  body = this.document.body;
  currentYear: number=new Date().getFullYear();
  contentHeight: number | undefined;
  isOverlay: boolean = false;
  isOpen: boolean = false;
  accodionItems = AccordionItems;
  currentTime: Date | undefined;
  isDaytime: boolean | undefined;
  isThemeModeClicked: boolean = true;
  inputValue: string = '';
  isQRCodeCreated: string = '';
  isButtonDisabled: boolean = true;
  myTotalWorkedHours!: number;
  isTotalWorkHoursVisible: boolean = false;
  timerDuration: number = 0;


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
    private cdref: ChangeDetectorRef,
    private totalWorkHoursService: TotalWorkHoursService
    ) {
      this.renderer.removeClass(document.body, 'active');
      // this.numbers.subscribe(any => console.log('fired'));
    }

  ngOnInit(): void {
    this.dataService.getTestData().subscribe((res) => {
      //console.log(res);
    })
    this.dataService.getData().subscribe((res) => {
       this.data = res;
    },(err) => {
      this.isError = true;
      console.log("error" + JSON.stringify(err));
      this.error = err;
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
    setTimeout(() => this.barAnimation = true, 2000);
    this.updateTime();
    setTimeout(() => {
      setInterval(() => {
        if (this.updateTime()) {
          if(this.isThemeModeClicked) {
            this.themeToggler.nativeElement.classList.remove('fa-sun');
            this.renderer.removeClass(document.body, 'active');
            this.isDarkeMode = true;
          }
        } else {
          if(this.isThemeModeClicked) {
            this.themeToggler.nativeElement.classList.add('fa-sun');
            this.renderer.addClass(document.body, 'active');
            this.isDarkeMode = false;
          }
        }
      }, 1000);
    }, 3500);

    this.myTotalWorkedHours = this.totalWorkHoursService.totalWorkedHours() - 1;
    console.log(this.myTotalWorkedHours)
  }

  toggleWorkHours() {
    this.myTotalWorkedHours =  this.totalWorkHoursService.totalWorkedHours();
    this.isTotalWorkHoursVisible = !this.isTotalWorkHoursVisible
  }

  

  updateTime() {
    this.currentTime = new Date();
    this.isDaytime = this.checkDaytime(this.currentTime);
    return this.isDaytime;
  }

  checkDaytime(time: Date): boolean {
    const startOfDaytime = new Date();
    startOfDaytime.setHours(7, 0, 0); // Adjust this to your desired start time for daytime
    const endOfDaytime = new Date();
    endOfDaytime.setHours(19, 0, 0); // Adjust this to your desired end time for daytime
    return time >= startOfDaytime && time <= endOfDaytime;
  }

  ngAfterViewInit(): void {}

  menuClick(): void {
    this.menubtn.nativeElement.classList.toggle('fa-times');
    this.header.nativeElement.classList.toggle('active');
  }

  onButtonClick(): void {
    this.isQRCodeCreated = this.inputValue;
    // Perform any additional logic if needed
    console.log('Button Clicked!');
    // Access the current value of the input box
    console.log('Input Value:', this.inputValue);
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

  accrodionEvent(valu: string) {
    this.isOpen = !this.isOpen
  }

}
