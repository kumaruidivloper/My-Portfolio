import { Injectable } from '@angular/core';

const CONFIRMATION_CODE_SHA256 = '373b9ea53bdd5a5bac3a41351d919bad6cde49a21d1c45021114f9ffa73b1855';

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
