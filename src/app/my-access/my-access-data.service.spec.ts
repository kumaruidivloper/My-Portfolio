import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccessRecordChangedError, MyAccessDataService } from './my-access-data.service';

describe('MyAccessDataService updates', () => {
  const endpoint = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/10';
  const record = {
    type: 'Bank', customerName: 'Test User', bankName: 'Sample Bank',
    branch: 'Sample Branch', accountName: 'Test Account', accountNumber: '1234567890',
    ifsc: 'TEST0001234', upi: '', accountType: 'Savings',
    userName: 'sample-user', password: 'sample-password', profilePassword: 'NA'
  };
  const document = { name: 'Test Access', type: 'Bank Access Details', bankAccessDetails: [record] };
  let service: MyAccessDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MyAccessDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updates only the selected record while preserving the latest other records and extra fields', () => {
    const other = { ...record, customerName: 'Other User' };
    const latest = { ...document, description: 'Preserve metadata', bankAccessDetails: [{ ...record, extra: 'keep' }, other] };
    const updated = { ...record, branch: 'New Branch' };
    const expectedRecords = [{ ...record, extra: 'keep', branch: 'New Branch' }, other];
    service.updateAccessRecord(0, record, updated).subscribe((result) => {
      expect(result.bankAccessDetails).toEqual(expectedRecords);
    });

    const load = http.expectOne(endpoint);
    expect(load.request.method).toBe('GET');
    load.flush(latest);
    const save = http.expectOne(endpoint);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ ...latest, bankAccessDetails: expectedRecords });
    save.flush({ ...latest, bankAccessDetails: expectedRecords });
  });

  it('rejects a changed or removed record without issuing an update', () => {
    for (const records of [[{ ...record, branch: 'Changed elsewhere' }], []]) {
      let error: unknown;
      service.updateAccessRecord(0, record, { ...record, branch: 'New Branch' }).subscribe({
        error: (result: unknown) => error = result
      });
      http.expectOne(endpoint).flush({ ...document, bankAccessDetails: records });
      expect(error).toEqual(jasmine.any(AccessRecordChangedError));
      http.expectNone(endpoint);
    }
  });
});
