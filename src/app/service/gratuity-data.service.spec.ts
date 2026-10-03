import { TotalBalanceService } from './total-balance.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GratuityDataService, parseGratuityDataResponse } from './gratuity-data.service';

const GRATUITY_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/4';
const VASUKI_GRATUITY_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/5';
const VASUKI_SUPER_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/6';

describe('GratuityDataService', () => {
  let service: GratuityDataService;
  let http: HttpTestingController;
  const response = {
    id: '4',
    name: 'Kumar',
    title: 'Invalid faker method - random.word',
    description: 'Invalid faker method - random.word',
    type: 'Gratuity',
    gratuityRecords: [
      { date: "Sep'26", gratuity: 262985, difference: 0 },
      { date: "Aug'26", gratuity: 262985, difference: 0 },
      { date: "July'26", gratuity: 262985, difference: 0 },
      { date: "June'26", gratuity: 262985, difference: 0 }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: TotalBalanceService, useValue: { syncTotals: () => undefined } }]
    });
    service = TestBed.inject(GratuityDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads Kumar gratuity records from resource 4', () => {
    service.getGratuityData('4').subscribe((data) => expect(data).toEqual(response));

    const request = http.expectOne(GRATUITY_API_URL);
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('updates the full gratuity document and preserves its metadata', () => {
    const updated = {
      ...response,
      gratuityRecords: [{ date: "Sep'26", gratuity: 270000, difference: 10 }]
    };
    service.updateGratuityData(updated, '4').subscribe((data) => expect(data).toEqual(updated));

    const request = http.expectOne(GRATUITY_API_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updated);
    request.flush(updated);
  });

  it('loads Vasuki gratuity records from resource 5', () => {
    const vasukiResponse = { ...response, id: '5', name: 'Vasu' };

    service.getGratuityData('5').subscribe((data) => expect(data).toEqual(vasukiResponse));

    const request = http.expectOne(VASUKI_GRATUITY_API_URL);
    expect(request.request.method).toBe('GET');
    request.flush(vasukiResponse);
  });

  it('updates only Vasuki gratuity resource 5', () => {
    const document = { ...response, id: '5', name: 'Vasu' };

    service.updateGratuityData(document, '5').subscribe((data) => expect(data).toEqual(document));

    const request = http.expectOne(VASUKI_GRATUITY_API_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(document);
    request.flush(document);
  });

  it('loads Vasuki super records and normalizes them for the shared history UI', () => {
    const response = {
      id: '6',
      name: 'Vasu',
      title: 'Super history',
      description: 'Monthly super history',
      type: 'Super',
      superRecords: [
        { date: "Sep'26", super: 1067372, difference: 14177 },
        { date: "Aug'26", super: 1053195, difference: 14127 }
      ]
    };

    service.getGratuityData('6').subscribe((data) => {
      expect(data).toEqual({
        id: '6',
        name: 'Vasu',
        title: 'Super history',
        description: 'Monthly super history',
        type: 'Super',
        gratuityRecords: [
          { date: "Sep'26", gratuity: 1067372, difference: 14177 },
          { date: "Aug'26", gratuity: 1053195, difference: 14127 }
        ]
      });
    });

    const request = http.expectOne(VASUKI_SUPER_API_URL);
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('writes edits to resource 6 using its superRecords payload shape', () => {
    const document = {
      id: '6',
      name: 'Vasu',
      title: 'Super history',
      description: 'Monthly super history',
      type: 'Super',
      gratuityRecords: [
        { date: "Sep'26", gratuity: 1070000, difference: 2628 }
      ]
    };
    service.updateGratuityData(document, '6').subscribe((data) => {
      expect(data.gratuityRecords).toEqual([
        { date: "Sep'26", gratuity: 1070000, difference: 2628 }
      ]);
    });

    const request = http.expectOne(VASUKI_SUPER_API_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      id: '6',
      name: 'Vasu',
      title: 'Super history',
      description: 'Monthly super history',
      type: 'Super',
      superRecords: [
        { date: "Sep'26", super: 1070000, difference: 2628 }
      ]
    });
    request.flush({
      id: '6',
      name: 'Vasu',
      title: 'Super history',
      description: 'Monthly super history',
      type: 'Super',
      superRecords: [
        { date: "Sep'26", super: 1070000, difference: 2628 }
      ]
    });
  });
});

describe('parseGratuityDataResponse', () => {
  it('rejects records with invalid numeric fields', () => {
    expect(() => parseGratuityDataResponse({
      gratuityRecords: [{ date: "Sep'26", gratuity: '262985', difference: 0 }]
    })).toThrowError('The gratuity data API returned a record with invalid fields.');
  });
});
