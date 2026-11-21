import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormStepperComponent } from './form-stepper.component';
import { CommonModule } from '@angular/common';

describe('FormStepperComponent', () => {
  let fixture: ComponentFixture<FormStepperComponent>;
  let component: FormStepperComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [FormStepperComponent], imports: [CommonModule] });
    fixture = TestBed.createComponent(FormStepperComponent);
    component = fixture.componentInstance;
    component.labels = ['A', 'B', 'C'];
    fixture.detectChanges();
  });

  it('advances only when the step is valid', () => {
    component.stepValid = false;
    const emitted: number[] = [];
    component.invalidNext.subscribe((s) => emitted.push(s));
    component.next();
    expect(component.step).toBe(0);
    expect(emitted).toEqual([0]);
    component.stepValid = true;
    component.next();
    expect(component.step).toBe(1);
  });

  it('disables Next and prevents keyboard or programmatic advancement when requested', () => {
    fixture.componentRef.setInput('nextDisabled', true);
    component.stepValid = false;
    const invalidNext = jasmine.createSpy('invalidNext');
    component.invalidNext.subscribe(invalidNext);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.stepper-actions .primary-action');
    expect(button.disabled).toBeTrue();
    component.next();
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    fixture.nativeElement.appendChild(input);
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(component.step).toBe(0);
    expect(invalidNext).not.toHaveBeenCalled();

    fixture.componentRef.setInput('nextDisabled', false);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
    button.click();
    expect(invalidNext).toHaveBeenCalledOnceWith(0);
  });

  it('goes back and stops at the last step', () => {
    component.next();
    component.next();
    component.next();
    expect(component.isLast).toBeTrue();
    component.back();
    expect(component.step).toBe(1);
  });

  it('starts at the requested step', () => {
    const f = TestBed.createComponent(FormStepperComponent);
    f.componentInstance.labels = ['A', 'B', 'C'];
    f.componentInstance.startStep = 2;
    f.detectChanges();
    expect(f.componentInstance.step).toBe(2);
  });

  it('uses theme surfaces for Next and both submit variants in light and dark themes', () => {
    for (const background of ['#eeeeee', '#222222']) {
      for (const variant of ['next', 'primary-action', 'save-action']) {
        const form = TestBed.createComponent(FormStepperComponent);
        form.componentInstance.labels = ['A', 'B', 'C'];
        form.componentInstance.startStep = variant === 'next' ? 0 : 2;
        form.componentInstance.submitClass = variant;
        form.componentInstance.submitDisabled = variant !== 'next';
        const host = form.nativeElement as HTMLElement;
        host.style.setProperty('--bg-color', background);
        host.style.setProperty('--green', '#ff671f');
        form.detectChanges();
        const button = host.querySelector('.stepper-actions button:last-child') as HTMLButtonElement;
        button.style.transition = 'none';
        expect(getComputedStyle(button).backgroundColor)
          .toBe(background === '#eeeeee' ? 'rgb(238, 238, 238)' : 'rgb(34, 34, 34)');
        expect(getComputedStyle(button).color).toBe('rgb(255, 103, 31)');
        if (variant !== 'next') {
          expect(button.disabled).toBeTrue();
          expect(getComputedStyle(button).opacity).toBe('0.55');
        }
        form.destroy();
      }
    }
  });
});
