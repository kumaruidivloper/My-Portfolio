import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GratuityResourceId } from '../service/gratuity-data.service';
import { VasukiSuperComponent } from './vasuki-super.component';

@Component({
  selector: 'app-kumar-gratuity',
  template: '',
  standalone: false
})
class KumarGratuityStubComponent {
  @Input() resourceId: GratuityResourceId = '4';
  @Input() ownerName = 'Kumar';
}

describe('VasukiSuperComponent', () => {
  let fixture: ComponentFixture<VasukiSuperComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VasukiSuperComponent, KumarGratuityStubComponent]
    });
    fixture = TestBed.createComponent(VasukiSuperComponent);
    fixture.detectChanges();
  });

  it('configures the shared history component for Vasuki Super resource 6', () => {
    const sharedComponent = fixture.debugElement.query(
      By.directive(KumarGratuityStubComponent)
    ).componentInstance as KumarGratuityStubComponent;

    expect(sharedComponent.resourceId).toBe('6');
    expect(sharedComponent.ownerName).toBe('Vasuki');
  });
});
