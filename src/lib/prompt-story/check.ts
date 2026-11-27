import { FORBIDDEN, numbersIn } from "@/lib/quote-video/brief";
import type { StoryFigure } from "@/lib/quote-video/story";
import { HEALTH2_LAYOUTS, HEALTH2_LIMITS, META_LAYOUTS, META_LIMITS, SAVE_LAYOUTS, SAVE_LIMITS, type DeviceLayout } from "@/lib/quote-video/story-knowledge";
import { deviceInfo } from "@/lib/scene-library/devices";
import { HEALTH2_FIXED as FIXED } from "@/lib/scene-library/health2-fixed";
import { isTaxRate, TAX_WORD_FIGURES } from "@/lib/scene-library/tax-th";
import { MOTION_ICONS, MOTION_LIMITS, SCREEN_MAX, type DeviceScene, type MotionLayout, type MotionSide, type PromptScene } from "./types";

/**
 * Other insurers and brands a คลิปตามโจทย์ may not name (spec: no named company comparisons). The
 * owner's list to adjust: one name a row, Thai or Latin, matched anywhere, letter case aside.
 */
export const OTHER_INSURERS = [
  "เมืองไทยประกันชีวิต", "ไทยประกันชีวิต", "เอไอเอ", "AIA", "พรูเด็นเชียล", "Prudential", "อลิอันซ์", "Allianz",
  "เจนเนอราลี", "Generali", "ฟีนิกซ์", "กรุงเทพประกันชีวิต", "FWD", "ธนชาต", "ทิพยประกันภัย",
];
/** the PA weekly benefit is paid a week, never a day: no word of a paclaim scene says it is */
const DAILY_WORD = /รายวัน|วันละ/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * This clip's own forbidden promises, beside brief.ts's (left as it is, so the quote clips do not
 * change): no "no health check", however spaced, and no other insurer by name.
 */
const FREE_FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /ไม่\s*(ต้อง\s*)?ตรวจ\s*สุขภาพ/, why: "สัญญาว่าไม่ต้องตรวจสุขภาพ" },
  { re: new RegExp(OTHER_INSURERS.map(escape).join("|"), "i"), why: "เอ่ยชื่อบริษัทประกันอื่น" },
];

/** every figure a คลิปตามโจทย์ script may say: the brief's own, and the figure's age, sum, year and month */
export function allowedFor(brief: string, figure?: StoryFigure): Set<number> {
  const out = new Set<number>(numbersIn(brief));
  if (figure) for (const n of [figure.age, figure.sumAssured, figure.annual, figure.monthly]) if (Number.isFinite(n) && n > 0) out.add(n);
  // a sum said in millions: "3 ล้าน" is 3,000,000
  for (const n of [...out]) if (n >= 1_000_000 && n % 100_000 === 0) out.add(n / 1_000_000);
  return out;
}

/**
 * The figures a device may show, and the figures inside its words: the brief's and the plan's as
 * written. Not allowedFor's spoken millions ("3" for 3,000,000): a device's "3" would draw 3 baht.
 */
export function deviceAllowed(brief: string, figure?: Pick<StoryFigure, "age" | "sumAssured" | "annual" | "monthly">): Set<number> {
  const out = new Set<number>();
  for (const m of brief.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(ล้าน)?/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.add(m[2] ? n * 1_000_000 : n);
  }
  if (figure) for (const n of [figure.age, figure.sumAssured, figure.annual, figure.monthly]) if (Number.isFinite(n) && n > 0) out.add(n);
  return out;
}

/**
 * Where a taxback's two client inputs may come from, when not the device's `allowed` figures: `rates` for its
 * bracket, `premiums` for its premium.
 */
export interface TaxSources { rates: ReadonlySet<number>; premiums: ReadonlySet<number> }

/**
 * The tax table's rates the brief writes as a percent ("ฐานภาษี 30%", "30 เปอร์เซ็นต์"): never the plan's figures,
 * whose age (20, 25, 30, 35) may be a rate, nor a bare number such as "30 ปี".
 */
export function briefRates(brief: string): Set<number> {
  const out = new Set<number>();
  for (const m of brief.matchAll(/(?<![\d,.])(\d+(?:\.\d+)?)\s*(?:%|เปอร์เซ็?นต์)/g)) {
    const n = Number(m[1]);
    if (isTaxRate(n)) out.add(n);
  }
  return out;
}

/**
 * A คลิปตามโจทย์'s taxback inputs: the client's bracket a rate the brief writes as a percent (briefRates), and the
 * premium a number the brief writes (deviceAllowed of the brief alone): never the plan's figures, whose premium may
 * be a health plan's (iShield), not life insurance a refund is worked from.
 */
