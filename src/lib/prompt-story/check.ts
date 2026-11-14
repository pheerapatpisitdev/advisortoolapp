import { FORBIDDEN, numbersIn } from "@/lib/quote-video/brief";
import type { StoryFigure } from "@/lib/quote-video/story";
import type { DeviceLayout } from "@/lib/quote-video/story-knowledge";
import { deviceInfo } from "@/lib/scene-library/devices";
import { isTaxRate, TAX_FIGURES, TAXBACK_FIGURES } from "@/lib/scene-library/tax-th";
import { SCREEN_MAX, type DeviceScene, type PromptScene } from "./types";

/**
 * Other insurers and brands a คลิปตามโจทย์ may not name (spec: no named company comparisons). The
 * owner's list to adjust: one name a row, Thai or Latin, matched anywhere, letter case aside.
 */
export const OTHER_INSURERS = [
  "เมืองไทยประกันชีวิต", "ไทยประกันชีวิต", "เอไอเอ", "AIA", "พรูเด็นเชียล", "Prudential", "อลิอันซ์", "Allianz",
  "เจนเนอราลี", "Generali", "ฟีนิกซ์", "กรุงเทพประกันชีวิต", "FWD", "ธนชาต", "ทิพยประกันภัย",
];
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
 * same rules; a device's numbers to `forDevice` (deviceAllowed), else to `allowed`
 */
export function checkScene(scene: PromptScene, allowed: Set<number>, forDevice: Set<number> = allowed): string[] {
  const reasons: string[] = [];
  for (const field of ["voice", "screen", "picture"] as const) {
    const t = scene[field] ?? "";
    for (const x of [...FORBIDDEN, ...FREE_FORBIDDEN]) if (x.re.test(t)) reasons.push(`${field}: ${x.why}`);
    // a picture note is drawn, never read: no digits in it at all, allowed or not
    if (field === "picture" && /[\d๐-๙]/.test(t)) reasons.push("picture: มีตัวเลข");
    const stray = numbersIn(t).find((n, i, all) => !allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
    if (stray !== undefined) reasons.push(`${field}: ตัวเลข ${stray} ไม่อยู่ในโจทย์หรือแผน`);
  }
  if (scene.device) {
    const d = checkDevice(scene.device, forDevice);
    if (typeof d === "string") reasons.push(`device: ${d}`);
  }
  return reasons;
}

/** a device's word on screen: the script's rules, and every figure in it from the brief or the plan */
function wordReasons(field: string, t: string, allowed: Set<number>): string[] {
  const reasons: string[] = [];
  for (const x of [...FORBIDDEN, ...FREE_FORBIDDEN]) if (x.re.test(t)) reasons.push(`${field}: ${x.why}`);
  const stray = numbersIn(t).find((n, i, all) => !allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
  if (stray !== undefined) reasons.push(`${field}: ตัวเลข ${stray} ไม่อยู่ในโจทย์หรือแผน`);
  return reasons;
}

/**
 * A scene's device, as the writer or the agent left it, made fit to draw: only the device's own fields are
 * kept (a total, gap or refund the writer adds is dropped: the drawer computes those); every word at most
 * SCREEN_MAX and held to the script's rules; a list at most four (moneysplit's parts two or three,
 * threegen's rows three); every number a whole number above nought that the brief or the plan gave
 * (deviceAllowed), the figures inside words too; taxcap's words may also say the tax table's figures
 * (TAX_FIGURES), taxback's only its year, life cap and bracket thresholds (TAXBACK_FIGURES: never a figure a
 * refund could be). Anything else is the first reason, naming its field: the device is dropped and the scene
 * painted. Three things are not reasons but drawn without (spec, Review Focus 2): beneficiary shares not all
 * given or not totalling 100, moneysplit amounts not all given or over the total (or with no total), and a
 * taxback bracket that is not one of the table's rates or not in `allowed`. The client's bracket is an input,
 * never the AI's pick: a คลิปตามโจทย์ brief states it ("ฐานภาษี 20%", deviceAllowed reads the 20); the story
 * form adds its chip's rate to `allowed`.
 */
export function checkDevice(d: unknown, allowed: Set<number>): DeviceScene | string {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "layout: ไม่มีอุปกรณ์";
  const o = d as Record<string, unknown>;
  // the registry (browser-safe) rather than story-knowledge's list, so the page may check a device too
  if (typeof o.layout !== "string" || !deviceInfo(o.layout)) return "layout: ไม่รู้จักอุปกรณ์นี้";
  const layout = o.layout as DeviceLayout;
  // the tax devices' words may name the table's own figures ("ลดหย่อนได้ 100,000"); their numbers may not.
  // taxback's words a narrower set: a cap such as 15,000 is also a refund, and a refund is never written by the AI
  const wordAllowed = layout === "taxcap" ? new Set([...allowed, ...TAX_FIGURES])
    : layout === "taxback" ? new Set([...allowed, ...TAXBACK_FIGURES]) : allowed;
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
  const num = (field: string, x: unknown, need: boolean): number | undefined => {
    if (x === undefined || x === null) {
      if (need) fail.push(`${field}: ไม่มีตัวเลข`);
      return undefined;
    }
    // the drawers clamp, but a figure on screen is never nought, below it, or a fraction
    if (typeof x !== "number" || !Number.isInteger(x) || x <= 0) {
      fail.push(`${field}: ต้องเป็นจำนวนเต็มมากกว่าศูนย์`);
      return undefined;
    }
    if (!allowed.has(x)) fail.push(`${field}: ตัวเลข ${x} ไม่อยู่ในโจทย์หรือแผน`);
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

  const rawTitle = Array.isArray(o.title) && o.title.length >= 1 && o.title.length <= 2 ? o.title : null;
  if (!rawTitle) fail.push("title: ใส่หัวข้อ 1–2 บรรทัด");
  const title: [string, string] = [word("title", rawTitle?.[0], true), word("title", rawTitle?.[1], false)];

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
    case "taxback":
      // the bracket: one of the tax table's rates that the brief (or the story form) gave; any other is left off
      out = { layout, title, ...opt("premium", o.premium), ...(isTaxRate(o.bracket) && allowed.has(o.bracket) ? { bracket: o.bracket } : {}) };
      break;
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
  }
  return fail.length ? fail[0] : out;
}

/** the scenes (0-based) that fail, with their reasons */
export function checkScript(scenes: PromptScene[], brief: string, figure?: StoryFigure): { scene: number; reasons: string[] }[] {
  const allowed = allowedFor(brief, figure);
  const forDevice = deviceAllowed(brief, figure);
  return scenes.flatMap((s, scene) => {
    const reasons = checkScene(s, allowed, forDevice);
    return reasons.length ? [{ scene, reasons }] : [];
  });
}
