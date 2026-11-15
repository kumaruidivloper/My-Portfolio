import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, throwError } from 'rxjs';

const ACCESS_DETAILS_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList/10';

export interface BankAccessDetail {
  type: string;
  customerName: string;
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  upi: string;
  accountType: string;
  userName: string;
  password: string;
  profilePassword: string;
}

export interface AccessDetails {
  name: string;
  type: string;
  bankAccessDetails: BankAccessDetail[];
}

const ACCESS_DETAIL_KEYS: (keyof BankAccessDetail)[] = [
  'type', 'customerName', 'bankName', 'branch', 'accountName', 'accountNumber',
  'ifsc', 'upi', 'accountType', 'userName', 'password', 'profilePassword'
];

export class AccessRecordChangedError extends Error {
  constructor() {
    super('This record changed since it was opened. Close the dialog and reload the page before editing again.');
  }
}

function isBankAccessDetail(value: unknown): value is BankAccessDetail {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return ACCESS_DETAIL_KEYS.every((key) => typeof record[key] === 'string');
}

export function parseAccessDetailsResponse(response: unknown): AccessDetails {
  if (typeof response !== 'object' || response === null) {
    throw new Error('The access details service returned an unexpected response.');
  }

  const document = response as Record<string, unknown>;
  if (typeof document['name'] !== 'string'
    || typeof document['type'] !== 'string'
    || !Array.isArray(document['bankAccessDetails'])) {
    throw new Error('The access details service returned an unexpected response.');
  }

  if (!document['bankAccessDetails'].every(isBankAccessDetail)) {
    throw new Error('The access details service returned a record with invalid fields.');
  }

  return {
    name: document['name'],
    type: document['type'],
    bankAccessDetails: document['bankAccessDetails']
  };
}

@Injectable({ providedIn: 'root' })
export class MyAccessDataService {
  constructor(private readonly http: HttpClient) {}

  getAccessDetails(): Observable<AccessDetails> {
    return this.http.get<unknown>(ACCESS_DETAILS_URL).pipe(map(parseAccessDetailsResponse));
  }

  updateAccessRecord(index: number, original: BankAccessDetail, updated: BankAccessDetail): Observable<AccessDetails> {
    return this.http.get<unknown>(ACCESS_DETAILS_URL).pipe(
      switchMap((response) => {
        const latest = parseAccessDetailsResponse(response);
        const current = latest.bankAccessDetails[index];
        if (!current || !ACCESS_DETAIL_KEYS.every((key) => current[key] === original[key])) {
          return throwError(() => new AccessRecordChangedError());
        }
        const bankAccessDetails = latest.bankAccessDetails.map((record, recordIndex) =>
          recordIndex === index ? { ...record, ...updated } : record
        );
        const document = { ...(response as Record<string, unknown>), bankAccessDetails };
        return this.http.put<unknown>(ACCESS_DETAILS_URL, document).pipe(map(parseAccessDetailsResponse));
      })
    );
  }
}
