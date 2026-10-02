import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { parseTransferResponse } from './transfer.service';
import { TransferService } from './transfer.service';

const TRANSFERS_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList';
const TRANSFERS_RESOURCE_URL = `${TRANSFERS_API_URL}/1`;

describe('TransferService', () => {
  let service: TransferService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TransferService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updates the existing transfer resource instead of creating a duplicate', () => {
    const updatedTransfers = [{
      dateOfTransfer: '29-Sep-23',
      amountTransferredAUD: 9985,
      conversionRate: 53.52,
      receivedDate: '05-Oct-23',
      amountReceivedINR: 535200
    }];
    let result: typeof updatedTransfers | undefined;

    service.updateTransfers(updatedTransfers).subscribe((transfers) => {
      result = transfers;
    });

    const request = http.expectOne(TRANSFERS_RESOURCE_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ transfers: updatedTransfers });
    request.flush({ transfers: updatedTransfers });

    expect(result).toEqual(updatedTransfers);
  });
});

describe('parseTransferResponse', () => {
  const transfer = {
    dateOfTransfer: '29-Sep-23',
    amountTransferredAUD: 9985,
    conversionRate: 53.52,
    receivedDate: '05-Oct-23',
    amountReceivedINR: 535200
  };

  it('extracts typed transfer entries from the API envelope', () => {
    expect(parseTransferResponse([{ transfers: [transfer] }])).toEqual([transfer]);
  });

  it('extracts typed transfer entries from a single-resource response', () => {
    expect(parseTransferResponse({ transfers: [transfer] })).toEqual([transfer]);
  });

  it('rejects transfer records that do not match the API contract', () => {
    expect(() => parseTransferResponse([{ transfers: [{ ...transfer, conversionRate: '53.52' }] }]))
      .toThrowError('The transfer API returned a transfer with invalid fields.');
  });

  it('rejects an unexpected API response shape', () => {
    expect(() => parseTransferResponse({ data: [transfer] }))
      .toThrowError('The transfer API returned an empty response or no transfers list.');
  });
});
