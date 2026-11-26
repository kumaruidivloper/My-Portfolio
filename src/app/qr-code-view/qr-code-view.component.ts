import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, PendingTasks, ViewChild, inject } from '@angular/core';

@Component({
  selector: 'app-qr-code-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-code" [hidden]="!!generationError || loading">
      <canvas #canvas [attr.aria-label]="'QR code for ' + data" [title]="'QR Code For (' + data + ')'"></canvas>
      @if (!compact) {
        <img src="assets/img/user-img.jpg" alt="" width="50" height="50">
      }
    </div>
    @if (loading) {
      <p role="status">Loading QR code...</p>
    }
    @if (generationError) {
      <p role="alert">{{ generationError }}</p>
    }
  `,
  styles: [`
    .qr-code { position: relative; }
    canvas { display: block; }
    img { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    p { color: #000; line-height: 1.4; }
  `]
})
export class QrCodeViewComponent implements OnChanges, OnDestroy {
  @Input() data = '';
  @Input() compact = false;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  generationError = '';
  loading = false;
  private readonly pendingTasks = inject(PendingTasks);
  private readonly cdr = inject(ChangeDetectorRef);
  private qrCode?: typeof import('qrcode');
  private renderVersion = 0;

  ngOnChanges(): void {
    const version = ++this.renderVersion;
    const data = this.data;
    if (!data) {
      this.loading = false;
      this.generationError = '';
      return;
    }
    this.generationError = '';
    if (this.qrCode) {
      this.renderQrCode(this.qrCode, data);
      return;
    }

    this.loading = true;
    this.pendingTasks.run(async () => {
      try {
        const { default: qrCode } = await import('qrcode');
        if (version !== this.renderVersion) {
          return;
        }
        this.qrCode = qrCode;
        this.renderQrCode(qrCode, data);
      } catch (error) {
        if (version !== this.renderVersion) {
          return;
        }
        console.error('Failed to load QR code generator', error);
        this.generationError = 'Could not load the QR code generator. Refresh the page to retry.';
      } finally {
        if (version === this.renderVersion) {
          this.loading = false;
          this.cdr.markForCheck();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.renderVersion++;
  }

  private renderQrCode(qrCode: typeof import('qrcode'), data: string): void {
    qrCode.toCanvas(this.canvas.nativeElement, data, {
      errorCorrectionLevel: 'M',
      margin: this.compact ? 4 : 1,
      width: this.compact ? 96 : 200,
      color: { dark: '#000000ff', light: '#ffffffff' }
    }, (error) => {
      if (error) {
        console.error('Failed to generate QR code', error);
        this.generationError = 'Could not generate the QR code. Try shorter text.';
      }
    });
  }
}
