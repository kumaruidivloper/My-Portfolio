import { ApiPayloadDecryptionError } from '../service/api-encryption.service';
import { ApiKeyValidationService } from '../service/api-key-validation.service';
import { ProtectedDestination } from '../../service/dashboard-access.guard';

export class AccessKeyValidation {
  key = '';
  error = '';
  inProgress = false;
  verified = false;
  private version = 0;
  private validation?: Promise<boolean>;
  private timeout?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly service: Pick<ApiKeyValidationService, 'verify'>,
    private readonly markForCheck: () => void,
    readonly available = !!globalThis.crypto?.subtle
  ) {}

  onChange(getTarget: () => ProtectedDestination): void {
    this.error = '';
    this.reset();
    if (this.available && this.key.length >= 8 && this.key.trim()) {
      this.inProgress = true;
      this.timeout = setTimeout(() => {
        this.timeout = undefined;
        void this.validate(getTarget());
      }, 300);
    }
  }

  validate(target: ProtectedDestination): Promise<boolean> {
    if (!this.available) {
      return Promise.resolve(false);
    }
    if (!this.key.trim()) {
      this.error = 'Enter the encryption key to continue.';
      return Promise.resolve(false);
    }
    if (this.verified) {
      return Promise.resolve(true);
    }
    if (this.validation) {
      return this.validation;
    }
    clearTimeout(this.timeout);
    this.timeout = undefined;
    const version = this.version;
    this.error = '';
    this.inProgress = true;
    this.validation = this.service.verify(this.key, target)
      .then(() => {
        if (version !== this.version) {
          return false;
        }
        this.verified = true;
        return true;
      })
      .catch((error: unknown) => {
        if (version === this.version) {
          this.error = error instanceof ApiPayloadDecryptionError
            ? 'Invalid key or damaged data. Try again.'
            : 'Encryption key verification is unavailable. Please try again.';
        }
        return false;
      })
      .finally(() => {
        if (version === this.version) {
          this.inProgress = false;
          this.validation = undefined;
          this.markForCheck();
        }
      });
    return this.validation;
  }

  reset(): void {
    this.version++;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.validation = undefined;
    this.inProgress = false;
    this.verified = false;
  }

  clear(): void {
    this.key = '';
    this.error = '';
    this.reset();
  }
}
