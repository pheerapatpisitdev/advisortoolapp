import { EMPTY_PERSONAL_INPUT, type PersonalInput } from '@/lib/tax/personal';
import { RULES_2569 as R } from '@/lib/tax/rules/2569';
import type { OccupationId } from '@/lib/tax/types';

export const STORAGE_KEY = 'personal-2569-v2';
export const STEPS = ['อาชีพ', 'รายได้', 'ครอบครัว', 'ลดหย่อน', 'ผลลัพธ์'];
export const STEP_COUNT = STEPS.length;

const OCC_IDS = R.occupations.map((o) => o.id);
const zeroBy = <T,>(v: T) => Object.fromEntries(OCC_IDS.map((id) => [id, v])) as Record<OccupationId, T>;

export interface Form {
  step: number;
  occupations: OccupationId[];
  monthlySalary: number;
  bonus: number;
  /** พนักงานเอกชนจ่ายประกันสังคม ข้าราชการไม่จ่าย */
  paysSocialSecurity: boolean;
  amounts: Record<OccupationId, number>;
  actual: Record<OccupationId, number>;
  useActual: Record<OccupationId, boolean>;
  withheld: number;
  age65: boolean;
  family: PersonalInput['family'];
  deductions: PersonalInput['deductions'];
  ssTouched: boolean;
}

export const INITIAL_FORM: Form = {
  step: 0,
  occupations: ['employee'],
  monthlySalary: 0,
  bonus: 0,
  paysSocialSecurity: true,
  amounts: zeroBy(0),
  actual: zeroBy(0),
  useActual: zeroBy(false),
  withheld: 0,
  age65: false,
  family: { ...EMPTY_PERSONAL_INPUT.family },
  deductions: { ...EMPTY_PERSONAL_INPUT.deductions },
  ssTouched: false,
};

/** แก้ข้อมูลที่บันทึกไว้ให้ใช้ได้เสมอ (อาชีพที่ไม่มีแล้ว ขั้นตอนเกินช่วง) */
export function sanitizeForm(f: Form): Form {
  const step = Math.floor(Number(f.step));
  return {
    ...f,
    occupations: [...new Set(f.occupations.filter((id) => OCC_IDS.includes(id)))],
    step: Number.isFinite(step) ? Math.min(STEP_COUNT - 1, Math.max(0, step)) : 0,
  };
}

/** ประกันสังคมโดยประมาณของพนักงาน: 5% ของเงินเดือน ไม่เกินเพดานต่อเดือน */
export function defaultSocialSecurity(monthly: number): number {
  const s = R.socialSecurityEmployee;
  return Math.round(Math.min(monthly * s.rate, s.monthlyCap) * 12);
}

export function usesSocialSecurityDefault(f: Form): boolean {
  return !f.ssTouched && f.paysSocialSecurity && f.occupations.includes('employee');
}

export function toInput(f: Form): PersonalInput {
  const incomes: PersonalInput['incomes'] = f.occupations.map((id) =>
    id === 'employee'
      ? { occupation: id, amount: f.monthlySalary * 12 + f.bonus }
      : { occupation: id, amount: f.amounts[id], actualExpense: f.useActual[id] ? f.actual[id] : 0 },
  );
  const socialSecurity = usesSocialSecurityDefault(f)
    ? defaultSocialSecurity(f.monthlySalary)
    : !f.ssTouched && f.occupations.includes('employee') && !f.paysSocialSecurity
      ? 0
      : f.deductions.socialSecurity;
  return { incomes, withheld: f.withheld, age65: f.age65, family: f.family, deductions: { ...f.deductions, socialSecurity } };
}
