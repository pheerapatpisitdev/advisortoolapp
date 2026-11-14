import { round2 } from './brackets';
import { calculateCompany } from './company';
import { calculatePersonal, EMPTY_PERSONAL_INPUT, type PersonalResult } from './personal';
import type { OccupationId, Rules } from './types';

export interface CompareInput {
  occupation: OccupationId;
  revenue: number;
  actualExpenses: number;
  ownerSalary: number; // เงินเดือนต่อปีที่บริษัทจ่ายให้เจ้าของ
  payDividend: boolean; // จ่ายกำไรหลังภาษีทั้งหมดเป็นปันผล
}

export interface CompareResult {
  personal: { tax: number; result: PersonalResult };
  company: {
    /** เงินเดือนที่ใช้คิดจริง ไม่เกินกำไรก่อนจ่ายเงินเดือน (บริษัทจ่ายเกินกำไรไม่ได้) */
    ownerSalaryUsed: number;
    corporateTax: number;
    ownerTax: number;
    dividendTax: number;
    total: number;
  };
  difference: number; // personal.tax − company.total (บวก = จดบริษัทเสียน้อยกว่า)
}

/** ทุนชำระแล้วที่สมมติให้บริษัทจำลอง (ให้อยู่ในเกณฑ์ SME) */
export const ASSUMED_CAPITAL = 1000000;

const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function comparePaths(input: CompareInput, rules: Rules): CompareResult {
  const revenue = num(input.revenue);
  const actual = num(input.actualExpenses);
  const salary = Math.min(num(input.ownerSalary), Math.max(0, revenue - actual));

  const personalResult = calculatePersonal(
    { ...EMPTY_PERSONAL_INPUT, incomes: [{ occupation: input.occupation, amount: revenue, actualExpense: actual }] },
    rules,
  );

  const company = calculateCompany(
    { revenue, expenses: actual + salary, paidUpCapital: ASSUMED_CAPITAL, taxPaid: 0 },
    rules,
  );
  const ownerTax = calculatePersonal(
    { ...EMPTY_PERSONAL_INPUT, incomes: salary > 0 ? [{ occupation: 'employee', amount: salary }] : [] },
    rules,
  ).tax;
  const afterTax = company.profit - company.tax;
  const dividendTax = input.payDividend && afterTax > 0 ? round2(afterTax * rules.company.dividendTax) : 0;
  const total = round2(company.tax + ownerTax + dividendTax);

  return {
    personal: { tax: personalResult.tax, result: personalResult },
    company: { ownerSalaryUsed: salary, corporateTax: company.tax, ownerTax, dividendTax, total },
    difference: round2(personalResult.tax - total),
  };
}
