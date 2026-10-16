/**
 * How far along a วิดีโอนำเสนอ clip is, as a bar and a percentage (owner, 2026-10-13; spec
 * docs/superpowers/specs/2026-10-13-video-story-brief-design.md, round 0).
 *
 * The steps before rendering are counted for real: produce (make.ts) writes each line spoken and
 * each scene drawn to the row's `progress`. The Cloud Run render reports nothing back, so its part
 * of the bar runs on the time past clips of the same kind took, and waits at 98% past it. The bar
 * is split by measured time: rendering is most of a clip's making. Pure and browser-safe.
 */

/** "pictures": a คลิปตามโจทย์'s painted pictures, before its voice */
export type ProgressStep = "pictures" | "motion" | "voice" | "files" | "draw" | "submit";
/** what produce has done, on the row: `done` of `of` lines spoken or scenes drawn */
export interface ProgressNote { step: ProgressStep; done: number; of: number }

export type ClipKind = `${"classic" | "motion"}-${"short" | "full" | "long" | "max"}` | "fhc" | "story";
/** seconds: from asking to the render starting, and the render itself */
export interface Estimate { pre: number; render: number }

/**
 * Medians of the finished clips, measured 2026-10-13 (classic full 13 clips, short 2, Motion 1,
 * FHC 2): the guess for a kind with too few finished clips of its own.
 */
export const DEFAULT_ESTIMATES: Record<ClipKind, Estimate> = {
  "classic-full": { pre: 90, render: 265 },
  "classic-short": { pre: 30, render: 260 },
  "motion-full": { pre: 45, render: 155 },
  "motion-short": { pre: 30, render: 120 },
  // the longer clips (owner, 2026-10-13), guessed from the full ones until they have their own: ~1.8× and ~2.4× the voice and frames
  "classic-long": { pre: 160, render: 470 },
  "classic-max": { pre: 215, render: 640 },
  "motion-long": { pre: 80, render: 280 },
  "motion-max": { pre: 110, render: 370 },
  fhc: { pre: 45, render: 155 },
  // คลิปเล่าเรื่อง (owner, 2026-10-15): guessed as an FHC summary until it has its own
  story: { pre: 60, render: 155 },
};
/** fewer finished clips of a kind than this, and its default stands */
export const MIN_SAMPLES = 3;
/** of each kind, only this many of the latest finished clips count */
export const RECENT = 20;
/** a render longer than this is a clip that hung, not a measure */
export const MAX_RENDER_SEC = 15 * 60;

export function clipKind(input: { fhc?: unknown; style?: unknown; length?: unknown; product?: unknown }): ClipKind {
  if (input.fhc) return "fhc";
  if (input.product === "STORY" || input.product === "FREESTORY") return "story";
  const length = input.length === "short" || input.length === "long" || input.length === "max" ? input.length : "full";
  return `${input.style === "motion" ? "motion" : "classic"}-${length}`;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Each kind's estimate from finished clips' times (seconds), newest first: the latest RECENT of a
 * kind count. A kind with too few keeps its default.
 */
export function estimatesFrom(samples: { kind: ClipKind; pre: number; render: number }[]): Record<ClipKind, Estimate> {
  const out = { ...DEFAULT_ESTIMATES };
  for (const kind of Object.keys(out) as ClipKind[]) {
    const mine = samples.filter((s) => s.kind === kind && s.pre >= 0 && s.render > 0 && s.render <= MAX_RENDER_SEC).slice(0, RECENT);
    if (mine.length >= MIN_SAMPLES) out[kind] = { pre: median(mine.map((s) => s.pre)), render: median(mine.map((s) => s.render)) };
  }
  return out;
}

/** A clip being made, as the list read it: seconds since it was asked for, and since its render began. */
export interface ProgressState {
  status: "drawing" | "rendering";
  note: ProgressNote | null;
  sinceStart: number;
  sinceRender: number | null;
  est: Estimate;
}
export interface ProgressView { pct: number; text: string; leftSec: number | null }

/** where each step before rendering starts and ends, as a share of that part of the bar */
// a คลิปตามโจทย์'s pictures share the voice's part: the bar counts them, then counts the voice from its start
const SPAN: Record<ProgressStep, [number, number]> = { pictures: [0, 0.35], motion: [0, 0.35], voice: [0, 0.35], files: [0.35, 0.45], draw: [0.45, 0.9], submit: [0.9, 1] };
/** the most the bar shows before the clip is done */
export const HOLD = 98;

/** the share of the bar before rendering: its share of the time, kept between 15% and 60% */
export const preShare = (e: Estimate) => Math.min(0.6, Math.max(0.15, e.pre / Math.max(1, e.pre + e.render)));

function stepText(n: ProgressNote | null): string {
  if (!n) return "เริ่มทำ…";
  switch (n.step) {
    case "pictures": return `วาดรูปประกอบ ${n.done}/${n.of}`;
    case "motion": return `ทำภาพขยับ ${n.done}/${n.of}`;
    case "voice": return `ทำเสียงแล้ว ${n.done}/${n.of} ประโยค`;
    case "files": return "เตรียมไฟล์";
    case "draw": return `วาดภาพแล้ว ${n.done}/${n.of} ฉาก`;
    case "submit": return "ส่งไปรวมเป็นวิดีโอ";
  }
}

/** The bar for a clip being made, `later` seconds after the list was read. */
export function progressView(s: ProgressState, later = 0): ProgressView {
  const share = preShare(s.est) * 100;
  if (s.status === "rendering") {
    const ran = Math.max(0, (s.sinceRender ?? 0) + later);
    if (ran >= s.est.render) return { pct: HOLD, text: "ใกล้เสร็จแล้ว", leftSec: null };
    return { pct: Math.floor(share + (HOLD - share) * (ran / s.est.render)), text: "กำลังรวมเป็นวิดีโอ", leftSec: Math.round(s.est.render - ran) };
  }
  const n = s.note;
  const [from, to] = n ? SPAN[n.step] : [0, 0];
  const part = n && n.of > 0 ? Math.min(1, Math.max(0, n.done / n.of)) : n?.step === "files" || n?.step === "submit" ? 1 : 0;
  const pct = Math.floor(share * (from + (to - from) * part));
  const left = Math.max(5, s.est.pre - (s.sinceStart + later)) + s.est.render;
  return { pct, text: stepText(n), leftSec: Math.round(left) };
}

/** "อีกประมาณ 1 นาทีครึ่ง", "อีกประมาณ 40 วินาที"; nothing when it cannot be said */
export function leftWords(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return "";
  if (sec < 15) return "อีกไม่กี่วินาที";
  if (sec < 60) return `อีกประมาณ ${Math.round(sec / 10) * 10} วินาที`;
  const halves = Math.round(sec / 30);
  const whole = Math.floor(halves / 2);
  return `อีกประมาณ ${whole} นาที${halves % 2 ? "ครึ่ง" : ""}`;
}

/** reads a row's `progress`: anything else is no note */
export function readNote(v: unknown): ProgressNote | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.step !== "pictures" && o.step !== "motion" && o.step !== "voice" && o.step !== "files" && o.step !== "draw" && o.step !== "submit") return null;
  const done = Number(o.done);
  const of = Number(o.of);
  return { step: o.step, done: Number.isFinite(done) ? done : 0, of: Number.isFinite(of) ? of : 0 };
}
