import type { Segment } from "@/lib/content/clip";

/**
 * The clip's time, from what was heard and what was silent (owner, 2026-10-02). Learned on the
 * owner's own clip: Gemini's times drift a second or more, so the silences measured from the
 * audio decide where speech is, and the words are fitted to that. No I/O here.
 */

export type Span = [number, number];
export interface Sub { start: number; end: number; text: string; seg: number }

const PAD = 0.1;
const MIN_SILENCE = 0.25;
const SNAP = 1.2;
const MAX_LINE = 22;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** ffmpeg's silencedetect as ametadata prints it: lavfi.silence_start=… / lavfi.silence_end=… */
export function parseSilences(text: string, duration: number): Span[] {
  const out: Span[] = [];
  let open: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const s = /lavfi\.silence_start=(-?[\d.]+)/.exec(line);
    if (s) { open = Math.max(0, Number(s[1])); continue; }
    const e = /lavfi\.silence_end=([\d.]+)/.exec(line);
    if (e && open !== null) { out.push([r3(open), r3(Math.min(duration, Number(e[1])))]); open = null; }
  }
  if (open !== null && open < duration) out.push([r3(open), r3(duration)]);
  return out.filter(([a, b]) => b > a);
}

export function speechSpans(silences: Span[], duration: number): Span[] {
  const out: Span[] = [];
  let t = 0;
  for (const [a, b] of [...silences].sort((x, y) => x[0] - y[0])) {
    if (a > t) out.push([r3(t), r3(a)]);
    t = Math.max(t, b);
  }
  if (t < duration) out.push([r3(t), r3(duration)]);
  return out.filter(([a, b]) => b - a > 0.05);
}

function nearest(t: number, edges: number[]): number {
  let best = t;
  let d = SNAP + 1e-9;
  for (const e of edges) if (Math.abs(e - t) <= d) { d = Math.abs(e - t); best = e; }
  return best;
}

/** each sentence's start moved to the nearest speech start, its end to the nearest speech end, within 1.2 s */
export function snapSegments(segments: Segment[], silences: Span[], duration: number): Segment[] {
  const spans = speechSpans(silences, duration);
  const starts = spans.map((s) => s[0]);
  const ends = spans.map((s) => s[1]);
  return segments.map((s) => {
    const start = nearest(s.start, starts);
    const end = nearest(s.end, ends);
    return end > start ? { ...s, start, end } : s;
  });
}

function merge(spans: Span[]): Span[] {
  const sorted = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out.map(([a, b]) => [r3(a), r3(b)] as Span);
}

function subtract(spans: Span[], hole: Span): Span[] {
  const out: Span[] = [];
  for (const [a, b] of spans) {
    if (hole[1] <= a || hole[0] >= b) { out.push([a, b]); continue; }
    if (hole[0] > a) out.push([a, hole[0]]);
    if (hole[1] < b) out.push([hole[1], b]);
  }
  return out;
}

/** what stays: the clip, less the cut sentences and (when asked) the silences, each with 0.1 s of air */
export function keepRanges(a: { duration: number; segments: Segment[]; cut: number[]; silences: Span[]; trimSilence: boolean }): Span[] {
  let keep: Span[] = [[0, a.duration]];
  // a clip measured silent from end to end has no speech to trust: trim nothing, cuts still apply
  const silences = speechSpans(a.silences, a.duration).length === 0 ? [] : a.silences;
  const snapped = snapSegments(a.segments, a.silences, a.duration);
  for (const i of a.cut) {
    const s = snapped[i];
    if (!s) continue;
    let [from, to] = [s.start, s.end];
    if (a.trimSilence) {
      // a silence the cut touches goes with it, so no sliver of air is left stranded beside the hole
      for (const [x, y] of silences) {
        if (y - x < MIN_SILENCE) continue;
        // keep 0.1 s of air on the speech side, as the silence trimming does
        if (Math.abs(x - s.end) < 1e-6) to = Math.max(to, y >= a.duration ? a.duration : y - PAD);
        if (Math.abs(y - s.start) < 1e-6) from = Math.min(from, x === 0 ? 0 : x + PAD);
      }
    }
    keep = subtract(keep, [from, to]);
  }
  if (a.trimSilence) {
    for (const [s, e] of silences) {
      if (e - s < MIN_SILENCE) continue;
      const from = s === 0 ? 0 : s + PAD;
      const to = e >= a.duration ? a.duration : e - PAD;
      if (to > from) keep = subtract(keep, [from, to]);
    }
  }
  return merge(keep).filter(([x, y]) => y - x > 0.05);
}

