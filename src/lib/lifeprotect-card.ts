import type { ModePremium } from "@/calc/mode-premiums";
import { formatSatang } from "@/calc/money";
import { PAY_MODE_LABEL } from "@/calc/types";
import type { PlanCardInput } from "@/lib/card-link";
import { displayPremium } from "@/lib/legacy-cta";
import { childPriceNote, lifeProtectFootnote, payerWords, waiverNote } from "@/lib/lifeprotect-cta";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import {
  addModes, lifeProtectModes, medicalModes, medicalPlansAt, needsParent, pickedRider, riderDueByYear, riderModes,
  riderSoldAt, totalModes, type Payer,
} from "@/lib/lifeprotect-quote";

export const LIFEPROTECT_PLAN = "LIFEPROTECT";

/** One contract's share of the headline instalment, as the page's box lists it. */
export interface SplitRow {
  label: string;
  /** "+57.80", to the satang so the lines add up to the headline */
  amount: string;
}

/**
 * A Life Protect arrangement priced the way its sales page prices it — from the same table,
 * with the same functions, in the same order — so the card and the value table pictured from
 * it carry the page's figures and the page's sentences, riders and all (owner, 2026-10-06).
 */
export interface LifeProtectPriced {
  /** what is paid each instalment, plan and riders together; undefined with no price to show */
  paid: ModePremium[] | undefined;
  /** what the headline instalment is made of, when riders are part of it */
  split?: { title: string; rows: SplitRow[] };
  /** said right under the price: a waiver adds nothing the family receives */
  priceNote?: string;
  /** the child's note and the small print, at the foot */
  footNotes: string[];
  /** what the riders add to each policy year's premium, for the table and the drawing */
  riderDue?: (years: number) => number[];
}

/**
 * Undefined when the riders named cannot be priced on this insured — a waiver not sold at the
 * age, a child's พีบี without a parent in range, a medical plan the age may not buy. The page
 * never writes such a link, so one that arrives was edited by hand and gets no picture.
 */
export function lifeProtectPriced(input: PlanCardInput, today: Date): LifeProtectPriced | undefined {
  if (input.planCode !== LIFEPROTECT_PLAN) return undefined;
  const table = lifeProtectTable(today);
  const term = table.terms.find((t) => t.variant === input.variant);
  if (!term || input.age < table.ageMin || input.age > table.ageMax) return undefined;
  const who = { sex: input.sex, age: input.age, sumAssured: input.sumAssured };
  const modes = lifeProtectModes(table, term, who);
  const annual = modes?.find((m) => m.mode === "annual");
  const priced = Boolean(annual) && !table.expired;
  const asked = input.riders;

  const picked = asked?.waiver ? pickedRider(table, asked.waiver) : undefined;
  if (asked?.waiver && (!picked || !riderSoldAt(picked.rider, input.age))) return undefined;
  const child = picked && needsParent(picked.rider, input.age) ? picked.rider.child : undefined;
  // a parent is named exactly when a child's พีบี is priced off one
  if (Boolean(child) !== Boolean(asked?.payer)) return undefined;
  const payer: Payer | undefined = child ? asked!.payer : undefined;
  if (payer && child && (payer.age < child.payerMin || payer.age > child.payerMax)) return undefined;
  const riderPrice = picked && priced ? riderModes(table, term, who, picked, annual!.total, payer) : undefined;
  if (picked && priced && !riderPrice) return undefined;

  const medical = table.medical;
  const plan = asked?.medical;
  if (plan !== undefined && (!medical || !medicalPlansAt(table, medical, input.age).includes(plan))) return undefined;
  const medicalPrice = medical && plan !== undefined && !table.expired
    ? medicalModes(table, medical, input.age, plan)
    : undefined;

  const paid = modes ? totalModes(table, modes, addModes(riderPrice, medicalPrice)) : undefined;
  const headline = displayPremium(paid, table.expired);
  const at = (m: ModePremium[] | undefined) => (headline ? m?.find((x) => x.mode === headline.mode) : undefined);
  const riderPart = at(riderPrice);
  const medicalPart = at(medicalPrice);
  const basePart = at(modes);
  const split = headline && basePart && (riderPart || medicalPart)
    ? {
        title: `แยกตามสัญญา · ${PAY_MODE_LABEL[headline.mode]}`,
        rows: [
          { label: "สัญญาหลัก", amount: formatSatang(basePart.total) },
          ...(picked && riderPart
            ? [{ label: picked.option.name + payerWords(payer), amount: `+${formatSatang(riderPart.total)}` }] : []),
          ...(medical && medicalPart
            ? [{ label: `${medical.name} แผน ${plan!.toLocaleString("en-US")}`, amount: `+${formatSatang(medicalPart.total)}` }]
            : []),
        ],
      }
    : undefined;

  const riderAnnual = riderPrice?.find((m) => m.mode === "annual")?.total;
  const childNote = childPriceNote(input.age);
  return {
    paid,
    ...(split ? { split } : {}),
    ...(picked && riderPart ? { priceNote: waiverNote(picked.rider.name) } : {}),
    footNotes: [...(childNote ? [childNote] : []), lifeProtectFootnote(Boolean(medicalPart))],
    ...(riderPrice || medicalPrice
      ? {
          riderDue: (years: number) => riderDueByYear(
            table, term, input.age, years,
            picked && riderAnnual !== undefined ? { rider: picked.rider, annual: riderAnnual } : undefined,
            medicalPrice && plan !== undefined ? { plan } : undefined,
          ),
        }
      : {}),
  };
}
