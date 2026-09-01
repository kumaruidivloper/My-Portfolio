/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortfolioComponent } from './portfolio.component';

describe('PortfolioComponent', () => {
  let component: PortfolioComponent;
  let fixture: ComponentFixture<PortfolioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortfolioComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioComponent);
    component = fixture.componentInstance;
    component.portfolio = {
      title: 'portfolio',
      projList: [
        { imageUrl: 'img-1.jpg', projName: 'Project 1' },
        { imageUrl: 'img-2.jpg', projName: 'Project 2' },
        { imageUrl: 'img-3.jpg', projName: 'Project 3' },
        { imageUrl: 'img-4.jpg', projName: 'Project 4' },
        { imageUrl: 'img-5.jpg', projName: 'Project 5' },
        { imageUrl: 'img-6.jpg', projName: 'Project 6' },
        { imageUrl: 'img-7.jpg', projName: 'Project 7' },
        { imageUrl: 'img-8.jpg', projName: 'Project 8' },
        { imageUrl: 'img-9.jpg', projName: 'Project 9' },
        { imageUrl: 'img-10.jpg', projName: 'Project 10' }
      ]
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the portfolio title and project names', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('my');
    expect(compiled.textContent).toContain('portfolio');
    expect(compiled.textContent).toContain('Project 1');
    expect(compiled.textContent).toContain('Project 2');
  });

  it('should show the number of project cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.box');
    expect(cards.length).toBe(10);
  });
});