export const keptDuration = (keep: Span[]): number => r3(keep.reduce((s, [a, b]) => s + b - a, 0));

export function mapTime(t: number, keep: Span[]): number {
  let acc = 0;
  for (const [a, b] of keep) {
    if (t <= a) return r3(acc);
    if (t < b) return r3(acc + t - a);
    acc += b - a;
  }
  return r3(acc);
}

const seg = new Intl.Segmenter("th", { granularity: "word" });
const PARTICLES = ["นะครับ", "นะคะ", "ค่ะ", "ครับ", "จ้ะ", "จ้า", "คะ", "นะ"];

/** a closing particle at the start of a line, only when it is a whole word (not the front of คะแนน) */
function leadingParticle(line: string): string | null {
  const bounds = new Set<number>();
  for (const { index, segment } of seg.segment(line)) { bounds.add(index); bounds.add(index + segment.length); }
  return PARTICLES.find((p) => line.startsWith(p) && bounds.has(p.length)) ?? null;
}

/** One sentence as subtitle lines: the speaker's own spaces first; Thai words only for a phrase too long. */
export function subtitleLines(text: string, max = MAX_LINE): string[] {
  const units: { t: string; space: boolean }[] = [];
  for (const phrase of text.split(/\s+/).filter(Boolean)) {
    if (phrase.length <= max) { units.push({ t: phrase, space: true }); continue; }
    let cur = "";
    let first = true;
    for (const { segment } of seg.segment(phrase)) {
      if (cur && (cur + segment).length > max) { units.push({ t: cur, space: first }); first = false; cur = ""; }
      cur += segment;
    }
    if (cur) units.push({ t: cur, space: first });
  }
  const out: string[] = [];
  let line = "";
  for (const u of units) {
    const joined = line ? line + (u.space ? " " : "") + u.t : u.t;
    if (line && joined.length > max) { out.push(line); line = u.t; } else line = joined;
  }
  if (line) out.push(line);
  for (let i = 1; i < out.length; i++) {
    const m = leadingParticle(out[i]);
    if (m) {
      out[i - 1] += m;
      out[i] = out[i].slice(m.length).trim();
      if (!out[i]) { out.splice(i, 1); i--; }
    }
  }
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].length <= 7) { out[i - 1] += (/[0-9A-Za-z,]$/.test(out[i - 1]) ? " " : "") + out[i]; out.splice(i, 1); }
  }
  if (out.length > 1 && out[0].length <= 4) out.splice(0, 2, `${out[0]} ${out[1]}`);
  return out;
}

/** the words of each speech span, laid out as timed lines in source-clip seconds; each line knows its segment */
export function buildSubs(segments: Segment[], silences: Span[], duration: number): Sub[] {
  let spans = speechSpans(silences, duration);
  if (spans.length === 0) {
    if (segments.length === 0) return [];
    spans = [[0, duration]];
  }
  const inSpan: number[][] = spans.map(() => []);
  segments.forEach((s, idx) => {
    const mid = (s.start + s.end) / 2;
    let best = 0;
    let bestD = Infinity;
    spans.forEach(([a, b], i) => {
      const d = mid < a ? a - mid : mid > b ? mid - b : 0;
      if (d < bestD) { bestD = d; best = i; }
    });
    inSpan[best].push(idx);
  });
  const subs: Sub[] = [];
  spans.forEach(([a, b], i) => {
    const ids = inSpan[i].filter((n) => segments[n].text.trim());
    const spanChars = ids.reduce((n, id) => n + segments[id].text.length, 0);
    let t = a;
    for (const id of ids) {
      const segEnd = t + (b - a) * (segments[id].text.length / spanChars);
      const lines = subtitleLines(segments[id].text);
      const total = lines.reduce((n, l) => n + l.length, 0);
      let lt = t;
      lines.forEach((l, k) => {
        const end = k === lines.length - 1 ? segEnd : lt + (segEnd - t) * (l.length / total);
        subs.push({ start: r3(lt), end: r3(end), text: l, seg: id });
        lt = end;
      });
      t = segEnd;
    }
  });
  return subs;
}

/** subtitles on the cut clip's clock; one whose time was all cut is dropped */
export function subsOnOutput(subs: Sub[], keep: Span[], cut: number[] = []): Sub[] {
  return subs
    .filter((s) => !cut.includes(s.seg))
    .map((s) => ({ start: mapTime(s.start, keep), end: mapTime(s.end, keep), text: s.text, seg: s.seg }))
    .filter((s) => s.end - s.start > 0.05);
}
