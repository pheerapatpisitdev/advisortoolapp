import type { Product, QuoteVideoFacts } from "./script";
import { gsWords } from "./gsaving";

/**
 * โจทย์การเล่า of a วิดีโอนำเสนอ clip (owner, 2026-10-13; spec
 * docs/superpowers/specs/2026-10-13-video-story-brief-design.md): how the clip opens (a hook
 * technique), what story it tells, who the customer is, and whether it loops.
 *
 * Only the opening, the closing and — in the longer clips — the customer's story are written to
 * the brief (writer.ts, a small model). Every sentence written is checked here against the
 * quote's own facts before it is spoken: a figure that is not the quote's, a word the voice must
 * not say, a promise the plan does not make, and it is not used. The fixed lines in `fallback`
 * stand in for anything that fails. Browser-safe: the form lists these choices.
 */

export type HookKind = "question" | "shock" | "myth" | "story" | "list" | "plain" | "auto";
export const HOOKS: { kind: HookKind; name: string; hint: string }[] = [
  { kind: "question", name: "ถามสะกิด", hint: "เปิดด้วยคำถามที่ลูกค้าต้องหยุดคิด" },
  { kind: "shock", name: "ตัวเลขช็อก", hint: "เปิดด้วยตัวเลขเล็กแลกตัวเลขใหญ่จากใบเสนอ" },
  { kind: "myth", name: "สวนความเชื่อ", hint: "เปิดด้วยความเชื่อที่คนเข้าใจผิด แล้วแก้ด้วยแผนนี้" },
  { kind: "story", name: "เล่าเรื่องสมมติ", hint: "เปิดด้วยภาพชีวิตของลูกค้าแบบนี้" },
  { kind: "list", name: "ลิสต์ 3 ข้อ", hint: "เปิดด้วย 3 ข้อที่คนชอบในแผนนี้" },
  { kind: "plain", name: "ตรงไปตรงมา (แบบเดิม)", hint: "สวัสดีแล้วเล่าแผน แบบที่ใช้อยู่ ไม่ใช้ AI" },
  { kind: "auto", name: "ให้ระบบเลือก", hint: "ระบบเลือกเทคนิคที่เข้ากับเรื่องที่เล่า" },
];
/** the techniques a clip can be written to, "auto" settled into one of these */
export const WRITTEN_HOOKS: Exclude<HookKind, "plain" | "auto">[] = ["question", "shock", "myth", "story", "list"];

export type Audience = "parents" | "owner" | "employee" | "single" | "retiring";
export const AUDIENCES: { key: Audience; name: string; scene: string }[] = [
  { key: "parents", name: "พ่อแม่ลูกเล็ก", scene: "บ้านยังผ่อน ลูกยังเล็ก รายได้หลักของบ้านมาจากคุณ" },
  { key: "owner", name: "เจ้าของกิจการ", scene: "ธุรกิจเดินได้เพราะคุณ ลูกน้องและครอบครัวพึ่งคุณอยู่" },
  { key: "employee", name: "พนักงานประจำ", scene: "เงินเดือนทุกเดือนคือรายได้หลักของบ้าน" },
  { key: "single", name: "โสด ดูแลพ่อแม่", scene: "พ่อแม่ที่เลี้ยงเรามา วันนี้ถึงตาเราดูแลท่าน" },
  { key: "retiring", name: "ใกล้เกษียณ", scene: "อีกไม่กี่ปีก็เกษียณ รายได้ประจำกำลังจะหายไป" },
];

/** one story a product can tell, offered only when the quote backs it */
export interface StoryAngle {
  key: string;
  product: Product;
  name: string;
  /** what the writer is told the story is about */
  about: string;
  when?: (f: QuoteVideoFacts) => boolean;
}

