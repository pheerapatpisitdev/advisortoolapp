import { describe, expect, it, test } from 'vitest';
import { calculatePersonal, EMPTY_PERSONAL_INPUT, type PersonalInput } from '@/lib/tax/personal';
import { RULES_2569 } from '@/lib/tax/rules/2569';

type Partial2 = {
  incomes?: PersonalInput['incomes'];
  withheld?: number;
  age65?: boolean;
  family?: Partial<PersonalInput['family']>;
  deductions?: Partial<PersonalInput['deductions']>;
};

const make = (p: Partial2): PersonalInput => ({
  ...EMPTY_PERSONAL_INPUT,
  ...p,
  incomes: p.incomes ?? [],
  family: { ...EMPTY_PERSONAL_INPUT.family, ...p.family },
  deductions: { ...EMPTY_PERSONAL_INPUT.deductions, ...p.deductions },
});
const calc = (p: Partial2) => calculatePersonal(make(p), RULES_2569);
const line = (r: ReturnType<typeof calc>, key: string) => r.deductionLines.find((d) => d.key === key)!;

const salaried = {
  incomes: [{ occupation: 'employee' as const, amount: 480000 }],
  withheld: 3050,
  deductions: { socialSecurity: 9000, lifeInsurance: 50000, rmf: 50000 },
};

test('salaried example', () => {
  const r = calc(salaried);
  expect(r.netIncome).toBe(211000);
  expect(r.tax).toBe(3050);
  expect(r.balance).toBe(0);
  expect(r.form).toBe('ภ.ง.ด.91');
});

test('freelance example', () => {
  const r = calc({ incomes: [{ occupation: 'freelance', amount: 800000 }], withheld: 24000 });
  expect(r.netIncome).toBe(640000);
  expect(r.tax).toBe(48500);
  expect(r.balance).toBe(24500);
  expect(r.form).toBe('ภ.ง.ด.90');
});

test('merchant flat 60%', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 1500000 }], deductions: { socialSecurity: 3000 } });
  expect(r.netIncome).toBe(537000);
  expect(r.tax).toBe(33050);
  expect(r.warnings).toContain('halfYear');
});

test('shared 100k cap', () => {
  const r = calc({
    incomes: [
      { occupation: 'employee', amount: 600000 },
      { occupation: 'freelance', amount: 300000 },
    ],
  });
  expect(r.totalExpenses).toBe(100000);
});

test('performer tiers', () => {
  expect(calc({ incomes: [{ occupation: 'performer', amount: 1000000 }] }).totalExpenses).toBe(460000);
});

test('performer cap', () => {
  expect(calc({ incomes: [{ occupation: 'performer', amount: 2000000 }] }).totalExpenses).toBe(600000);
});

test('actual expense wins', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 1000000, actualExpense: 800000 }] });
  expect(r.totalExpenses).toBe(800000);
});

test('actual expense ignored when lower', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 1000000, actualExpense: 100000 }] });
  expect(r.totalExpenses).toBe(600000);
});

test('actual expense capped at that income', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 1000000, actualExpense: 5000000 }] });
  expect(r.totalExpenses).toBe(1000000);
});

test('retirement group cap', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 2000000 }],
    deductions: { pvd: 120000, pensionInsurance: 100000, rmf: 300000 },
  });
  const sum = ['pvd', 'pensionInsurance', 'rmf'].reduce((s, k) => s + line(r, k).allowed, 0);
  expect(sum).toBe(500000);
  expect(line(r, 'rmf').allowed).toBe(280000);
  expect(line(r, 'rmf').note).toBeTruthy();
});

test('life+health cap', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 1000000 }],
    deductions: { lifeInsurance: 90000, healthInsurance: 40000 },
  });
  expect(line(r, 'healthInsurance').allowed).toBe(25000);
  expect(line(r, 'lifeInsurance').allowed).toBe(75000);
});

test('esg cap by percent', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 600000 }], deductions: { thaiEsg: 300000 } });
  expect(line(r, 'thaiEsg').allowed).toBe(180000);
});

test('children rule', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 600000 }], family: { childrenFrom2018: 2 } });
  expect(line(r, 'children').allowed).toBe(90000);
});

test('children rule with elder', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 600000 }],
    family: { childrenBefore2018: 1, childrenFrom2018: 2 },
  });
  expect(line(r, 'children').allowed).toBe(150000);
});

test('parents max 4', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 600000 }], family: { parents: 6 } });
  expect(line(r, 'parents').allowed).toBe(120000);
});

test('donation 10% and double', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 1000000 }], deductions: { donationDouble: 100000 } });
  expect(line(r, 'donation').allowed).toBe(84000);
});

