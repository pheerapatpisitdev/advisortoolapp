import type { PlanCardInput } from "@/lib/card-link";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { iHealthyFacts as benefitSheet } from "@/lib/ihealthy-facts";
import { LIFEPROTECT_PLAN } from "@/lib/lifeprotect-card";
import { quoteCard, valueTableCard, type ValueTableRow } from "@/lib/quote-card";
import type { SceneMotion } from "./timeline";

/**
 * วิดีโอนำเสนอ (owner, 2026-10-11): what the scenes show and say, taken from the same quote the
 * cards and the value table are drawn from — the voice never says a figure a card does not.
 *
 * Three products: Life Protect (มรดก), iShield (a lump sum on a critical illness) and iHealthy
 * Ultra (a health plan, compared against the plans the agent picks). The spoken lines are the
 * owner's casual wording, approved in the mockups the same day: no "เบี้ย", "เสียชีวิต" or
 * "เวนคืน" in the voice — "ค่าใช้จ่าย", "ถ้าเป็นอะไรไป", "ขอเงินก้อนคืน". The screen keeps the
 * cards' own words. Words in a line are separated by single spaces: the subtitles light up one
 * of those pieces at a time.
 */

export type Product = "LIFEPROTECT" | "ISHIELD" | "IHEALTHY";
export type SceneKey = "lead" | "price" | "cover" | "value" | "compare" | "contact";

/** What the agent asked for. A row written before products existed has no `product`: Life Protect. */
export type VideoInput =
  | { product?: "LIFEPROTECT" | "ISHIELD"; variant: string; age: number; sex: "M" | "F"; sumAssured: number }
  | { product: "IHEALTHY"; age: number; sex: "M" | "F"; plan: string; compare: string[] };

export const productOf = (v: VideoInput): Product => v.product ?? "LIFEPROTECT";

export interface PriceRow { label: string; amount: string; main: boolean }
export interface CoverRow { label: string; amount: string; mark: boolean }
export interface ComparePlan { name: string; ceiling: string; room: string; opd: string; monthly: string; main: boolean }

/** Everything the clip shows, as the cards state it. Parts a product has not got are absent. */
export interface QuoteVideoFacts {
  product: Product;
  planLine: string;
  insuredWho: string;
  insuredLine: string;
  sex: "M" | "F";
  age: number;
  /** the figure the clip opens on, counted up: มรดก, the lump sum, the yearly ceiling */
  lead: { label: string; amount: string; baht: number; note?: string };
  /** the highlighted line under it: "ตกวันละ 79 บาท"; iHealthy's first-year monthly price */
  leadMark: string;
  /** "79"; none for iHealthy, whose price is a first year's and not a standing daily one */
  perDayAmount?: string;
  priceTitle: string;
  prices: PriceRow[];
  spokenPrice: { per: string; amount: string };
  /** the highlighted phrases under the price box */
  pills: string[];
  /** the red pen under them */
  penNote?: string;
  /** small print under the price box (iHealthy: what the price includes, and that it is a first year's) */
  priceNotes: string[];
  coverTitle: string;
  cover: CoverRow[];
  /** Life Protect draws its two death benefits as bars; the others list their rows */
  coverStyle: "bars" | "rows";
  coverPen?: string;
  coverNote?: string;
  coverToAge: number;
  payYears?: number;
  lastPayAge?: number;
  rows?: ValueTableRow[];
  totalPaid?: string;
  breakEven?: { age: number; cash: string; index: number };
  compare?: ComparePlan[];
  /** iHealthy: the plan's name, "Gold" */
  planName?: string;
  /** iHealthy: what each kind of cover pays, for the voice */
  benefits?: { label: string; amount: string }[];
  footNote?: string;
}

const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));
const SEX_WHO = { M: "คุณผู้ชาย", F: "คุณผู้หญิง" } as const;

export const planInput = (v: Extract<VideoInput, { variant: string }>): PlanCardInput => ({
  kind: "plan", planCode: productOf(v), variant: v.variant, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
});

/** The facts for an arrangement; undefined for anything the clip cannot state (no price, not sold). */
export function quoteVideoFacts(v: VideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  if (v.product === "IHEALTHY") return iHealthyFacts(v, today);
  return planFacts(v, today);
}

