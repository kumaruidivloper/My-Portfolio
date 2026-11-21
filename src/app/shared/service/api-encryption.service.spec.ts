import { ApiEncryptionService, EncryptedApiPayload } from './api-encryption.service';

describe('ApiEncryptionService', () => {
  let service: ApiEncryptionService;

  beforeEach(() => {
    service = new ApiEncryptionService();
    service.setPassphrase('runtime test passphrase');
  });

  it('encrypts and decrypts API values without changing their shape', async () => {
    const original = { id: '2', pfRecords: [{ date: "Sep'26", pfAmount: 1200, difference: 10 }] };

    const encrypted = await service.encrypt(original);

    expect(encrypted.format).toBe('portfolio-api-encrypted-v2');
    expect(encrypted._meta.iterations).toBe(310_000);
    expect(encrypted._meta.salt).toBeTruthy();
    expect(JSON.stringify(encrypted)).not.toContain('pfRecords');
    await expectAsync(service.decryptIfEncrypted(encrypted)).toBeResolvedTo(original);
  });

  it('uses the iteration count stored in encrypted metadata', async () => {
    const subtle = globalThis.crypto.subtle;
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const material = await subtle.importKey(
      'raw',
      new TextEncoder().encode('runtime test passphrase'),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 25_000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const plaintext = new TextEncoder().encode(JSON.stringify({ value: 'metadata iterations' }));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);
    const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));

    const encrypted: EncryptedApiPayload = {
      format: 'portfolio-api-encrypted-v2',
      _meta: { salt: toBase64(salt), iv: toBase64(iv), iterations: 25_000 },
      ciphertext: toBase64(new Uint8Array(ciphertext))
    };

    await expectAsync(service.decryptIfEncrypted(encrypted)).toBeResolvedTo({ value: 'metadata iterations' });
  });

  it('rejects encrypted data when the runtime key is incorrect', async () => {
    const encrypted = await service.encrypt({ value: 'private' });
    service.setPassphrase('different runtime key');

    await expectAsync(service.decryptIfEncrypted(encrypted))
      .toBeRejectedWithError('Could not decrypt API data. Check the encryption key and stored payload.');
  });

  it('decrypts individually encrypted fields into their original JSON types', async () => {
    service.setPassphrase('test passphrase');
    const response = {
      id: '2',
      pfRecords: [{
        date: 'enc:AQEBAQEBAQEBAQEBO7/rFbZJsNuSi9QQtqzRBUy4IiClXDIP',
        pfAmount: 'enc:AgICAgICAgICAgICWNUNrPdLtCS6pfBXPJSJrIneV/8=',
        difference: 'enc:AwMDAwMDAwMDAwMDseN0Doao21MHoFhAOCcM8iqV'
      }]
    };

    await expectAsync(service.decryptFields(response)).toBeResolvedTo({
      id: '2',
      pfRecords: [{ date: "Sep'26", pfAmount: 1200, difference: 10 }]
    });

    const encrypted = await service.encryptFields({
      id: '2',
      pfRecords: [{ date: "Sep'26", pfAmount: 1200, difference: 10 }]
    });
    expect(encrypted).toEqual(jasmine.objectContaining({ id: '2' }));
    expect(JSON.stringify(encrypted)).not.toContain('1200');
    await expectAsync(service.decryptFields(encrypted)).toBeResolvedTo({
      id: '2',
      pfRecords: [{ date: "Sep'26", pfAmount: 1200, difference: 10 }]
    });
  });

  it('does not save with a key that has not decrypted a field', async () => {
    service.setPassphrase('wrong key');
    await expectAsync(service.decryptFields({ value: 'enc:AQEBAQEBAQEBAQEBO7/rFbZJsNuSi9QQtqzRBUy4IiClXDIP' }))
      .toBeRejectedWithError('Could not decrypt API data. Check the encryption key and stored payload.');
    await expectAsync(service.encryptFields({ id: '2', value: 100 }))
      .toBeRejectedWithError('Load encrypted API data with the correct encryption key before saving.');
  });

  it('rejects a malformed encrypted field instead of displaying it', async () => {
    service.setPassphrase('test passphrase');
    await expectAsync(service.decryptFields({ nested: ['enc:not-valid'] }))
      .toBeRejectedWithError('Could not decrypt API data. Check the encryption key and stored payload.');
  });

  it('continues to decrypt the previous envelope format', async () => {
    const original = { value: 'legacy encrypted format' };
    const encrypted = await service.encrypt(original);
    const legacy = {
      format: 'portfolio-api-encrypted-v1',
      salt: encrypted._meta.salt,
      iv: encrypted._meta.iv,
      ciphertext: encrypted.ciphertext
    };

    await expectAsync(service.decryptIfEncrypted(legacy)).toBeResolvedTo(original);
  });

  it('keeps legacy plaintext responses readable during migration', async () => {
    const legacy = { name: 'Portfolio', intro: [] };

    await expectAsync(service.decryptIfEncrypted(legacy)).toBeResolvedTo(legacy);
  });

  it('rejects unknown encrypted payload versions', async () => {
    const encrypted = {
      format: 'portfolio-api-encrypted-v2',
      _meta: { salt: '', iv: '', iterations: 310_000 },
      ciphertext: ''
    };

    await expectAsync(service.decryptIfEncrypted(encrypted))
      .toBeRejectedWithError('Could not decrypt API data. Check the encryption key and stored payload.');
  });
});
