import { expect, test } from 'vitest';
import { calculateCompany } from '@/lib/tax/company';
import { RULES_2569 } from '@/lib/tax/rules/2569';

const c = (revenue: number, expenses: number, paidUpCapital = 1000000, taxPaid = 0) =>
  calculateCompany({ revenue, expenses, paidUpCapital, taxPaid }, RULES_2569);

test('sme 1m', () => {
  const r = c(5000000, 4000000);
  expect(r.isSme).toBe(true);
  expect(r.tax).toBe(105000);
  expect(r.halfYearTax).toBe(52500);
  expect(r.smeReasons.length).toBeGreaterThan(0);
});

test('non-sme by capital', () => {
  const r = c(5000000, 4000000, 6000000);
  expect(r.isSme).toBe(false);
  expect(r.tax).toBe(200000);
});

test('non-sme by revenue', () => {
  expect(c(31000000, 30000000).tax).toBe(200000);
});

test('sme 4m', () => {
  expect(c(5000000, 1000000).tax).toBe(605000);
});

test('loss', () => {
  const r = c(1000000, 1500000);
  expect(r.profit).toBe(-500000);
  expect(r.tax).toBe(0);
  expect(r.halfYearTax).toBe(0);
});

test('sme under 300k', () => {
  expect(c(1300000, 1000000).tax).toBe(0);
});

test('balance subtracts tax already paid', () => {
  expect(c(5000000, 4000000, 1000000, 60000).balance).toBe(45000);
});

test('garbage input', () => {
  const r = calculateCompany({ revenue: NaN, expenses: -1, paidUpCapital: NaN, taxPaid: NaN }, RULES_2569);
  expect(r.tax).toBe(0);
  for (const n of [r.profit, r.tax, r.halfYearTax, r.balance]) expect(Number.isFinite(n)).toBe(true);
});
