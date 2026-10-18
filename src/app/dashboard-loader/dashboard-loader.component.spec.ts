import { TestBed } from '@angular/core/testing';
import { DashboardLoaderComponent } from './dashboard-loader.component';

describe('DashboardLoaderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [DashboardLoaderComponent] });
  });

  it('renders an accessible spinner without visible text', () => {
    const fixture = TestBed.createComponent(DashboardLoaderComponent);
    fixture.componentRef.setInput('label', 'Loading PF records');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-label')).toBe('Loading PF records');
    expect(host.querySelector('.loader-ring')).not.toBeNull();
    expect(host.textContent?.trim()).toBe('');
    expect(host.classList).not.toContain('inline');
  });

  it('supports a compact inline variant', () => {
    const fixture = TestBed.createComponent(DashboardLoaderComponent);
    fixture.componentRef.setInput('inline', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).classList).toContain('inline');
  });
});
