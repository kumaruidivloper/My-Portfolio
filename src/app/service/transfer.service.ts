import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { TransferApiDocument, TransferRecord } from '../model/transfer';

const TRANSFERS_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList';

function isTransferRecord(value: unknown): value is TransferRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record['dateOfTransfer'] === 'string'
    && typeof record['receivedDate'] === 'string'
    && typeof record['amountTransferredAUD'] === 'number'
    && Number.isFinite(record['amountTransferredAUD'])
    && typeof record['conversionRate'] === 'number'
    && Number.isFinite(record['conversionRate'])
    && typeof record['amountReceivedINR'] === 'number'
    && Number.isFinite(record['amountReceivedINR']);
}

export function parseTransferResponse(response: unknown): TransferRecord[] {
  const envelope = Array.isArray(response) ? response[0] : response;
  if (typeof envelope !== 'object' || envelope === null || !Array.isArray(envelope.transfers)) {
    throw new Error('The transfer API returned an empty response or no transfers list.');
  }

  if (!envelope.transfers.every(isTransferRecord)) {
    throw new Error('The transfer API returned a transfer with invalid fields.');
  }

  return envelope.transfers;
}

@Injectable({
  providedIn: 'root'
})
export class TransferService {
  constructor(private http: HttpClient) {}

  getTransfers(): Observable<TransferRecord[]> {
    return this.http.get<unknown>(TRANSFERS_API_URL).pipe(
      map(parseTransferResponse)
    );
  }

  updateTransfers(transfers: TransferRecord[]): Observable<TransferRecord[]> {
    const document: TransferApiDocument = { transfers };
    return this.http.post<unknown>(TRANSFERS_API_URL, document).pipe(
      map(parseTransferResponse)
    );
  }
}