function planFacts(v: Extract<VideoInput, { variant: string }>, today: Date): QuoteVideoFacts | undefined {
  const product = productOf(v);
  const input = planInput(v);
  const card = quoteCard(input, today);
  const table = valueTableCard(input, today);
  if (!card || !table || !card.summary || !card.perDay || !card.legacy) return undefined;
  const section = card.sections[0];
  if (!section || section.rows.length === 0) return undefined;
  const paying = table.rows.filter((r) => r.due !== "—");
  const last = table.rows[table.rows.length - 1];
  const lastPaid = [...table.rows].reverse().find((r) => r.paid !== null);
  if (!paying.length || !last || !lastPaid?.paid) return undefined;
  const beIndex = table.rows.findIndex((r) => r.breakEven);
  const be = beIndex >= 0 ? table.rows[beIndex] : undefined;
  const main = card.summary.rows.find((r) => r.main) ?? card.summary.rows[0];
  const spoken = card.summary.rows.find((r) => r.label === "รายเดือน") ?? main;
  const lifeProtect = product === LIFEPROTECT_PLAN;
  const coverToAge = last.age + 1;
  const lump = lifeProtect ? undefined : section.rows[0];
  return {
    product,
    planLine: card.planLine,
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: v.sex,
    age: v.age,
    lead: lifeProtect
      ? { label: "มรดก", amount: card.legacy.amount, baht: digits(card.legacy.amount), ...(card.legacy.note ? { note: card.legacy.note } : {}) }
      : { label: "รับเงินก้อนเมื่อตรวจพบโรคร้ายแรง", amount: lump!.amount, baht: digits(lump!.amount) },
    leadMark: card.perDay,
    perDayAmount: card.perDay.replace(/[^\d,]/g, ""),
    priceTitle: card.summary.title,
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.main })),
    spokenPrice: { per: spoken.label === "รายปี" ? "ปีละ" : spoken.label === "ราย 6 เดือน" ? "งวดละ" : "เดือนละ", amount: spoken.amount },
    pills: lifeProtect ? [`จ่ายเบี้ยแค่ ${paying.length} ปี`, "เบี้ยคงที่ตลอด"] : [`จ่ายเบี้ยแค่ ${paying.length} ปี`, `คุ้มครองถึงอายุ ${coverToAge}`],
    penNote: `จ่ายครบอายุ ${paying[paying.length - 1].age} แล้วหยุดส่ง`,
    priceNotes: [],
    coverTitle: section.title,
    cover: section.rows.map((r) => ({ label: r.label, amount: r.amount, mark: Boolean(r.mark) })),
    coverStyle: lifeProtect ? "bars" : "rows",
    coverPen: `คุ้มครองถึงอายุ ${coverToAge} ปี`,
    ...(lifeProtect || !card.footNotes?.[0] ? {} : { coverNote: card.footNotes[0] }),
    coverToAge,
    payYears: paying.length,
    lastPayAge: paying[paying.length - 1].age,
    rows: table.rows,
    totalPaid: lastPaid.paid,
    ...(be?.cash ? { breakEven: { age: be.age, cash: be.cash, index: beIndex } } : {}),
    ...(card.footNotes?.[0] ? { footNote: card.footNotes[0] } : {}),
  };
}

/** the iHealthy card's row of this name, at this column */
function cellOf(rows: { label: string; cells: { text: string }[]; span?: string }[], label: string, i: number): string | undefined {
  const row = rows.find((r) => r.label === label);
  return row?.span ?? row?.cells[i]?.text;
}

