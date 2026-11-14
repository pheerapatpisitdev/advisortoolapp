import { round2, taxByBrackets, type BracketLine } from './brackets';
import type { Rules } from './types';

export interface CompanyInput {
  revenue: number;
  expenses: number;
  paidUpCapital: number;
  taxPaid: number;
}

export interface CompanyResult {
  profit: number;
  isSme: boolean;
  smeReasons: string[];
  bracketLines: BracketLine[];
  tax: number;
  halfYearTax: number;
  balance: number;
}

const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const baht = (n: number) => n.toLocaleString('th-TH');

export function calculateCompany(input: CompanyInput, rules: Rules): CompanyResult {
  const c = rules.company;
  const revenue = num(input.revenue);
  const expenses = num(input.expenses);
  const capital = num(input.paidUpCapital);
  const profit = round2(revenue - expenses);

  const capitalOk = capital <= c.smeCapital;
  const revenueOk = revenue <= c.smeRevenue;
  const isSme = capitalOk && revenueOk;
  const smeReasons = [
    capitalOk
      ? `ทุนชำระแล้ว ${baht(capital)} บาท ไม่เกิน ${baht(c.smeCapital)} บาท`
      : `ทุนชำระแล้ว ${baht(capital)} บาท เกิน ${baht(c.smeCapital)} บาท`,
    revenueOk
      ? `รายได้ ${baht(revenue)} บาท ไม่เกิน ${baht(c.smeRevenue)} บาท`
      : `รายได้ ${baht(revenue)} บาท เกิน ${baht(c.smeRevenue)} บาท`,
  ];

  const brackets = isSme ? c.smeBrackets : [{ upTo: null, rate: c.flatRate }];
  const { tax, lines } = taxByBrackets(Math.max(0, profit), brackets);

  return {
    profit,
    isSme,
    smeReasons,
    bracketLines: lines,
    tax,
    halfYearTax: round2(tax / 2),
    balance: round2(tax - num(input.taxPaid)),
  };
}
