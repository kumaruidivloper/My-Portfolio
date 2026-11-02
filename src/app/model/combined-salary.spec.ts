import { combineSalaryRecords } from './combined-salary';
import { SalaryRecord } from './salary-record';

describe('combineSalaryRecords', () => {
  const record: SalaryRecord = {
    date: 'Sep 2026', initialAdvanceRepayment: 10, totalSalary: 1000,
    ausTax: 100, indiaDeduction: 20, totalDeduction: 333, ausSalary: 777
  };

  it('sums every manual field by normalized month without recalculating credited salary or deductions', () => {
    const kumar = [{ ...record }];
    const vasuki = [{ ...record, date: "Sep'26", ausHealthInsurance: 40, ausSalary: -50 }];
    const original = JSON.stringify([kumar, vasuki]);
    expect(combineSalaryRecords(kumar, vasuki)).toEqual([{
      date: '2026-09', initialAdvanceRepayment: 20, totalSalary: 2000, ausHealthInsurance: 40,
      ausTax: 200, indiaDeduction: 40, totalDeduction: 666, ausSalary: 727
    }]);
    expect(JSON.stringify([kumar, vasuki])).toBe(original);
  });

  it('keeps unmatched months, sorts across years, and does not fabricate missing months', () => {
    const records = combineSalaryRecords(
      [{ ...record, date: 'Feb 2027' }],
      [{ ...record, date: 'Dec 2026', ausHealthInsurance: 40 }]
    );
    expect(records.map(({ date }) => date)).toEqual(['2026-12', '2027-02']);
    expect(records.map(({ ausSalary }) => ausSalary)).toEqual([777, 777]);
    expect(records.map(({ ausHealthInsurance }) => ausHealthInsurance)).toEqual([40, 0]);
  });

  it('handles either or both histories being empty', () => {
    expect(combineSalaryRecords([], [])).toEqual([]);
    expect(combineSalaryRecords([record], [])[0].ausSalary).toBe(777);
    expect(combineSalaryRecords([], [record])[0].ausSalary).toBe(777);
  });
});