export const STORIES: StoryAngle[] = [
  { key: "legacy", product: "LIFEPROTECT", name: "มรดกให้ครอบครัว", about: "เงินก้อนที่ครอบครัวได้ถ้าเป็นอะไรไป ดูแลคนที่รักแทนเรา" },
  { key: "saving", product: "LIFEPROTECT", name: "เงินออมไม่หาย ขอคืนได้", about: "เงินที่ออมไว้ไม่หายไปไหน มูลค่าเงินสดโตทุกปี ถึงอายุหนึ่งขอคืนได้มากกว่าที่ออม", when: (f) => Boolean(f.breakEven) },
  { key: "shortpay", product: "LIFEPROTECT", name: "ออมสั้น คุ้มครองยาว", about: "ออมไม่กี่ปีก็ครบ แต่คุ้มครองยาวถึงอายุ 99", when: (f) => !f.payToEnd },
  { key: "burden", product: "LIFEPROTECT", name: "ภาระที่ทิ้งไว้ (บ้าน หนี้ ลูก)", about: "ภาระที่ยังอยู่ เช่น บ้านที่ยังผ่อน หนี้ และลูกที่ยังเรียน ถ้าวันหนึ่งเราไม่อยู่" },
  { key: "early", product: "ISHIELD", name: "เจอเร็ว รับก่อน", about: "ตรวจเจอโรคร้ายแรงระยะเริ่มต้นก็ได้เงินก้อนแล้ว ไม่ต้องรอให้ถึงระยะรุนแรง" },
  { key: "income", product: "ISHIELD", name: "เงินก้อนแทนรายได้ตอนป่วย", about: "ตอนป่วยหนักทำงานไม่ได้ รายได้หาย เงินก้อนนี้ใช้จ่ายแทนรายได้" },
  { key: "many", product: "ISHIELD", name: "70 โรค เบี้ยเท่าเดิม", about: "คุ้มครองหลายโรค และยอดออมเท่าเดิมทุกปี" },
  { key: "maturity", product: "ISHIELD", name: "ไม่ป่วยก็ได้คืน", about: "ถ้าไม่ป่วยเลย อยู่ครบสัญญาก็รับเงินคืน", when: (f) => f.cover.some((r) => /ครบสัญญา/.test(r.label)) },
  { key: "lump", product: "IHEALTHY", name: "เหมาจ่าย ไม่ต้องควักเอง", about: "ค่ารักษาเหมาจ่ายตามจริงในวงเงินสูง ไม่ต้องควักเงินเก็บ" },
  { key: "room", product: "IHEALTHY", name: "ค่าห้อง / ผู้ป่วยนอก", about: "ค่าห้องโรงพยาบาลและผู้ป่วยนอกที่แผนนี้จ่ายให้", when: (f) => (f.benefits ?? []).some((b) => /ค่าห้อง|ผู้ป่วยนอก/.test(b.label)) },
  { key: "compare", product: "IHEALTHY", name: "เทียบให้เห็น", about: "เทียบแผนที่เลือกกับแผนอื่นให้เห็นชัด", when: (f) => (f.compare?.length ?? 0) >= 2 },
  { key: "salary", product: "PENSION", name: "เงินเดือนหลังเกษียณ", about: "มีเงินเข้าทุกเดือนหลังเกษียณ เหมือนได้เงินเดือนต่อ" },
  { key: "tax", product: "PENSION", name: "ลดหย่อนภาษี", about: "ระหว่างที่ยังทำงาน ยอดออมนำไปลดหย่อนภาษีได้ตามเกณฑ์สรรพากร" },
  { key: "guarantee", product: "PENSION", name: "รับประกันจ่าย 15 ปีแรก", about: "บำนาญ 15 ปีแรกรับประกันจ่าย ถ้าเป็นอะไรไปก่อน ครอบครัวยังได้ส่วนที่เหลือ" },
  { key: "steps", product: "PENSION", name: "ยิ่งอายุมาก ยิ่งได้มาก", about: "บำนาญเพิ่มเป็นขั้นตามอายุ ช่วงที่ค่าใช้จ่ายสุขภาพมักเพิ่มขึ้น", when: (f) => (f.pension?.bands.length ?? 0) > 1 },
  { key: "family", product: "LEGACY", name: "เงินก้อนให้ครอบครัว", about: "ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน ดูแลคนที่รักแทนเรา" },
  { key: "illness", product: "LEGACY", name: "ป่วยหนัก ได้เงินก้อนรักษาตัวเอง", about: "ตรวจพบโรคร้ายแรงรับเงินก้อนไว้รักษาตัวเอง แล้วประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว" },
  { key: "light", product: "LEGACY", name: "ค่าใช้จ่ายปีแรกเบา", about: "ค่าใช้จ่ายปีแรกตกวันละไม่กี่บาท แลกกับเงินก้อนใหญ่ให้ครอบครัว ส่วนโรคร้ายแรงปรับตามอายุ" },
  // Protection Life (owner, 2026-10-14): term cover only — no cash value, so nothing about saving or money back
  { key: "plbfamily", product: "PLB", name: "เงินก้อนให้ครอบครัว", about: "ถ้าเป็นอะไรไปในช่วงสัญญา ครอบครัวได้เงินก้อนเต็มทุน ดูแลคนที่รักแทนเรา" },
  { key: "plbburden", product: "PLB", name: "คุ้มครองช่วงที่ภาระยังอยู่", about: "ภาระที่ยังผ่อนอยู่ในช่วงนี้ เช่น บ้าน รถ หนี้ ลูกที่ยังเรียน เลือกระยะคุ้มครอง 5 ถึง 15 ปีให้ตรงกับภาระ" },
  { key: "plblight", product: "PLB", name: "ค่าใช้จ่ายเบา เท่าเดิมทุกปี", about: "ค่าใช้จ่ายตกวันละไม่กี่บาท เท่าเดิมทุกปีตลอดสัญญา แลกกับเงินก้อนให้ครอบครัว" },
  { key: "plbtax", product: "PLB", name: "ลดหย่อนภาษีได้", about: "ค่าใช้จ่ายนำไปลดหย่อนภาษีได้ตามเกณฑ์สรรพากร", when: (f) => Boolean(f.plb?.tax) },
  // Global Savings 15/8 (owner, 2026-10-20): a savings plan — the money back is certain, the index bonus never is
  { key: "gssure", product: "GSAVING", name: "เงินคืนแน่นอน", about: "ออมสั้นแค่ 8 ปี ได้เงินคืนทุกปี และเงินก้อนตอนครบสัญญา ส่วนนี้ได้แน่นอน" },
  { key: "gsbonus", product: "GSAVING", name: "โบนัสตามดัชนีโลก", about: "มีโบนัสตามดัชนีโลกเพิ่มจากเงินคืน จ่ายสิ้นปีที่ 10 และตอนครบสัญญา โบนัสส่วนนี้ไม่แน่นอน" },
  { key: "gstax", product: "GSAVING", name: "ลดหย่อนภาษี", about: "ระหว่างที่ออม ยอดออมนำไปลดหย่อนภาษีได้ตามเกณฑ์สรรพากร" },
  { key: "gsshort", product: "GSAVING", name: "ออมสั้น ครบเร็ว", about: "ออมแค่ 8 ปี ครบสัญญา 15 ปี ระหว่างนั้นยังคุ้มครองชีวิตด้วย" },
  // อีซี่ โพรเทค 6 (owner, 2026-11-26)
  { key: "epshort", product: "EASYPROTECT", name: "ออม 6 ปี แล้วจบ", about: "ออมแค่ 6 ปีแล้วไม่ต้องจ่ายอีก แต่คุ้มครองยาวถึงอายุ 99" },
  { key: "epfamily", product: "EASYPROTECT", name: "เงินก้อนให้ครอบครัว", about: "ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน ดูแลคนที่รักแทนเรา" },
  { key: "epcash", product: "EASYPROTECT", name: "เงินออมไม่หาย", about: "เงินที่ออมไว้มีมูลค่าเงินสดโตทุกปี ถึงอายุหนึ่งขอคืนได้ครบเท่าที่ออม", when: (f) => Boolean(f.breakEven) },
  // ไลฟ์เทรเชอร์ (owner, 2026-11-26)
  { key: "ltlegacy", product: "LIFETREASURE", name: "มรดกที่รู้จำนวน", about: "เงินก้อนให้ครอบครัวระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด แบ่งให้ใครเท่าไรก็ระบุได้" },
  { key: "ltterms", product: "LIFETREASURE", name: "เลือกระยะจ่ายได้", about: "เลือกจ่าย 6 12 หรือ 18 ปี ให้พอดีกับรายได้ แล้วคุ้มครองถึงอายุ 99", when: (f) => (f.lifetreasure?.terms.length ?? 0) > 1 },
  { key: "ltcash", product: "LIFETREASURE", name: "เงินออมไม่หาย", about: "เงินที่ออมไว้มีมูลค่าเงินสดโตทุกปี ถึงอายุหนึ่งครบเท่าที่ออม", when: (f) => Boolean(f.breakEven) },
  // CI 123 (owner, 2026-11-26): a critical-illness rider paid by stage — no cash value, so nothing about money back
  { key: "ciearly", product: "CI123", name: "เจอเร็ว ได้เร็ว", about: "ตรวจพบโรคร้ายแรงตั้งแต่ระยะก่อนเริ่มต้นก็รับเงินก้อนแล้ว ไม่ต้องรอให้ถึงระยะรุนแรง" },
  { key: "cistages", product: "CI123", name: "จ่ายหลายระยะ", about: "เคลมระยะแรกแล้ว ยังเคลมระยะถัดไปได้ ระยะรุนแรงจ่ายเต็มทุน หักส่วนที่รับไปแล้ว" },
  { key: "cilife", product: "CI123", name: "มีแบบหลักคุ้มครองชีวิตด้วย", about: "นอกจากเงินก้อนเมื่อป่วยหนัก ยังมีแบบหลักคุ้มครองชีวิต ดูแลครอบครัวด้วย" },
  // 12 พีแอล (owner, 2026-11-26): the cash backs and the maturity are certain, the dividend is not said
  { key: "tpback", product: "TWELVEPL", name: "เงินคืนทุกปี", about: "มีเงินคืนทุกปีตั้งแต่ปีที่ 2 และเงินก้อนตอนครบอายุ 85 เมื่อถือครบสัญญา ส่วนนี้ได้แน่นอน" },
  { key: "tpshort", product: "TWELVEPL", name: "ออม 12 ปี คุ้มครองยาว", about: "ออมแค่ 12 ปี แต่คุ้มครองชีวิตยาวถึงอายุ 85" },
  { key: "tpfamily", product: "TWELVEPL", name: "เงินก้อนให้ครอบครัว", about: "ถ้าเป็นอะไรไปก่อน ครอบครัวได้เต็มทุน ดูแลคนที่รักแทนเรา" },
  { key: "tptax", product: "TWELVEPL", name: "ลดหย่อนภาษี", about: "ระหว่างที่ออม ยอดออมสัญญาหลักนำไปลดหย่อนภาษีได้ตามเกณฑ์สรรพากร", when: (f) => f.twelvepl?.tax !== undefined },
];

