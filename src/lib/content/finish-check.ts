import { claimedNumbers } from "./check";
import { FINISH_HOOK_MAX, loopText } from "./finish";
import { FORMULA_SHORT, outputFormula } from "./formula";
import type { ContentOutput } from "./output";
import { scenes } from "./script";

/**
 * สูตรอ่าน-ดูจนจบ's checklist card (finish.ts): the guides' own checklists, the half a rule can
 * read done by the code, the rest ticked by the agent. Pure and without a model, so it costs
 * nothing and runs on the words on screen as they are typed. It warns and never blocks — the
 * owner decides, as with check.ts.
 */

export type FinishFormat = "post" | "script";

/** Thai vowels and tone marks above or below a letter take no width of their own */
const MARKS = /[ัิ-ฺ็-๎]/g;

export function visibleLength(s: string): number {
  return [...s.replace(MARKS, "")].length;
}

/**
 * Characters of Thai to a phone's line in a Facebook post, near enough; the guides' "บรรทัดบนมือถือ".
 * Measured 2026-10-01 in FeedPreview's caption (0.95rem, 12px each side): 7.4px a visible
 * character, so 49 on a 390px iPhone and 45 on a 360px Android — the narrower, the stricter.
 */
export const MOBILE_LINE = 45;

export const PREAMBLE = ["สวัสดี", "วันนี้จะมา", "วันนี้เรามา", "วันนี้ขอ", "ก่อนอื่น", "หลายคนถาม", "ขอเล่า", "มาทำความรู้จัก", "ทำความเข้าใจ"];
export const WEAK_OPENERS = ["เราขอแนะนำ", "ขอแนะนำ", "ซึ่ง", "ทั้งนี้", "อย่างไรก็ตาม", "นอกจากนี้", "ดังนั้น", "และ", "ก็", "จริงๆแล้ว", "จริง ๆ แล้ว"];
/** words a reader of a Thai insurance post may not know; each wants a meaning where it first appears */
export const JARGON = ["IRR", "co-payment", "copayment", "co-pay", "copay", "deductible", "annuity", "rider", "unit linked", "unit-linked", "cash value", "IPD", "OPD"];

export type FinishCheckId =
  | "no-preamble" | "hook-short" | "para-lines" | "run-lines" | "lead-words" | "jargon" | "list-count" | "loops-closed"
  | "numbers-on-screen" | "cuts";

export const FINISH_AUTO: { id: FinishCheckId; label: string; script?: true }[] = [
  { id: "no-preamble", label: "เปิดไม่เกริ่น" },
  { id: "hook-short", label: "hook สั้นพอ" },
  { id: "para-lines", label: "ย่อหน้าไม่เกิน 4 บรรทัดบนมือถือ" },
  { id: "run-lines", label: "ช่วงข้อความไม่เกิน 2 บรรทัด" },
  { id: "lead-words", label: "ขึ้นต้นย่อหน้าด้วยคำที่มีเนื้อหา" },
  { id: "jargon", label: "ศัพท์เทคนิคมีคำแปล" },
  { id: "list-count", label: "hook บอกกี่ข้อ เนื้อหามีครบ" },
  { id: "loops-closed", label: "ลูปปิดครบ" },
  { id: "numbers-on-screen", label: "ตัวเลขที่พูดขึ้นจอ", script: true },
  { id: "cuts", label: "เปลี่ยนภาพสม่ำเสมอ", script: true },
];

/** what only the agent can judge; a label per format, none where it does not apply */
const FINISH_TICKS: { id: string; post?: string; script?: string }[] = [
  { id: "lead-first", post: "ข้อสรุปอยู่ต้นเรื่อง", script: "ส่งคุณค่าชิ้นแรกภายใน 10 วินาที" },
  { id: "promise-kept", post: "hook สัญญาอะไร เนื้อหาให้ครบ", script: "hook สัญญาอะไร เนื้อหาให้ครบ" },
  { id: "share-reason", post: "มีเหตุผลให้คนแชร์", script: "มีเหตุผลให้คนแชร์" },
  { id: "one-scene", post: "ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก", script: "ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก" },
  { id: "no-fear", post: "ไม่ใช้ความกลัวเป็นตัวขับหลัก", script: "ไม่ใช้ความกลัวเป็นตัวขับหลัก" },
  { id: "old-client", post: "ถ้าลูกค้าเก่าอ่านเจอ เขาจะยังไว้ใจเราเหมือนเดิม", script: "ถ้าลูกค้าเก่าดูเจอ เขาจะยังไว้ใจเราเหมือนเดิม" },
  { id: "muted", script: "ดูแบบปิดเสียงแล้วยังเข้าใจ" },
];

