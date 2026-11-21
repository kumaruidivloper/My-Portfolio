import { TestBed } from '@angular/core/testing';
import { QrCodeViewComponent } from './qr-code-view.component';

describe('QrCodeViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [QrCodeViewComponent] });
  });

  it('renders the latest input when values change before the generator loads', async () => {
    const fixture = TestBed.createComponent(QrCodeViewComponent);
    fixture.componentRef.setInput('data', 'first');
    fixture.detectChanges();
    fixture.componentRef.setInput('data', 'latest');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const expectedFixture = TestBed.createComponent(QrCodeViewComponent);
    expectedFixture.componentRef.setInput('data', 'latest');
    expectedFixture.detectChanges();
    await expectedFixture.whenStable();
    const expectedCanvas = expectedFixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, 200, 200).data;
    const expectedPixels = expectedCanvas.getContext('2d')!.getImageData(0, 0, 200, 200).data;

    expect(canvas.getAttribute('aria-label')).toBe('QR code for latest');
    expect(canvas.width).toBe(200);
    expect(pixels.every((value, index) => value === expectedPixels[index])).toBeTrue();
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(fixture.componentInstance.generationError).toBe('');
    fixture.destroy();
    expectedFixture.destroy();
  });

  it('clears loading and errors when input is removed', async () => {
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(QrCodeViewComponent);
    fixture.componentRef.setInput('data', 'x'.repeat(3000));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Could not generate the QR code');

    fixture.componentRef.setInput('data', '');
    fixture.detectChanges();
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
  });
});
