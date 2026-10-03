import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, forkJoin, map, Observable, Subject, switchMap } from 'rxjs';
import { TotalApiDocument, TotalRecord } from '../model/total-record';

const TOTAL_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList';
const TOTAL_RESOURCE_ID = '7';

interface SourceEntry {
  date: string;
  amount: number;
  difference: number;
}

// Resource id -> field holding the balance in that resource's records.
const SOURCES: ReadonlyArray<{ id: string; listKey: string; amountKey: string }> = [
  { id: '2', listKey: 'pfRecords', amountKey: 'pfAmount' },
  { id: '3', listKey: 'pfRecords', amountKey: 'pfAmount' },
  { id: '4', listKey: 'gratuityRecords', amountKey: 'gratuity' },
  { id: '5', listKey: 'gratuityRecords', amountKey: 'gratuity' },
  { id: '6', listKey: 'superRecords', amountKey: 'super' }
];

// Earlier months are not part of the overall balance.
const FIRST_MONTH_KEY = '2026-07';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthKey(value: string): string {
  const match = /^([A-Za-z]+)'(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) {
    return value.trim().toLowerCase();
  }
  const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase());
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function toEntries(response: unknown, listKey: string, amountKey: string): SourceEntry[] {
  const list = (response as Record<string, unknown> | null)?.[listKey];
  if (!Array.isArray(list)) {
    throw new Error('Unexpected response while calculating the overall balance.');
  }
  return list.map((item) => {
    const record = item as Record<string, unknown>;
    const amount = record[amountKey];
    const difference = record['difference'];
    if (typeof record['date'] !== 'string' || typeof amount !== 'number' || typeof difference !== 'number') {
      throw new Error('Invalid record while calculating the overall balance.');
    }
    return { date: record['date'], amount, difference };
  });
}

// One row per month. Months present in every source are always totalled; months newer than the
// latest complete month carry forward each missing source's latest balance until its entry arrives.
export function calculateTotals(sources: SourceEntry[][]): TotalRecord[] {
  if (sources.length === 0) {
    return [];
  }
  const maps = sources.map((entries) => new Map(entries.map((entry) => [monthKey(entry.date), entry])));
  const labels = new Map<string, string>();
  for (const entries of sources) {
    for (const entry of entries) {
      const key = monthKey(entry.date);
      if (!labels.has(key)) {
        labels.set(key, entry.date);
      }
    }
  }
  const keys = [...labels.keys()].filter((key) => key >= FIRST_MONTH_KEY).sort().reverse();
  const latestComplete = keys.find((key) => maps.every((source) => source.has(key)));
  return keys
    .filter((key) => latestComplete === undefined ? false : key >= latestComplete || maps.every((source) => source.has(key)))
    .map((key) => {
      let total = 0;
      let difference = 0;
      for (const source of maps) {
        const entry = source.get(key);
        if (entry) {
          total += entry.amount;
          difference += entry.difference;
        } else {
          // Missing entry: carry that source's latest earlier balance, with no interest added.
          const earlier = [...source.keys()].filter((candidate) => candidate < key).sort().pop();
          total += earlier ? source.get(earlier)!.amount : 0;
        }
      }
      return { date: labels.get(key)!, total, difference };
    });
}

@Injectable({
  providedIn: 'root'
})
export class TotalBalanceService {
  private readonly syncRequests = new Subject<void>();
  private readonly updated = new Subject<void>();
  readonly totalsUpdated$ = this.updated.asObservable();

  constructor(private http: HttpClient) {
    this.syncRequests.pipe(
      switchMap(() => this.recalculate().pipe(catchError(() => EMPTY)))
    ).subscribe(() => this.updated.next());
  }

  getTotals(): Observable<TotalApiDocument> {
    return this.http.get<unknown>(`${TOTAL_API_URL}/${TOTAL_RESOURCE_ID}`).pipe(
      map((response) => {
        const document = response as Record<string, unknown>;
        const records = document?.['totalRecords'];
        if (!Array.isArray(records)) {
          throw new Error('The overall balance API returned an unexpected response.');
        }
        return {
          id: typeof document['id'] === 'string' ? document['id'] : TOTAL_RESOURCE_ID,
          name: typeof document['name'] === 'string' ? document['name'] : 'All',
          type: typeof document['type'] === 'string' ? document['type'] : 'Total',
          totalRecords: records as TotalRecord[]
        };
      })
    );
  }

  // Fire-and-forget: recalculates resource 7 after any source resource changes.
  syncTotals(): void {
    this.syncRequests.next();
  }

  private recalculate(): Observable<unknown> {
    return forkJoin([
      ...SOURCES.map((source) => this.http.get<unknown>(`${TOTAL_API_URL}/${source.id}`)),
      this.http.get<unknown>(`${TOTAL_API_URL}/${TOTAL_RESOURCE_ID}`)
    ]).pipe(
      switchMap((responses) => {
        const current = responses[SOURCES.length] as Record<string, unknown>;
        const entries = SOURCES.map((source, index) => toEntries(responses[index], source.listKey, source.amountKey));
        return this.http.put<unknown>(`${TOTAL_API_URL}/${TOTAL_RESOURCE_ID}`, {
          ...current,
          totalRecords: calculateTotals(entries)
        });
      })
    );
  }
}
