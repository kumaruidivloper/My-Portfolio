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
    fixture.componentRef.setInput('companyDeatils', {
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
    });
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
    const cards = fixture.nativeElement.querySelectorAll('.id-badge');
    expect(cards.length).toBe(9);
  });

  it('renders every supplied company instead of requiring exactly nine entries', () => {
    for (const count of [2, 10]) {
      fixture.componentRef.setInput('companyDeatils', {
        companies: Array.from({ length: count }, (_, index) => ({
          name: `Employer ${index + 1}`, from: '01/01/2020', to: 'Till Date'
        }))
      });
      fixture.detectChanges();
      const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.id-badge'));
      expect(cards.length).toBe(count);
      expect(cards[count - 1].textContent).toContain(`Employer ${count}`);
      expect(cards[count - 1].textContent).toContain('01/01/2020');
      expect(cards[count - 1].textContent).toContain('Till Date');
    }
  });

  it('uses the ID portrait and available company logos, and labels missing-logo monograms', () => {
    const profile = { name: 'Portfolio Owner', title: 'I Am A Front-End Developer', userImage: 'assets/img/user-img.jpg' };
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('companyDeatils', {
      companies: [
        { name: 'Tata consultancy services', from: '25/10/2021', to: 'Till Date' },
        { name: 'Other Employer', from: '2020', to: '2021' },
        { name: 'MindTree Ltd', from: '06/12/2018', to: '31/07/2019' },
        { name: 'Volvo Group India Pvt Ltd', from: '27/07/2017', to: '30/11/2018' },
        { name: 'Xentaqsys Technologies', from: '11/05/2010', to: '30/08/2010' },
        { name: 'Schindlers Management Services Pvt Ltd', from: '17/11/2010', to: '07/03/2011' }
      ]
    });
    fixture.detectChanges();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.id-badge'));
    expect(cards[0].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/tcs.png');
    for (const card of cards) {
      expect(card.querySelector('.badge-portrait img')?.getAttribute('src')).toBe('assets/img/companies/company-id-photo.png');
    }
    expect(cards[0].querySelector('.badge-name')?.textContent).toBe('Portfolio Owner');
    expect(cards[0].querySelector('.badge-role')?.textContent).toBe('Front-End Developer');
    expect(cards[1].querySelector('.monogram-caption')?.textContent).toBe('Company monogram');
    expect(cards[1].querySelector('.company-name')?.textContent).toBe('Other Employer');
    expect(cards[1].querySelector('img.company-logo')).toBeNull();
    expect(cards[2].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/mindtree.png');
    expect(cards[2].querySelector('.company-monogram')).toBeNull();
    expect(cards[2].querySelector('.company-name')?.textContent).toBe('MindTree Ltd');
    expect(cards[3].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/volvo.png');
    expect(cards[3].querySelector('.company-monogram')).toBeNull();
    expect(cards[3].querySelector('.company-name')?.textContent).toBe('Volvo Group India Pvt Ltd');
    expect(cards[4].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/xentaqsys.png');
    expect(cards[4].querySelector('.company-monogram')).toBeNull();
    expect(cards[4].querySelector('.company-name')?.textContent).toBe('Xentaqsys Technologies');
    expect(cards[5].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/schindlers.png');
    expect(cards[5].querySelector('.company-monogram')).toBeNull();
    expect(cards[5].querySelector('.company-name')?.textContent).toBe('Schindlers Management Services Pvt Ltd');
  });
});