export const storiesFor = (f: QuoteVideoFacts): StoryAngle[] => STORIES.filter((s) => s.product === f.product && (!s.when || s.when(f)));

/** what the agent chose; a clip without one is told the way it always was */
export interface VideoBrief {
  hook: HookKind;
  story?: string;
  audience?: Audience;
  /** what the agent wants stressed, in their own words */
  note?: string;
  /** คลิปวนลูป: the end runs on into the opening */
  loop?: boolean;
}
export const NOTE_MAX = 100;

/**
 * The sentences written to a brief. `hook` opens the clip before the quote's own lead sentence;
 * `close` ends the closing (`loopClose` instead when it loops, said hanging, to run into `hook`);
 * `story` and its `points` are the longer clips' customer scene.
 */
export interface WrittenLines {
  hook: string;
  headline: string[];
  close?: string;
  loopClose?: string;
  story?: string;
  points?: string[];
  /** the technique it was written to ("auto" settled) */
  kind: Exclude<HookKind, "plain" | "auto">;
}

export const HEADLINE_MAX = 28;
const LIMIT = { hook: 150, close: 80, loopClose: 70, story: 260, point: 24 } as const;

/** a brief as the form sent it, cleaned; undefined for no brief (the clip told as it always was) */
export function cleanBrief(raw: unknown, f: QuoteVideoFacts): VideoBrief | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const hook = HOOKS.some((h) => h.kind === o.hook) ? (o.hook as HookKind) : undefined;
  if (!hook) return undefined;
  const offered = storiesFor(f);
  const story = offered.some((s) => s.key === o.story) ? (o.story as string) : offered[0]?.key;
  const audience = AUDIENCES.some((a) => a.key === o.audience) ? (o.audience as Audience) : undefined;
  const note = typeof o.note === "string" ? o.note.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : "";
  // a loop needs an opening that can follow a sentence: the plain hook greets, so it cannot
  const loop = o.loop === true && hook !== "plain";
  if (hook === "plain" && !loop) return { hook };
  return { hook, ...(story ? { story } : {}), ...(audience ? { audience } : {}), ...(note ? { note } : {}), ...(loop ? { loop } : {}) };
}

/** whether a brief asks for written lines at all */
export const writes = (b: VideoBrief | undefined): b is VideoBrief => Boolean(b && b.hook !== "plain");

const digits = (s: string) => Number(s.replace(/[^\d.]/g, ""));

/**
 * Every figure the quote states, as numbers: what a written line may say and nothing else — and
 * the agent's own note's ("ผ่อนอีก 20 ปี"), which is theirs to state.
 */
export function allowedNumbers(f: QuoteVideoFacts, note = ""): Set<number> {
  const out = new Set<number>([1, 2, 3, 4, 5, 15, 24, 95, 98, 99]);
  const add = (v: number | string | undefined | null) => {
    if (v === undefined || v === null) return;
    const n = typeof v === "number" ? v : digits(v);
    if (Number.isFinite(n) && n > 0) out.add(n);
  };
  add(f.age); add(f.coverToAge); add(f.payYears); add(f.lastPayAge); add(f.lead.baht); add(f.perDayAmount);
  add(f.totalPaid); add(f.spokenPrice.amount); add(f.insuredLine.match(/[\d,]+/)?.[0]);
  for (const p of f.prices) add(p.amount);
  for (const r of f.cover) { add(r.amount.match(/[\d,]+/)?.[0]); add(r.label.match(/\d+/)?.[0]); }
  if (f.breakEven) { add(f.breakEven.age); add(f.breakEven.cash); }
  if (f.illness) { add(f.illness.early); add(f.illness.major); add(f.illness.total); }
  for (const b of f.benefits ?? []) add(b.amount.match(/[\d,]+/)?.[0]);
  for (const c of f.compare ?? []) { add(c.monthly); add(c.yearly); add(c.opd.match(/[\d,]+/)?.[0]); add(c.room.match(/[\d,]+/)?.[0]); }
  if (f.budget) add(f.budget.amount);
  if (f.legacy) {
    const l = f.legacy;
    add(l.tier); add(l.critical); add(l.diseaseCount); add(l.criticalToAge); add(l.coverToAge); add(l.perDay); add(l.annual); add(l.monthly);
    for (const b of l.bands) { add(b.from); add(b.to); add(b.to + 1); add(b.amount); }
  }
  if (f.plb) {
    const p = f.plb;
    add(p.years); add(p.sum); add(p.endAge); add(p.perDay); add(p.annual); add(p.semi); add(p.monthly); add(p.total);
    // "3 แสน": a sum under a million said in แสน
    if (p.sum < 1_000_000 && p.sum % 100_000 === 0) add(p.sum / 100_000);
    for (const r of p.terms) { add(r.years); add(r.endAge); add(r.annual); }
  }
  if (f.gsaving) {
    const g = f.gsaving;
    for (const n of [g.premium, g.perDay, g.payYears, g.term, g.paid, g.payback, g.maturity, g.guaranteed, g.deathMax, g.taxYearly, g.total, g.bonus10, g.bonus15, g.bonusAll, g.bonusAll - g.bonus15, g.maturityPct, ...g.bonusYears]) add(typeof n === "number" ? Math.round(n) : n);
  }
  if (f.easyprotect) {
    const g = f.easyprotect;
    for (const n of [g.sum, g.payYears, g.payYears + 1, g.lastPayAge, g.coverToAge, g.paid, g.endCash, g.floorPercent]) add(n);
    add(g.annual); add(g.times);
  }
  if (f.lifetreasure) {
    const g = f.lifetreasure;
    for (const n of [g.sum, g.payYears, g.lastPayAge, g.coverToAge, g.paid, g.endCash, g.at70, g.floorPercent]) add(n);
    add(g.annual); add(g.times);
    for (const r of g.terms) { add(r.years); add(r.annual); add(r.total); add(r.times); }
  }
  if (f.ci123) {
    const g = f.ci123;
    // the plan's own name, "CI 123"
    add(123);
    // 90: the days an illness waits (qa.ts), 18 and 19: the children's ages
    for (const n of [g.sum, g.diseaseCount, g.baseSum, g.death.beforeAge, g.death.sumBefore, g.death.sumFrom, g.perDay, g.annual, 18, 19, 90]) add(n);
    for (const r of [...g.stairs, ...g.more]) { add(r.amount); add(r.count); }
    // "5 แสน": a sum under a million said in แสน
    if (g.sum < 1_000_000 && g.sum % 100_000 === 0) add(g.sum / 100_000);
  }
  if (f.twelvepl) {
    const g = f.twelvepl;
    for (const n of [g.sum, g.payYears, g.lastPayAge, g.coverToAge, g.paid, g.cashFirst, g.cashFull, g.cashFullYear, g.cashBacks, g.maturity, g.guaranteed, g.tax]) add(n === undefined ? n : Math.round(n));
    add(g.annual);
  }
  if (f.pension) {
    const p = f.pension;
    add(p.start); add(p.monthly); add(p.guaranteeTo); add(p.sumAssured);
    for (const b of p.bands) { add(b.from); add(b.annual); add(b.percent); }
    add(Math.round(p.totalPension / 100_000) * 100_000);
    add(Math.round(p.totalPension / 10_000) * 10_000);
  }
  for (const n of numbersIn(note)) add(n);
  // a sum said in millions: "2 ล้าน" is 2,000,000
  for (const n of [...out]) if (n >= 1_000_000 && n % 100_000 === 0) out.add(n / 1_000_000);
  return out;
}

