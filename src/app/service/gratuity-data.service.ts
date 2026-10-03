import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { GratuityApiDocument, GratuityRecord } from '../model/gratuity-record';
import { TotalBalanceService } from './total-balance.service';

const GRATUITY_DATA_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList';

export type GratuityResourceId = '4' | '5' | '6';

const GRATUITY_RESOURCE_NAMES: Record<GratuityResourceId, string> = {
  '4': 'Kumar',
  '5': 'Vasuki',
  '6': 'Vasu'
};

function isGratuityRecord(value: unknown): value is GratuityRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record['date'] === 'string'
    && typeof record['gratuity'] === 'number'
    && Number.isFinite(record['gratuity'])
    && typeof record['difference'] === 'number'
    && Number.isFinite(record['difference']);
}

export function parseGratuityDataResponse(
  response: unknown,
  fallbackName = 'Kumar',
  resourceId: GratuityResourceId = '4'
): GratuityApiDocument {
  if (typeof response !== 'object' || response === null) {
    throw new Error('The gratuity data API returned an unexpected response.');
  }

  const document = response as Record<string, unknown>;
  const sourceRecords = resourceId === '6' ? document['superRecords'] : document['gratuityRecords'];
  if (!Array.isArray(sourceRecords)) {
    throw new Error('The gratuity data API returned an unexpected response.');
  }
  if (resourceId === '6') {
    if (!sourceRecords.every((record) => {
      if (typeof record !== 'object' || record === null) {
        return false;
      }
      const entry = record as Record<string, unknown>;
      return typeof entry['date'] === 'string'
        && typeof entry['super'] === 'number'
        && Number.isFinite(entry['super'])
        && typeof entry['difference'] === 'number'
        && Number.isFinite(entry['difference']);
    })) {
      throw new Error('The super data API returned a record with invalid fields.');
    }
  } else if (!sourceRecords.every(isGratuityRecord)) {
    throw new Error('The gratuity data API returned a record with invalid fields.');
  }

  return {
    id: typeof document['id'] === 'string' ? document['id'] : '',
    name: typeof document['name'] === 'string' ? document['name'] : fallbackName,
    title: typeof document['title'] === 'string' ? document['title'] : '',
    description: typeof document['description'] === 'string' ? document['description'] : '',
    type: typeof document['type'] === 'string' ? document['type'] : resourceId === '6' ? 'Super' : 'Gratuity',
    gratuityRecords: resourceId === '6'
      ? sourceRecords.map((record) => {
        const entry = record as Record<string, unknown>;
        return {
          date: entry['date'] as string,
          gratuity: entry['super'] as number,
          difference: entry['difference'] as number
        };
      })
      : sourceRecords
  };
}

@Injectable({
  providedIn: 'root'
})
export class GratuityDataService {
  constructor(private http: HttpClient, private totalBalanceService: TotalBalanceService) {}

  getGratuityData(resourceId: GratuityResourceId = '4'): Observable<GratuityApiDocument> {
    return this.http.get<unknown>(`${GRATUITY_DATA_API_URL}/${resourceId}`).pipe(
      map((response) => parseGratuityDataResponse(response, GRATUITY_RESOURCE_NAMES[resourceId], resourceId))
    );
  }

  updateGratuityData(
    document: GratuityApiDocument,
    resourceId: GratuityResourceId = '4'
  ): Observable<GratuityApiDocument> {
    const requestDocument = resourceId === '6'
      ? {
        id: document.id,
        name: document.name,
        title: document.title,
        description: document.description,
        type: 'Super',
        superRecords: document.gratuityRecords.map(({ date, gratuity, difference }) => ({
          date,
          super: gratuity,
          difference
        }))
      }
      : document;
    return this.http.put<unknown>(`${GRATUITY_DATA_API_URL}/${resourceId}`, requestDocument).pipe(
      map((response) => parseGratuityDataResponse(response, GRATUITY_RESOURCE_NAMES[resourceId], resourceId)),
      tap(() => this.totalBalanceService.syncTotals())
    );
  }
}
