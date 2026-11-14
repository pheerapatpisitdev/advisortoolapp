import { describe, expect, it, test } from 'vitest';
import { INITIAL_FORM, sanitizeForm, toInput, STEP_COUNT, type Form } from '@/lib/tax/form';

test('sanitizeForm drops unknown occupations and clamps step', () => {
  const bad = { ...INITIAL_FORM, occupations: ['employee', 'astronaut'], step: 99 } as unknown as Form;
  const f = sanitizeForm(bad);
  expect(f.occupations).toEqual(['employee']);
  expect(f.step).toBe(STEP_COUNT - 1);
  expect(sanitizeForm({ ...INITIAL_FORM, step: -3 }).step).toBe(0);
  expect(sanitizeForm({ ...INITIAL_FORM, step: 2.5 }).step).toBe(2);
});

test('social security default only when the user pays it', () => {
  const f: Form = { ...INITIAL_FORM, monthlySalary: 40000 };
  expect(toInput(f).deductions.socialSecurity).toBe(10500);
  expect(toInput({ ...f, paysSocialSecurity: false }).deductions.socialSecurity).toBe(0);
  expect(toInput({ ...f, ssTouched: true, deductions: { ...f.deductions, socialSecurity: 9000 } }).deductions.socialSecurity).toBe(9000);
});

test('employee income is monthly x 12 plus bonus', () => {
  const i = toInput({ ...INITIAL_FORM, monthlySalary: 40000, bonus: 20000 });
  expect(i.incomes).toEqual([{ occupation: 'employee', amount: 500000 }]);
});