/** the figures a line says, a "ล้าน" after one counted in */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(ล้าน)?/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    out.push(m[2] ? n * 1_000_000 : n);
    if (m[2]) out.push(n);
  }
  return out;
}

/** words the voice never says, and promises no clip makes (script.ts keeps the same words out) */
export const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /เบี้ย/, why: "ใช้คำว่า เบี้ย" },
  { re: /เสียชีวิต|ตาย/, why: "ใช้คำว่า เสียชีวิต" },
  { re: /เวนคืน/, why: "ใช้คำว่า เวนคืน" },
  { re: /%|เปอร์เซ็นต์|ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล/, why: "พูดถึงผลตอบแทน" },
  { re: /การันตี|รับประกันผล|แน่นอน 100|ไม่มีความเสี่ยง/, why: "สัญญาเกินแบบประกัน" },
  { re: /ทันที/, why: "พูดว่า ทันที" },
  { re: /สวัสดี(?!การ)/, why: "มีคำทักทาย" },
  { re: /[๐-๙]/, why: "ใช้เลขไทย" },
  { re: /(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ยี่สิบ)\s*(ล้าน|แสน|หมื่น|พัน|ร้อย)/, why: "เขียนตัวเลขเป็นคำ" },
  { re: /https?:|www\.|@/, why: "มีลิงก์" },
  { re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, why: "มีอีโมจิ" },
];

