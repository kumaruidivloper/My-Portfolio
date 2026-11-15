import { ConfirmationCodeService, hashConfirmationCode } from './confirmation-code.service';

describe('Confirmation code verification', () => {
  it('uses the same SHA-256 digest when Web Crypto is unavailable', async () => {
    const code = '12345678901234';
    const nativeHash = await hashConfirmationCode(code, globalThis.crypto.subtle);
    expect(await hashConfirmationCode(code, undefined)).toBe(nativeHash);
    expect(await hashConfirmationCode('abc', undefined)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('rejects an incorrect code', async () => {
    expect(await new ConfirmationCodeService().verify('12345678901234')).toBeFalse();
  });

  it('rejects an incorrect code without Web Crypto instead of failing verification', async () => {
    const crypto = globalThis.crypto;
    const original = Object.getOwnPropertyDescriptor(crypto, 'subtle');
    Object.defineProperty(crypto, 'subtle', { configurable: true, value: undefined });
    try {
      expect(await new ConfirmationCodeService().verify('12345678901234')).toBeFalse();
    } finally {
      if (original) {
        Object.defineProperty(crypto, 'subtle', original);
      } else {
        Reflect.deleteProperty(crypto, 'subtle');
      }
    }
  });
});
