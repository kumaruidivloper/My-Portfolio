/// <reference types="jasmine" />

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { QrCodeViewComponent } from '../../qr-code-view/qr-code-view.component';

import { WorkExperienceComponent } from './work-experience.component';

describe('WorkExperienceComponent', () => {
  let component: WorkExperienceComponent;
  let fixture: ComponentFixture<WorkExperienceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WorkExperienceComponent],
      imports: [QrCodeViewComponent]
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

  it('extends only the pressed card with resistance and retracts after release or cancellation', fakeAsync(() => {
    const badges = fixture.nativeElement.querySelectorAll('.id-badge') as NodeListOf<HTMLElement>;
    const badge = badges[0];
    const hanger = badge.parentElement!;
    const capture = spyOn(badge, 'setPointerCapture');
    spyOn(badge, 'hasPointerCapture').and.returnValue(true);
    const release = spyOn(badge, 'releasePointerCapture');
    const send = (type: string, pointerId = 1, clientY = 100) => badge.dispatchEvent(new PointerEvent(type, {
      bubbles: true, isPrimary: true, button: 0, pointerId, clientX: 100, clientY
    }));

    for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      send('pointerdown');
      expect(capture).toHaveBeenCalledWith(1);
      send('pointermove', 2, 300);
      expect(hanger.style.getPropertyValue('--card-pull')).not.toMatch(/^[1-9]/);
      send('pointermove', 1, 300);
      const pull = parseFloat(hanger.style.getPropertyValue('--card-pull'));
      expect(pull).toBeGreaterThan(0);
      expect(pull).toBeLessThan(64);
      expect(badges[1].parentElement!.style.getPropertyValue('--card-pull')).toBe('');
      send(endEvent);
      expect(hanger.style.getPropertyValue('--card-pull')).toBe('0px');
      expect(hanger.style.getPropertyValue('--card-tilt')).toBe('0deg');
      expect(hanger.classList.contains('is-dragging')).toBeFalse();
      expect(hanger.classList.contains('is-returning')).toBeTrue();
      tick(650);
      expect(hanger.classList.contains('is-returning')).toBeFalse();
    }
    expect(release).toHaveBeenCalledWith(1);
  }));

  it('ignores secondary-button presses', () => {
    const badge = fixture.nativeElement.querySelector('.id-badge') as HTMLElement;
    const capture = spyOn(badge, 'setPointerCapture');
    badge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, button: 2 }));
    expect(capture).not.toHaveBeenCalled();
    expect(badge.parentElement!.classList.contains('is-dragging')).toBeFalse();
  });

  it('places each company QR between its dates and refreshes it when records change', async () => {
    for (const companies of [
      [{ name: 'Company A', from: '2020', to: '2022' }, { name: 'Company B', from: '2022', to: 'Till Date' }],
      [{ name: 'Updated Employer', from: '2024', to: 'Present' }]
    ]) {
      fixture.componentRef.setInput('companyDeatils', { companies });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.badge-dates') as NodeListOf<HTMLElement>;
      expect(rows.length).toBe(companies.length);
      rows.forEach((row, index) => {
        const company = companies[companies.length - 1 - index];
        expect(row.children[0].textContent).toContain(company.from);
        expect(row.children[1].tagName).toBe('APP-QR-CODE-VIEW');
        expect(row.children[2].textContent).toContain(company.to);
        expect(row.querySelector('canvas')?.getAttribute('aria-label'))
          .toBe(`QR code for ${company.name}\nFrom: ${company.from}\nTo: ${company.to}`);
      });
    }
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
      expect(cards[0].textContent).toContain(`Employer ${count}`);
      expect(cards[count - 1].textContent).toContain('Employer 1');
      expect(cards[count - 1].textContent).toContain('01/01/2020');
      expect(cards[count - 1].textContent).toContain('Till Date');
    }
  });

  it('uses the updated Cognizant name on the badge and in its QR code', async () => {
    fixture.componentRef.setInput('companyDeatils', {
      companies: [{ name: 'Cognizant Technology and Solution India Pvt Ltd', from: '09/03/2011', to: '21/07/2017' }]
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const card = fixture.nativeElement as HTMLElement;
    expect(card.querySelector('.company-name')?.textContent).toBe('Cognizant Technology & Solution India Pvt Ltd');
    expect(card.querySelector('.badge-qr canvas')?.getAttribute('aria-label'))
      .toBe('QR code for Cognizant Technology & Solution India Pvt Ltd\nFrom: 09/03/2011\nTo: 21/07/2017');
    expect(card.querySelector('.company-logo')?.getAttribute('src')).toBe('assets/img/companies/cognizant.png');
  });

  it('shows the newest career chapter first without mutating the supplied chronology', () => {
    const companies = [
      { name: 'Dart Innovation & Technologies Pvt Ltd', from: '25/05/2007', to: '30/04/2010' },
      { name: 'Harman International Pvt Ltd', from: '17/10/2019', to: '28/09/2021' },
      { name: 'Tata consultancy services', from: '25/10/2021', to: 'Till Date' }
    ];
    fixture.componentRef.setInput('companyDeatils', { companies });
    fixture.detectChanges();
    const chapters = fixture.nativeElement.querySelectorAll('.company-chapter') as NodeListOf<HTMLElement>;
    expect(Array.from(chapters, card => card.querySelector('.company-name')?.textContent))
      .toEqual(['Tata consultancy services', 'Harman International Pvt Ltd', 'Dart Innovation & Technologies Pvt Ltd']);
    expect(Array.from(chapters, card => card.querySelector('.chapter-number')?.textContent))
      .toEqual(['Chapter 3', 'Chapter 2', 'Chapter 1']);
    expect(companies[0].name).toBe('Dart Innovation & Technologies Pvt Ltd');
    expect(companies[2].name).toBe('Tata consultancy services');
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
    const cards = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.id-badge')).reverse();
    expect(cards[0].querySelector('img.company-logo')?.getAttribute('src')).toBe('assets/img/companies/tcs.png');
    const chapters: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.company-chapter'));
    for (const chapter of chapters) {
      expect(chapter.querySelector('.lanyard-logo')?.getAttribute('src'))
        .toBe(chapter.querySelector('.company-logo')?.getAttribute('src'));
    }
    for (const card of cards) {
      expect(card.querySelector('.badge-portrait img')?.getAttribute('src')).toBe('assets/img/companies/company-id-photo.png');
    }
    expect(cards[0].querySelector('.badge-name')?.textContent).toBe('Portfolio Owner');
    expect(cards[0].querySelector('.badge-role')?.textContent).toBe('Front-End Engineer');
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
