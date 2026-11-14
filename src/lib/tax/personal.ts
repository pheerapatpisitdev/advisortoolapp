import { round2, taxByBrackets, type BracketLine } from './brackets';
import type { OccupationId, Rules } from './types';

export interface PersonalInput {
  incomes: { occupation: OccupationId; amount: number; actualExpense?: number }[]; // ต่อปี
  withheld: number;
  age65: boolean;
  family: {
    spouseNoIncome: boolean;
    childrenBefore2018: number;
    childrenFrom2018: number;
    parents: number;
    disabled: number;
    maternity: number;
  };
  deductions: {
    socialSecurity: number;
    lifeInsurance: number;
    healthInsurance: number;
    parentHealthInsurance: number;
    pensionInsurance: number;
    pvd: number;
    gpf: number;
    rmf: number;
    nsf: number;
    thaiEsg: number;
    homeLoanInterest: number;
    donationGeneral: number;
    donationDouble: number;
    politicalDonation: number;
  };
}

export const EMPTY_PERSONAL_INPUT: PersonalInput = {
  incomes: [],
  withheld: 0,
  age65: false,
  family: { spouseNoIncome: false, childrenBefore2018: 0, childrenFrom2018: 0, parents: 0, disabled: 0, maternity: 0 },
  deductions: {
    socialSecurity: 0,
    lifeInsurance: 0,
    healthInsurance: 0,
    parentHealthInsurance: 0,
    pensionInsurance: 0,
    pvd: 0,
    gpf: 0,
    rmf: 0,
    nsf: 0,
    thaiEsg: 0,
    homeLoanInterest: 0,
    donationGeneral: 0,
    donationDouble: 0,
    politicalDonation: 0,
  },
};

export interface DeductionLine {
  key: string;
  label: string;
  claimed: number;
  allowed: number;
  cap: number | null;
  /** สิทธิ์ที่ยังใช้เพิ่มได้จริง หลังคิดเพดานรวมของกลุ่มแล้ว */
  remaining: number;
  note?: string;
}

/** รายการที่ผู้ใช้เพิ่มเองได้เพื่อลดภาษี ใช้แสดง "ยังลดภาษีได้อีก" */
export const ACTIONABLE_KEYS = ['lifeInsurance', 'healthInsurance', 'parentHealthInsurance', 'rmf', 'pensionInsurance', 'nsf', 'thaiEsg'];

export type PersonalWarning = 'halfYear' | 'vat' | 'method2';

export interface PersonalResult {
  totalIncome: number;
  expenseLines: { occupation: OccupationId; label: string; income: number; expense: number; note: string }[];
  totalExpenses: number;
  exemption: number;
  deductionLines: DeductionLine[];
  totalDeductions: number;
  netIncome: number;
  bracketLines: BracketLine[];
  marginalRate: number;
  taxMethod1: number;
  taxMethod2: number;
  methodUsed: 1 | 2;
  tax: number;
  withheld: number;
  balance: number; // บวก = จ่ายเพิ่ม, ลบ = ได้คืน
  mustFile: boolean;
  form: 'ภ.ง.ด.90' | 'ภ.ง.ด.91';
  warnings: PersonalWarning[];
}

const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const count = (x: unknown) => Math.floor(num(x));
const baht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

