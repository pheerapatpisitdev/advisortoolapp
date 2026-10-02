import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { planLabel } from "@/lib/ihealthy-facts";
import { cardQuery } from "@/lib/ihealthy-link";
import { phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable, type IHealthyTable } from "@/lib/ihealthy-table";
import type { IHealthyInitial } from "@/lib/ihealthy-choice";
import { one, type Reply } from "../common";
import { HEALTH_HAND_OVER, arrangementFor } from "./quote";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/**
 * What one plan costs this customer a year, in baht, or nothing where it has no price.
 *
 * The yearly instalment rather than the monthly: it is the one every plan has — the company
 * refuses a monthly instalment under its own floor — and a menu with a gap in it reads as a
 * plan that cannot be bought.
 */
function yearly(table: IHealthyTable, age: number, sex: Sex, plan: string): string | undefined {
  const v = arrangementFor({ age, sex, plan });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  const annual = priced?.total.find((m) => m.mode === "annual");
  return annual ? formatBaht(annual.total) : undefined;
}

/**
 * What the customer is told the totals are made of, once, under the list.
 *
 * The sum is read off the arrangement the prices were quoted on rather than written into the
 * sentence. It was written in, and when the page moved from the 150,000-baht base to the
 * 50,000-baht Health Ultra Package the sentence stayed behind: the customer was told a sum
 * that nothing on the card, and nothing in the price beside it, was quoted for.
 */
function whatIsInIt(table: IHealthyTable, v: IHealthyInitial): string {
  const base = table.bases.find((b) => b.variant === v.base);
  const name = base ? `${base.label} ` : "";
  return `(รวมสัญญาหลัก ${name}ทุน ${v.sumAssured.toLocaleString("en-US")}`
    + " กับค่าชดเชยรายวันแล้ว · ค่ารักษาที่เหลือจ่ายตามจริงทุกแผน)";
}

/** Priced, in the sheet's order, dropping any the engine has no figure for. */
function pricedPlans(table: IHealthyTable, age: number, sex: Sex, codes: string[]) {
  return codes
    .map((code) => ({ code, amount: yearly(table, age, sex, code) }))
    .filter((row): row is { code: string; amount: string } => row.amount !== undefined);
}

function lines(priced: { code: string; amount: string }[]): string {
  return priced.map((row) => `${planLabel(row.code)} ${row.amount} บาท`).join("\n");
}

/**
 * The three plans the adverts sell, priced, with the comparison table as a picture.
 *
 * Six plans as six lines of Thai in a chat is a list nobody reads; the same plans as a table
 * is something a customer compares, and they compare it on a phone — so the picture carries
 * the three the sales page shows on one, and the buttons under it are those three by name.
 */
export function healthMenu(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  if (age < table.ageMin || age > table.ageMax) {
    return one(`ไอเฮลท์ตี้ อัลตร้า รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ อายุ ${age} ปีอยู่นอกช่วงนี้ ${HEALTH_HAND_OVER}`);
  }
  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ${HEALTH_HAND_OVER}`);
  }

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const priced = pricedPlans(table, age, sex, phoneColumns(order, sellable));

  if (priced.length === 0) {
    return one(`ตอนนี้ยังคิดราคาให้ไม่ได้ครับ ${HEALTH_HAND_OVER}`);
  }

  // the picture opens on the first of them; nothing is highlighted, so which one only decides
  // the arrangement the table is priced from, and all of them share it
  const v = arrangementFor({ age, sex, plan: priced[0].code });
  return {
    messages: [{
      text: `${SEX_WORD[sex]} ${age} ปี เบี้ยรวมต่อปีครับ 🏥\n${lines(priced)}\n${whatIsInIt(table, v)}`,
      card: `/api/ihealthy-card/table?${cardQuery(table, v)}&fit=phone`,
    }],
    replies: priced.map((row) => planLabel(row.code)),
  };
}

/**
 * The plans the menu left out, by name and price.
 *
 * The adverts sell three of six. The other three are real and the company writes them, so a
 * customer who asks what else there is gets them rather than a shrug — and an age that has no
 * others is told that in one line instead of being shown an empty list.
 */
export function otherPlansReply(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  if (age < table.ageMin || age > table.ageMax || table.expired) return healthMenu(age, sex, today);

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const inMenu = phoneColumns(order, sellable);
  const rest = sellable.filter((code) => !inMenu.includes(code));

  if (rest.length === 0) {
    const names = sellable.map(planLabel).join(" กับ ");
    return {
      ...one(`อายุ ${age} ปี บริษัทเขียนไว้ให้เลือก ${sellable.length} แผนนี้ครับ — ${names}`),
      replies: sellable.map(planLabel),
    };
  }

  // counted rather than written: how many are left over is the rate table's answer, not ours
  const priced = pricedPlans(table, age, sex, rest);
  return {
    ...one(`อีก ${priced.length} แผนที่มีครับ เบี้ยรวมต่อปี\n${lines(priced)}`),
    replies: priced.map((row) => planLabel(row.code)),
  };
}
