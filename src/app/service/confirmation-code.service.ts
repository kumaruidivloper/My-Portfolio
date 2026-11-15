import { Injectable } from '@angular/core';

const CONFIRMATION_CODE_SHA256 = '14570e86378155ff4e8c8fa1ff20a95e289bb0a05dd98a46c9c24f55c20071cd';

export async function hashConfirmationCode(code: string, subtle: SubtleCrypto | undefined): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = subtle
    ? new Uint8Array(await subtle.digest('SHA-256', bytes))
    : (await import('@noble/hashes/sha2.js')).sha256(bytes);
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationCodeService {
  async verify(code: string): Promise<boolean> {
    const digestHex = await hashConfirmationCode(code, globalThis.crypto?.subtle);
    return digestHex === CONFIRMATION_CODE_SHA256;
  }
}