export const briefTax = (brief: string): TaxSources => ({ rates: briefRates(brief), premiums: deviceAllowed(brief) });

/**
 * What no word of a คลิปตามโจทย์ may say, told to the writer: built from the same lists checkScene
 * holds the words to, so the prompt and the check cannot drift. A rule that is a plain list of words
 * gives its words; any other (greetings, Thai digits, links, emoji…) gives its reason as "ห้าม…".
 */
export function forbiddenForPrompt(): { words: string[]; rules: string[] } {
  const words: string[] = [];
  const rules: string[] = [];
  for (const x of [...FORBIDDEN, ...FREE_FORBIDDEN]) {
    if (/^[\p{L}\p{M}\d% |]+$/u.test(x.re.source)) words.push(...x.re.source.split("|"));
    else rules.push(`ห้าม${x.why}`);
  }
  return { words, rules };
}

/**
 * why a scene cannot go in the clip (empty when fine): voice, screen and picture are all held to the
 * same rules; a device's numbers to `forDevice` (deviceAllowed), else to `allowed`; a taxback's inputs to
 * `tax` (briefTax) when given
 */
export function checkScene(scene: PromptScene, allowed: Set<number>, forDevice: Set<number> = allowed, tax?: TaxSources): string[] {
  const reasons: string[] = [];
  for (const field of ["voice", "screen", "picture"] as const) {
    const t = scene[field] ?? "";
    for (const x of [...FORBIDDEN, ...FREE_FORBIDDEN]) if (x.re.test(t)) reasons.push(`${field}: ${x.why}`);
    // a picture note is drawn, never read: no digits in it at all, allowed or not
    if (field === "picture" && /[\d๐-๙]/.test(t)) reasons.push("picture: มีตัวเลข");
    const stray = numbersIn(t).find((n, i, all) => !allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
    if (stray !== undefined) reasons.push(`${field}: ตัวเลข ${stray} ไม่อยู่ในโจทย์หรือแผน`);
  }
  // a scene that carries a paclaim device: its voice and screen words never call the weekly benefit a daily one either
  if ((scene.device as { layout?: unknown } | undefined)?.layout === "paclaim") {
    for (const field of ["voice", "screen"] as const) if (DAILY_WORD.test(scene[field] ?? "")) reasons.push(`${field}: เรียกค่าชดเชยรายสัปดาห์ว่ารายวัน`);
  }
  if (scene.device) {
    const d = checkDevice(scene.device, forDevice, tax);
    if (typeof d === "string") reasons.push(`device: ${d}`);
  }
  if (scene.motion !== undefined && scene.motion !== null) {
    const m = checkMotion(scene.motion, allowed, forDevice);
    if (Array.isArray(m)) reasons.push(...m);
  }
  return reasons;
}

/** a device's word on screen: the script's rules, and every figure in it from the brief or the plan */
function wordReasons(field: string, t: string, allowed: ReadonlySet<number>): string[] {
  const reasons: string[] = [];
  for (const x of [...FORBIDDEN, ...FREE_FORBIDDEN]) if (x.re.test(t)) reasons.push(`${field}: ${x.why}`);
  const stray = numbersIn(t).find((n, i, all) => !allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
  if (stray !== undefined) reasons.push(`${field}: ตัวเลข ${stray} ไม่อยู่ในโจทย์หรือแผน`);
  return reasons;
}

/**
 * A scene's โมชันกราฟิก layout, as the writer or the agent left it, made fit to draw: only the kind's own fields
 * are kept, every string trimmed and single-spaced, non-empty, within MOTION_LIMITS, and held to the screen words'
 * rules (forbidden words; any figure in a word from `allowed`). A number's value is a whole number above nought in
 * `forNumber` (deviceAllowed). Anything else is a list of reasons, each "motion.<field>: why".
 */
export function checkMotion(m: unknown, allowed: Set<number>, forNumber: Set<number>): MotionLayout | string[] {
  if (!m || typeof m !== "object" || Array.isArray(m)) return ["motion: ไม่มีรูปแบบภาพ"];
  const o = m as Record<string, unknown>;
  const fail: string[] = [];
  const word = (field: string, x: unknown, max: number): string => {
    if (typeof x !== "string") {
      fail.push(`motion.${field}: ต้องเป็นข้อความ`);
      return "";
    }
    const t = x.replace(/\s+/g, " ").trim();
    if (!t) fail.push(`motion.${field}: ว่างอยู่`);
    if ([...t].length > max) fail.push(`motion.${field}: ยาวเกิน ${max} ตัวอักษร`);
    fail.push(...wordReasons(`motion.${field}`, t, allowed));
    return t;
  };
  const words = (field: string, x: unknown, min: number, max: number, cap: number): string[] => {
    if (!Array.isArray(x) || x.length < min || x.length > max) {
      fail.push(`motion.${field}: ใส่ได้ ${min === max ? min : `${min}–${max}`} บรรทัด`);
      return [];
    }
    return x.map((t, i) => word(`${field}[${i}]`, t, cap));
  };
  const key = (x: unknown, count: number): number => {
    if (typeof x !== "number" || !Number.isInteger(x) || x < -1 || x >= count) {
      fail.push("motion.key: ต้องเป็น -1 หรือเลขบรรทัดที่มี");
      return -1;
    }
    return x;
  };
  const side = (field: string, x: unknown): MotionSide => {
    if (!x || typeof x !== "object" || Array.isArray(x)) {
      fail.push(`motion.${field}: ไม่มีฝั่งนี้`);
      return { head: "", lines: ["", ""] };
    }
    const s = x as Record<string, unknown>;
    const head = word(`${field}.head`, s.head, MOTION_LIMITS.head);
    const lines = words(`${field}.lines`, s.lines, 2, 2, MOTION_LIMITS.side);
    return { head, lines: [lines[0] ?? "", lines[1] ?? ""] };
  };
  let out: MotionLayout | undefined;
  switch (o.kind) {
    case "hook": {
      const lines = words("lines", o.lines, 1, 3, MOTION_LIMITS.line);
      const k = key(o.key, lines.length);
      if (typeof o.icon !== "string" || !(MOTION_ICONS as readonly string[]).includes(o.icon)) fail.push("motion.icon: ไม่รู้จักไอคอนนี้");
      out = { kind: "hook", lines, key: k, icon: o.icon as (typeof MOTION_ICONS)[number] };
      break;
    }
    case "card": {
      const tag = word("tag", o.tag, MOTION_LIMITS.tag);
      const chips = words("chips", o.chips, 2, 2, MOTION_LIMITS.chip);
      out = { kind: "card", tag, chips: [chips[0] ?? "", chips[1] ?? ""] };
      break;
    }
    case "number": {
      const v = o.value;
      if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) fail.push("motion.value: ต้องเป็นจำนวนเต็มมากกว่าศูนย์");
      else if (!forNumber.has(v)) fail.push(`motion.value: ตัวเลข ${v} ไม่อยู่ในโจทย์หรือแผน`);
      out = {
        kind: "number", value: v as number, unit: word("unit", o.unit, MOTION_LIMITS.unit),
        tag: word("tag", o.tag, MOTION_LIMITS.tag), bill: word("bill", o.bill, MOTION_LIMITS.bill),
      };
      break;
    }
    case "compare": {
      const title = word("title", o.title, MOTION_LIMITS.title);
      out = { kind: "compare", title, bad: side("bad", o.bad), good: side("good", o.good) };
      break;
    }
    case "check": {
      const lines = words("lines", o.lines, 2, 2, MOTION_LIMITS.line);
      const ticks = words("ticks", o.ticks, 3, 3, MOTION_LIMITS.tick);
      if (typeof o.photo !== "boolean") fail.push("motion.photo: ต้องเป็นจริงหรือเท็จ");
      out = {
        kind: "check", lines: [lines[0] ?? "", lines[1] ?? ""], ticks: [ticks[0] ?? "", ticks[1] ?? "", ticks[2] ?? ""], photo: o.photo === true,
      };
      break;
    }
    case "full": {
      const lines = words("lines", o.lines, 1, 2, MOTION_LIMITS.line);
      out = { kind: "full", lines, key: key(o.key, lines.length) };
      break;
    }
    default:
      return ["motion.kind: ไม่รู้จักรูปแบบภาพนี้"];
  }
  return fail.length || !out ? fail : out;
}

/**
 * A scene's device, as the writer or the agent left it, made fit to draw: only the device's own fields are
 * kept (a total, gap or refund the writer adds is dropped: the drawer computes those); every word at most
 * SCREEN_MAX and held to the script's rules; a list at most four (moneysplit's parts two or three,
 * threegen's rows three); every number a whole number above nought that the brief or the plan gave
 * (deviceAllowed), the figures inside words too, but a tax device's words (taxcap, taxback) carry no figure but
 * the year (TAX_WORD_FIGURES): the device draws the table's own, and a refund is never the AI's. Anything else is the first reason, naming its field: the device is dropped and the scene
 * painted. Three things are not reasons but drawn without (spec, Review Focus 2): beneficiary shares not all
 * given or not totalling 100, moneysplit amounts not all given or over the total (or with no total), and a
 * taxback bracket that is not one of the table's rates or not in `tax.rates` (else `allowed`). The client's bracket
 * and premium are inputs, never the AI's pick: a คลิปตามโจทย์ passes `tax` (briefTax), so the bracket is a rate the
 * brief writes as a percent ("ฐานภาษี 20%") and the premium a number the brief writes, never a plan figure; the
 * story form leaves `tax` out and adds its chip's rate to `allowed`.
 */
export function checkDevice(d: unknown, allowed: Set<number>, tax?: TaxSources): DeviceScene | string {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "layout: ไม่มีอุปกรณ์";
  const o = d as Record<string, unknown>;
  // the registry (browser-safe) rather than story-knowledge's list, so the page may check a device too
  if (typeof o.layout !== "string" || !deviceInfo(o.layout)) return "layout: ไม่รู้จักอุปกรณ์นี้";
  const layout = o.layout as DeviceLayout;
  // a tax device's words carry the year alone: no cap, threshold or rate (the device draws them) and no refund
  const wordAllowed: ReadonlySet<number> = layout === "taxcap" || layout === "taxback" ? TAX_WORD_FIGURES : allowed;
  const fail: string[] = [];
  const word = (field: string, x: unknown, need: boolean): string => {
    if (x === undefined && !need) return "";
    if (typeof x !== "string") {
      fail.push(`${field}: ต้องเป็นข้อความ`);
      return "";
    }
    const t = x.replace(/\s+/g, " ").trim();
    if (need && !t) fail.push(`${field}: ว่างอยู่`);
    if ([...t].length > SCREEN_MAX) fail.push(`${field}: ยาวเกิน ${SCREEN_MAX} ตัวอักษร`);
    fail.push(...wordReasons(field, t, wordAllowed));
    return t;
  };
  // `from`: where the figure may come from, `where` said in its reason when not
  const num = (field: string, x: unknown, need: boolean, from: ReadonlySet<number> = allowed, where = "ไม่อยู่ในโจทย์หรือแผน"): number | undefined => {
    if (x === undefined || x === null) {
      if (need) fail.push(`${field}: ไม่มีตัวเลข`);
      return undefined;
    }
    // the drawers clamp, but a figure on screen is never nought, below it, or a fraction
    if (typeof x !== "number" || !Number.isInteger(x) || x <= 0) {
      fail.push(`${field}: ต้องเป็นจำนวนเต็มมากกว่าศูนย์`);
      return undefined;
    }
    if (!from.has(x)) fail.push(`${field}: ตัวเลข ${x} ${where}`);
    return x;
  };
  const list = (field: string, x: unknown, min: number, max = 4): Record<string, unknown>[] => {
    if (!Array.isArray(x) || x.length < min || x.length > max) {
      fail.push(`${field}: ใส่ได้ ${min === max ? min : `${min}–${max}`} รายการ`);
      return [];
    }
    return x.map((r) => (r && typeof r === "object" && !Array.isArray(r) ? r : { value: r }) as Record<string, unknown>);
  };
  const opt = (field: string, x: unknown) => {
    const n = num(field, x, false);
    return n === undefined ? {} : { [field]: n };
  };
  // an optional word left null is absent, as left out
  const optWord = (field: string, x: unknown) => {
    const t = x === null ? "" : word(field, x, false);
    return t ? { [field]: t } : {};
  };

  // an อุปมา device carries words only (spec 2026-11-15): no digit of any script in any word, each within its own
  // length (META_LIMITS), refused when over, never cut; the script's forbidden words apply as to any word
  const meta = (field: string, x: unknown, max: number, need: boolean): string => {
    if (x === undefined && !need) return "";
    if (typeof x !== "string") {
      fail.push(`${field}: ต้องเป็นข้อความ`);
      return "";
    }
    const t = x.replace(/\s+/g, " ").trim();
    if (need && !t) fail.push(`${field}: ว่างอยู่`);
    if ([...t].length > max) fail.push(`${field}: ยาวเกิน ${max} ตัวอักษร`);
    // a digit of any script: Arabic, Thai, full-width ０-９, Arabic-Indic, … (Unicode's decimal digits)
    if (/\p{Nd}/u.test(t)) fail.push(`${field}: มีตัวเลข`);
    for (const f of [...FORBIDDEN, ...FREE_FORBIDDEN]) if (f.re.test(t)) fail.push(`${field}: ${f.why}`);
    // specs 2026-11-15-devices-saving and -health2: no IRR on a saving or a round-5 health device (FORBIDDEN has no IRR; other devices and scripts are unchanged)
    // spec: the PA weekly benefit is never called "รายวัน" (paclaim only)
    if (layout === "paclaim" && DAILY_WORD.test(t)) fail.push(`${field}: เรียกค่าชดเชยรายสัปดาห์ว่ารายวัน`);
    if ((isSaveLayout || isHealth2Layout) && /\birr\b/i.test(t)) fail.push(`${field}: พูดถึงผลตอบแทน`);
    return t;
  };
  const metaOpt = (field: string, x: unknown, max: number) => {
    const t = x === null ? "" : meta(field, x, max, false);
    return t ? { [field]: t } : {};
  };
  const isMetaLayout = (META_LAYOUTS as readonly string[]).includes(layout);
  const isSaveLayout = (SAVE_LAYOUTS as readonly string[]).includes(layout);
  const isHealth2Layout = (HEALTH2_LAYOUTS as readonly string[]).includes(layout);
  // an ออมเงิน or a round-5 health device's words are digit-free as a metaphor's, within SAVE_LIMITS / HEALTH2_LIMITS (its figures are the fields below)
  const words = isMetaLayout || isSaveLayout || isHealth2Layout;
  const limits = isHealth2Layout ? HEALTH2_LIMITS : isSaveLayout ? SAVE_LIMITS : META_LIMITS;
  // a figure of a saving device: a whole number from `lo` to `hi`, from the brief (the allowed set). `need`: a figure the
  // device cannot be drawn without refuses it (spec: paidgot's two amounts, pensionsteps' rows); an optional figure that
  // is not a whole number, out of range or not in the brief is left off, never a reason (spec 2026-11-15: a number that
  // cannot be sourced is left off)
  // `from`: where the figure may come from, the brief's (allowed) unless a device names more (round 5: its fixed sources too)
  const ranged = (field: string, x: unknown, need: boolean, lo: number, hi: number, from: ReadonlySet<number> = allowed): number | undefined => {
    if (!need) return typeof x === "number" && Number.isInteger(x) && x >= lo && x <= hi && from.has(x) ? x : undefined;
    const n = num(field, x, true, from);
    if (n !== undefined && (n < lo || n > hi)) {
      fail.push(`${field}: ต้องอยู่ระหว่าง ${lo.toLocaleString("en-US")} ถึง ${hi.toLocaleString("en-US")}`);
      return undefined;
    }
    return n;
  };
  const baht = (field: string, x: unknown, need: boolean, from?: ReadonlySet<number>) => ranged(field, x, need, 1, SAVE_LIMITS.baht, from);
  const age = (field: string, x: unknown, need: boolean, from?: ReadonlySet<number>) => ranged(field, x, need, 1, SAVE_LIMITS.age, from);
  // a round-5 figure: the brief's numbers and that device's fixed-source values (health2-fixed.ts), whole baht to HEALTH2_LIMITS.baht
  const sourced = (...fixed: number[][]): ReadonlySet<number> => new Set([...allowed, ...fixed.flat()]);
  /** a figure that must be exactly the source's (the sheet's co-payment, the renewal age, the tax cap, the hospital total) */
  const exact = (field: string, n: number | undefined, source: number, what: string) => {
    if (n !== undefined && n !== source) fail.push(`${field}: ต้องเท่ากับ${what}`);
    return n;
  };
  const given = <K extends string>(field: K, n: number | undefined): { [P in K]?: number } => (n === undefined ? {} : ({ [field]: n } as { [P in K]?: number }));
  /** an age pair of paidgot: both ages given and from at most to, else neither is drawn */
  const agePair = (a: string, b: string, from: unknown, to: unknown): { [k: string]: number } => {
    const x = age(a, from, false), y = age(b, to, false);
    return x !== undefined && y !== undefined && x <= y ? { [a]: x, [b]: y } : {};
  };

  const rawTitle = Array.isArray(o.title) && o.title.length >= 1 && o.title.length <= 2 ? o.title : null;
  if (!rawTitle) fail.push("title: ใส่หัวข้อ 1–2 บรรทัด");
  const title: [string, string] = words
    ? [meta("title", rawTitle?.[0], limits.titleLine, true), meta("title", rawTitle?.[1] ?? "", limits.titleLine, false)]
    : [word("title", rawTitle?.[0], true), word("title", rawTitle?.[1], false)];
  const note = words ? metaOpt("note", o.note, limits.note) : {};

  let out: DeviceScene;
  switch (layout) {
    case "split":
      out = { layout, title, parts: list("parts", o.parts, 1).map((p) => word("parts", p.value, true)), whole: word("whole", o.whole, true) };
      break;
    case "limit":
      out = { layout, title, limit: num("limit", o.limit, true) ?? 0, ...opt("used", o.used), planName: word("planName", o.planName, false) };
      break;
    case "room":
      out = { layout, title, plan: num("plan", o.plan, true) ?? 0, ...opt("real", o.real), planName: word("planName", o.planName, false) };
      break;
    case "overflow":
      out = { layout, title, ...opt("bill", o.bill), ...opt("limit", o.limit) };
      break;
    case "waiting":
      out = { layout, title, rows: list("rows", o.rows, 1).map((r) => ({ at: word("rows", r.at, true), label: word("rows", r.label, true) })) };
      break;
    case "cashless":
      out = { layout, title, note: word("note", o.note, true) };
      break;
    case "groupgap":
      out = { layout, title, ...opt("bill", o.bill), ...opt("group", o.group) };
      break;
    case "agecost":
      out = {
        layout, title,
        rows: list("rows", o.rows, 0).map((r) => ({ age: num("rows", r.age, true) ?? 0, annual: num("rows", r.annual, true) ?? 0 })),
        source: word("source", o.source, false),
      };
      break;
    case "lifeneed":
      out = { layout, title, ...opt("debts", o.debts), ...opt("expenses", o.expenses), ...opt("years", o.years), ...opt("education", o.education), ...opt("have", o.have) };
      break;
    case "beneficiary": {
      const rows = list("rows", o.rows, 1).map((r) => ({ name: word("rows", r.name, true), share: num("rows", r.share, false) }));
      // shares all given and totalling 100, or none drawn
      const keep = rows.every((r) => r.share !== undefined) && rows.reduce((s, r) => s + (r.share ?? 0), 0) === 100;
      out = { layout, title, rows: rows.map((r) => (keep ? { name: r.name, share: r.share } : { name: r.name })) };
      break;
    }
    case "cilump":
      out = { layout, title, ...opt("sum", o.sum), ...optWord("note", o.note) };
      break;
    case "incomestop":
      out = { layout, title, ...opt("monthly", o.monthly), ...opt("months", o.months) };
      break;
    case "taxback": {
      // the premium: in a คลิปตามโจทย์ the brief's own number (tax.premiums), never the plan's
      const premium = num("premium", o.premium, false, tax?.premiums ?? allowed, tax ? "ไม่อยู่ในโจทย์" : undefined);
      // the bracket: one of the tax table's rates that the brief (or the story form) gave; any other is left off
      const rates = tax?.rates ?? allowed;
      out = { layout, title, ...(premium !== undefined ? { premium } : {}), ...(isTaxRate(o.bracket) && rates.has(o.bracket) ? { bracket: o.bracket } : {}) };
      break;
    }
    case "taxcap":
      out = { layout, title };
      break;
    case "moneysplit": {
      const total = num("total", o.total, false);
      const parts = list("parts", o.parts, 2, 3).map((p) => ({ label: word("parts", p.label, true), amount: num("parts", p.amount, false) }));
      // amounts all given and within the total, or none drawn
      const keep = total !== undefined && parts.every((p) => p.amount !== undefined) && parts.reduce((s, p) => s + (p.amount ?? 0), 0) <= total;
      out = { layout, title, ...(total !== undefined ? { total } : {}), parts: parts.map((p) => (keep ? { label: p.label, amount: p.amount } : { label: p.label })) };
      break;
    }
    case "threegen":
      out = { layout, title, rows: list("rows", o.rows, 3, 3).map((r) => word("rows", r.value, true)), ...optWord("note", o.note) };
      break;
    case "umbrella": case "lifering": case "safetynet": case "bridge":
      out = { layout, title, ...note };
      break;
    case "housepillar":
      out = { layout, title, ...note, ...metaOpt("label", o.label, META_LIMITS.word), ...metaOpt("spare", o.spare, META_LIMITS.word) };
      break;
    case "seedtree":
      out = { layout, title, ...note, ...metaOpt("from", o.from, META_LIMITS.word), ...metaOpt("to", o.to, META_LIMITS.word) };
      break;
    case "balance": {
      const raw = Array.isArray(o.sides) && o.sides.length === 2 ? o.sides : null;
      if (!raw) fail.push("sides: ใส่คำสองข้างพอดี");
      const sides: [string, string] = [meta("sides", raw?.[0], META_LIMITS.word, true), meta("sides", raw?.[1], META_LIMITS.word, true)];
      if (o.tilt !== undefined && o.tilt !== null && o.tilt !== "left" && o.tilt !== "right" && o.tilt !== "even") fail.push("tilt: ต้องเป็น left, right หรือ even");
      out = { layout, title, ...note, sides, ...(o.tilt === "left" || o.tilt === "right" || o.tilt === "even" ? { tilt: o.tilt } : {}) };
      break;
    }
    case "shield": {
      // an arrow left blank (cleared in the editor: "", spaces, null) is no arrow: dropped before the count
      const kept = Array.isArray(o.arrows) ? o.arrows.filter((x) => !(x === null || (typeof x === "string" && !x.trim()))) : null;
      const raw = kept && kept.length >= 1 && kept.length <= META_LIMITS.arrows ? kept : null;
      if (!raw) fail.push(`arrows: ใส่ลูกศร 1–${META_LIMITS.arrows} คำ`);
      out = { layout, title, ...note, arrows: (raw ?? []).map((x) => meta("arrows", x, META_LIMITS.arrow, true)) };
      break;
    }
    case "savejar":
      out = { layout, title, ...note, ...given("years", ranged("years", o.years, false, 1, SAVE_LIMITS.years)), ...given("paid", baht("paid", o.paid, false)) };
      break;
    case "paidgot": {
      // both amounts or no device (the bars compare them); each age pair is drawn only when both of its ages are
      // sourced and it runs from at most to, else that bar has no ages. The internal `fromPlan` is never taken from here
      const paid = baht("paid", o.paid, true);
      const got = baht("got", o.got, true);
      out = { layout, title, ...note, paid: paid ?? 0, got: got ?? 0, ...agePair("payFrom", "payTo", o.payFrom, o.payTo), ...agePair("getFrom", "getTo", o.getFrom, o.getTo) };
      break;
    }
    case "pricerise":
      out = { layout, title, ...note };
      break;
    case "ipdopd": {
      // room and opd are the sheet's (or the brief's); "none" (the plan has no OPD) and "actual" (as paid) are the sheet's two words
      const room = baht("room", o.room, true, sourced(FIXED.ipdopd.room));
      const opd = o.opd === "none" || o.opd === "actual" ? o.opd : (baht("opd", o.opd, true, sourced(FIXED.ipdopd.opd)) ?? 0);
      // either one from the sheet (not the brief's): the two are ONE plan's pair, else the card would show a plan that does not exist
      const sheetRoom = room !== undefined && !allowed.has(room);
      const sheetOpd = opd === "none" || opd === "actual" || (typeof opd === "number" && !allowed.has(opd));
      const anySheet = sheetRoom || sheetOpd;
      const plan = anySheet ? FIXED.ipdopd.plans.find((p) => p.room === room && p.opd === opd) : undefined;
      if (anySheet && !plan && !fail.length) fail.push("opd: ค่าห้องกับวงเงินผู้ป่วยนอกต้องเป็นของแผนเดียวกันในตารางของบริษัท");
      // the plan's name, when a plan is matched: that plan's own label (never the AI's casing), any other name is dropped
      const planName = metaOpt("planName", o.planName, HEALTH2_LIMITS.label);
      const nameOut = !anySheet ? planName : plan && planName.planName && String(planName.planName).toLowerCase() === plan.label.toLowerCase() ? { planName: plan.label } : {};
      out = { layout, title, ...note, room: room ?? 0, opd, ...nameOut };
      break;
    }
    case "deductible": {
      const deductible = baht("deductible", o.deductible, true, sourced(FIXED.deductible));
      out = { layout, title, ...note, deductible: deductible ?? 0, ...given("bill", baht("bill", o.bill, false)) };
      break;
    }
    case "copay": {
      const percent = exact("percent", ranged("percent", o.percent, true, 1, 100, sourced([FIXED.copayPercent])), FIXED.copayPercent, "ร่วมจ่ายของแผน");
      out = { layout, title, ...note, percent: percent ?? 0, ...given("bill", baht("bill", o.bill, false)) };
      break;
    }
    case "renew98": {
      const to = exact("to", age("to", o.to, true, sourced([FIXED.renewalToAge])), FIXED.renewalToAge, "อายุที่แผนต่ออายุได้ถึง");
      // today's age: the brief's, 1 to 99, and below the renewal age (a person at or past it has no timeline to show)
      const today = age("age", o.age, false);
      out = { layout, title, ...note, to: to ?? 0, ...given("age", today !== undefined && today < FIXED.renewalToAge ? today : undefined) };
      break;
    }
    case "parentshealth": {
      const cap = exact("cap", baht("cap", o.cap, true, sourced([FIXED.parentsCap])), FIXED.parentsCap, "เพดานลดหย่อนของกรมสรรพากร");
      out = { layout, title, ...note, cap: cap ?? 0 };
      break;
    }
    case "groupcost": {
      const perYear = baht("perYear", o.perYear, true, sourced(FIXED.groupPerYear));
      // the head-count band: a คลิปตามโจทย์ never keeps one (a brief's number from 10 to 100 may be an age or a rate, not a head-count);
      // the story and library paths set `band` themselves and do not pass through here
      out = { layout, title, ...note, perYear: perYear ?? 0 };
      break;
    }
    case "hospitals": {
      const counts = FIXED.hospitals.counts;
      const total = exact("total", baht("total", o.total, true, sourced([FIXED.hospitals.total])), FIXED.hospitals.total, "จำนวนโรงพยาบาลในรายชื่อของบริษัท");
      const seen = new Set<string>();
      const rows = list("rows", o.rows, 1, HEALTH2_LIMITS.rows).map((r) => {
        // a province is a name in the hospital list (its spelling): that membership is its check, so its length is the list's own
        const raw = typeof r.province === "string" ? r.province.replace(/\s+/g, " ").trim() : "";
        const province = meta("rows", r.province, Object.hasOwn(counts, raw) ? 99 : HEALTH2_LIMITS.label, true);
        const count = baht("rows", r.count, true, sourced(Object.values(counts)));
        if (province) {
          if (!Object.hasOwn(counts, province)) fail.push("rows: จังหวัดนี้ไม่มีในรายชื่อโรงพยาบาล");
          else if (count !== undefined && count !== counts[province]) fail.push("rows: จำนวนโรงพยาบาลไม่ตรงกับรายชื่อของบริษัท");
          if (seen.has(province)) fail.push("rows: จังหวัดซ้ำ");
          seen.add(province);
        }
        return { province, count: count ?? 0 };
      });
      out = { layout, title, ...note, total: total ?? 0, rows };
      break;
    }
    case "paclaim": {
      const medical = baht("medical", o.medical, true, sourced(FIXED.pa.medical));
      let weekly = baht("weekly", o.weekly, false, sourced(FIXED.pa.weekly));
      // both from the plans (neither the brief's): one plan's pair, else the weekly sum is dropped (it is another plan's)
      if (medical !== undefined && weekly !== undefined && !allowed.has(medical) && !allowed.has(weekly) && !FIXED.pa.pairs.some(([m, w]) => m === medical && w === weekly)) weekly = undefined;
      // weeks only with a weekly sum, and only the plans' own limit; any other is left off
      const weeks = weekly !== undefined && o.weeks === FIXED.pa.weeks ? FIXED.pa.weeks : undefined;
      out = { layout, title, ...note, medical: medical ?? 0, ...given("weekly", weekly), ...given("weeks", weeks) };
      break;
    }
    case "pensionsteps": {
      // one to five steps; each from at most to, all three numbers; ascending: a step starts after the one before it began and does not end before it
      const rows = list("rows", o.rows, 1, SAVE_LIMITS.rows).map((r) => ({
        from: age("rows", r.from, true) ?? 0, to: age("rows", r.to, true) ?? 0, annual: baht("rows", r.annual, true) ?? 0,
      }));
      rows.forEach((r, i) => {
        if (r.from > r.to) fail.push("rows: อายุเริ่มต้องไม่มากกว่าอายุสิ้นสุด");
        if (i > 0 && (r.from <= rows[i - 1].from || r.to < rows[i - 1].to)) fail.push("rows: ต้องเรียงตามอายุจากน้อยไปมาก");
      });
      out = { layout, title, ...note, rows };
      break;
    }
  }
  return fail.length ? fail[0] : out;
}

/** the scenes (0-based) that fail, with their reasons */
export function checkScript(scenes: PromptScene[], brief: string, figure?: StoryFigure): { scene: number; reasons: string[] }[] {
  const allowed = allowedFor(brief, figure);
  const forDevice = deviceAllowed(brief, figure);
  const tax = briefTax(brief);
  return scenes.flatMap((s, scene) => {
    const reasons = checkScene(s, allowed, forDevice, tax);
    return reasons.length ? [{ scene, reasons }] : [];
  });
}
