import { coverIn, peopleIn } from "@/lib/assistant/common";
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import { iHealthyTable } from "@/lib/ihealthy-table";
import type { LineMessage } from "@/lib/line/client";
import { C } from "@/lib/line/rich-menu-image";
import { videoFormLink, videoStartOfChat } from "@/lib/line/agent-video";
import type { VideoStart } from "@/lib/quote-video/link";
import type { QuoteVideoFacts, VideoInput } from "@/lib/quote-video/script";

/**
 * สั่งคลิปในแชท LINE (ทาง ค, owner chose ก ก ก 2026-11-27, mockup
 * https://claude.ai/artifact/S5X3j9dZbvR7Kij2prLHsS): a linked agent types an order — all of it in
 * one line, or a piece at a time while the bot asks for what is missing with buttons (ก) — for
 * Life Protect, iHealthy, iShield or มรดก (ก); a summary card, then the clip. Rule-only: nothing is
 * guessed by a model. This file is the words and the reading; clip-order-run.ts does the work.
 */

export type OrderProduct = "LIFEPROTECT" | "IHEALTHY" | "ISHIELD" | "LEGACY";
export type OrderStyle = "motion" | "classic";

/** the order as far as the chat has got, kept on the agent's LINE row (ins_agent_line.clip_draft) */
export interface ClipDraft {
  product?: OrderProduct;
  sex?: "M" | "F";
  age?: number;
  /** Life Protect and iShield */
  sum?: number;
  variant?: string;
  /** iHealthy's plan code ("SILVER") */
  plan?: string;
  /** มรดก: the millions the family receives, 1–10 */
  tier?: number;
  /** the customer's name for the clip, without คุณ */
  customer?: string;
  style: OrderStyle;
  /** when the chat last touched it, ISO */
  at: string;
}

/** an order left this long is forgotten: the next message is a new conversation */
export const DRAFT_MINUTES = 30;
/** the look a LINE order starts on, as the mockup's card (Motion ฿10) */
export const ORDER_STYLE: OrderStyle = "motion";
/** each plan's paying term when the order names none: the form's own (QuoteVideoBoard DEFAULT_TERM) */
const DEFAULT_TERM = { LIFEPROTECT: "WLF19H", ISHIELD: "WLCI10" } as const;
const TERM_YEARS: Record<string, number> = { WLF09H: 9, WLF19H: 19, WLF99H: 99, WLCI05: 5, WLCI10: 10, WLCI15: 15, WLCI20: 20 };

export const PLAN_NAMES: Record<OrderProduct, string> = {
  LIFEPROTECT: "Life Protect", IHEALTHY: "iHealthy Ultra", ISHIELD: "iShield", LEGACY: "มรดก",
};

export function freshDraft(raw: unknown, now = Date.now()): ClipDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<ClipDraft>;
  const at = Date.parse(String(d.at ?? ""));
  if (!Number.isFinite(at) || now - at > DRAFT_MINUTES * 60_000) return null;
  return { ...d, style: d.style === "classic" ? "classic" : "motion", at: String(d.at) } as ClipDraft;
}

/* ── the words an agent types ───────────────────────────────────────────────────────────── */

const VIDEO_WORD = /วิดีโอ|วีดีโอ|วิดิโอ|วีดิโอ|คลิป|video|clip/i;
const ASKING = /ทำ|สร้าง|สั่ง|ขอ|อยากได้|เป็น|ได้ไหม|ได้มั้ย|ยังไง|อย่างไร|\?/;

/** "ขอคลิป": the clip owed, or the latest one again — the button the bot puts under its words */
export const FETCH = "ขอคลิป";
export const asksForClip = (text: string) => /^\s*ขอ\s*คลิป\s*(?:หน่อย|ครับ|ค่ะ|คะ|ด้วย)?\s*$/.test(text);

/** the card's buttons send these words back */
export const START = "สร้างคลิป";
export const SWAP_STYLE = "เปลี่ยนแบบคลิป";
export const OTHER_PLAN = "แบบอื่น";
const CANCEL = /^\s*(?:ยกเลิก|ไม่เอาแล้ว|ไม่ทำแล้ว|cancel)\s*$/i;

