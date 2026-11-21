import { Injectable } from '@angular/core';

const ENCRYPTED_PAYLOAD_FORMAT = 'portfolio-api-encrypted-v2';
const LEGACY_ENCRYPTED_PAYLOAD_FORMAT = 'portfolio-api-encrypted-v1';
const PBKDF2_ITERATIONS = 310_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const FIELD_SALT = 'HVZGCrs6T32WkRhgolZmkA==';
const ENCRYPTED_FIELD_PREFIX = 'enc:';

export interface EncryptedApiPayload {
  format: typeof ENCRYPTED_PAYLOAD_FORMAT;
  _meta: {
    salt: string;
    iv: string;
    iterations: number;
  };
  ciphertext: string;
}

export class ApiPayloadDecryptionError extends Error {
  constructor() {
    super('Could not decrypt API data. Check the encryption key and stored payload.');
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsEncryptedField(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.startsWith(ENCRYPTED_FIELD_PREFIX);
  }
  if (Array.isArray(value)) {
    return value.some(containsEncryptedField);
  }
  return isRecord(value) && Object.entries(value).some(([key, child]) =>
    key !== '_meta' && containsEncryptedField(child)
  );
}

@Injectable({ providedIn: 'root' })
export class ApiEncryptionService {
  private passphrase = '';
  private fieldKeyVerified = false;

  get hasPassphrase(): boolean {
    return this.passphrase !== '';
  }

  get hasVerifiedEncryptedField(): boolean {
    return this.fieldKeyVerified;
  }

  setPassphrase(passphrase: string): void {
    if (!passphrase.trim()) {
      throw new Error('Enter an encryption key.');
    }
    this.passphrase = passphrase;
    this.fieldKeyVerified = false;
  }

  clearPassphrase(): void {
    this.passphrase = '';
    this.fieldKeyVerified = false;
  }

  async decryptFields(value: unknown): Promise<unknown> {
    if (!containsEncryptedField(value)) {
      return value;
    }

    const subtle = this.subtleCrypto();
    const passphrase = this.passphrase;
    const key = await this.deriveKey(subtle, base64ToBytes(FIELD_SALT), PBKDF2_ITERATIONS);

    const decryptValue = async (item: unknown): Promise<unknown> => {
      if (typeof item === 'string' && item.startsWith(ENCRYPTED_FIELD_PREFIX)) {
        try {
          const bytes = base64ToBytes(item.slice(ENCRYPTED_FIELD_PREFIX.length));
          if (bytes.length < 28) {
            throw new Error('Invalid encrypted field.');
          }
          const plaintext = await subtle.decrypt(
            { name: 'AES-GCM', iv: bytes.slice(0, 12), tagLength: 128 },
            key,
            bytes.slice(12)
          );
          return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as unknown;
        } catch {
          throw new ApiPayloadDecryptionError();
        }
      }
      if (Array.isArray(item)) {
        return Promise.all(item.map(decryptValue));
      }
      if (isRecord(item)) {
        const entries = await Promise.all(Object.entries(item).map(async ([name, child]) =>
          [name, name === '_meta' ? child : await decryptValue(child)] as const
        ));
        return Object.fromEntries(entries);
      }
      return item;
    };

    const result = await decryptValue(value);
    if (passphrase !== this.passphrase) {
      throw new ApiPayloadDecryptionError();
    }
    this.fieldKeyVerified = true;
    return result;
  }

  async encryptFields(value: unknown): Promise<unknown> {
    if (!this.fieldKeyVerified) {
      throw new Error('Load encrypted API data with the correct encryption key before saving.');
    }
    const subtle = this.subtleCrypto();
    const passphrase = this.passphrase;
    const key = await this.deriveKey(subtle, base64ToBytes(FIELD_SALT), PBKDF2_ITERATIONS);

    const encryptValue = async (item: unknown): Promise<unknown> => {
      if (Array.isArray(item)) {
        return Promise.all(item.map(encryptValue));
      }
      if (isRecord(item)) {
        const entries = await Promise.all(Object.entries(item).map(async ([name, child]) =>
          [name, name === 'id' || name === '_meta' ? child : await encryptValue(child)] as const
        ));
        return Object.fromEntries(entries);
      }
      const serialized = JSON.stringify(item);
      if (serialized === undefined) {
        throw new Error('API data could not be serialized for encryption.');
      }
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
      const ciphertext = new Uint8Array(await subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        new TextEncoder().encode(serialized)
      ));
      const combined = new Uint8Array(iv.length + ciphertext.length);
      combined.set(iv);
      combined.set(ciphertext, iv.length);
      return ENCRYPTED_FIELD_PREFIX + bytesToBase64(combined);
    };

