export type OccupationId =
  | 'employee'
  | 'freelance'
  | 'medical'
  | 'professional'
  | 'contractor'
  | 'landlord'
  | 'merchant'
  | 'performer';

export type ExpenseRule =
  | { kind: 'capped50' } // 50% รวมกันทุกอาชีพ capped50 ไม่เกิน sharedExpenseCap
  | { kind: 'flat'; rate: number }
  | { kind: 'performer' }; // ใช้ rules.performer

export interface Occupation {
  id: OccupationId;
  label: string;
  hint: string;
  incomeType: '40(1)' | '40(2)' | '40(5)' | '40(6)' | '40(7)' | '40(8)';
  expense: ExpenseRule;
  allowActual: boolean;
}

export interface Bracket {
  upTo: number | null;
  rate: number;
}

export interface Rules {
  taxYear: number;
  updatedAt: string;
  sources: { label: string; url: string }[];
  personalBrackets: Bracket[];
  sharedExpenseCap: number;
  performer: { firstTier: number; firstRate: number; restRate: number; cap: number };
  occupations: Occupation[];
  seniorExemption: number;
  allowance: {
    self: number;
    spouse: number;
    child: number;
    childSecondFrom2018: number;
    parent: number;
    parentMax: number;
    disabled: number;
    maternity: number;
    socialSecurity: number;
    lifeHealthCombined: number;
    health: number;
    parentHealth: number;
    pensionRate: number;
    pensionCap: number;
    pvdRate: number;
    gpfRate: number;
    rmfRate: number;
    nsf: number;
    retirementGroupCap: number;
    esgRate: number;
    esgCap: number;
    homeLoanInterest: number;
    political: number;
    donationRate: number;
  };
  method2: { threshold: number; rate: number; waiveUpTo: number };
  filing: { salaryOnly: number; other: number };
  vatThreshold: number;
  /** ใช้เติมค่าประกันสังคมให้พนักงานอัตโนมัติ (มาตรา 33) */
  socialSecurityEmployee: { rate: number; monthlyCap: number };
  /** รายได้ที่ได้รับยกเว้น VAT (ค่าเช่าที่อยู่อาศัย บริการรักษาพยาบาล) ไม่ต้องเตือนให้จด VAT */
  vatExemptOccupations: OccupationId[];
  /** อาชีพที่ต้องยื่นภาษีครึ่งปี (ภ.ง.ด.94) */
  halfYearOccupations: OccupationId[];
  company: {
    smeCapital: number;
    smeRevenue: number;
    smeBrackets: Bracket[];
    flatRate: number;
    dividendTax: number;
  };
}
