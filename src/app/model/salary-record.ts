export type SalaryResourceId = '8' | '9';

export const SALARY_FIELDS = [
  { key: 'initialAdvanceRepayment', label: 'Initial advance repayment' },
  { key: 'totalSalary', label: 'Total salary' },
  { key: 'ausHealthInsurance', label: 'Australian health insurance' },
  { key: 'ausTax', label: 'Australian tax' },
  { key: 'indiaDeduction', label: 'India deduction' },
  { key: 'totalDeduction', label: 'Total deduction' },
  { key: 'ausSalary', label: 'Australian salary' }
] as const;

export type SalaryField = typeof SALARY_FIELDS[number]['key'];
export type SalaryRecord = { date: string; ausHealthInsurance?: number } &
  Record<Exclude<SalaryField, 'ausHealthInsurance'>, number>;

export interface SalaryApiDocument {
  id: string;
  name: string;
  title: string;
  description: string;
  type: string;
  salaryRecords: SalaryRecord[];
}

export function salaryFields(resourceId: SalaryResourceId) {
  return SALARY_FIELDS.filter(({ key }) => resourceId === '9' || key !== 'ausHealthInsurance');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function salaryMonthKey(value: string): string {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }
  const match = /^([A-Za-z]+)(?:\s+|')(\d{2}|\d{4})$/.exec(value.trim());
  const month = match ? MONTHS.findIndex((name) => name.toLowerCase() === match[1].slice(0, 3).toLowerCase()) : -1;
  if (!match || month < 0) {
    throw new Error(`Unsupported salary month: "${value}".`);
  }
  return `${match[2].length === 2 ? `20${match[2]}` : match[2]}-${String(month + 1).padStart(2, '0')}`;
}

export function salaryMonthLabel(value: string): string {
  const [year, month] = salaryMonthKey(value).split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