export const startsClip = (text: string) => new RegExp(`^\\s*${START}`).test(text);
export const swapsStyle = (text: string) => text.trim() === SWAP_STYLE;
export const cancels = (text: string) => CANCEL.test(text);

const PRODUCT_WORDS: [OrderProduct, RegExp][] = [
  ["LIFEPROTECT", /life\s*protect|ไลฟ์\s*(?:โพรเทค|โปรเทค|โพรเทคท์)|(?<![a-z])lp(?![a-z])/i],
  ["IHEALTHY", /i\s*-?\s*health?y|ไอ\s*เฮลท์?(?:ตี้|ธี่)?|ไอเฮล/i],
  ["ISHIELD", /i\s*-?\s*shield|ไอ\s*ชิลด์?/i],
  ["LEGACY", /มรดก|legacy/i],
];

/** the plan an order names, or "other" for แบบอื่น */
export function productIn(text: string): OrderProduct | "other" | undefined {
  if (text.trim() === OTHER_PLAN) return "other";
  return PRODUCT_WORDS.find(([, re]) => re.test(text))?.[0];
}

/** one person: "ชาย 35", "หญิง 42", "ญ 40" */
export function personIn(text: string): { sex: "M" | "F"; age: number } | undefined {
  const people = peopleIn(text);
  return people.length === 1 ? people[0] : undefined;
}

/** the customer's name for the clip: "คุณสมชาย" → สมชาย; never ขอบคุณ */
export function customerIn(text: string): string | undefined {
  const m = /(?<!ขอบ)คุณ\s*([ก-ฮะ-๎a-zA-Z]{2,20})/.exec(text);
  return m?.[1];
}

