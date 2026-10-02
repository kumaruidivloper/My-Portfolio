import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PfDataService, parsePfDataResponse } from './pf-data.service';

const PF_DATA_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/2';

describe('PfDataService', () => {
  let service: PfDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PfDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads PF data from the configured resource', () => {
    const response = {
      id: '2',
      name: 'Kumar',
      description: 'Provident fund history',
      pfRecords: [{ date: "Sep'26", pfAmount: 2066449, difference: 23709 }]
    };
    let result: typeof response | undefined;

    service.getPfData().subscribe((data) => result = data);

    const request = http.expectOne(PF_DATA_API_URL);
    expect(request.request.method).toBe('GET');
    request.flush(response);
    expect(result).toEqual(response);
  });

  it('updates the existing PF resource with the full record list', () => {
    const document = {
      id: '2',
      name: 'Kumar',
      description: 'Provident fund history',
      pfRecords: [{ date: "Sep'26", pfAmount: 2067000, difference: 24000 }]
    };
    let result: typeof document | undefined;

    service.updatePfData(document).subscribe((data) => result = data);

    const request = http.expectOne(PF_DATA_API_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(document);
    request.flush(document);
    expect(result).toEqual(document);
  });
});

describe('parsePfDataResponse', () => {
  it('rejects malformed PF record values', () => {
    expect(() => parsePfDataResponse({
      pfRecords: [{ date: "Sep'26", pfAmount: '2066449', difference: 23709 }]
    })).toThrowError('The PF data API returned a record with invalid fields.');
  });
});
