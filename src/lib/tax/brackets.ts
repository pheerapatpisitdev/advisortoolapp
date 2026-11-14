import type { Bracket } from './types';

export interface BracketLine {
  from: number;
  to: number | null;
  rate: number;
  amount: number;
  tax: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** คิดภาษีแบบขั้นบันได คืนภาษีรวม รายการต่อขั้น (เฉพาะขั้นที่มีเงินตกถึง) และอัตราขั้นสุดท้าย */
export function taxByBrackets(
  net: number,
  brackets: Bracket[],
): { tax: number; lines: BracketLine[]; marginalRate: number } {
  const amountIn = Math.max(0, Number(net) || 0);
  const lines: BracketLine[] = [];
  let from = 0;
  let marginalRate = 0;
  for (const b of brackets) {
    if (amountIn <= from) break;
    const top = b.upTo === null ? amountIn : Math.min(amountIn, b.upTo);
    const amount = top - from;
    lines.push({ from, to: b.upTo, rate: b.rate, amount, tax: round2(amount * b.rate) });
    marginalRate = b.rate;
    if (b.upTo === null) break;
    from = b.upTo;
  }
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
  return { tax, lines, marginalRate };
}