function iHealthyFacts(v: Extract<VideoInput, { product: "IHEALTHY" }>, today: Date): QuoteVideoFacts | undefined {
  const card = iHealthyCard(new URLSearchParams({ age: String(v.age), sex: v.sex, plan: v.plan }), today);
  const at = card.columns.findIndex((c) => c.selected);
  const col = card.columns[at];
  if (!col || !col.sold || !card.premium) return undefined;
  // the card settles an age the plan cannot be sold at onto one it can: a clip says what was asked or nothing
  if (!card.insuredWho.endsWith(` ${v.age} ปี`)) return undefined;
  const price = (label: string, i: number) => card.premiumRows.find((r) => r.label === label)?.cells[i]?.text ?? "";
  const monthly = price("รายเดือน", at);
  const prices = card.premiumRows
    .map((r) => ({ label: r.label, amount: r.cells[at]?.text ?? "", main: r.label === "รายเดือน" }))
    .filter((r) => digits(r.amount) > 0);
  if (!monthly || prices.length === 0) return undefined;
  const benefits = card.rows
    .filter((r) => r.label !== "วงเงินค่ารักษาต่อปี")
    .map((r) => ({ label: r.label, amount: r.span ? r.span.split(" · ")[0] : r.cells[at]?.text ?? "" }))
    .filter((b) => b.amount && b.amount !== "-");
  const wanted = new Set([v.plan, ...v.compare]);
  const codes = iHealthyPlanCodes();
  const compare = card.columns
    .map((c, i) => ({ c, i, code: codes[i] }))
    .filter(({ c, code }) => c.sold && code && wanted.has(code))
    .slice(0, 3)
    .map(({ c, i }) => ({
      name: c.name, ceiling: c.ceiling, main: i === at,
      room: (cellOf(card.rows, "ค่าห้องและค่าอาหาร", i) ?? "-").replace(" ต่อวัน", ""),
      opd: cellOf(card.rows, "ผู้ป่วยนอก OPD", i) ?? "-",
      monthly: price("รายเดือน", i),
    }));
  const ceilingNum = Number.parseFloat(col.ceiling.replace(/,/g, ""));
  const ceiling = Math.round(ceilingNum * (col.ceiling.includes("ล้าน") ? 1_000_000 : 1));
  if (!Number.isFinite(ceiling) || ceiling <= 0) return undefined;
  return {
    product: "IHEALTHY",
    planLine: card.planLine,
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: v.sex,
    age: v.age,
    planName: col.name,
    lead: { label: "วงเงินค่ารักษาต่อปี", amount: ceiling.toLocaleString("en-US"), baht: ceiling },
    leadMark: `เบี้ยปีแรก เดือนละ ${monthly} บาท`,
    priceTitle: "เบี้ยประกันปีแรก",
    prices,
    spokenPrice: { per: "เดือนละ", amount: monthly },
    pills: [],
    priceNotes: [card.lines.map((l) => l.label).join(" · "), "เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น"],
    coverTitle: `แผน ${col.name} คุ้มครอง`,
    cover: benefits.map((b) => ({ label: b.label, amount: b.amount, mark: true })),
    coverStyle: "rows",
    coverToAge: 98,
    benefits,
    ...(compare.length >= 2 ? { compare } : {}),
  };
}

/** the iHealthy plans in the card's column order, by code: the card draws every plan, in the benefit sheet's order, when no `fit` is asked for */
const iHealthyPlanCodes = (): string[] => benefitSheet().plans.map((p) => p.code);

