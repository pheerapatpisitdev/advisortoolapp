import { formatMoney } from "./money";
import { ACTIONABLE_KEYS, type DeductionLine, type PersonalResult } from "./personal";
import type { Rules } from "./types";

/**
 * What the tax page says outside the engine (owner, 2026-11-14, ก ก ก ก on mockup
 * https://claude.ai/artifact/U4tvaUqZU5zkTnZF5qi6R8): the headline, the rights still unused,
 * which of our own calculators each one leads to, and the text an agent copies to a customer.
 * The engine beside this file came from the stand-alone tax app unchanged.
 */

/** an unused right that one of our plans fills: the calculator an agent opens next (ก on question 3) */
export const TAX_PRODUCT_LINKS: Record<string, { href: string; label: string }> = {
  lifeInsurance: { href: "/lifeprotect", label: "Life Protect" },
  healthInsurance: { href: "/ihealthy-ultra", label: "iHealthy Ultra" },
  pensionInsurance: { href: "/bumnan95", label: "บำนาญ 95" },
};

export interface TaxHeadline {
  title: string;
  /** null where there is nothing to pay and nothing coming back */
  amount: number | null;
  tone: "pay" | "refund";
}

export function taxHeadline(r: PersonalResult): TaxHeadline {
  if (r.tax === 0 && r.balance === 0) return { title: "ไม่ต้องเสียภาษี", amount: null, tone: "refund" };
  if (r.balance > 0) return { title: "ต้องจ่ายเพิ่มตอนยื่นแบบ", amount: r.balance, tone: "pay" };
  if (r.balance < 0) return { title: "ได้เงินคืน", amount: -r.balance, tone: "refund" };
  return { title: "ไม่ต้องจ่ายเพิ่ม ภาษีที่ถูกหักไว้พอดีแล้ว", amount: null, tone: "refund" };
}

/** the rights a customer can still buy into; none when the 0.5% method sets the tax, since a deduction does not move it */
export function unusedRights(r: PersonalResult): DeductionLine[] {
  if (r.methodUsed !== 1 || r.marginalRate <= 0) return [];
  return r.deductionLines.filter((l) => ACTIONABLE_KEYS.includes(l.key) && l.remaining > 0);
}

/** what every further 10,000 baht of deduction saves, at the rate the last baht is taxed */
export function savingPer10k(r: PersonalResult): number {
  return 10000 * r.marginalRate;
}

/** the summary an agent pastes into a customer's chat; empty until there is an income */
export function taxSummaryText(r: PersonalResult, rules: Rules): string {
  if (r.totalIncome <= 0) return "";
  const h = taxHeadline(r);
  const lines = [
    `สรุปภาษีเงินได้ปี ${rules.taxYear} (ประมาณการ)`,
    `รายได้ทั้งปี ${formatMoney(r.totalIncome)} บาท`,
    `เงินได้สุทธิ ${formatMoney(r.netIncome)} บาท`,
    `ภาษีทั้งปี ${formatMoney(r.tax)} บาท`,
  ];
  if (r.withheld > 0) {
    lines.push(`ถูกหักไปแล้ว ${formatMoney(r.withheld)} บาท → ${h.title}${h.amount !== null ? ` ${formatMoney(h.amount)} บาท` : ""}`);
  } else if (h.amount === null) {
    lines.push(h.title);
  }
  const unused = unusedRights(r);
  if (unused.length > 0) {
    lines.push("", "ยังลดหย่อนได้อีก");
    for (const l of unused) lines.push(`• ${l.label} ${formatMoney(l.remaining)} บาท`);
    lines.push(`ลดหย่อนเพิ่มทุก 10,000 บาท ประหยัดภาษี ${formatMoney(savingPer10k(r))} บาท`);
  }
  lines.push("", "ตัวเลขนี้เป็นการประมาณการ ไม่ใช่คำแนะนำทางภาษี");
  return lines.join("\n");
}
