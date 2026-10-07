import { Injectable } from '@angular/core';

const CONFIRMATION_CODE_SHA256 = '14570e86378155ff4e8c8fa1ff20a95e289bb0a05dd98a46c9c24f55c20071cd';

@Injectable({
  providedIn: 'root'
})
export class ConfirmationCodeService {
  async verify(code: string): Promise<boolean> {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(code)
    );
    const digestHex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return digestHex === CONFIRMATION_CODE_SHA256;
  }
}
