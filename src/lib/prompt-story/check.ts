import { FORBIDDEN, numbersIn } from "@/lib/quote-video/brief";
import type { StoryFigure } from "@/lib/quote-video/story";
import type { PromptScene } from "./types";

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
  return reasons;
}

/** the scenes (0-based) that fail, with their reasons */
export function checkScript(scenes: PromptScene[], brief: string, figure?: StoryFigure): { scene: number; reasons: string[] }[] {
  const allowed = allowedFor(brief, figure);
  return scenes.flatMap((s, scene) => {
    const reasons = checkScene(s, allowed);
    return reasons.length ? [{ scene, reasons }] : [];
  });
}
