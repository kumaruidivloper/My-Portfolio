import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiEncryptionService, ApiPayloadDecryptionError } from './api-encryption.service';
import { ApiKeyValidationService } from './api-key-validation.service';
import { ACCESS_DETAILS_URL, PF_DATA_API_URL } from '../../service/api-resource-urls';

describe('ApiKeyValidationService', () => {
  let service: ApiKeyValidationService;
  let http: HttpTestingController;
  const encrypted = { id: '2', records: [{ value: 'enc:AgICAgICAgICAgICWNUNrPdLtCS6pfBXPJSJrIneV/8=' }] };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ApiKeyValidationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('verifies a key against encrypted fields without sending or retaining it', async () => {
    const verified = service.verify('test passphrase', 'dashboard');
    const request = http.expectOne(`${PF_DATA_API_URL}/2`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    expect(request.request.urlWithParams).not.toContain('test passphrase');
    expect(request.request.headers.keys()).toEqual([]);
    request.flush(encrypted);
    await expectAsync(verified).toBeResolved();
    expect(TestBed.inject(ApiEncryptionService).hasPassphrase).toBeFalse();
  });

  it('rejects a wrong key without retaining it', async () => {
    const verified = service.verify('wrong key', 'my-access');
    http.expectOne(ACCESS_DETAILS_URL).flush(encrypted);
    await expectAsync(verified).toBeRejectedWithError(ApiPayloadDecryptionError);
    expect(TestBed.inject(ApiEncryptionService).hasPassphrase).toBeFalse();
  });

  it('rejects plaintext and request failures instead of accepting an unverified key', async () => {
    const plaintext = service.verify('test passphrase', 'dashboard');
    http.expectOne(`${PF_DATA_API_URL}/2`).flush({ id: '2', records: [] });
    await expectAsync(plaintext).toBeRejectedWithError('No encrypted data is available to verify the encryption key.');

    const unavailable = service.verify('test passphrase', 'dashboard');
    http.expectOne(`${PF_DATA_API_URL}/2`).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await expectAsync(unavailable).toBeRejected();
  });

  it('verifies previously supported encrypted envelopes', async () => {
    const encryption = new ApiEncryptionService();
    encryption.setPassphrase('test passphrase');
    const envelope = await encryption.encrypt({ value: 'test' });
    const verified = service.verify('test passphrase', 'my-access');
    http.expectOne(ACCESS_DETAILS_URL).flush(envelope);
    await expectAsync(verified).toBeResolved();
  });
});
