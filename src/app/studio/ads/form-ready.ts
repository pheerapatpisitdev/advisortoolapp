/**
 * Whether the ads form may be sent, kept free of React so a test can pin the budget edges.
 *
 * The cap is checked here as well as on the server (the batch send's checkDailyBudget, send.ts): the buttons
 * sit outside a <form>, so the input's own `max` stops nothing, and without this a figure over
 * the cap was only refused after the owner pressed save.
 */

export interface FormState {
  hasPoster: boolean;
  /** the chosen ad account is not in baht */
  nonBaht: boolean;
  link: string;
  /** the budget box as typed */
  budget: string;
  pageId: string;
  actId: string;
  /** baht a day, from the setup (ADS_MAX_DAILY_BUDGET_THB) */
  maxDailyBudgetThb: number;
  /** traffic when left out: a traffic send needs a link, a lead send a form instead, a messages send neither */
  objective?: "traffic" | "leads" | "messages";
  /** the chosen lead form; "" while none is chosen */
  leadFormId?: string;
}

/** the typed budget as a number; NaN for an empty or non-numeric box */
export const budgetBaht = (budget: string): number => (budget.trim() === "" ? NaN : Number(budget));

/** a whole-baht figure that is above the cap, for the hint under the box */
export const overCap = (budget: string, max: number): boolean => {
  const n = budgetBaht(budget);
  return Number.isFinite(n) && n > max;
};

export function formReady(s: FormState): boolean {
  const n = budgetBaht(s.budget);
  return (
    s.hasPoster &&
    !s.nonBaht &&
    (s.objective === "leads" ? (s.leadFormId ?? "") !== "" : s.objective === "messages" || s.link.trim() !== "") &&
    Number.isInteger(n) && n >= 1 && n <= s.maxDailyBudgetThb &&
    s.pageId !== "" &&
    s.actId !== ""
  );
}
