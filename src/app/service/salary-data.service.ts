import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, Subject, tap } from 'rxjs';
import { SalaryApiDocument, SalaryRecord, SalaryResourceId, salaryFields, salaryMonthKey } from '../model/salary-record';

const SALARY_API_URL = 'https://64b76091df0839c97e168d79.mockapi.io/taskList';

export function parseSalaryDataResponse(response: unknown, resourceId: SalaryResourceId): SalaryApiDocument {
  if (typeof response !== 'object' || response === null) {
    throw new Error('The salary API returned an unexpected response.');
  }
  const document = response as Record<string, unknown>;
  const records = document['salaryRecords'];
  if (!Array.isArray(records)) {
    throw new Error('The salary API returned no salary records list.');
  }
  const salaryRecords: SalaryRecord[] = records.map((value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      throw new Error('The salary API returned an invalid record.');
    }
    const record = value as Record<string, unknown>;
    if (typeof record['date'] !== 'string' || salaryFields(resourceId).some(({ key }) =>
      typeof record[key] !== 'number' || !Number.isFinite(record[key]))) {
      throw new Error('The salary API returned a record with invalid fields.');
    }
    if (record['ausHealthInsurance'] !== undefined &&
      (typeof record['ausHealthInsurance'] !== 'number' || !Number.isFinite(record['ausHealthInsurance']))) {
      throw new Error('The salary API returned invalid health insurance.');
    }
    salaryMonthKey(record['date']);
    // Field validation above establishes the salary record shape.
    return { ...record } as SalaryRecord;
  });
  return {
    id: typeof document['id'] === 'string' ? document['id'] : resourceId,
    name: typeof document['name'] === 'string' ? document['name'] : `${resourceId === '8' ? 'Kumar' : 'Vasuki'} Australia Salary`,
    title: typeof document['title'] === 'string' ? document['title'] : '',
    description: typeof document['description'] === 'string' ? document['description'] : '',
    type: typeof document['type'] === 'string' ? document['type'] : 'Salary',
    salaryRecords
  };
}

@Injectable({ providedIn: 'root' })
export class SalaryDataService {
  private readonly updated = new Subject<void>();
  readonly salaryUpdated$ = this.updated.asObservable();

  constructor(private http: HttpClient) {}

  getSalaryData(resourceId: SalaryResourceId): Observable<SalaryApiDocument> {
    return this.http.get<unknown>(`${SALARY_API_URL}/${resourceId}`).pipe(
      map((response) => parseSalaryDataResponse(response, resourceId))
    );
  }

  updateSalaryData(document: SalaryApiDocument, resourceId: SalaryResourceId): Observable<SalaryApiDocument> {
    const validated = parseSalaryDataResponse(document, resourceId);
    return this.http.put<unknown>(`${SALARY_API_URL}/${resourceId}`, validated).pipe(
      map((response) => parseSalaryDataResponse(response, resourceId)),
      tap(() => this.updated.next())
    );
  }
}