    const result = await encryptValue(value);
    if (passphrase !== this.passphrase || !this.fieldKeyVerified) {
      throw new Error('The encryption key changed before saving. Reload the API data and try again.');
    }
    return result;
  }

  async encrypt(value: unknown): Promise<EncryptedApiPayload> {
    const subtle = this.subtleCrypto();
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const key = await this.deriveKey(subtle, salt, PBKDF2_ITERATIONS);
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error('API data could not be serialized for encryption.');
    }
    const plaintext = new TextEncoder().encode(serialized);
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);

    return {
      format: ENCRYPTED_PAYLOAD_FORMAT,
      _meta: {
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        iterations: PBKDF2_ITERATIONS
      },
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    };
  }

  async decryptIfEncrypted(value: unknown): Promise<unknown> {
    if (!isRecord(value)) {
      return value;
    }

    const format = value['format'];
    const metadata = value['_meta'];
    const hasCiphertextMetadata = isRecord(metadata)
      && typeof metadata['salt'] === 'string'
      && typeof value['ciphertext'] === 'string';
    const hasEncryptedFormat = typeof format === 'string' && format.startsWith('portfolio-api-encrypted-');
    if (!hasEncryptedFormat && !hasCiphertextMetadata) {
      return value;
    }
    if (format === LEGACY_ENCRYPTED_PAYLOAD_FORMAT) {
      return this.decryptPayload(value['salt'], value['iv'], PBKDF2_ITERATIONS, value['ciphertext']);
    }
    if ((format !== undefined && format !== ENCRYPTED_PAYLOAD_FORMAT)
      || !isRecord(metadata)
      || typeof metadata['salt'] !== 'string'
      || typeof metadata['iv'] !== 'string'
      || typeof metadata['iterations'] !== 'number'
      || !Number.isSafeInteger(metadata['iterations'])
      || metadata['iterations'] < 1
      || metadata['iterations'] > MAX_PBKDF2_ITERATIONS
      || typeof value['ciphertext'] !== 'string') {
      throw new ApiPayloadDecryptionError();
    }

    return this.decryptPayload(metadata['salt'], metadata['iv'], metadata['iterations'], value['ciphertext']);
  }

  private async decryptPayload(
    saltValue: unknown,
    ivValue: unknown,
    iterations: number,
    ciphertextValue: unknown
  ): Promise<unknown> {
    if (typeof saltValue !== 'string' || typeof ivValue !== 'string' || typeof ciphertextValue !== 'string') {
      throw new ApiPayloadDecryptionError();
    }
    const subtle = this.subtleCrypto();
    try {
      const salt = base64ToBytes(saltValue);
      const iv = base64ToBytes(ivValue);
      const key = await this.deriveKey(subtle, salt, iterations);
      const plaintext = await subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        base64ToBytes(ciphertextValue)
      );
      return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    } catch {
      throw new ApiPayloadDecryptionError();
    }
  }

  private async deriveKey(
    subtle: SubtleCrypto,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number
  ): Promise<CryptoKey> {
    if (!this.passphrase) {
      throw new Error('Enter the encryption key to access API data.');
    }
    const material = await subtle.importKey(
      'raw',
      new TextEncoder().encode(this.passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private subtleCrypto(): SubtleCrypto {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !globalThis.crypto.getRandomValues) {
      throw new Error('Secure browser cryptography is unavailable. Use HTTPS or localhost.');
    }
    return subtle;
  }
}