/** "1 ล้าน", "1.5 ล้าน", "800,000" — how a sum is said aloud */
export function spokenBaht(baht: number): string {
  if (baht >= 1_000_000 && baht % 100_000 === 0) return `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return baht.toLocaleString("en-US");
}

/** "2 ล้านบาท" runs together as it is said; a figure in digits keeps its space */
const spokenWithBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};

/**
 * A customer's name as the clip says it: "คุณ" taken off (the voice adds its own), letters,
 * marks and spaces only, at most 30 characters. Empty when nothing usable is left.
 */
export function cleanCustomerName(raw: string | undefined | null): string {
  const s = (raw ?? "").normalize("NFC").replace(/^\s*คุณ\s*/, "").replace(/[^\p{L}\p{M}\s.]/gu, "").replace(/\s+/g, " ").trim();
  return s.slice(0, 30).trim();
}

export interface SceneScript { key: SceneKey; voice: string }

/** How each kind of iHealthy cover is said aloud */
const SAID: Record<string, string> = {
  "Day Surgery": "ผ่าตัดเล็ก",
  "อุบัติเหตุ OPD 24 ชม": "อุบัติเหตุ",
  "มะเร็ง รังสีรักษา": "รักษามะเร็ง",
};

function healthCoverLine(f: QuoteVideoFacts): string {
  const b = f.benefits ?? [];
  const room = b.find((x) => x.label === "ค่าห้องและค่าอาหาร");
  const actual = b.filter((x) => x.amount === "ตามที่จ่ายจริง" && SAID[x.label]).map((x) => SAID[x.label]);
  const opd = b.find((x) => x.label === "ผู้ป่วยนอก OPD");
  const daily = b.find((x) => x.label === "ค่าชดเชยรายวัน");
  const parts: string[] = [];
  if (room) parts.push(`ค่าห้องวันละ ${room.amount.replace(" ต่อวัน", "")} บาท`);
  if (actual.length) parts.push(`${actual.length > 1 ? `${actual.slice(0, -1).join(" ")} และ${actual[actual.length - 1]}` : actual[0]} จ่ายตามจริง`);
  if (opd) parts.push(opd.amount === "ตามที่จ่ายจริง" ? "ผู้ป่วยนอกก็จ่ายตามจริง" : `มีผู้ป่วยนอกปีละ ${opd.amount} บาท`);
  if (daily) parts.push(`และนอนโรงพยาบาลรับเพิ่มวันละ ${daily.amount.replace(/[^\d,]/g, "")} บาท`);
  return `${parts.join(" ")}ค่ะ`;
}

/** The spoken lines, in the owner's casual wording (mockups, 2026-10-11). */
export function quoteVideoScript(f: QuoteVideoFacts, customer?: string): SceneScript[] {
  const name = cleanCustomerName(customer);
  const hello = name ? `สวัสดีค่ะ คุณ${name}` : "สวัสดีค่ะ";
  const who = name ? `อายุ ${f.age}` : `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  const closing = name
    ? `คุณ${name}สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ`
    : "สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ";

  if (f.product === "IHEALTHY") {
    const others = (f.compare ?? []).filter((p) => !p.main);
    return [
      { key: "lead", voice: `${hello} ขอเล่าแผนประกันสุขภาพนี้ให้ฟังสั้นๆ นะคะ ${name ? "" : `${who} `}แผน ${f.planName} เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ`.replace(/\s+/g, " ") },
      { key: "price", voice: `ปีแรกค่าใช้จ่ายเดือนละ ${f.spokenPrice.amount} บาท รวมประกันชีวิตกับค่าชดเชยรายวันไว้แล้วค่ะ` },
      { key: "cover", voice: healthCoverLine(f) },
      ...(others.length
        ? [{ key: "compare" as const, voice: `ถ้าอยากเทียบ ${others.map((p) => `แผน ${p.name} วงเงิน ${p.ceiling} เดือนละ ${p.monthly} บาท`).join(" และ")} ต่ออายุได้ถึงอายุ ${f.coverToAge} เลยค่ะ` }]
        : []),
      { key: "contact", voice: closing },
    ];
  }

  const value = f.breakEven
    ? `ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน จ่ายครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี พออายุ ${f.breakEven.age} ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ ${f.breakEven.cash} บาท มากกว่าที่จ่ายไปทั้งหมดแล้วค่ะ`
    : `ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน จ่ายครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ตามตารางเลยค่ะ`;

  if (f.product === "ISHIELD") {
    const [major, early, death, maturity] = f.cover;
    const count = (label?: string) => label?.match(/\((\d+) โรค\)/)?.[1];
    const parts = [
      major && `ตรวจเจอโรคร้ายระยะรุนแรง${count(major.label) ? ` ${count(major.label)} โรค` : ""} รับ ${spokenBaht(digits(major.amount))}`,
      early && `เจอระยะเริ่มต้นอีก${count(early.label) ? ` ${count(early.label)} โรค` : ""} รับโรคละ ${spokenBaht(digits(early.amount))}`,
      death && `ถ้าเป็นอะไรไป ครอบครัวได้ ${spokenBaht(digits(death.amount))}`,
      maturity && `และถ้าอยู่ครบอายุ ${f.coverToAge} ก็รับคืน ${spokenBaht(digits(maturity.amount))}`,
    ].filter(Boolean);
    return [
      { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ทำทุน ${spokenBaht(digits(f.insuredLine))} ถ้าตรวจเจอโรคร้ายแรง รับเงินก้อนทันที ${spokenWithBaht(f.lead.baht)}ค่ะ` },
      { key: "price", voice: `ค่าใช้จ่ายตกแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท จ่ายแค่ ${f.payYears} ปีก็จบ แต่ดูแลยาวถึงอายุ ${f.coverToAge} เลยค่ะ` },
      { key: "cover", voice: `${parts.join(" ")}ค่ะ` },
      { key: "value", voice: value },
      { key: "contact", voice: closing },
    ];
  }

  // Life Protect
  const [first, second] = f.cover;
  const beforeAge = first?.label.match(/(\d+)/)?.[1];
  const cover = second && beforeAge
    ? `ถ้าเป็นอะไรไปก่อนอายุ ${beforeAge} ครอบครัวได้ ${spokenBaht(digits(first.amount))} หลังจากนั้นได้ ${spokenBaht(digits(second.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`
    : `ถ้าเป็นอะไรไป ครอบครัวได้ ${spokenBaht(digits(first.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`;
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ทำทุน ${spokenBaht(digits(f.insuredLine))} ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ค่ะ` },
    { key: "price", voice: `ค่าใช้จ่ายตกแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท จ่ายแค่ ${f.payYears} ปีก็จบ ราคาไม่ขึ้นเลยตลอดที่จ่ายค่ะ` },
    { key: "cover", voice: cover },
    { key: "value", voice: value },
    { key: "contact", voice: closing },
  ];
}

/** How each scene of this clip moves (timeline.ts draws the frames from it). */
export function sceneMotion(f: QuoteVideoFacts, key: SceneKey): SceneMotion {
  switch (key) {
    case "lead": return { count: true, sweeps: 1 };
    case "price": return { count: true, sweeps: f.pills.length ? 2 : 1 };
    case "cover": return f.coverStyle === "bars" ? { bars: true, sweeps: 1 } : { sweeps: f.cover.length, spread: true };
    case "value": return { pan: true };
    case "compare": return { ring: true };
    case "contact": return {};
  }
}
