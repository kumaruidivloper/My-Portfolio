import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GratuityResourceId } from '../service/gratuity-data.service';
import { VasukiGratuityComponent } from './vasuki-gratuity.component';

@Component({
  selector: 'app-kumar-gratuity',
  template: '',
  standalone: false
})
class KumarGratuityStubComponent {
  @Input() resourceId: GratuityResourceId = '4';
  @Input() ownerName = 'Kumar';
}

describe('VasukiGratuityComponent', () => {
  let fixture: ComponentFixture<VasukiGratuityComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VasukiGratuityComponent, KumarGratuityStubComponent]
    });
    fixture = TestBed.createComponent(VasukiGratuityComponent);
    fixture.detectChanges();
  });

  it('configures the shared history component for Vasuki Gratuity resource 5', () => {
    const sharedComponent = fixture.debugElement.query(
      By.directive(KumarGratuityStubComponent)
    ).componentInstance as KumarGratuityStubComponent;

    expect(sharedComponent.resourceId).toBe('5');
    expect(sharedComponent.ownerName).toBe('Vasuki');
  });
});
