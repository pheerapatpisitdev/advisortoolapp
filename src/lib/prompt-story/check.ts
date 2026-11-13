import { FORBIDDEN, numbersIn } from "@/lib/quote-video/brief";
import type { StoryFigure } from "@/lib/quote-video/story";
import type { HealthLayout } from "@/lib/quote-video/story-knowledge";
import { deviceInfo } from "@/lib/scene-library/devices";
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

/** why a scene cannot go in the clip (empty when fine): voice, screen and picture are all held to the same rules */
export function checkScene(scene: PromptScene, allowed: Set<number>): string[] {
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
    const d = checkDevice(scene.device, allowed);
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
 * A scene's health device, as the writer or the agent left it, made fit to draw: only the device's own
 * fields are kept; every word at most SCREEN_MAX and held to the script's rules; a list (parts, rows) at
 * most four; every number a whole number above nought that the brief or the plan gave (allowedFor), the
 * figures inside words too. Anything else is the first reason, naming its field.
 */
export function checkDevice(d: unknown, allowed: Set<number>): DeviceScene | string {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "layout: ไม่มีอุปกรณ์";
  const o = d as Record<string, unknown>;
  // the registry (browser-safe) rather than story-knowledge's list, so the page may check a device too
  if (typeof o.layout !== "string" || !deviceInfo(o.layout)) return "layout: ไม่รู้จักอุปกรณ์นี้";
  const layout = o.layout as HealthLayout;
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
    fail.push(...wordReasons(field, t, allowed));
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
  const list = (field: string, x: unknown, min: number): Record<string, unknown>[] => {
    if (!Array.isArray(x) || x.length < min || x.length > 4) {
      fail.push(`${field}: ใส่ได้ ${min}–4 รายการ`);
      return [];
    }
    return x.map((r) => (r && typeof r === "object" && !Array.isArray(r) ? r : { value: r }) as Record<string, unknown>);
  };
  const opt = (field: string, x: unknown) => {
    const n = num(field, x, false);
    return n === undefined ? {} : { [field]: n };
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
  }
  return fail.length ? fail[0] : out;
}

/** the scenes (0-based) that fail, with their reasons */
export function checkScript(scenes: PromptScene[], brief: string, figure?: StoryFigure): { scene: number; reasons: string[] }[] {
  const allowed = allowedFor(brief, figure);
  return scenes.flatMap((s, scene) => {
    const reasons = checkScene(s, allowed);
    return reasons.length ? [{ scene, reasons }] : [];
  });
}
