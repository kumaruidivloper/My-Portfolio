import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { PfApiDocument, PfRecord } from '../model/pf-record';

const PF_DATA_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/2';

function isPfRecord(value: unknown): value is PfRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record['date'] === 'string'
    && typeof record['pfAmount'] === 'number'
    && Number.isFinite(record['pfAmount'])
    && typeof record['difference'] === 'number'
    && Number.isFinite(record['difference']);
}

export function parsePfDataResponse(response: unknown): PfApiDocument {
  if (typeof response !== 'object' || response === null) {
    throw new Error('The PF data API returned an unexpected response.');
  }

  const document = response as Record<string, unknown>;
  const records = document['pfRecords'];
  if (!Array.isArray(records)) {
    throw new Error('The PF data API returned an unexpected response.');
  }

  if (!records.every(isPfRecord)) {
    throw new Error('The PF data API returned a record with invalid fields.');
  }

  return {
    id: typeof document['id'] === 'string' ? document['id'] : '',
    name: typeof document['name'] === 'string' ? document['name'] : 'Kumar',
    description: typeof document['description'] === 'string' ? document['description'] : '',
    pfRecords: records
  };
}

@Injectable({
  providedIn: 'root'
})
export class PfDataService {
  constructor(private http: HttpClient) {}

  getPfData(): Observable<PfApiDocument> {
    return this.http.get<unknown>(PF_DATA_API_URL).pipe(map(parsePfDataResponse));
  }

  updatePfData(document: PfApiDocument): Observable<PfApiDocument> {
    return this.http.put<unknown>(PF_DATA_API_URL, document).pipe(map(parsePfDataResponse));
  }
}
