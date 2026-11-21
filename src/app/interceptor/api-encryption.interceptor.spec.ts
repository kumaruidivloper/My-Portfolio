import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiEncryptionInterceptor } from './api-encryption.interceptor';
import { ApiEncryptionService } from '../shared/service/api-encryption.service';
import { ACCESS_DETAILS_URL } from '../service/api-resource-urls';
import { MyAccessDataService } from '../shared/service/my-access-data.service';
import { PfDataService } from '../shared/service/pf-data.service';
import { TotalBalanceService } from '../shared/service/total-balance.service';

describe('ApiEncryptionInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let encryption: ApiEncryptionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ApiEncryptionService,
        { provide: TotalBalanceService, useValue: { syncTotals: () => undefined } },
        { provide: HTTP_INTERCEPTORS, useClass: ApiEncryptionInterceptor, multi: true }
      ]
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    encryption = TestBed.inject(ApiEncryptionService);
    encryption.setPassphrase('test passphrase');
  });

  afterEach(() => http.verify());

  it('loads PF records from encrypted fields and saves in the same format', async () => {
    const url = 'https://64b76091df0839c97e168d79.mockapi.io/bank/2';
    const service = TestBed.inject(PfDataService);
    const loaded = firstValueFrom(service.getPfData());
    http.expectOne(url).flush({
      id: '2',
      name: 'Test',
      description: 'Test',
      pfRecords: [{
        date: 'enc:AQEBAQEBAQEBAQEBO7/rFbZJsNuSi9QQtqzRBUy4IiClXDIP',
        pfAmount: 'enc:AgICAgICAgICAgICWNUNrPdLtCS6pfBXPJSJrIneV/8=',
        difference: 'enc:AwMDAwMDAwMDAwMDseN0Doao21MHoFhAOCcM8iqV'
      }]
    });
    const document = await loaded;
    expect(document.pfRecords).toEqual([{ date: "Sep'26", pfAmount: 1200, difference: 10 }]);

    const encrypt = spyOn(encryption, 'encryptFields').and.callThrough();
    const saved = firstValueFrom(service.updatePfData(document));
    await encrypt.calls.mostRecent().returnValue;
    await Promise.resolve();

    const request = http.expectOne(url);
    expect(request.request.body.id).toBe('2');
    expect(request.request.body.pfRecords[0].pfAmount).toMatch(/^enc:/);
    request.flush(request.request.body);
    await expectAsync(saved).toBeResolvedTo(document);
  });

  it('decrypts encrypted API reads while allowing legacy plaintext during migration', async () => {
    const encrypted = await encryption.encrypt({ name: 'Portfolio' });
    const decrypted = firstValueFrom(client.get<unknown>('https://64b76091df0839c97e168d79.mockapi.io/taskList/10'));
    http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/10').flush(encrypted);
    await expectAsync(decrypted).toBeResolvedTo({ name: 'Portfolio' });

    const legacy = firstValueFrom(client.get<unknown>('https://64b76091df0839c97e168d79.mockapi.io/taskList/8'));
    http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/8').flush({ name: 'Legacy' });
    await expectAsync(legacy).toBeResolvedTo({ name: 'Legacy' });
  });

  it('encrypts edited access records before saving and decrypts them on reload', async () => {
    const record = {
      type: 'Bank', customerName: 'Test User', bankName: 'Sample Bank',
      branch: 'Original Branch', accountName: 'Test Account', accountNumber: '1234567890',
      ifsc: 'TEST0001234', upi: '', accountType: 'Savings',
      userName: 'sample-user', password: 'sample-password', profilePassword: 'NA'
    };
    const document = {
      id: '10', _meta: { v: 1, salt: 'test-salt' },
      name: 'Test Access', type: 'Bank Access Details', bankAccessDetails: [record]
    };
    await encryption.decryptFields({ value: 'enc:AgICAgICAgICAgICWNUNrPdLtCS6pfBXPJSJrIneV/8=' });
    const encryptedDocument = await encryption.encryptFields(document);
    if (typeof encryptedDocument !== 'object' || encryptedDocument === null) {
      fail('Expected an encrypted API document.');
      return;
    }
    encryption.setPassphrase('test passphrase');

    let writeEncrypted!: () => void;
    const writeReady = new Promise<void>((resolve) => { writeEncrypted = resolve; });
    const encryptFields = encryption.encryptFields.bind(encryption);
    spyOn(encryption, 'encryptFields').and.callFake(async (value) => {
      const encrypted = await encryptFields(value);
      writeEncrypted();
      return encrypted;
    });

    const updated = { ...record, branch: 'Updated Branch', password: 'updated-password' };
    const saving = firstValueFrom(TestBed.inject(MyAccessDataService).updateAccessRecord(0, record, updated));
    const refresh = http.expectOne(ACCESS_DETAILS_URL);
    expect(refresh.request.method).toBe('GET');
    refresh.flush(encryptedDocument);
    await writeReady;
    await Promise.resolve();

    const save = http.expectOne(ACCESS_DETAILS_URL);
    expect(save.request.method).toBe('PUT');
    const payload = save.request.body;
    expect(payload.id).toBe('10');
    expect(payload._meta).toEqual(document._meta);
    expect(payload.name).toMatch(/^enc:/);
    expect(payload.type).toMatch(/^enc:/);
    for (const value of Object.values(payload.bankAccessDetails[0])) {
      expect(value).toEqual(jasmine.stringMatching(/^enc:/));
    }
    expect(JSON.stringify(payload)).not.toContain('Updated Branch');
    expect(JSON.stringify(payload)).not.toContain('updated-password');
    expect(JSON.stringify(payload)).not.toContain('test passphrase');

    const reader = new ApiEncryptionService();
    reader.setPassphrase('test passphrase');
    await expectAsync(reader.decryptFields(payload)).toBeResolvedTo({ ...document, bankAccessDetails: [updated] });
    reader.setPassphrase('wrong test passphrase');
    await expectAsync(reader.decryptFields(payload)).toBeRejected();

    save.flush(payload);
    expect((await saving).bankAccessDetails).toEqual([updated]);
    const reloaded = firstValueFrom(TestBed.inject(MyAccessDataService).getAccessDetails());
    http.expectOne(ACCESS_DETAILS_URL).flush(payload);
    expect((await reloaded).bankAccessDetails).toEqual([updated]);
  });

  it('does not send a write when the session key has not been verified', async () => {
    await encryption.decryptFields({ value: 'enc:AgICAgICAgICAgICWNUNrPdLtCS6pfBXPJSJrIneV/8=' });
    encryption.setPassphrase('unverified test passphrase');
    const saving = firstValueFrom(client.put(ACCESS_DETAILS_URL, { password: 'private value' }));
    await expectAsync(saving)
      .toBeRejectedWithError('Load encrypted API data with the correct encryption key before saving.');
    http.expectNone(ACCESS_DETAILS_URL);
  });

  it('does not encrypt requests to unrelated hosts', () => {
    client.put<unknown>('https://example.com/data', { value: 'unchanged' }).subscribe();
    const request = http.expectOne('https://example.com/data');
    expect(request.request.body).toEqual({ value: 'unchanged' });
    request.flush({});
  });
});
