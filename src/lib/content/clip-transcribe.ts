import type { ChatMessage } from "@/lib/ai/types";
import { briefFor } from "./brief";
import { findWords, strayNumbers, type ContentWord } from "./check";
import { MAX_CAPTION, type Segment, type SpokenFlag } from "./clip";
import type { ModeChecks } from "./mode-checks";
import { checkPolicy } from "./policy";
import type { ContentItem, Flags } from "./store";

/**
 * Listening to a clip (owner, 2026-10-02): one Gemini call hears it, writes down what was said
 * with the seconds, and drafts the Reel's caption. What was said is checked as a post's words
 * are — and only warned about; the caption is held to a post's rules.
 */

/** the one model of ours that takes a video (src/lib/content/models.ts "cheap") */
export const CLIP_MODEL = "gemini-3.7-flash";
/** Gemini fetches a link up to 100MB; a bigger clip goes through the Files API */
export const GEMINI_LINK_MAX_BYTES = 100 * 1024 * 1024;

const SYSTEM = [
  "คุณช่วยตัวแทนประกันชีวิตในไทยเตรียมคลิป Reel ที่เขาถ่ายเอง",
  "งานที่ 1: ถอดเสียงพูดในคลิปเป็นภาษาไทยตามที่ได้ยินจริง ไม่แต่งเติม ไม่แก้คำ แบ่งเป็นช่วงสั้นๆ ไม่เกิน 8 วินาที พร้อมเวลาเริ่ม-จบเป็นวินาที (ทศนิยมได้)",
  "งานที่ 2: เขียนแคปชัน Reel ภาษาไทย 1 ชุด ยาวไม่เกิน 600 ตัวอักษร บรรทัดแรกเป็นประโยคเปิดที่ทำให้อยากดู ตามด้วยเนื้อหาสั้นๆ และ hashtag 3–5 อัน",
  "แคปชันต้องไม่มีคำโฆษณาเกินจริง (การันตี, รับประกันผลตอบแทน, ไม่มีความเสี่ยง, ดีที่สุด, ถูกที่สุด) และไม่ใส่ตัวเลขเบี้ยหรือผลประโยชน์ที่ไม่ได้พูดในคลิปหรือไม่มีในข้อมูลที่ให้",
  "ไม่ต้องใส่ข้อความ disclaimer ท้ายแคปชัน ระบบเติมให้เอง",
  "ถ้าในคลิปไม่มีเสียงพูด ให้ segments เป็น [] และเขียนแคปชันจากภาพและข้อมูลที่ให้",
  "ตอบเป็น JSON เท่านั้น รูปแบบ {\"segments\":[{\"start\":0,\"end\":2.5,\"text\":\"...\"}],\"caption\":\"...\"}",
].join("\n");

export function clipMessages(ctx: { script: string; brief: string; product: string }): ChatMessage[] {
  const about = [
    ctx.product && `แบบประกันที่เกี่ยวข้อง: ${ctx.product}`,
    ctx.script && `บทที่ตัวแทนตั้งใจพูด (อาจพูดไม่ตรงทุกคำ — ถอดตามที่ได้ยินจริง):\n${ctx.script}`,
    ctx.brief && `ตัวแทนบอกว่าคลิปนี้เกี่ยวกับ: ${ctx.brief}`,
  ].filter(Boolean).join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${about || "ไม่มีข้อมูลเพิ่มเติม"}\n\nถอดเสียงคลิปนี้ และเขียนแคปชัน ตอบเป็น JSON ที่มี segments และ caption` },
  ];
}

const unfence = (t: string) => t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

/** seconds from a number, a string of seconds ("2.5") or m:ss ("0:02", "1:05.5"); NaN for anything else */
function secondsOf(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const t = v.trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  const m = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function parseClipReply(text: string, durationSec: number): { segments: Segment[]; caption: string } | null {
  let raw: unknown;
  try { raw = JSON.parse(unfence(text)); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { segments?: unknown; caption?: unknown };
  const given = Array.isArray(r.segments) ? r.segments : [];
  const segments: Segment[] = [];
  let lastStart = 0;
  let lastEnd = 0;
  for (const s of given) {
    const seg = (s && typeof s === "object" ? s : {}) as { start?: unknown; end?: unknown; text?: unknown };
    let start = secondsOf(seg.start);
    const end = secondsOf(seg.end);
    const words = typeof seg.text === "string" ? seg.text.trim() : "";
    if (!words || Number.isNaN(start) || Number.isNaN(end) || end <= start || end > durationSec + 1) continue;
    // starting before the one before it began is out of order; starting inside it is overlap,
    // which is moved up to where it ended
    if (start < lastStart) continue;
    if (start < lastEnd) start = lastEnd;
    if (start >= end) continue;
    segments.push({ start, end, text: words.slice(0, 500) });
    lastStart = start;
    lastEnd = end;
  }
  // a reply that wrote segments and had none of them readable is unreadable, not a silent clip
  if (given.length > 0 && segments.length === 0) return null;
  const caption = typeof r.caption === "string" ? r.caption.trim().slice(0, MAX_CAPTION) : "";
  if (segments.length === 0 && !caption) return null;
  return { segments, caption };
}

export function spokenFlagsOf(segments: Segment[], words: ContentWord[], yardstick: string, checks: Partial<ModeChecks>): SpokenFlag[] {
  const out: SpokenFlag[] = [];
  for (const s of segments) {
    for (const hit of findWords(s.text, words)) {
      if (hit.kind !== "banned") continue;
      out.push({ at: s.start, kind: "word", text: hit.word, message: `ได้ยินว่า “${hit.word}” — เป็นคำที่ห้ามใช้ในโพสต์` });
    }
    for (const n of strayNumbers(s.text, yardstick, { every: checks.every })) {
      out.push({ at: s.start, kind: "number", text: n, message: `พูดตัวเลข ${n} ที่ไม่มีในข้อมูลแบบประกัน — ตรวจว่าถูกต้อง` });
    }
    for (const f of checkPolicy(s.text, { recruit: checks.recruit })) {
      out.push({ at: s.start, kind: "policy", text: f.match, message: f.message });
    }
  }
  return out;
}

export function captionFlags(caption: string, yardstick: string, words: ContentWord[], checks: Partial<ModeChecks>): Flags {
  return {
    numbers: strayNumbers(caption, yardstick, { every: checks.every }),
    words: findWords(caption, words),
    policy: checkPolicy(caption, { recruit: checks.recruit }),
    fixes: null,
  };
}

/** where a figure said or written may come from: the plan's own figures, the script, the agent's note */
export function clipYardstick(item: ContentItem): string {
  const v = item.output.video;
  return [briefFor(item.planHref)?.text ?? "", item.output.hooks.join("\n"), item.output.body, item.output.closing, v?.brief ?? ""].join("\n");
}
