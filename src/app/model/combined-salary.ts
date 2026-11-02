import { SALARY_FIELDS, SalaryRecord, salaryMonthKey } from './salary-record';

export function combineSalaryRecords(kumar: readonly SalaryRecord[], vasuki: readonly SalaryRecord[]): SalaryRecord[] {
  const months = new Map<string, SalaryRecord>();
  for (const record of [...kumar, ...vasuki]) {
    const date = salaryMonthKey(record.date);
    let combined = months.get(date);
    if (!combined) {
      combined = {
        date, initialAdvanceRepayment: 0, totalSalary: 0, ausHealthInsurance: 0,
        ausTax: 0, indiaDeduction: 0, totalDeduction: 0, ausSalary: 0
      };
      months.set(date, combined);
    }
    for (const { key } of SALARY_FIELDS) {
      combined[key] = (combined[key] ?? 0) + (record[key] ?? 0);
    }
  }
  return [...months.values()].sort((a, b) => a.date.localeCompare(b.date));
}
