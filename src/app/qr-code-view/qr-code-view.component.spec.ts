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

  it('renders compact codes without a portrait and with a four-module quiet zone', async () => {
    const fixture = TestBed.createComponent(QrCodeViewComponent);
    fixture.componentRef.setInput('data', 'Company A\nFrom: 2020\nTo: 2022');
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(96);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, 96, 96).data;
    let hasBlack = false;
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        const red = pixels[(y * 96 + x) * 4];
        if (x < 8 || y < 8 || x >= 88 || y >= 88) {
          expect(red).toBe(255);
        }
        hasBlack ||= red === 0;
      }
    }
    expect(hasBlack).toBeTrue();
    fixture.destroy();
  });

  it('updates an existing QR code without hiding it or showing a loading message', async () => {
    const fixture = TestBed.createComponent(QrCodeViewComponent);
    fixture.componentRef.setInput('data', 'first');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const previousPixels = canvas.getContext('2d')!.getImageData(0, 0, 200, 200).data;
    fixture.componentRef.setInput('data', 'second');
    fixture.detectChanges();

    const currentPixels = canvas.getContext('2d')!.getImageData(0, 0, 200, 200).data;
    expect(canvas.parentElement!.hidden).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(canvas.getAttribute('aria-label')).toBe('QR code for second');
    expect(currentPixels.some((value, index) => value !== previousPixels[index])).toBeTrue();
    fixture.destroy();
  });

  it('hides an outdated QR code on a generation error and renders it again after correction', async () => {
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(QrCodeViewComponent);
    fixture.componentRef.setInput('data', 'first');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    fixture.componentRef.setInput('data', 'x'.repeat(3000));
    fixture.detectChanges();
    expect(canvas.parentElement!.hidden).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Could not generate the QR code');

    fixture.componentRef.setInput('data', 'corrected');
    fixture.detectChanges();
    expect(canvas.parentElement!.hidden).toBeFalse();
    expect(canvas.getAttribute('aria-label')).toBe('QR code for corrected');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
  });
});
