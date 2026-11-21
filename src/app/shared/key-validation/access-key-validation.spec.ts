import { fakeAsync, tick } from '@angular/core/testing';
import { AccessKeyValidation } from './access-key-validation';
import { ApiPayloadDecryptionError } from '../service/api-encryption.service';
import { ApiKeyValidationService } from '../service/api-key-validation.service';

describe('AccessKeyValidation', () => {
  let service: jasmine.SpyObj<ApiKeyValidationService>;
  let markForCheck: jasmine.Spy;
  let validation: AccessKeyValidation;

  beforeEach(() => {
    service = jasmine.createSpyObj<ApiKeyValidationService>('ApiKeyValidationService', ['verify']);
    markForCheck = jasmine.createSpy('markForCheck');
    validation = new AccessKeyValidation(service, markForCheck, true);
  });

  it('debounces key changes and verifies the latest destination', fakeAsync(() => {
    service.verify.and.resolveTo();
    validation.key = 'first-key';
    validation.onChange(() => 'dashboard');
    tick(200);
    validation.key = 'second-key';
    validation.onChange(() => 'my-access');

    tick(299);
    expect(service.verify).not.toHaveBeenCalled();
    tick(1);

    expect(service.verify).toHaveBeenCalledOnceWith('second-key', 'my-access');
    expect(validation.verified).toBeTrue();
    expect(validation.inProgress).toBeFalse();
    expect(markForCheck).toHaveBeenCalled();
  }));

  it('shares an in-flight validation and ignores its result after reset', async () => {
    let resolveVerification!: () => void;
    service.verify.and.returnValue(new Promise<void>((resolve) => resolveVerification = resolve));
    validation.key = 'secret-key';

    const first = validation.validate('dashboard');
    const second = validation.validate('dashboard');
    expect(second).toBe(first);
    expect(service.verify).toHaveBeenCalledTimes(1);

    validation.clear();
    resolveVerification();
    expect(await first).toBeFalse();
    expect(validation.verified).toBeFalse();
    expect(validation.key).toBe('');
    expect(markForCheck).not.toHaveBeenCalled();
  });

  it('reports decryption errors separately from verification failures', async () => {
    validation.key = 'secret-key';
    service.verify.and.rejectWith(new ApiPayloadDecryptionError());
    expect(await validation.validate('dashboard')).toBeFalse();
    expect(validation.error).toBe('Invalid key or damaged data. Try again.');

    service.verify.and.rejectWith(new Error('offline'));
    expect(await validation.validate('dashboard')).toBeFalse();
    expect(validation.error).toBe('Encryption key verification is unavailable. Please try again.');
    expect(validation.inProgress).toBeFalse();
  });

  it('does not verify an empty key or when encryption is unavailable', async () => {
    validation.key = '   ';
    expect(await validation.validate('dashboard')).toBeFalse();
    expect(validation.error).toBe('Enter the encryption key to continue.');

    const unavailable = new AccessKeyValidation(service, markForCheck, false);
    unavailable.key = 'secret-key';
    expect(await unavailable.validate('dashboard')).toBeFalse();
    expect(service.verify).not.toHaveBeenCalled();
  });
});
