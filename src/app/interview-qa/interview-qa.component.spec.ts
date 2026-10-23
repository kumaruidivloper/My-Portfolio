/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { InterviewQaModule } from './interview-qa.module';
import { InterviewQaComponent } from './interview-qa.component';

describe('InterviewQaComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InterviewQaModule],
      providers: [provideRouter([])]
    });
  });

  function render() {
    const fixture = TestBed.createComponent(InterviewQaComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the dialog, then the interview accordion once the questions load, and locks body scroll', async () => {
    const fixture = render();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.querySelector('.qa-loading')).not.toBeNull();

    const deadline = Date.now() + 3000;
    while (!fixture.componentInstance.menus() && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    fixture.detectChanges();
    expect(element.querySelector('.qa-loading')).toBeNull();
    expect(element.querySelectorAll('app-accordion .widget').length).toBe(fixture.componentInstance.menus()?.length ?? -1);
    expect(element.querySelectorAll('app-accordion .widget').length).toBeGreaterThan(0);
    expect(document.body.classList).toContain('scrollOff');

    fixture.destroy();
    expect(document.body.classList).not.toContain('scrollOff');
  });

  it('navigates home from the close button and the Escape key', () => {
    const fixture = render();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    (fixture.nativeElement.querySelector('button[aria-label="Close interview Q&A"]') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('/');
    fixture.destroy();
  });
});