test('senior exemption', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 480000 }], age65: true });
  expect(r.exemption).toBe(190000);
  expect(r.netIncome).toBe(130000);
  expect(r.tax).toBe(0);
});

test('method 2 wins', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 4000000, actualExpense: 3900000 }] });
  expect(r.taxMethod1).toBe(0);
  expect(r.taxMethod2).toBe(20000);
  expect(r.tax).toBe(20000);
  expect(r.methodUsed).toBe(2);
  expect(r.warnings).toContain('method2');
});

test('method 2 waived', () => {
  expect(calc({ incomes: [{ occupation: 'merchant', amount: 900000 }] }).taxMethod2).toBe(0);
});

test('zero income', () => {
  const r = calc({});
  expect(r.tax).toBe(0);
  expect(r.netIncome).toBe(0);
  expect(r.marginalRate).toBe(0);
  expect(r.mustFile).toBe(false);
});

test('deductions exceed income', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 200000 }],
    deductions: { rmf: 60000, lifeInsurance: 100000, donationGeneral: 50000 },
  });
  expect(r.netIncome).toBe(0);
  expect(r.tax).toBe(0);
  for (const d of r.deductionLines) expect(d.allowed).toBeGreaterThanOrEqual(0);
});

test('sanitizes non-numeric and negative input', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: NaN }],
    withheld: -5,
    family: { parents: -1 },
  });
  const empty = calc({});
  expect(r.tax).toBe(empty.tax);
  expect(r.totalIncome).toBe(0);
  expect(r.totalDeductions).toBe(empty.totalDeductions);
  expect(r.balance).toBe(0);
  const nums = [r.totalIncome, r.totalExpenses, r.exemption, r.totalDeductions, r.netIncome, r.tax, r.balance, r.withheld];
  for (const n of nums) expect(Number.isFinite(n)).toBe(true);
});

test('refund', () => {
  expect(calc({ ...salaried, withheld: 10000 }).balance).toBe(-6950);
});

test('vat warning', () => {
  expect(calc({ incomes: [{ occupation: 'merchant', amount: 2000000 }] }).warnings).toContain('vat');
});

test('must file thresholds', () => {
  expect(calc({ incomes: [{ occupation: 'employee', amount: 120000 }] }).mustFile).toBe(false);
  expect(calc({ incomes: [{ occupation: 'employee', amount: 120001 }] }).mustFile).toBe(true);
  expect(calc({ incomes: [{ occupation: 'freelance', amount: 60001 }] }).mustFile).toBe(true);
});

// ---- final review fixes ----
test('senior exemption comes off income before expenses', () => {
  const r = calc({ incomes: [{ occupation: 'merchant', amount: 1000000 }], age65: true });
  expect(r.exemption).toBe(190000);
  expect(r.totalExpenses).toBe(486000);
  expect(r.netIncome).toBe(264000);
  expect(r.tax).toBe(5700);
});

test('remaining rights are listed even when nothing was entered', () => {
  const r = calc({ incomes: [{ occupation: 'employee', amount: 600000 }] });
  expect(line(r, 'rmf').remaining).toBe(180000);
  expect(line(r, 'thaiEsg').remaining).toBe(180000);
  expect(line(r, 'lifeInsurance').remaining).toBe(100000);
});

test('remaining respects combined life+health cap', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 1000000 }],
    deductions: { lifeInsurance: 100000, healthInsurance: 40000 },
  });
  expect(line(r, 'lifeInsurance').remaining).toBe(0);
  expect(line(r, 'healthInsurance').remaining).toBe(0);
});

test('remaining respects retirement group cap', () => {
  const r = calc({
    incomes: [{ occupation: 'employee', amount: 3000000 }],
    deductions: { rmf: 500000, pvd: 300000, pensionInsurance: 200000, nsf: 30000 },
  });
  for (const k of ['rmf', 'pvd', 'pensionInsurance', 'nsf', 'gpf']) expect(line(r, k).remaining).toBe(0);
  expect(line(r, 'rmf').cap).toBe(500000);
});

test('selected occupation with zero income does not change filing', () => {
  const r = calc({
    incomes: [
      { occupation: 'employee', amount: 100000 },
      { occupation: 'freelance', amount: 0 },
    ],
  });
  expect(r.mustFile).toBe(false);
  expect(r.form).toBe('ภ.ง.ด.91');
});

test('no vat warning for vat-exempt rent and medical income', () => {
  expect(calc({ incomes: [{ occupation: 'landlord', amount: 2000000 }] }).warnings).not.toContain('vat');
  expect(calc({ incomes: [{ occupation: 'medical', amount: 2000000 }] }).warnings).not.toContain('vat');
});