/** why a written sentence cannot be spoken, or null when it can */
export function lineProblem(text: string, f: QuoteVideoFacts, max: number, note = ""): string | null {
  const t = text.trim();
  if (!t) return "ว่าง";
  if (t.length > max) return `ยาวเกิน ${max} ตัวอักษร`;
  for (const x of FORBIDDEN) if (x.re.test(t)) return x.why;
  // iShield's cover waits 90 days for an illness: nothing written may promise otherwise (owner, 2026-10-11)
  if (f.product === "ISHIELD" && /รับเลย|ได้เลยตั้งแต่วันแรก/.test(t)) return "สัญญาว่ารับได้ตั้งแต่วันแรก";
  // มรดก is mostly a critical-illness rider that builds no value: what is paid is ค่าใช้จ่าย, never ออม (owner, 2026-10-14)
  if (f.product === "LEGACY" && /ออม|เงินคืน|ขอคืน/.test(t)) return "ใช้คำว่า ออม หรือเงินคืน (แบบนี้ใช้คำว่า ค่าใช้จ่าย)";
  // Protection Life builds no value either, its waiting period is unconfirmed, and only its 10–15-year terms are said to cut tax (owner, 2026-10-14)
  if (f.product === "PLB") {
    if (/ออม|เงินคืน|ขอคืน|ได้คืน/.test(t)) return "ใช้คำว่า ออม หรือเงินคืน (แบบนี้ใช้คำว่า ค่าใช้จ่าย)";
    if (/รอคอย|ระยะรอ|ตั้งแต่วันนี้|ตั้งแต่วันแรก|คุ้มครองเลย/.test(t)) return "พูดถึงระยะรอคอย หรือสัญญาว่าคุ้มครองตั้งแต่วันแรก";
    if (!f.plb?.tax && /ภาษี/.test(t)) return "ระยะ 5 ปี ไม่พูดเรื่องลดหย่อนภาษี";
  }
  // Global Savings: the index bonus is never promised (owner, 2026-10-20)
  if (f.product === "GSAVING" && /โบนัส[^\n]{0,20}?(?<!ไม่)(แน่นอน|ได้แน่|ชัวร์)/.test(t)) return "สัญญาว่าโบนัสได้แน่นอน";
  // 12 พีแอล: what comes back in all is only ever said with the plan held to the end; no tax relief under 20 (twelvepl.ts)
  if (f.product === "TWELVEPL") {
    if (f.twelvepl && numbersIn(t).some((n) => n === Math.round(f.twelvepl!.guaranteed)) && !/ครบ/.test(t)) return "พูดยอดรับรวมโดยไม่บอกว่าถือครบสัญญา";
    if (f.twelvepl?.tax === undefined && /ภาษี/.test(t)) return "อายุนี้ไม่พูดเรื่องลดหย่อนภาษี";
  }
  // อีซี่ โพรเทค 6, ไลฟ์เทรเชอร์: the page promises no tax relief, and the break-even year may pay back only what was paid
  if (f.product === "EASYPROTECT" || f.product === "LIFETREASURE") {
    if (/ภาษี/.test(t)) return "แบบนี้ไม่พูดเรื่องลดหย่อนภาษี";
    if (/มากกว่าที่ออม|เกินที่ออม/.test(t)) return "พูดว่าได้คืนมากกว่าที่ออม";
  }
  // CI 123 builds no value, waits 90 days for an illness, and its CI part rises with age (copilot/knowledge.ts CI123_SECTION)
  if (f.product === "CI123") {
    if (/เงินคืน|ขอคืน|ได้คืน|มูลค่าเงินสด/.test(t)) return "พูดถึงเงินคืน (แบบนี้ไม่มีมูลค่าเงินสด)";
    if (/รับเลย|ได้เลยตั้งแต่วันแรก|ตั้งแต่วันแรก/.test(t)) return "สัญญาว่ารับได้ตั้งแต่วันแรก";
    if (/เท่าเดิม|ไม่ขึ้น|คงที่/.test(t)) return "พูดว่ายอดออมเท่าเดิม (ส่วน CI 123 ปรับตามอายุ)";
    if (/ภาษี/.test(t)) return "แบบนี้ไม่พูดเรื่องลดหย่อนภาษี";
  }
  // ตั้งค่าส่วนตัว (owner, 2026-11-14): never an instalment the agent hid; บำนาญ 95's own pension is paid monthly and may be said
  if (f.hide?.includes("monthly") && (f.product === "PENSION" ? /รายเดือน|(ออม|จ่าย|ค่าใช้จ่าย)\s*(ต่อ)?เดือนละ/ : /รายเดือน|เดือนละ|ต่อเดือน/).test(t)) return "พูดถึงการจ่ายรายเดือน (ตัวแทนปิดไว้)";
  if (f.hide?.includes("semi") && /ราย\s*6\s*เดือน|งวดละ/.test(t)) return "พูดถึงการจ่ายราย 6 เดือน (ตัวแทนปิดไว้)";
  const allowed = allowedNumbers(f, note);
  const stray = numbersIn(t).find((n, i, all) => !allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
  if (stray !== undefined) return `มีตัวเลข ${stray.toLocaleString("en-US")} ที่ไม่อยู่ในใบเสนอ`;
  return null;
}

/** the chat invitation the clip already says */
const INVITE = /ทักมา|ทักแชท|ทักได้|สนใจ\s*ทัก/;

/** the sentence particles a hanging line must not end on */
const ENDS = /(ค่ะ|คะ|ครับ|นะ|จ้ะ|จ้า|[.!?])\s*$/;

/**
 * Why written lines cannot be used, field by field; an empty object when all can. `need` says
 * which fields this clip speaks.
 */
export function writtenProblems(w: Partial<WrittenLines>, f: QuoteVideoFacts, need: { loop: boolean; story: boolean; note?: string }): Partial<Record<keyof WrittenLines, string>> {
  const out: Partial<Record<keyof WrittenLines, string>> = {};
  const note = need.note ?? "";
  const hook = lineProblem(w.hook ?? "", f, LIMIT.hook, note);
  if (hook) out.hook = hook;
  const head = w.headline ?? [];
  if (!head.length || head.length > 2 || head.some((h) => !h.trim() || h.length > HEADLINE_MAX || lineProblem(h, f, HEADLINE_MAX, note))) {
    out.headline = `พาดหัว 1–2 บรรทัด บรรทัดละไม่เกิน ${HEADLINE_MAX} ตัวอักษร`;
  }
  if (need.loop) {
    const c = lineProblem(w.loopClose ?? "", f, LIMIT.loopClose, note);
    if (c) out.loopClose = c;
    else if (ENDS.test(w.loopClose ?? "")) out.loopClose = "ประโยควนลูปต้องพูดค้าง ไม่ลงท้ายด้วย ค่ะ/ครับ";
  } else {
    const c = lineProblem(w.close ?? "", f, LIMIT.close, note);
    if (c) out.close = c;
    // the closing follows "สนใจ ทักมาคุยกันได้เลยนะคะ" (script.ts): it must not say it again
    else if (INVITE.test(w.close ?? "")) out.close = "ซ้ำกับคำชวนทักแชท";
  }
  if (need.story) {
    const s = lineProblem(w.story ?? "", f, LIMIT.story, note);
    if (s) out.story = s;
    const pts = w.points ?? [];
    if (pts.length < 2 || pts.length > 3 || pts.some((p) => !p.trim() || lineProblem(p, f, LIMIT.point, note))) out.points = "ข้อความบนจอ 2–3 ข้อ ข้อละไม่เกิน 24 ตัวอักษร";
  }
  return out;
}

const said = (baht: number) => (baht >= 1_000_000 && baht % 100_000 === 0
  ? `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้านบาท`
  : `${baht.toLocaleString("en-US")} บาท`);

/** the hook technique an "auto" brief is written to: one the story suits, the same for the same clip */
export function settleHook(b: VideoBrief, f: QuoteVideoFacts, seed = 0): Exclude<HookKind, "plain" | "auto"> {
  if (b.hook !== "auto" && b.hook !== "plain") return b.hook;
  const suits: Record<string, Exclude<HookKind, "plain" | "auto">[]> = {
    legacy: ["question", "story"], saving: ["myth", "shock"], shortpay: ["list", "shock"], burden: ["story", "question"],
    early: ["myth", "question"], income: ["story", "question"], many: ["list", "shock"], maturity: ["myth", "list"],
    lump: ["question", "shock"], room: ["shock", "list"], compare: ["list", "question"],
    salary: ["question", "story"], tax: ["shock", "list"], guarantee: ["myth", "list"], steps: ["list", "shock"],
    family: ["question", "story"], illness: ["myth", "question"], light: ["shock", "list"],
    epshort: ["myth", "list"], epfamily: ["question", "story"], epcash: ["myth", "shock"],
    ltlegacy: ["question", "story"], ltterms: ["list", "myth"], ltcash: ["myth", "shock"],
    ciearly: ["myth", "question"], cistages: ["list", "shock"], cilife: ["story", "question"],
    tpback: ["question", "list"], tpshort: ["myth", "shock"], tpfamily: ["story", "question"], tptax: ["list", "shock"],
    plbfamily: ["question", "story"], plbburden: ["story", "list"], plblight: ["shock", "myth"], plbtax: ["list", "shock"],
  };
  const pool = suits[b.story ?? ""] ?? ["question", "shock"];
  return pool[Math.abs(seed + f.age) % pool.length];
}

/**
 * The fixed lines for a brief: what a clip says when the writer is down or what it wrote cannot
 * be used. Female endings (script.ts spokenBy turns them into a man's), every figure the quote's.
 */
export function fallbackLines(f: QuoteVideoFacts, b: VideoBrief, seed = 0): WrittenLines {
  const kind = settleHook(b, f, seed);
  const aud = AUDIENCES.find((a) => a.key === b.audience);
  const p = f.product;
  const gs = (text: string) => (f.gsaving ? gsWords(text, f.gsaving) : text);
  const lead = said(f.lead.baht);
  const perDay = f.perDayAmount;
  const monthly = f.spokenPrice.amount;
  const hooks: Record<typeof kind, Record<Product, string>> = {
    question: {
      LIFEPROTECT: "ถ้าพรุ่งนี้คุณไม่อยู่ ครอบครัวจะมีเงินใช้ต่ออีกกี่ปีคะ",
      ISHIELD: "ถ้าวันหนึ่งหมอบอกว่าเป็นโรคร้ายแรง คุณมีเงินก้อนพร้อมรักษาหรือยังคะ",
      IHEALTHY: "ถ้าต้องนอนโรงพยาบาลพรุ่งนี้ ค่ารักษาจะมาจากไหนคะ",
      PENSION: "เกษียณแล้ว อยากมีเงินเข้าบัญชีทุกเดือนไหมคะ",
      LEGACY: "ถ้าพรุ่งนี้คุณไม่อยู่ ครอบครัวจะมีเงินก้อนดูแลต่อไหมคะ",
      PLB: "ถ้าพรุ่งนี้คุณไม่อยู่ ภาระที่ยังผ่อนอยู่ ใครจะจ่ายต่อคะ",
      GSAVING: "เงินเก็บของคุณ ตอนนี้งอกเงยบ้างไหมคะ",
      EASYPROTECT: "ถ้าออมแค่ 6 ปี แล้วครอบครัวมีเงินก้อนไปถึงอายุ 99 จะเริ่มวันนี้ไหมคะ",
      LIFETREASURE: "อยากส่งต่อเงินก้อนให้ครอบครัว แบบรู้จำนวนแน่นอนตั้งแต่วันนี้ไหมคะ",
      CI123: "ถ้าวันหนึ่งหมอบอกว่าเป็นโรคร้ายแรง คุณมีเงินก้อนพร้อมรักษาหรือยังคะ",
      TWELVEPL: "ถ้ามีเงินคืนให้ทุกปี และมีก้อนใหญ่รอตอนครบสัญญา จะเริ่มออมวันนี้ไหมคะ",
    },
    shock: {
      LIFEPROTECT: perDay ? `วันละ ${perDay} บาท แลกเป็นเงินก้อนให้ครอบครัวได้ถึง ${lead}` : `เงินก้อนให้ครอบครัวได้ถึง ${lead}`,
      ISHIELD: perDay ? `วันละ ${perDay} บาท แลกกับเงินก้อนสูงสุด ${lead} ตอนป่วยหนัก` : `เงินก้อนสูงสุด ${lead} ตอนป่วยหนัก`,
      IHEALTHY: `${f.spokenPrice.per} ${monthly} บาท ได้วงเงินค่ารักษาถึง ${lead}ต่อปี`,
      PENSION: `ออมวันนี้ แล้วรับเดือนละ ${f.pension?.monthly ?? ""} บาท ไปจนถึงอายุ 95`,
      LEGACY: perDay ? `ค่าใช้จ่ายปีแรกวันละ ${perDay} บาท แลกเป็นเงินก้อนให้ครอบครัวได้ถึง ${lead}` : `เงินก้อนให้ครอบครัวได้ถึง ${lead}`,
      PLB: perDay ? `ค่าใช้จ่ายวันละ ${perDay} บาท แลกเป็นเงินก้อนให้ครอบครัวได้ถึง ${lead}` : `เงินก้อนให้ครอบครัวได้ถึง ${lead}`,
      GSAVING: perDay ? `ออมวันละ ${perDay} บาท แค่ 8 ปี รับคืนรวม ${lead}` : `ออมแค่ 8 ปี รับคืนรวม ${lead}`,
      EASYPROTECT: `ออมแค่ 6 ปี ครอบครัวได้${f.easyprotect?.atLeast ? "อย่างน้อย " : "เงินก้อน "}${lead}`,
      LIFETREASURE: `ส่งต่อให้ครอบครัว${f.lifetreasure?.atLeast ? "อย่างน้อย " : " "}${lead} จ่ายแค่ ${f.lifetreasure?.payYears ?? 12} ปี`,
      CI123: perDay ? `ปีแรกวันละ ${perDay} บาท แลกกับเงินก้อนสูงสุด ${lead} ตอนป่วยหนัก` : `เงินก้อนสูงสุด ${lead} ตอนป่วยหนัก`,
      TWELVEPL: `ออมแค่ 12 ปี ถือครบถึงอายุ 85 รับคืนรวม ${lead}`,
    },
    myth: {
      LIFEPROTECT: "หลายคนคิดว่าประกันชีวิตคือเงินที่จ่ายทิ้ง แต่แผนนี้ เงินที่ออมไว้ไม่หายไปไหนค่ะ",
      ISHIELD: "หลายคนคิดว่าต้องป่วยหนักก่อนถึงจะได้เงิน แต่แผนนี้จ่ายตั้งแต่ระยะเริ่มต้นค่ะ",
      IHEALTHY: "หลายคนคิดว่ามีสวัสดิการก็พอแล้ว แต่ค่ารักษาโรงพยาบาลเอกชนไม่ใช่น้อยๆ ค่ะ",
      PENSION: "หลายคนคิดว่าเกษียณแล้วจะมีเงินพอใช้ แต่ไม่มีใครจ่ายเงินเดือนให้เราอีกแล้วค่ะ",
      LEGACY: "หลายคนคิดว่าประกันชีวิตดูแลแค่ครอบครัว แต่แผนนี้ ป่วยหนักก็ได้เงินก้อนไว้รักษาตัวเองค่ะ",
      PLB: perDay ? `หลายคนคิดว่าประกันชีวิตต้องแพง แต่แผนนี้ ค่าใช้จ่ายแค่วันละ ${perDay} บาทค่ะ` : "หลายคนคิดว่าประกันชีวิตต้องแพง แต่แผนนี้ ค่าใช้จ่ายเบาและเท่าเดิมทุกปีค่ะ",
      GSAVING: "หลายคนคิดว่าประกันออมทรัพย์ต้องออมนาน แต่แผนนี้ออมแค่ 8 ปีก็ครบค่ะ",
      EASYPROTECT: "หลายคนคิดว่าประกันตลอดชีพต้องจ่ายไปจนแก่ แต่แผนนี้ออมแค่ 6 ปีก็ครบค่ะ",
      LIFETREASURE: "หลายคนคิดว่ามรดกต้องรอขายทรัพย์สิน แต่แผนนี้ระบุจำนวนเงินก้อนไว้ได้ตั้งแต่วันนี้ค่ะ",
      CI123: "หลายคนคิดว่าต้องป่วยหนักก่อนถึงจะได้เงิน แต่แผนนี้จ่ายตั้งแต่ระยะก่อนเริ่มต้นค่ะ",
      TWELVEPL: "หลายคนคิดว่าประกันชีวิตต้องออมยาวหลายสิบปี แต่แผนนี้ออมแค่ 12 ปี คุ้มครองถึงอายุ 85 ค่ะ",
    },
    story: {
      LIFEPROTECT: `ลองนึกภาพนะคะ ${aud?.scene ?? "คนที่คุณรักต้องใช้ชีวิตต่อ"} ถ้าวันหนึ่งคุณไม่อยู่ ใครจะดูแลต่อ`,
      ISHIELD: `ลองนึกภาพนะคะ ${aud?.scene ?? "ชีวิตกำลังไปได้ดี"} แล้ววันหนึ่งหมอบอกว่าต้องรักษาตัวยาว`,
      IHEALTHY: `ลองนึกภาพนะคะ ${aud?.scene ?? "ชีวิตกำลังไปได้ดี"} แล้ววันหนึ่งต้องนอนโรงพยาบาล`,
      PENSION: `ลองนึกภาพนะคะ ${aud?.scene ?? "วันที่เลิกทำงาน"} แต่ค่าใช้จ่ายยังมีทุกเดือน`,
      LEGACY: `ลองนึกภาพนะคะ ${aud?.scene ?? "คนที่คุณรักต้องใช้ชีวิตต่อ"} ถ้าวันหนึ่งคุณไม่อยู่ ใครจะดูแลต่อ`,
      PLB: `ลองนึกภาพนะคะ ${aud?.scene ?? "บ้านยังผ่อน ลูกยังเรียน"} ถ้าวันหนึ่งคุณไม่อยู่ ใครจะดูแลต่อ`,
      GSAVING: `ลองนึกภาพนะคะ ${aud?.scene ?? "อีก 15 ปีข้างหน้า"} มีเงินก้อนรออยู่ จากการออมแค่ 8 ปี`,
      EASYPROTECT: `ลองนึกภาพนะคะ ${aud?.scene ?? "คนที่คุณรักต้องใช้ชีวิตต่อ"} ถ้าวันหนึ่งคุณไม่อยู่ ใครจะดูแลต่อ`,
      LIFETREASURE: `ลองนึกภาพนะคะ ${aud?.scene ?? "วันที่ต้องส่งต่อสิ่งที่สร้างมา"} ครอบครัวได้เงินก้อนตามจำนวนที่คุณตั้งไว้`,
      CI123: `ลองนึกภาพนะคะ ${aud?.scene ?? "ชีวิตกำลังไปได้ดี"} แล้ววันหนึ่งหมอบอกว่าต้องรักษาตัวยาว`,
      TWELVEPL: `ลองนึกภาพนะคะ ${aud?.scene ?? "หยุดออมไปนานแล้ว"} แต่ยังมีเงินคืนเข้ามาทุกปี`,
    },
    list: {
      LIFEPROTECT: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง ${f.payToEnd ? (f.riders?.rises ? "เบี้ยสัญญาหลักเท่าเดิมตลอด" : "ยอดออมเท่าเดิมตลอด") : `ออมแค่ ${f.payYears} ปี`} สอง เงินก้อนให้ครอบครัว ${lead} สาม เงินที่ออมไม่หายไปไหน`,
      ISHIELD: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง คุ้มครอง ${f.illness?.total ?? ""} โรค สอง จ่ายตั้งแต่ระยะเริ่มต้น สาม ยอดออมเท่าเดิมทุกปี`.replace("  ", " "),
      IHEALTHY: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง เหมาจ่ายค่ารักษา สอง รวม${f.includes?.includes("ค่าชดเชยรายวัน") === false ? "ประกันชีวิต" : "ค่าชดเชยรายวัน"}ไว้แล้ว สาม ต่ออายุได้ถึงอายุ ${f.coverToAge}`,
      PENSION: "แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง รับบำนาญทุกเดือนถึงอายุ 95 สอง นำไปลดหย่อนภาษีได้ สาม 15 ปีแรกรับประกันจ่าย",
      LEGACY: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง เงินก้อนให้ครอบครัว ${lead} สอง ป่วยหนักได้เงินก้อนรักษาตัว สาม ประกันชีวิตยังอยู่ต่อ`,
      PLB: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง เงินก้อนให้ครอบครัว ${lead} สอง ค่าใช้จ่ายเท่าเดิมทุกปี สาม เลือกระยะได้ตามภาระ`,
      GSAVING: "แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง ออมแค่ 8 ปี สอง ได้เงินคืนทุกปี สาม มีโบนัสตามดัชนีโลก",
      EASYPROTECT: "แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง ออมแค่ 6 ปี สอง ยอดออมเท่าเดิมทุกปี สาม คุ้มครองถึงอายุ 99",
      LIFETREASURE: "แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง ระบุจำนวนเงินก้อนไว้ล่วงหน้า สอง เลือกระยะจ่ายได้ สาม คุ้มครองถึงอายุ 99",
      CI123: `แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง คุ้มครอง ${f.ci123?.diseaseCount ?? ""} โรค สอง จ่ายตั้งแต่ระยะก่อนเริ่มต้น สาม เคลมระยะถัดไปได้อีก`.replace("  ", " "),
      TWELVEPL: "แผนนี้มี 3 อย่างที่คนชอบค่ะ หนึ่ง ออมแค่ 12 ปี สอง ได้เงินคืนทุกปี สาม คุ้มครองถึงอายุ 85",
    },
  };
  const heads: Record<typeof kind, Record<Product, string[]>> = {
    question: {
      LIFEPROTECT: ["ถ้าพรุ่งนี้คุณไม่อยู่", "ครอบครัวจะอยู่ยังไง?"],
      ISHIELD: ["ถ้าป่วยหนักวันนี้", "มีเงินก้อนพร้อมไหม?"],
      IHEALTHY: ["นอนโรงพยาบาลพรุ่งนี้", "ค่ารักษามาจากไหน?"],
      PENSION: ["เกษียณแล้ว", "อยากมีเงินเดือนไหม?"],
      LEGACY: ["ถ้าพรุ่งนี้คุณไม่อยู่", "ครอบครัวมีเงินก้อนไหม?"],
      PLB: ["ถ้าพรุ่งนี้คุณไม่อยู่", "ภาระใครจ่ายต่อ?"],
      GSAVING: ["เงินเก็บของคุณ", "งอกเงยบ้างไหม?"],
      EASYPROTECT: ["ออมแค่ 6 ปี", "ดูแลถึงอายุ 99"],
      LIFETREASURE: ["เงินก้อนให้ครอบครัว", "รู้จำนวนตั้งแต่วันนี้"],
      CI123: ["ถ้าป่วยหนักวันนี้", "มีเงินก้อนพร้อมไหม?"],
      TWELVEPL: ["เงินคืนให้ทุกปี", "เริ่มวันนี้ดีไหม?"],
    },
    shock: {
      LIFEPROTECT: perDay ? [`วันละ ${perDay} บาท`, `แลกเงินก้อน ${lead}`] : [`เงินก้อน ${lead}`],
      ISHIELD: perDay ? [`วันละ ${perDay} บาท`, `แลกเงินก้อน ${lead}`] : [`เงินก้อน ${lead}`],
      IHEALTHY: [`${f.spokenPrice.per} ${monthly} บาท`, `วงเงิน ${lead}/ปี`],
      PENSION: [`รับเดือนละ ${f.pension?.monthly ?? ""} บาท`, "ไปจนถึงอายุ 95"],
      LEGACY: perDay ? [`ปีแรกวันละ ${perDay} บาท`, `แลกเงินก้อน ${lead}`] : [`เงินก้อน ${lead}`],
      PLB: perDay ? [`วันละ ${perDay} บาท`, `แลกเงินก้อน ${lead}`] : [`เงินก้อน ${lead}`],
      GSAVING: [perDay ? `ออมวันละ ${perDay} บาท` : "ออมแค่ 8 ปี", `รับคืนรวม ${lead}`],
      EASYPROTECT: [perDay ? `วันละ ${perDay} บาท` : "ออมแค่ 6 ปี", `เงินก้อน ${lead}`],
      LIFETREASURE: [`จ่าย ${f.lifetreasure?.payYears ?? 12} ปี`, `ส่งต่อ ${lead}`],
      CI123: perDay ? [`ปีแรกวันละ ${perDay} บาท`, `เงินก้อน ${lead}`] : [`เงินก้อน ${lead}`],
      TWELVEPL: [perDay ? `ออมวันละ ${perDay} บาท` : "ออมแค่ 12 ปี", "มีเงินคืนทุกปี"],
    },
    myth: {
      LIFEPROTECT: ["ประกันชีวิต", "คือเงินจ่ายทิ้ง จริงไหม?"],
      ISHIELD: ["ต้องป่วยหนักก่อน", "ถึงจะได้เงิน จริงไหม?"],
      IHEALTHY: ["มีสวัสดิการแล้ว", "พอจริงไหม?"],
      PENSION: ["เกษียณแล้ว", "เงินพอใช้จริงไหม?"],
      LEGACY: ["ประกันชีวิต", "ดูแลแค่ครอบครัว จริงไหม?"],
      PLB: ["ประกันชีวิต", "ต้องแพง จริงไหม?"],
      GSAVING: ["ประกันออมทรัพย์", "ต้องออมนาน จริงไหม?"],
      EASYPROTECT: ["ประกันตลอดชีพ", "ต้องจ่ายจนแก่ จริงไหม?"],
      LIFETREASURE: ["มรดก", "ต้องรอขายทรัพย์สิน?"],
      CI123: ["ต้องป่วยหนักก่อน", "ถึงจะได้เงิน จริงไหม?"],
      TWELVEPL: ["ประกันชีวิต", "ต้องออมนาน จริงไหม?"],
    },
    story: {
      LIFEPROTECT: ["ถ้าวันหนึ่งคุณไม่อยู่", "ใครจะดูแลต่อ?"],
      ISHIELD: ["ถ้าต้องรักษาตัวยาว", "รายได้จะมาจากไหน?"],
      IHEALTHY: ["ถ้าต้องนอนโรงพยาบาล", "ใครจ่ายค่ารักษา?"],
      PENSION: ["วันที่เลิกทำงาน", "เงินเดือนมาจากไหน?"],
      LEGACY: ["ถ้าวันหนึ่งคุณไม่อยู่", "ใครจะดูแลต่อ?"],
      PLB: ["ถ้าวันหนึ่งคุณไม่อยู่", "ใครจะดูแลต่อ?"],
      GSAVING: ["อีก 15 ปีข้างหน้า", "มีเงินก้อนรอไหม?"],
      EASYPROTECT: ["ถ้าวันหนึ่งคุณไม่อยู่", "ใครจะดูแลต่อ?"],
      LIFETREASURE: ["วันที่ต้องส่งต่อ", "ครอบครัวได้เท่าไร?"],
      CI123: ["ถ้าต้องรักษาตัวยาว", "เงินก้อนมาจากไหน?"],
      TWELVEPL: ["หยุดออมแล้ว", "ยังมีเงินคืนทุกปี"],
    },
    list: {
      LIFEPROTECT: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      ISHIELD: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      IHEALTHY: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      PENSION: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      LEGACY: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      PLB: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      GSAVING: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      EASYPROTECT: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      LIFETREASURE: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      CI123: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
      TWELVEPL: ["3 อย่างที่คนชอบ", "ในแผนนี้"],
    },
  };
  const loops: Record<typeof kind, string> = {
    question: "เพราะไม่มีใครรู้เลยว่า",
    shock: "และนี่คือเหตุผลที่บอกว่า",
    myth: "และนี่คือเหตุผลที่ไม่ควรเชื่อว่า",
    story: "ก่อนจะถึงวันนั้น",
    list: "สรุปง่ายๆ อีกครั้ง",
  };
  const closes: Record<Product, string> = {
    LIFEPROTECT: "ยินดีช่วยดูแผนให้ครอบครัวของคุณค่ะ",
    ISHIELD: "ยินดีช่วยดูแผนให้คุณพร้อมทุกเมื่อค่ะ",
    IHEALTHY: "ยินดีช่วยดูแผนสุขภาพให้ค่ะ",
    PENSION: "ยินดีช่วยวางแผนเกษียณให้ค่ะ",
    LEGACY: "ยินดีช่วยดูแผนมรดกให้ครอบครัวของคุณค่ะ",
    PLB: "ยินดีช่วยเลือกระยะคุ้มครองให้พอดีกับภาระค่ะ",
    GSAVING: "ยินดีช่วยวางแผนออมให้ค่ะ",
    EASYPROTECT: "ยินดีช่วยดูแผนให้ครอบครัวของคุณค่ะ",
    LIFETREASURE: "ยินดีช่วยวางแผนส่งต่อให้ครอบครัวของคุณค่ะ",
    CI123: "ยินดีช่วยดูแผนให้คุณพร้อมทุกเมื่อค่ะ",
    TWELVEPL: "ยินดีช่วยวางแผนออมให้ค่ะ",
  };
  const tails: Record<Product, string> = {
    LIFEPROTECT: "แผนนี้คือเงินก้อนที่ดูแลคนที่คุณรักแทนคุณค่ะ",
    ISHIELD: "แผนนี้คือเงินก้อนที่ให้คุณรักษาตัวได้โดยไม่ต้องห่วงรายได้ค่ะ",
    IHEALTHY: "แผนนี้ดูแลค่ารักษาให้ คุณจะได้ตั้งใจหายป่วยอย่างเดียวค่ะ",
    PENSION: "แผนนี้คือเงินเดือนที่คุณจ่ายให้ตัวเองไว้ใช้หลังเกษียณค่ะ",
    LEGACY: "แผนนี้คือเงินก้อนที่ดูแลคนที่คุณรัก และดูแลตัวคุณเองตอนป่วยหนักค่ะ",
    PLB: "แผนนี้คือเงินก้อนที่ดูแลคนที่คุณรัก ในช่วงที่ภาระยังอยู่ค่ะ",
    GSAVING: "แผนนี้คือเงินออมที่ได้คืนแน่นอน และมีโอกาสโตตามดัชนีโลกค่ะ",
    EASYPROTECT: "แผนนี้คือเงินก้อนที่ดูแลคนที่คุณรักแทนคุณ โดยออมแค่ 6 ปีค่ะ",
    LIFETREASURE: "แผนนี้คือเงินก้อนที่ส่งต่อให้คนที่คุณรัก ตามจำนวนที่คุณตั้งไว้ค่ะ",
    CI123: "แผนนี้คือเงินก้อนที่ให้คุณรักษาตัวได้เต็มที่ ตั้งแต่ระยะแรกที่ตรวจพบค่ะ",
    TWELVEPL: "แผนนี้คือเงินออมที่คืนให้ทุกปี และดูแลคนที่คุณรักไปด้วยค่ะ",
  };
  const points: Record<Product, string[]> = {
    LIFEPROTECT: ["ภาระยังอยู่", "คนที่รักยังต้องใช้เงิน", "เงินก้อนดูแลแทนคุณ"],
    ISHIELD: ["ป่วยหนักทำงานไม่ได้", "ค่าใช้จ่ายยังมีทุกเดือน", "เงินก้อนแทนรายได้"],
    IHEALTHY: ["ค่ารักษาสูงขึ้นทุกปี", "เงินเก็บไม่หายไปกับบิล", "เหมาจ่ายตามจริง"],
    PENSION: ["รายได้ประจำหายไป", "ค่าใช้จ่ายยังมีทุกเดือน", "บำนาญจ่ายแทนเงินเดือน"],
    LEGACY: ["ภาระยังอยู่", "ป่วยหนักต้องใช้เงินก้อน", "มรดกดูแลทั้งสองทาง"],
    PLB: ["ภาระยังผ่อนอยู่", "คนที่รักยังต้องใช้เงิน", "เงินก้อนดูแลแทนคุณ"],
    GSAVING: ["ออมสั้นแค่ 8 ปี", "เงินคืนทุกปี", "โบนัสตามดัชนีโลก"],
    EASYPROTECT: ["ออมแค่ 6 ปี", "ยอดเท่าเดิมทุกปี", "คุ้มครองถึงอายุ 99"],
    LIFETREASURE: ["ระบุจำนวนไว้ล่วงหน้า", "เลือกระยะจ่ายได้", "คุ้มครองถึงอายุ 99"],
    CI123: ["ป่วยหนักต้องใช้เงินก้อน", "เจอเร็วก็ได้เร็ว", "เคลมระยะถัดไปได้อีก"],
    TWELVEPL: ["ออมแค่ 12 ปี", "เงินคืนทุกปี", "คุ้มครองถึงอายุ 85"],
  };
  return {
    kind,
    // Global Savings' lines were written for 15/8: 25/5's clip says its own years (gsaving.ts gsWords)
    hook: gs(hooks[kind][p]),
    headline: heads[kind][p].map(gs),
    close: closes[p],
    loopClose: loops[kind],
    story: `ลองนึกภาพนะคะ ${aud?.scene ?? "ชีวิตที่มีคนพึ่งพาคุณอยู่"} ${tails[p]}`,
    points: points[p].map(gs),
  };
}
