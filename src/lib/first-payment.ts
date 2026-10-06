import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";

/** How many monthly instalments the company collects with the application. */
export const FIRST_MONTHLY_INSTALMENTS = 2;

/**
 * What paying monthly takes up front, in satang: the company collects the first two
 * instalments with the application and deducts monthly from the third (the bots' FAQ says
 * the same). Undefined when monthly is not one of the instalments the company will take.
 */
export function firstMonthlyPayment(modes: ModePremium[]): number | undefined {
  const monthly = modes.find((m) => m.mode === "monthly" && !m.belowMinimum);
  return monthly ? monthly.total * FIRST_MONTHLY_INSTALMENTS : undefined;
}

/**
 * The line a copied quote carries under its รายเดือน line, or nothing for any other
 * instalment and for a monthly one the company will not take.
 */
export function firstPaymentLines(m: ModePremium): string[] {
  const first = firstMonthlyPayment([m]);
  return first === undefined ? [] : [`(ชำระเบี้ยครั้งแรก ${FIRST_MONTHLY_INSTALMENTS} งวด ${formatBaht(first)} บาท)`];
}