/** a sum: "1 ล้าน", "5 แสน", "ทุน 800,000"; asked for alone, a plain "800000" too */
export function sumIn(text: string, alone = false): number | undefined {
  const said = coverIn(text);
  if (said) return said;
  if (!alone) return undefined;
  const m = /^\s*([1-9][\d,]{4,})\s*(?:บาท)?\s*$/.exec(text);
  const n = m ? Number(m[1].replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n >= 10_000 ? n : undefined;
}

/** iHealthy's plan: "แผน 3", "ซิลเวอร์", "silver"; asked for alone, a plain "3" */
export function ihPlanIn(text: string, alone = false): string | undefined {
  const plans = iHealthyTable().plans;
  const no = /แผน\s*(\d)/.exec(text)?.[1] ?? (alone ? /^\s*(\d)\s*$/.exec(text)?.[1] : undefined);
  if (no) return plans.find((p) => p.planNo === Number(no))?.code;
  return plans.find((p) => text.includes(p.name) || new RegExp(`\\b${p.code}\\b`, "i").test(text))?.code;
}

/** มรดก's tier: the millions the family receives, "3 ล้าน" → 3; asked for alone, a plain "3" */
export function tierIn(text: string, alone = false): number | undefined {
  const sum = coverIn(text);
  const n = sum ? sum / 1_000_000 : alone ? Number(/^\s*(\d{1,2})\s*(?:ล้าน)?\s*$/.exec(text)?.[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined;
}

/** the paying term an order names: "จ่าย 9 ปี", "ชำระ 99 ปี", "iShield 15" */
function termIn(text: string, product: OrderProduct): string | undefined {
  const years = Number(/(?:จ่าย|ชำระ)\s*(?:เบี้ย)?\s*(\d{1,2})\s*ปี/.exec(text)?.[1] ?? /(?:shield|ชิลด์?)\s*(\d{1,2})(?!\d)/i.exec(text)?.[1]);
  if (!years) return undefined;
  const prefix = product === "LIFEPROTECT" ? "WLF" : product === "ISHIELD" ? "WLCI" : "";
  return Object.entries(TERM_YEARS).find(([code, y]) => code.startsWith(prefix) && prefix && y === years)?.[0];
}

/**
 * A message that starts an order: a short one with a video word that asks (asks "สร้างเป็นวิดีโอ")
 * or already says what to make ("คลิป LP ชาย 35 ทุน 1 ล้าน คุณสมชาย"). Not "ขอคลิป", which fetches.
 */
export function startsOrder(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120 || asksForClip(t)) return false;
  if (!VIDEO_WORD.test(t)) return false;
  return ASKING.test(t) || Boolean(productIn(t)) || Boolean(personIn(t));
}

/* ── putting the order together ─────────────────────────────────────────────────────────── */

export type Need = "product" | "person" | "sum" | "plan" | "tier";

/** what the order still lacks, first first; null = ready for the card */
export function need(d: ClipDraft): Need | null {
  if (!d.product) return "product";
  if (!d.sex || d.age === undefined) return "person";
  if ((d.product === "LIFEPROTECT" || d.product === "ISHIELD") && !d.sum) return "sum";
  if (d.product === "IHEALTHY" && !d.plan) return "plan";
  if (d.product === "LEGACY" && !d.tier) return "tier";
  return null;
}

/** the quote this chat holds, as the order's start (agent-video.ts videoStartOfChat) */
export function draftFromChat(slots: WithPdf<AnySlots> | null | undefined, now = new Date()): ClipDraft | null {
  const s = videoStartOfChat(slots);
  if (!s || !isOrderProduct(s.product)) return null;
  return {
    product: s.product, sex: s.sex, age: s.age,
    ...(s.sumAssured ? { sum: s.sumAssured } : {}), ...(s.variant ? { variant: s.variant } : {}),
    ...(s.plan ? { plan: s.plan } : {}), ...(s.tier ? { tier: s.tier } : {}),
    style: ORDER_STYLE, at: now.toISOString(),
  };
}

const isOrderProduct = (p: unknown): p is OrderProduct => p === "LIFEPROTECT" || p === "IHEALTHY" || p === "ISHIELD" || p === "LEGACY";

/**
 * The order with what this message adds. `asked` is what the bot just asked for: an answer to it
 * may be a bare number ("3", "800000") that means nothing on its own. A plan named afresh starts
 * its own figures over: Life Protect's sum is not iShield's.
 */
export function withMessage(d: ClipDraft, text: string, asked: Need | null, now = new Date()): ClipDraft {
  const out: ClipDraft = { ...d, at: now.toISOString() };
  const named = productIn(text);
  if (named && named !== "other" && named !== d.product) {
    out.product = named;
    delete out.sum; delete out.variant; delete out.plan; delete out.tier;
  }
  const person = personIn(text);
  if (person) { out.sex = person.sex; out.age = person.age; }
  const customer = customerIn(text);
  if (customer) out.customer = customer;
  const product = out.product;
  if (product === "LIFEPROTECT" || product === "ISHIELD") {
    const sum = sumIn(text, asked === "sum");
    if (sum) out.sum = sum;
    const term = termIn(text, product);
    if (term) out.variant = term;
  }
  if (product === "IHEALTHY") {
    const plan = ihPlanIn(text, asked === "plan");
    if (plan) out.plan = plan;
  }
  if (product === "LEGACY") {
    const tier = tierIn(text, asked === "tier");
    if (tier) out.tier = tier;
  }
  return out;
}

/** the order as the clip's input: the form's own shape, with the look the card shows */
export function inputOf(d: ClipDraft): VideoInput | null {
  if (need(d) || !d.product || !d.sex || d.age === undefined) return null;
  const person = { age: d.age, sex: d.sex };
  const look = { style: d.style, length: "full" as const };
  switch (d.product) {
    case "LIFEPROTECT":
    case "ISHIELD":
      return { product: d.product, variant: d.variant ?? DEFAULT_TERM[d.product], ...person, sumAssured: d.sum!, ...look };
    case "IHEALTHY":
      return { product: "IHEALTHY", ...person, plan: d.plan!, compare: [], ...look };
    case "LEGACY":
      return { product: "LEGACY", ...person, tier: d.tier!, ...look };
  }
}

/** the form, opened on this order: แก้ละเอียดบนเว็บ */
export function formOf(d: ClipDraft): string {
  const start: VideoStart | null = d.product
    ? {
      product: d.product, ...(d.sex ? { sex: d.sex } : {}), ...(d.age !== undefined ? { age: d.age } : {}),
      ...(d.sum ? { sumAssured: d.sum } : {}), ...(d.variant ? { variant: d.variant } : {}),
      ...(d.plan ? { plan: d.plan } : {}), ...(d.tier ? { tier: d.tier } : {}),
    }
    : null;
  return videoFormLink(start);
}

/* ── what the bot says ──────────────────────────────────────────────────────────────────── */

const withButtons = (text: string, buttons: string[]): LineMessage => ({
  type: "text", text,
  quickReply: { items: buttons.map((b) => ({ type: "action" as const, action: { type: "message" as const, label: b.slice(0, 20), text: b } })) },
});

/** the question for what is missing, with its buttons */
export function question(n: Need, d: ClipDraft): LineMessage {
  switch (n) {
    case "product":
      return withButtons("ทำคลิปแบบประกันไหนครับ", [...Object.values(PLAN_NAMES).map((name) => name === "iHealthy Ultra" ? "iHealthy" : name), OTHER_PLAN]);
    case "person":
      return { type: "text", text: "ลูกค้าเพศอะไร อายุเท่าไหร่ครับ\nพิมพ์ได้เลย เช่น \"หญิง 42\"" };
    case "sum":
      return withButtons(`ทุนประกัน ${PLAN_NAMES[d.product!]} เท่าไหร่ครับ\nพิมพ์ได้เลย เช่น "1 ล้าน"`, ["5 แสน", "1 ล้าน", "2 ล้าน", "5 ล้าน"]);
    case "plan":
      return withButtons("เลือกแผน iHealthy ครับ", iHealthyTable().plans.map((p) => `แผน ${p.planNo} ${p.name}`));
    case "tier":
      return withButtons("ครอบครัวได้รับเงินกี่ล้านครับ", ["1 ล้าน", "2 ล้าน", "3 ล้าน", "5 ล้าน", "10 ล้าน"]);
  }
}

export const otherPlanText = (link: string) =>
  `ตอนนี้สั่งในแชทได้ 4 แบบครับ: Life Protect, iHealthy, iShield, มรดก\nแบบอื่นสั่งได้ที่หน้าวิดีโอนำเสนอ\n${link}`;
export const CANCELLED = "ยกเลิกคำสั่งคลิปแล้วครับ";

/** how the clip will be paid, as the card's line and the button's price */
export type OrderCost =
  | { ok: true; line: string; price: string }
  | { ok: false; text: string };

const LOOK_WORDS: Record<OrderStyle, string> = { motion: "Motion · ~60 วิ", classic: "แบบปกติ · ~60 วิ" };
const baht = (n: number) => n.toLocaleString("en-US");

/** the card's rows: what is ordered, as the agent typed it, with the premium the quote works out */
export function cardRows(d: ClipDraft, facts: QuoteVideoFacts, cost: Extract<OrderCost, { ok: true }>): [string, string][] {
  const term = d.variant ?? (d.product === "LIFEPROTECT" || d.product === "ISHIELD" ? DEFAULT_TERM[d.product] : undefined);
  const plan = d.product === "IHEALTHY" ? facts.planLine : `${PLAN_NAMES[d.product!]}${term && TERM_YEARS[term] ? ` · จ่าย ${TERM_YEARS[term]} ปี` : ""}`;
  const who = `${d.customer ? `คุณ${d.customer} · ` : ""}${d.sex === "F" ? "หญิง" : "ชาย"} ${d.age}`;
  const figure: [string, string] = d.product === "IHEALTHY" ? ["วงเงินต่อปี", facts.lead.amount]
    : d.product === "LEGACY" ? ["ครอบครัวได้รับ", `${baht(d.tier! * 1_000_000)}`]
      : ["ทุนประกัน", baht(d.sum!)];
  const yearly = facts.prices.find((p) => p.label === "รายปี") ?? facts.prices.find((p) => p.main);
  return [
    ["แบบประกัน", plan],
    ["ผู้เอาประกัน", who],
    figure,
    ...(yearly ? [[yearly.label === "รายปี" ? "เบี้ย/ปี" : `เบี้ย${yearly.label}`, yearly.amount] as [string, string]] : []),
    ["แบบคลิป", LOOK_WORDS[d.style]],
    ["ราคา", cost.line],
  ];
}

/** the LINE menu's navy (rich-menu-image.tsx); the button in LINE's own green, as its chat draws one */
const NAVY = C.ground;
const GREEN = "#06C755";

/** สรุปก่อนสร้างคลิป: the order, its price, and สร้างคลิป / เปลี่ยนแบบคลิป / แก้ละเอียดบนเว็บ */
export function summaryCard(d: ClipDraft, facts: QuoteVideoFacts, cost: Extract<OrderCost, { ok: true }>): LineMessage {
  const rows = cardRows(d, facts, cost);
  const startWords = cost.price ? `${START} ${cost.price}` : START;
  return {
    type: "flex",
    altText: `สรุปก่อนสร้างคลิป · ${rows.slice(0, 3).map(([, v]) => v).join(" · ")}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: NAVY, paddingAll: "12px",
        contents: [{ type: "text", text: "สรุปก่อนสร้างคลิป", color: C.ink, weight: "bold", size: "sm" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
        contents: rows.map(([label, value]) => ({
          type: "box", layout: "horizontal", spacing: "md",
          contents: [
            { type: "text", text: label, size: "xs", flex: 2, wrap: true },
            { type: "text", text: value, size: "xs", flex: 3, wrap: true, align: "end", color: NAVY, weight: "bold" },
          ],
        })),
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", paddingTop: "0px",
        contents: [
          { type: "button", style: "primary", color: GREEN, height: "sm", action: { type: "message", label: startWords, text: startWords } },
          { type: "button", style: "secondary", height: "sm", action: { type: "message", label: SWAP_STYLE, text: SWAP_STYLE } },
          { type: "button", style: "link", height: "sm", action: { type: "uri", label: "แก้ละเอียดบนเว็บ", uri: formOf(d) } },
        ],
      },
    },
  };
}

/** after สร้างคลิป: the clip comes back here on its own, or — the month's pushes near full — by ขอคลิป */
export function startedReply(pushes: boolean): LineMessage {
  if (pushes) return { type: "text", text: "รับแล้ว กำลังสร้างคลิป ใช้เวลาประมาณ 3–5 นาที\nเสร็จแล้วจะส่งวิดีโอมาในแชทนี้" };
  return withButtons([
    "รับแล้ว กำลังสร้างคลิป ใช้เวลาประมาณ 3–5 นาที",
    "เดือนนี้ข้อความแจ้งเตือนใกล้เต็ม ระบบจะไม่ส่งคลิปมาเอง",
    `เสร็จแล้วกด "${FETCH}" เพื่อรับวิดีโอ`,
  ].join("\n"), [FETCH]);
}

/** ขอคลิป while it is still being made */
export function stillMaking(left: string): LineMessage {
  return withButtons(`คลิปยังสร้างอยู่${left ? ` ${left}` : ""}\nแล้วกด "${FETCH}" อีกครั้งนะครับ`, [FETCH]);
}

export const nothingToFetch = (link: string) => `ยังไม่มีคลิปที่ทำเสร็จในช่วงนี้ครับ\nสั่งคลิปได้โดยพิมพ์ เช่น "คลิป LP ชาย 35 ทุน 1 ล้าน"\nดูทุกคลิป ${link}`;

/** more clips still owed after this one: the button again under the last message */
export function fetchAgain(messages: LineMessage[], more: number): LineMessage[] {
  if (more <= 0 || !messages.length) return messages;
  return [...messages, withButtons(`ยังมีอีก ${more} คลิป กด "${FETCH}" อีกครั้งเพื่อรับครับ`, [FETCH])];
}
