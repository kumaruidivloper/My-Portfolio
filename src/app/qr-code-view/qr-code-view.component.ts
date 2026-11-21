import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { toCanvas } from 'qrcode';

@Component({
  selector: 'app-qr-code-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-code" [hidden]="generationError">
      <canvas #canvas [attr.aria-label]="'QR code for ' + data" [title]="'QR Code For (' + data + ')'"></canvas>
      <img src="assets/img/user-img.jpg" alt="" width="50" height="50">
    </div>
    @if (generationError) {
      <p role="alert">Could not generate the QR code. Try shorter text.</p>
    }
  `,
  styles: [`
    .qr-code { position: relative; }
    img { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    p { color: #000; line-height: 1.4; }
  `]
})
export class QrCodeViewComponent implements OnChanges {
  @Input() data = '';
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  generationError = false;

  ngOnChanges(): void {
    if (!this.data) {
      return;
    }
    toCanvas(this.canvas.nativeElement, this.data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
      color: { dark: '#000000ff', light: '#ffffffff' }
    }, (error) => {
      this.generationError = !!error;
      if (error) {
        console.error('Failed to generate QR code', error);
      }
    });
  }
}