export function ticksFor(format: string): { id: string; label: string }[] {
  if (format !== "post" && format !== "script") return [];
  return FINISH_TICKS.flatMap((t) => (t[format] ? [{ id: t.id, label: t[format]! }] : []));
}

/** the ticks as sent from a browser: the format's own ids, once each */
export function cleanTicks(v: unknown, format: string): string[] {
  const known = new Set(ticksFor(format).map((t) => t.id));
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && known.has(x)))] : [];
}

export interface FinishResult {
  id: FinishCheckId;
  label: string;
  ok: boolean;
  /** the words where it failed, cut short, so the agent knows where to look */
  where: string[];
}

const clip = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const arabic = (t: string) => t.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** a bullet, a number, a keycap: a line that starts one is a list item, a paragraph of its own */
const LIST_ITEM = /^\s*(?:[-•*▪✅✔👉]|\d+\s*[.)]|[๐-๙]+\s*[.)]|\d️?⃣)/u;

/** The text in the paragraphs a reader meets: split at blank lines, each list item its own. */
export function paragraphs(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    let prose: string[] = [];
    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (!LIST_ITEM.test(line)) { prose.push(line); continue; }
      if (prose.length) out.push(prose.join("\n"));
      prose = [];
      out.push(line);
    }
    if (prose.length) out.push(prose.join("\n"));
  }
  return out;
}

const mobileLines = (p: string) => p.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(visibleLength(l) / MOBILE_LINE)), 0);

/** a paragraph's first words, past its bullet, number or emoji */
const opening = (p: string) => p.replace(/^[\s\-•*▪✅✔👉\d.)๐-๙⃣️\p{Extended_Pictographic}]+/u, "");

