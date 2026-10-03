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
});
