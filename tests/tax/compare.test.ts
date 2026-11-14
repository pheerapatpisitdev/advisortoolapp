import { expect, test } from 'vitest';
import { comparePaths } from '@/lib/tax/compare';
import { calculatePersonal, EMPTY_PERSONAL_INPUT } from '@/lib/tax/personal';
import { RULES_2569 } from '@/lib/tax/rules/2569';

const base = {
  occupation: 'merchant' as const,
  revenue: 3000000,
  actualExpenses: 1500000,
  ownerSalary: 600000,
  payDividend: true,
};

test('compare merchant', () => {
  const r = comparePaths(base, RULES_2569);
  expect(r.personal.tax).toBe(150000);
  expect(r.company.corporateTax).toBe(90000);
  expect(r.company.ownerTax).toBe(21500);
  expect(r.company.dividendTax).toBe(81000);
  expect(r.company.total).toBe(192500);
  expect(r.difference).toBe(-42500);
});

test('compare no dividend', () => {
  const r = comparePaths({ ...base, payDividend: false }, RULES_2569);
  expect(r.company.dividendTax).toBe(0);
  expect(r.company.total).toBe(111500);
  expect(r.difference).toBe(38500);
});

test('compare with salary larger than profit', () => {
  const r = comparePaths({ ...base, ownerSalary: 2000000 }, RULES_2569);
  expect(r.company.corporateTax).toBe(0);
  expect(r.company.dividendTax).toBe(0);
});

test('compare garbage input', () => {
  const r = comparePaths({ ...base, revenue: NaN, actualExpenses: NaN, ownerSalary: NaN }, RULES_2569);
  expect(r.personal.tax).toBe(0);
  expect(r.company.total).toBe(0);
  expect(Number.isFinite(r.difference)).toBe(true);
});

test('owner salary is capped at the profit before salary', () => {
  const r = comparePaths({ ...base, revenue: 1000000, actualExpenses: 500000, ownerSalary: 2000000 }, RULES_2569);
  expect(r.company.ownerSalaryUsed).toBe(500000);
  expect(r.company.corporateTax).toBe(0);
  expect(r.company.ownerTax).toBe(calculatePersonal({ ...EMPTY_PERSONAL_INPUT, incomes: [{ occupation: 'employee', amount: 500000 }] }, RULES_2569).tax);
});