export function calculatePersonal(raw: PersonalInput, rules: Rules): PersonalResult {
  const a = rules.allowance;
  const occ = (id: OccupationId) => rules.occupations.find((o) => o.id === id)!;
  const sharedRate = 0.5; // อัตรา 50% ของเงินได้ 40(1)/40(2) ตามกฎหมาย

  // ---------- รายได้ ----------
  const incomes = (raw.incomes ?? [])
    .filter((i) => rules.occupations.some((o) => o.id === i.occupation))
    .map((i) => ({ occupation: i.occupation, amount: num(i.amount), actualExpense: num(i.actualExpense) }))
    .filter((i) => i.amount > 0);

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);

  // ---------- ยกเว้นผู้มีอายุ 65+ : หักจากเงินได้ก่อนคิดค่าใช้จ่าย (เงินเดือนก่อน แล้วรายได้อื่นตามลำดับ) ----------
  let exemptLeft = raw.age65 ? rules.seniorExemption : 0;
  const base = new Map<number, number>();
  const order = incomes.map((_, idx) => idx).sort((x, y) => Number(incomes[y].occupation === 'employee') - Number(incomes[x].occupation === 'employee'));
  for (const idx of order) {
    const take = Math.min(exemptLeft, incomes[idx].amount);
    exemptLeft -= take;
    base.set(idx, incomes[idx].amount - take);
  }
  const exemption = raw.age65 ? rules.seniorExemption - exemptLeft : 0;

  // ---------- ค่าใช้จ่าย ----------
  // 40(1)+40(2): 50% รวมกันไม่เกินเพดานร่วม แบ่งให้แต่ละรายการตามสัดส่วน
  const cappedRaw = incomes.reduce((s, i, idx) => s + (occ(i.occupation).expense.kind === 'capped50' ? base.get(idx)! * sharedRate : 0), 0);
  const cappedTotal = Math.min(cappedRaw, rules.sharedExpenseCap);

  const expenseLines = incomes.map((i, idx) => {
    const o = occ(i.occupation);
    const b = base.get(idx)!;
    let expense = 0;
    let note = '';
    if (o.expense.kind === 'capped50') {
      expense = cappedRaw > 0 ? (b * sharedRate * cappedTotal) / cappedRaw : 0;
      note =
        cappedRaw > rules.sharedExpenseCap
          ? `${o.label}: หัก ${sharedRate * 100}% แต่รวมกับงานประจำ/ฟรีแลนซ์ได้ไม่เกิน ${baht(rules.sharedExpenseCap)} บาท`
          : `${o.label}: หัก ${sharedRate * 100}% ของรายได้`;
    } else {
      let flat = 0;
      if (o.expense.kind === 'flat') {
        flat = b * o.expense.rate;
        note = `หักเหมา ${Math.round(o.expense.rate * 100)}%`;
      } else {
        const p = rules.performer;
        flat = Math.min(Math.min(b, p.firstTier) * p.firstRate + Math.max(0, b - p.firstTier) * p.restRate, p.cap);
        note = `หักเหมา ${p.firstRate * 100}% ของ ${baht(p.firstTier)} บาทแรก และ ${p.restRate * 100}% ของส่วนเกิน รวมไม่เกิน ${baht(p.cap)} บาท`;
      }
      expense = flat;
      if (o.allowActual && i.actualExpense > flat) {
        expense = Math.min(i.actualExpense, b);
        note = 'หักตามค่าใช้จ่ายจริง (มากกว่าแบบเหมา)';
      }
    }
    return { occupation: i.occupation, label: o.label, income: i.amount, expense: round2(expense), note };
  });
  const totalExpenses = round2(expenseLines.reduce((s, l) => s + l.expense, 0));

  // ---------- ค่าลดหย่อน ----------
  const f = raw.family ?? EMPTY_PERSONAL_INPUT.family;
  const d = { ...EMPTY_PERSONAL_INPUT.deductions, ...raw.deductions };
  for (const k of Object.keys(d) as (keyof typeof d)[]) d[k] = num(d[k]);

  const lines: DeductionLine[] = [];
  const add = (key: string, label: string, claimed: number, cap: number | null, allowed?: number, note?: string) => {
    const al = Math.max(0, allowed ?? (cap === null ? claimed : Math.min(claimed, cap)));
    const remaining = cap === null ? 0 : Math.max(0, round2(cap - al));
    lines.push({ key, label, claimed, allowed: round2(al), cap, remaining, ...(note ? { note } : {}) });
  };
  const setRemaining = (key: string, n: number) => {
    const l = lines.find((x) => x.key === key);
    if (l) l.remaining = Math.max(0, round2(n));
  };

  add('self', 'ค่าลดหย่อนส่วนตัว', a.self, a.self);
  if (f.spouseNoIncome) add('spouse', 'คู่สมรสไม่มีรายได้', a.spouse, a.spouse);

  const before = count(f.childrenBefore2018);
  const from = count(f.childrenFrom2018);
  if (before + from > 0) {
    const firstFrom2018At30k = before === 0 && from > 0 ? 1 : 0;
    const kids = before * a.child + firstFrom2018At30k * a.child + (from - firstFrom2018At30k) * a.childSecondFrom2018;
    add('children', `บุตร ${before + from} คน`, kids, null, kids, 'คนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561 ได้คนละ 60,000 บาท');
  }
  const parents = count(f.parents);
  if (parents > 0) {
    const used = Math.min(parents, a.parentMax);
    add('parents', `พ่อแม่ที่ดูแล ${parents} คน`, parents * a.parent, a.parentMax * a.parent, used * a.parent,
      parents > a.parentMax ? `นับได้สูงสุด ${a.parentMax} คน (พ่อแม่ตัวเองและคู่สมรส)` : undefined);
  }
  const disabled = count(f.disabled);
  if (disabled > 0) add('disabled', `ผู้พิการที่อุปการะ ${disabled} คน`, disabled * a.disabled, null);
  if (num(f.maternity) > 0) add('maternity', 'ค่าฝากครรภ์และคลอดบุตร', num(f.maternity), a.maternity);

  add('socialSecurity', 'ประกันสังคม', d.socialSecurity, a.socialSecurity);

  const healthAllowed = Math.min(d.healthInsurance, a.health);
  const lifeAllowed = Math.min(d.lifeInsurance, a.lifeHealthCombined - healthAllowed);
  add('lifeInsurance', 'ประกันชีวิต', d.lifeInsurance, a.lifeHealthCombined, lifeAllowed,
    d.lifeInsurance > lifeAllowed ? `รวมกับประกันสุขภาพได้ไม่เกิน ${baht(a.lifeHealthCombined)} บาท` : undefined);
  add('healthInsurance', 'ประกันสุขภาพตัวเอง', d.healthInsurance, a.health, healthAllowed);
  add('parentHealthInsurance', 'ประกันสุขภาพพ่อแม่', d.parentHealthInsurance, a.parentHealth);
  const lifeHealthLeft = a.lifeHealthCombined - lifeAllowed - healthAllowed;
  setRemaining('lifeInsurance', lifeHealthLeft);
  setRemaining('healthInsurance', Math.min(a.health - healthAllowed, lifeHealthLeft));

  // กลุ่มเกษียณ
  const pensionCap = Math.min(totalIncome * a.pensionRate, a.pensionCap);
  const retire = {
    pvd: { label: 'กองทุนสำรองเลี้ยงชีพ (PVD)', cap: totalIncome * a.pvdRate },
    gpf: { label: 'กบข.', cap: totalIncome * a.gpfRate },
    rmf: { label: 'RMF', cap: totalIncome * a.rmfRate },
    pensionInsurance: { label: 'ประกันชีวิตแบบบำนาญ', cap: pensionCap },
    nsf: { label: 'กอช.', cap: a.nsf },
  } as const;
  type RK = keyof typeof retire;
  const rAllowed: Record<RK, number> = { pvd: 0, gpf: 0, rmf: 0, pensionInsurance: 0, nsf: 0 };
  const rNote: Partial<Record<RK, string>> = {};
  for (const k of Object.keys(retire) as RK[]) rAllowed[k] = Math.min(d[k], retire[k].cap);
  let over = (Object.values(rAllowed) as number[]).reduce((s, v) => s + v, 0) - a.retirementGroupCap;
  for (const k of ['rmf', 'pensionInsurance', 'gpf', 'pvd', 'nsf'] as RK[]) {
    if (over <= 0) break;
    const cut = Math.min(over, rAllowed[k]);
    if (cut > 0) {
      rAllowed[k] -= cut;
      over -= cut;
      rNote[k] = `กลุ่มเกษียณ (RMF, PVD, กบข., บำนาญ, กอช.) รวมกันได้ไม่เกิน ${baht(a.retirementGroupCap)} บาท`;
    }
  }
  const groupLeft = a.retirementGroupCap - (Object.values(rAllowed) as number[]).reduce((s, v) => s + v, 0);
  for (const k of ['pvd', 'gpf', 'rmf', 'pensionInsurance', 'nsf'] as RK[]) {
    const cap = round2(Math.min(retire[k].cap, a.retirementGroupCap));
    add(k, retire[k].label, d[k], cap, rAllowed[k], rNote[k]);
    setRemaining(k, Math.min(cap - rAllowed[k], groupLeft));
  }

  add('thaiEsg', 'Thai ESG / Thai ESGX', d.thaiEsg, round2(Math.min(totalIncome * a.esgRate, a.esgCap)));
  if (d.homeLoanInterest > 0) add('homeLoanInterest', 'ดอกเบี้ยบ้าน', d.homeLoanInterest, a.homeLoanInterest);
  if (d.politicalDonation > 0) add('politicalDonation', 'บริจาคพรรคการเมือง', d.politicalDonation, a.political);

  // บริจาค คิดจากเงินที่เหลือหลังหักทุกอย่าง
  const beforeDonation = lines.reduce((s, l) => s + l.allowed, 0);
  const donationBase = Math.max(0, totalIncome - exemption - totalExpenses - beforeDonation);
  const donationClaim = d.donationGeneral + 2 * d.donationDouble;
  if (donationClaim > 0) {
    const cap = round2(donationBase * a.donationRate);
    add('donation', 'เงินบริจาค', donationClaim, cap, Math.min(donationClaim, cap),
      d.donationDouble > 0 ? 'บริจาคการศึกษา กีฬา โรงพยาบาลรัฐ ผ่าน e-Donation นับ 2 เท่า' : undefined);
  }

  const totalDeductions = round2(lines.reduce((s, l) => s + l.allowed, 0));
  const netIncome = round2(Math.max(0, totalIncome - totalExpenses - exemption - totalDeductions));

  // ---------- ภาษี ----------
  const m1 = taxByBrackets(netIncome, rules.personalBrackets);
  const nonSalary = incomes.filter((i) => i.occupation !== 'employee').reduce((s, i) => s + i.amount, 0);
  let taxMethod2 = 0;
  if (nonSalary >= rules.method2.threshold) {
    const t = round2(nonSalary * rules.method2.rate);
    taxMethod2 = t > rules.method2.waiveUpTo ? t : 0;
  }
  const methodUsed: 1 | 2 = taxMethod2 > m1.tax ? 2 : 1;
  const tax = Math.max(m1.tax, taxMethod2);
  const withheld = num(raw.withheld);

  const onlySalary = incomes.length > 0 && incomes.every((i) => i.occupation === 'employee');
  const mustFile = totalIncome > (onlySalary || incomes.length === 0 ? rules.filing.salaryOnly : rules.filing.other);

  const warnings: PersonalWarning[] = [];
  if (incomes.some((i) => rules.halfYearOccupations.includes(i.occupation))) warnings.push('halfYear');
  const vatable = incomes
    .filter((i) => i.occupation !== 'employee' && !rules.vatExemptOccupations.includes(i.occupation))
    .reduce((s, i) => s + i.amount, 0);
  if (vatable > rules.vatThreshold) warnings.push('vat');
  if (methodUsed === 2) warnings.push('method2');

  return {
    totalIncome,
    expenseLines,
    totalExpenses,
    exemption,
    deductionLines: lines,
    totalDeductions,
    netIncome,
    bracketLines: m1.lines,
    marginalRate: m1.marginalRate,
    taxMethod1: m1.tax,
    taxMethod2,
    methodUsed,
    tax,
    withheld,
    balance: round2(tax - withheld),
    mustFile,
    form: onlySalary || incomes.length === 0 ? 'ภ.ง.ด.91' : 'ภ.ง.ด.90',
    warnings,
  };
}
