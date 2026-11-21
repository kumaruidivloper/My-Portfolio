/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkExperienceComponent } from './work-experience.component';

describe('WorkExperienceComponent', () => {
  let component: WorkExperienceComponent;
  let fixture: ComponentFixture<WorkExperienceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WorkExperienceComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkExperienceComponent);
    component = fixture.componentInstance;
    component.companyDeatils = {
      companies: [
        { name: 'Company A', from: '2020', to: '2022' },
        { name: 'Company B', from: '2022', to: '2024' },
        { name: 'Company C', from: '2024', to: 'Present' },
        { name: 'Company D', from: '2020', to: '2022' },
        { name: 'Company E', from: '2022', to: '2024' },
        { name: 'Company F', from: '2024', to: 'Present' },
        { name: 'Company G', from: '2020', to: '2022' },
        { name: 'Company H', from: '2022', to: '2024' },
        { name: 'Company I', from: '2024', to: 'Present' }
      ]
    };
    component.proud = {
      title: 'Proudly worked with',
      companies: 'Top companies'
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title and company names', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Proudly worked with');
    expect(compiled.textContent).toContain('Top companies');
    expect(compiled.textContent).toContain('Company A');
    expect(compiled.textContent).toContain('Company B');
  });

  it('should show the number of company cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.box');
    expect(cards.length).toBe(9);
  });
});
