import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SalaryApiDocument } from '../model/salary-record';
import { SalaryDataService, parseSalaryDataResponse } from './salary-data.service';

const salary: SalaryApiDocument = {
  id: '8', name: 'Kumar Australia Salary', title: 'Salary', description: 'History', type: 'Salary',
  salaryRecords: [{
    date: 'Sep 2026', initialAdvanceRepayment: 20, totalSalary: 3000, ausTax: 100,
    indiaDeduction: 30, totalDeduction: 150, ausSalary: 2850
  }]
};

describe('SalaryDataService', () => {
  let service: SalaryDataService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SalaryDataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the correct owner resource and preserves every record field', () => {
    service.getSalaryData('8').subscribe((data) => expect(data).toEqual(salary));
    const request = http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/8');
    expect(request.request.method).toBe('GET');
    request.flush(salary);
    const vasuki = {
      ...salary, id: '9', name: 'Vasuki Australia Salary',
      salaryRecords: [{ ...salary.salaryRecords[0], ausHealthInsurance: 50 }]
    };
    service.getSalaryData('9').subscribe((data) => expect(data).toEqual(vasuki));
    http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/9').flush(vasuki);
  });

  it('updates only the selected salary resource and publishes an update after success', () => {
    const updated = jasmine.createSpy('updated');
    service.salaryUpdated$.subscribe(updated);
    service.updateSalaryData(salary, '8').subscribe((data) => expect(data).toEqual(salary));
    const request = http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/8');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(salary);
    expect(updated).not.toHaveBeenCalled();
    request.flush(salary);
    expect(updated).toHaveBeenCalledTimes(1);
  });

  it('reports failed updates without publishing success', () => {
    const updated = jasmine.createSpy('updated');
    service.salaryUpdated$.subscribe(updated);
    service.updateSalaryData(salary, '8').subscribe({ error: (error: unknown) => expect(error).toBeDefined() });
    http.expectOne('https://64b76091df0839c97e168d79.mockapi.io/taskList/8')
      .flush('Unavailable', { status: 500, statusText: 'Unavailable' });
    expect(updated).not.toHaveBeenCalled();
  });
});

describe('Salary response validation', () => {
  it('accepts empty histories and rejects malformed or non-finite fields', () => {
    expect(parseSalaryDataResponse({ salaryRecords: [] }, '8').salaryRecords).toEqual([]);
    for (const value of [null, {}, { salaryRecords: [null] },
      { salaryRecords: [{ ...salary.salaryRecords[0], ausTax: '100' }] },
      { salaryRecords: [{ ...salary.salaryRecords[0], ausSalary: NaN }] },
      { salaryRecords: [{ ...salary.salaryRecords[0], date: 'Not a month' }] }]) {
      expect(() => parseSalaryDataResponse(value, '8')).toThrowError();
    }
  });

  it('requires health insurance for Vasuki but does not invent it for Kumar', () => {
    expect(parseSalaryDataResponse(salary, '8').salaryRecords[0].ausHealthInsurance).toBeUndefined();
    expect(() => parseSalaryDataResponse(salary, '9')).toThrowError();
    expect(parseSalaryDataResponse({
      ...salary, salaryRecords: [{ ...salary.salaryRecords[0], ausHealthInsurance: 25 }]
    }, '9').salaryRecords[0].ausHealthInsurance).toBe(25);
  });
});
