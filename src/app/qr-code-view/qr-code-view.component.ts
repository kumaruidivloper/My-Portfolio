import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { QRCodeModule } from 'angularx-qrcode';

/** Standalone wrapper so the QR code library is split into its own chunk and loaded on first use. */
@Component({
  selector: 'app-qr-code-view',
  imports: [QRCodeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--[imageSrc]="'assets/img/user-img.jpg'" we can add this prop to add image QR code center-->
    <qrcode class="qr-code-placeholder"
      [qrdata]="data"
      [allowEmptyString]="true"
      [ariaLabel]="'QR Code image with the following content...'"
      [cssClass]="'center'"
      [colorDark]="'#000000ff'"
      [colorLight]="'#ffffffff'"
      [elementType]="'canvas'"
      [imageSrc]="'assets/img/user-img.jpg'"
      [errorCorrectionLevel]="'M'"
      [imageHeight]="50"
      [imageWidth]="50"
      [margin]="1"
      [scale]="1"
      [title]="'QR Code For' + ' ' + '(' + data + ')'"
      [width]="200"
    ></qrcode>
  `
})
export class QrCodeViewComponent {
  @Input() data = '';
}