/** the hook without a script's time marker in front of it */
const bareHook = (out: ContentOutput) => (out.hooks[0] ?? "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();

/** what the paragraph checks read: a post's paragraphs, or what is said in each stretch of a script */
function units(out: ContentOutput, format: FinishFormat): string[] {
  if (format === "script") return scenes(out.hooks[0] ?? "", out.body, out.closing).map((s) => s.say).filter(Boolean);
  return [...paragraphs(out.body), ...paragraphs(out.closing)];
}

const COUNT = /(\d+)\s*(?:ข้อ|เรื่อง|จุด|อย่าง|วิธี|เหตุผล|สิ่ง)/;
const COUNT_WORDS: Record<number, string[]> = {
  1: ["แรก", "หนึ่ง"], 2: ["สอง"], 3: ["สาม"], 4: ["สี่"], 5: ["ห้า"], 6: ["หก"], 7: ["เจ็ด"], 8: ["แปด"], 9: ["เก้า"], 10: ["สิบ"],
};

function listCount(out: ContentOutput): string[] {
  const m = COUNT.exec(arabic(bareHook(out)));
  const n = m ? Number(m[1]) : 0;
  if (n < 2 || n > 10) return [];
  const text = arabic(`${out.body}\n${out.closing}`);
  const missing: string[] = [];
  for (let k = 1; k <= n; k++) {
    const names = [String(k), ...COUNT_WORDS[k]].join("|");
    const item = new RegExp(`(?:^|\\n)\\s*(?:${k}\\s*[.)]|${k}\\uFE0F?\\u20E3)|ข้อ(?:ที่)?\\s*(?:${names})(?!\\d)`);
    if (!item.test(text)) missing.push(`ข้อ ${k}`);
  }
  return missing.length ? [`hook บอก ${n} ข้อ แต่ไม่พบ ${missing.join(", ")}`] : [];
}

function jargon(out: ContentOutput): string[] {
  const all = [bareHook(out), out.body, out.closing].join("\n");
  const where: string[] = [];
  for (const term of JARGON) {
    const m = new RegExp(`(?<![A-Za-z])${escape(term)}(?![A-Za-z])`, "i").exec(all);
    if (!m) continue;
    // "ผู้ป่วยใน (IPD)": the meaning came first, and the word is its bracket
    if (/\(\s*$/.test(all.slice(Math.max(0, m.index - 3), m.index))) continue;
    const after = all.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (/^\s*\(|คือ|หมายถึง|แปลว่า|หรือ/.test(after)) continue;
    where.push(m[0]);
  }
  return where;
}

function loopsOpen(out: ContentOutput): string[] {
  if (!out.loops?.length) return ["ไม่มีข้อมูลลูป ตรวจเองนะครับ"];
  const text = loopText(out);
  return out.loops.flatMap((l) => {
    const at = text.indexOf(l.open);
    const closed = at >= 0 && text.indexOf(l.close, at + l.open.length) >= 0;
    return closed ? [] : [`“${clip(l.open)}” ยังไม่ได้เฉลย`];
  });
}

const key = (n: number) => n.toFixed(2);
const SPAN = /(\d+)\s*[–-]\s*(\d+)/;

function numbersOnScreen(out: ContentOutput): string[] {
  return scenes(out.hooks[0] ?? "", out.body, out.closing).flatMap((s) => {
    const shown = new Set(claimedNumbers(s.screen.join(" ")).map(key));
    const unshown = claimedNumbers(s.say).filter((n) => !shown.has(key(n)));
    return unshown.length ? [`${s.time ?? "ต้นคลิป"}: ${clip(s.say)}`] : [];
  });
}

function cuts(out: ContentOutput): string[] {
  return scenes(out.hooks[0] ?? "", out.body, out.closing).flatMap((s) => {
    const m = s.time ? SPAN.exec(arabic(s.time)) : null;
    if (!m || Number(m[2]) - Number(m[1]) <= 7 || s.acts.length > 0) return [];
    return [`${s.time}: ${clip(s.say)}`];
  });
}

export function finishChecks(out: ContentOutput, format: FinishFormat): FinishResult[] {
  const hook = bareHook(out);
  const paras = units(out, format);
  const where: Record<FinishCheckId, () => string[]> = {
    "no-preamble": () => (PREAMBLE.some((p) => hook.startsWith(p)) ? [clip(hook)] : []),
    "hook-short": () => (visibleLength(hook) > FINISH_HOOK_MAX ? [`${visibleLength(hook)}/${FINISH_HOOK_MAX} ตัวอักษร`] : []),
    "para-lines": () => paras.filter((p) => mobileLines(p) > 4).map((p) => clip(p)),
    "run-lines": () => paras
      .flatMap((p) => p.split(/\s+/))
      .filter((r) => !r.startsWith("#") && !r.startsWith("http") && visibleLength(r) > MOBILE_LINE * 2)
      .map((r) => clip(r)),
    "lead-words": () => paras
      .filter((p) => WEAK_OPENERS.some((w) => opening(p).startsWith(w)))
      .map((p) => clip(p)),
    jargon: () => jargon(out),
    "list-count": () => listCount(out),
    "loops-closed": () => loopsOpen(out),
    "numbers-on-screen": () => numbersOnScreen(out),
    cuts: () => cuts(out),
  };
  return FINISH_AUTO
    .filter((c) => format === "script" || !c.script)
    .map((c) => {
      const found = where[c.id]();
      return { id: c.id, label: c.label, ok: found.length === 0, where: found };
    });
}

/** the card's word for the piece's formula, with the checks passed for สูตรอ่าน-ดูจนจบ; "" for none */
export function formulaBadge(out: ContentOutput, format: string): string {
  const f = outputFormula(out);
  if (!f) return "";
  if (f !== "finish" || (format !== "post" && format !== "script")) return FORMULA_SHORT[f];
  const r = finishChecks(out, format);
  return `${FORMULA_SHORT.finish} · ตรวจ ${r.filter((x) => x.ok).length}/${r.length}`;
}
