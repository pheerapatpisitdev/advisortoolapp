# ตัดต่อคลิปด้วย AI — ซับไทย, hook, ตัดช่วงเงียบ (เฟส B1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ตัวแทนเปิด "ตัดต่อ" บนคลิปที่ถอดเสียงแล้ว → แก้ใบสั่งตัดต่อ (ประโยคที่ตัด, ตัดช่วงเงียบ, ซับ, hook, สไตล์) ด้วยพรีวิวสด → กด "สร้างคลิป" → บริการภายนอก (Rendi หรือ AWS Lambda) render ไฟล์ Reel ที่มีซับไทยฝังและ hook → Reel ใช้ไฟล์นั้น

**Architecture:** ใบสั่งตัดต่ออยู่ใน `ins_content.output.video.edit` · ฟังก์ชันล้วนสร้างไทม์ไลน์ (`src/lib/video/timeline.ts`) และคำสั่ง ffmpeg (`command.ts`) · ซับ/hook วาดเป็น PNG ด้วย `renderPng` เดิม (satori+resvg) · ตัว render เป็น adapter สองตัวหน้าตาเดียวกัน (`src/lib/video/engines/`) เลือกลำดับจากการตั้งค่า + สำรองอัตโนมัติ · งานยาวไม่รอใน function: ส่งงานแล้วเก็บผลเมื่อหน้าจอถามสถานะ (Rendi) หรือ webhook (Lambda) · คิดเงินรอบ `ai-edit` แบบ hold ตอนส่ง settle ตอนเสร็จ

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, Supabase (Postgres + Storage), satori/resvg, Rendi REST API, AWS Lambda (`@aws-sdk/client-lambda`, container with ffmpeg), vitest

**Spec:** `docs/superpowers/specs/2026-10-02-studio-clip-editing-design.md`

## Global Constraints

- Vercel **Hobby**: ทุก route/page `maxDuration` ≤ **300**; cron วันละครั้ง — ห้ามรอ render ใน function
- สไตล์มี 4 แบบเท่านั้น: `"box" | "outline" | "yellow" | "page"` · ฟอนต์ IBM Plex Sans Thai (ไฟล์ใน `src/app/api/card/`)
- hook: `main` ≤ **28** ตัวอักษร, `top` ≤ **24** (ไม่บังคับ) · ขึ้น **0–2.6 วิ** ของคลิปที่ตัดแล้ว · hook y = **230**, ซับ y = **1450** บนเฟรม **1080×1920**
- ช่วงเงียบ: `silencedetect=noise=-24dB:d=0.25` · ตัดช่วงเงียบ ≥ **0.25 วิ** เว้นขอบ **0.1 วิ** · ขยับขอบประโยคไปขอบเงียบภายใน **1.2 วิ**
- ซับไทย: ≤ **22** ตัวอักษร/บรรทัด · แบ่งตามเว้นวรรคก่อน → `Intl.Segmenter("th")` เฉพาะวลียาว · ห้ามขึ้นบรรทัดด้วย คะ/ค่ะ/ครับ/นะ · รวมบรรทัดเหลือ ≤ 7 ตัวอักษรเข้าบรรทัดก่อน
- คำสั่ง render: libx264 crf **20** high yuv420p · AAC **160k** 48 kHz stereo · `+faststart` · fps **30** · `afade` 15–20 ms ที่รอยต่อ
- งานค้างเกิน **15 นาที** = ล้ม (hold ของ wallet ถูกคืนเองที่ 15 นาทีพอดี)
- รอบ `ai-edit` hold **฿3**; ล้ม = ไม่คิด/คืนรอบฟรี; ทีมงานไม่จ่าย; ค่า prepare เจ้าของรับ
- ข้อมูลอยู่ใน `output.video.edit` — ไม่มีตารางใหม่ · ไฟล์ทั้งหมดอยู่ใน bucket `content-video` โฟลเดอร์ชิ้นงาน แบบแบน `<piece>/<uuid>.<ext>`
- Rendi: `https://api.rendi.dev/v1`, header `X-API-KEY` · แพลนฟรีคำสั่งละ ≤ 60 วิ · ไฟล์บน Rendi อยู่ถาวร → ลบหลังคัดลอก · webhook ของ Rendi เป็นของ Pro และไม่มีลายเซ็น → เชื่อเฉพาะผลที่ถามซ้ำเอง
- คีย์อยู่ในที่เก็บเดิม `ins_api_keys` (`ins_set_api_key` / `ins_get_api_keys`) provider `rendi` และ `aws` (รูปแบบ `ACCESS_KEY_ID:SECRET:REGION:FUNCTION_NAME`)
- Supabase project `cenysylrzbwfrtuqoeqk` · migration `supabase/migrations/20261003_clip_editing.sql` · migrate ก่อน push
- ข้อความถึงผู้ใช้ภาษาไทย; comment ภาษาอังกฤษตามแบบไฟล์นั้น
- ตรวจ: `npx vitest run <file>` · `npx tsc --noEmit` · `npx eslint <files>` · `npm run verify` ก่อน merge

## Review Focus

1. ตัวแทนติ๊กตัดประโยคจนไม่เหลืออะไร หรือเหลือ < 3 วิ → "สร้างคลิป" ต้องปฏิเสธก่อนคิดเงิน ("คลิปที่เหลือสั้นเกินไป — Reel ต้องยาวอย่างน้อย 3 วินาที") — Task 9 (test `refuses an edit that leaves under 3 seconds`)
2. ตัวแทนแก้ใบสั่งระหว่าง render กำลังทำ → ผล render ที่กลับมาต้องติด `renderedRev` ของรุ่นที่ส่งไป ไม่ใช่รุ่นใหม่ และหน้าจอขึ้น "ยังไม่ได้สร้างใหม่" — Task 7 (test `a render that lands after an edit is marked with the rev it was made from`)
3. หน้าจอสองแท็บถามสถานะพร้อมกันตอนงานเสร็จ → เก็บผลครั้งเดียว ไม่คิดเงินสองครั้ง ไม่มีไฟล์ซ้ำค้าง — Task 7 (test `collects a finished job once when asked twice at the same time`)
4. ประโยคที่ Gemini ให้เวลาคลาดไปอยู่ในช่วงเงียบทั้งประโยค (ไม่มีช่วงพูดทับเลย) → ข้อความต้องไม่หาย ไปรวมกับช่วงพูดที่ใกล้ที่สุด — Task 2 (test `a segment that falls in a silence joins the nearest speech`)
5. hook ที่มีคำต้องห้ามระดับ block → ไม่ render, ไม่คิดเงิน, บอกคำ — และ hook ว่าง → render ได้โดยไม่มี hook — Task 9 (tests `refuses a hook the rules block`, `renders with no hook when it is empty`)

---

### Task 1: ชนิดข้อมูล, migration, การตั้งค่า และ cron เก็บกวาดรู้จักไฟล์ตัดต่อ

**Files:**
- Create: `supabase/migrations/20261003_clip_editing.sql`
- Create: `src/lib/video/settings.ts`
- Modify: `src/lib/content/clip.ts` (types + constants)
- Modify: `src/lib/content/clip-sweep.ts` (`sweepPlan` keeps proxy/rendered files with their clip)
- Test: `tests/video/settings.test.ts`, `tests/content/clip-sweep.test.ts`, `tests/content/clip.test.ts`

**Interfaces:**
- Produces (clip.ts):
  - `type ClipStyle = "box" | "outline" | "yellow" | "page"`; `CLIP_STYLES: readonly ClipStyle[]`
  - `interface Hook { top?: string; main: string }`; `MAX_HOOK_MAIN = 28`, `MAX_HOOK_TOP = 24`
  - `type EngineName = "rendi" | "lambda"`
  - `interface EditPass { paidBy: "staff" } | { paidBy: "free"; auditId: number } | { paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number }`
  - `interface EditJob { kind: "prepare" | "render"; engine: EngineName; id: string; startedAt: string; token: string; rev?: string; pass?: EditPass; costThb?: number; tried: EngineName[] }`
  - `interface ClipEdit { proxyPath?: string; silences?: [number, number][]; cut: number[]; trimSilence: boolean; subs: { start: number; end: number; text: string }[]; hook: Hook; style: ClipStyle; rev: string; job?: EditJob | null; renderedPath?: string; renderedAt?: string; renderedRev?: string; error?: string }`
  - `Segment` gains `cut?: boolean; why?: string` · `ClipVideo` gains `hookSuggestion?: Hook; edit?: ClipEdit`
  - `EDIT_JOB_TIMEOUT_MS = 15 * 60_000`
  - `clipFiles(v: ClipVideo): string[]` — every file a clip keeps: `v.path`, `edit.proxyPath`, `edit.renderedPath`
- Produces (settings.ts): `interface VideoSettings { engine: EngineName; fallback: boolean; rendiMaxSeconds: number }`; `videoSettings(): Promise<VideoSettings>`; `saveVideoSettings(s: VideoSettings): Promise<void>`

- [ ] **Step 1: Migration**

`supabase/migrations/20261003_clip_editing.sql`:

```sql
-- Clip editing, phase B1 (owner, 2026-10-02): the preview, the subtitle pictures and the
-- silence list live beside the clip in content-video; the owner picks the render service.
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'video/quicktime', 'image/png', 'text/plain']
 where id = 'content-video';

alter table public.ins_ai_settings
  add column if not exists video_engine text not null default 'rendi'
    check (video_engine in ('rendi', 'lambda')),
  add column if not exists video_fallback boolean not null default true,
  -- Rendi's free plan stops a command at 60 s; Pro allows 600
  add column if not exists rendi_max_seconds integer not null default 60
    check (rendi_max_seconds between 10 and 600);
```

- [ ] **Step 2: Write the failing tests**

`tests/video/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const row = vi.hoisted(() => ({ data: null as Record<string, unknown> | null, upserted: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: row.data, error: null }) }),
      upsert: async (v: unknown) => { row.upserted = v; return { error: null }; },
    }),
  }),
}));
const { saveVideoSettings, videoSettings } = await import("@/lib/video/settings");

beforeEach(() => { row.data = null; row.upserted = null; });

describe("videoSettings", () => {
  it("defaults to Rendi with fallback, 60 s a command", async () => {
    expect(await videoSettings()).toEqual({ engine: "rendi", fallback: true, rendiMaxSeconds: 60 });
  });
  it("reads what the owner chose, and clamps a bad number", async () => {
    row.data = { video_engine: "lambda", video_fallback: false, rendi_max_seconds: 5000 };
    expect(await videoSettings()).toEqual({ engine: "lambda", fallback: false, rendiMaxSeconds: 600 });
  });
  it("saves into the one settings row", async () => {
    await saveVideoSettings({ engine: "rendi", fallback: true, rendiMaxSeconds: 600 });
    expect(row.upserted).toMatchObject({ id: true, video_engine: "rendi", video_fallback: true, rendi_max_seconds: 600 });
  });
});
```

Append to `tests/content/clip.test.ts`:

```ts
import { clipFiles } from "@/lib/content/clip";

describe("clipFiles", () => {
  it("is the clip, its preview and its edited take", () => {
    const v = { path: "p/a.mp4", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS,
      edit: { proxyPath: "p/b.mp4", renderedPath: "p/c.mp4", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" as const, rev: "r" } };
    expect(clipFiles(v)).toEqual(["p/a.mp4", "p/b.mp4", "p/c.mp4"]);
    expect(clipFiles({ ...v, edit: undefined })).toEqual(["p/a.mp4"]);
  });
});
```

Append to `tests/content/clip-sweep.test.ts` (inside `describe("sweepPlan")`, reuse its `row`/`file`/`now` helpers):

```ts
  it("keeps a clip's preview and edited take while the clip is kept, and lets them go with it", () => {
    const withEdit = (r: SweepRow): SweepRow => ({ ...r, video: { ...r.video!, edit: { proxyPath: `${r.id}/p.mp4`, renderedPath: `${r.id}/e.mp4`, cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: "x" } } });
    const live = new Map([["a", withEdit(row("a", "v.mp4"))]]);
    expect(sweepPlan([file("a", "v.mp4"), file("a", "p.mp4"), file("a", "e.mp4"), file("a", "old.png")], live, now).remove).toEqual(["a/old.png"]);
    const idle = new Map([["a", withEdit(row("a", "v.mp4", {}, 24 * 61))]]);
    expect(sweepPlan([file("a", "v.mp4"), file("a", "p.mp4"), file("a", "e.mp4")], idle, now).remove.sort()).toEqual(["a/e.mp4", "a/p.mp4", "a/v.mp4"]);
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/video/settings.test.ts tests/content/clip.test.ts tests/content/clip-sweep.test.ts` → FAIL (module missing / `clipFiles` missing / preview removed as orphan)

- [ ] **Step 4: Implement**

`src/lib/content/clip.ts` — add after `SpokenFlag`:

```ts
/** the look of the words laid on a clip (owner, 2026-10-02: four ready styles, no free styling) */
export type ClipStyle = "box" | "outline" | "yellow" | "page";
export const CLIP_STYLES: readonly ClipStyle[] = ["box", "outline", "yellow", "page"];
export interface Hook { top?: string; main: string }
export const MAX_HOOK_MAIN = 28;
export const MAX_HOOK_TOP = 24;
export type EngineName = "rendi" | "lambda";
/** who pays for a render, kept on the job so the round is settled when the job ends */
export type EditPass =
  | { paidBy: "staff" }
  | { paidBy: "free"; auditId: number }
  | { paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number };
export interface EditJob {
  kind: "prepare" | "render";
  engine: EngineName;
  id: string;
  startedAt: string;
  /** the secret a webhook for this job must carry */
  token: string;
  /** the edit a render was made from */
  rev?: string;
  pass?: EditPass;
  /** the job's estimated cost, for the round's charge */
  costThb?: number;
  /** engines already asked for this job, so a retry goes to the other */
  tried: EngineName[];
}
/** An agent's edit of a clip (owner, 2026-10-02): what is cut, the subtitles, the hook, the look. */
export interface ClipEdit {
  proxyPath?: string;
  silences?: [number, number][];
  cut: number[];
  trimSilence: boolean;
  subs: { start: number; end: number; text: string }[];
  hook: Hook;
  style: ClipStyle;
  rev: string;
  job?: EditJob | null;
  renderedPath?: string;
  renderedAt?: string;
  renderedRev?: string;
  error?: string;
}
/** a job that has not answered for this long has failed; the wallet hands a hold back at the same 15 minutes */
export const EDIT_JOB_TIMEOUT_MS = 15 * 60_000;
```

- `Segment` gains (after `text`): `/** the listener thinks it should go (a filler, a retake); the agent decides */ cut?: boolean; why?: string;`
- `ClipVideo` gains (after `spokenFlags?`): `/** the hook the listener suggested */ hookSuggestion?: Hook; edit?: ClipEdit;`
- add:

```ts
/** every file a clip keeps in content-video: the clip, its preview, its edited take */
export function clipFiles(v: ClipVideo): string[] {
  return [v.path, v.edit?.proxyPath, v.edit?.renderedPath].filter((p): p is string => Boolean(p));
}
```

`src/lib/video/settings.ts`:

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EngineName } from "@/lib/content/clip";

/** Which service renders clips, and whether the other one is tried when it cannot (owner, 2026-10-02). */
export interface VideoSettings { engine: EngineName; fallback: boolean; rendiMaxSeconds: number }

const clamp = (n: number) => Math.min(600, Math.max(10, Math.round(n)));

export async function videoSettings(): Promise<VideoSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("video_engine, video_fallback, rendi_max_seconds").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
  const seconds = Number(data?.rendi_max_seconds);
  return {
    engine: data?.video_engine === "lambda" ? "lambda" : "rendi",
    fallback: data?.video_fallback !== false,
    rendiMaxSeconds: Number.isFinite(seconds) ? clamp(seconds) : 60,
  };
}

export async function saveVideoSettings(s: VideoSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, video_engine: s.engine, video_fallback: s.fallback, rendi_max_seconds: clamp(s.rendiMaxSeconds), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
}
```

`src/lib/content/clip-sweep.ts` `sweepPlan` — import `clipFiles` and replace the body of the loop from `const r = rows.get(f.piece);` through the end of the `if (postedLongAgo || neverHeldLong)` block with:

```ts
    const r = rows.get(f.piece);
    const v = r?.video;
    // a clip keeps its preview and its edited take beside it; anything else in the folder is
    // an upload left half way, a replaced take, a render's pictures — a day's grace, then gone
    if (!r || !v || !clipFiles(v).includes(path)) {
      if (t - new Date(f.createdAt).getTime() > DAY) remove.push(path);
      continue;
    }
    if (r.state && HELD.has(r.state)) continue;
    const postedLongAgo = r.state === "published" && r.at !== null && t - new Date(r.at).getTime() > VERIFY_WINDOW_MS;
    const neverHeldLong = (r.state === null || r.state === "failed" || r.state === "cancelled")
      && t - new Date(v.uploadedAt).getTime() > CLIP_DRAFT_DAYS * DAY;
    if (postedLongAgo || neverHeldLong) {
      remove.push(path);
      if (!v.expired) expire.add(r.id);
    }
```

(the posted-Reel Facebook check in `sweepClips` keys off the piece, so it is unchanged; the expiry write stays guarded on `video.path` as today.)

- [ ] **Step 5: Run tests, type check, apply migration, commit**

Run: `npx vitest run tests/video/settings.test.ts tests/content/clip.test.ts tests/content/clip-sweep.test.ts` → PASS · `npx tsc --noEmit` → clean
Apply with Supabase MCP `apply_migration` (project `cenysylrzbwfrtuqoeqk`, name `clip_editing`) — **controller only**; verify `select allowed_mime_types from storage.buckets where id='content-video'` lists 4 types and `select video_engine, video_fallback, rendi_max_seconds from ins_ai_settings` returns `rendi, true, 60`.

```bash
git add supabase/migrations/20261003_clip_editing.sql src/lib/video/settings.ts src/lib/content/clip.ts src/lib/content/clip-sweep.ts tests/video/settings.test.ts tests/content/clip.test.ts tests/content/clip-sweep.test.ts
git commit -m "feat(studio): clip edit data, render settings, and the sweep keeps an edit's files"
```

---

### Task 2: ไทม์ไลน์ — ช่วงเงียบ, ช่วงเก็บ, ซับไทย (ฟังก์ชันล้วน)

**Files:**
- Create: `src/lib/video/timeline.ts`
- Test: `tests/video/timeline.test.ts`, fixture `tests/video/fixtures/c1369.ts`

**Interfaces:**
- Consumes: `Segment` (clip.ts)
- Produces:
  - `type Span = [number, number]`; `interface Sub { start: number; end: number; text: string }`
  - `parseSilences(text: string, duration: number): Span[]`
  - `speechSpans(silences: Span[], duration: number): Span[]`
  - `snapSegments(segments: Segment[], silences: Span[], duration: number): Segment[]`
  - `keepRanges(a: { duration: number; segments: Segment[]; cut: number[]; silences: Span[]; trimSilence: boolean }): Span[]`
  - `mapTime(t: number, keep: Span[]): number`; `keptDuration(keep: Span[]): number`
  - `subtitleLines(text: string, max?: number): string[]`
  - `buildSubs(segments: Segment[], silences: Span[], duration: number): Sub[]` (source-clip seconds)
  - `subsOnOutput(subs: Sub[], keep: Span[]): Sub[]` (output seconds; a sub fully inside a cut is dropped)

- [ ] **Step 1: Fixture from the real clip**

`tests/video/fixtures/c1369.ts` — the owner's clip as measured on 2026-10-02:

```ts
// C1369.MP4 (35.52 s): silencedetect -24 dB 0.25 s, and the words Gemini heard per speech span
export const DURATION = 35.52;
export const SILENCE_LOG = [
  "frame:0 pts:0 pts_time:0", "lavfi.silence_start=0",
  "frame:73 pts:73472 pts_time:1.53", "lavfi.silence_end=1.53", "lavfi.silence_duration=1.53",
  "lavfi.silence_start=4.62", "lavfi.silence_end=5.07", "lavfi.silence_duration=0.45",
  "lavfi.silence_start=9.06", "lavfi.silence_end=9.46",
  "lavfi.silence_start=11.51", "lavfi.silence_end=11.82",
  "lavfi.silence_start=16.54", "lavfi.silence_end=16.92",
  "lavfi.silence_start=22.92", "lavfi.silence_end=23.24",
  "lavfi.silence_start=24.74", "lavfi.silence_end=25.12",
  "lavfi.silence_start=30.04", "lavfi.silence_end=30.41",
  "lavfi.silence_start=34.21",
].join("\n");
// Gemini's segments (its times drift ~1 s; snapping and span assignment correct them)
export const SEGMENTS = [
  { start: 0, end: 2.9, text: "ขอบคุณลูกเพจมากมายนะคะ" },
  { start: 2.9, end: 5.9, text: "แล้วก็ขอบคุณน้องๆ พี่ๆ น้องๆ ท่านใหม่" },
  { start: 5.9, end: 9.2, text: "ที่คอยกดติดตามเพจด้วยนะคะ" },
  { start: 9.2, end: 13.0, text: "ล่าสุดเนี่ย ทางเพจของเราก็ได้ปิดยอดไปแล้วนะคะ" },
  { start: 13.0, end: 16.5, text: "881,533 บาท" },
  { start: 16.5, end: 20.3, text: "อนุมัติมาที่ 53,333 บาท" },
  { start: 20.3, end: 24.8, text: "ส่วนที่เหลือก็คือติดเกี่ยวกับการขอประวัติ สำหรับลูกค้าที่มีประวัตินะคะ" },
  { start: 24.8, end: 27.5, text: "ขอบคุณจริงๆ ขอบคุณทุกท่าน" },
  { start: 27.5, end: 30.1, text: "ที่สนับสนุนมา ณ โอกาสนี้ด้วยค่ะ" },
  { start: 30.1, end: 33.1, text: "ทั้งทีมเลย ขอบคุณมากๆ เลยค่ะ" },
  { start: 33.1, end: 35.0, text: "สวัสดีค่ะ" },
];
```

- [ ] **Step 2: Write the failing tests**

`tests/video/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildSubs, keepRanges, keptDuration, mapTime, parseSilences, snapSegments, speechSpans, subsOnOutput, subtitleLines,
} from "@/lib/video/timeline";
import { DURATION, SEGMENTS, SILENCE_LOG } from "./fixtures/c1369";

describe("parseSilences", () => {
  it("pairs starts with ends, and closes one left open at the end", () => {
    const s = parseSilences(SILENCE_LOG, DURATION);
    expect(s[0]).toEqual([0, 1.53]);
    expect(s[1]).toEqual([4.62, 5.07]);
    expect(s.at(-1)).toEqual([34.21, 35.52]);
    expect(s).toHaveLength(9);
  });
  it("is empty for a log with nothing in it", () => {
    expect(parseSilences("", 10)).toEqual([]);
  });
});

describe("speechSpans", () => {
  it("is what lies between the silences", () => {
    const sp = speechSpans(parseSilences(SILENCE_LOG, DURATION), DURATION);
    expect(sp[0]).toEqual([1.53, 4.62]);
    expect(sp).toHaveLength(8);
    expect(sp.at(-1)).toEqual([30.41, 34.21]);
  });
  it("is the whole clip when nothing was silent", () => {
    expect(speechSpans([], 12)).toEqual([[0, 12]]);
  });
});

describe("snapSegments", () => {
  it("moves a sentence's edges to the nearest silence edge within 1.2 s, and no further", () => {
    const sil = parseSilences(SILENCE_LOG, DURATION);
    const s = snapSegments([{ start: 3.9, end: 9.2, text: "x" }, { start: 14.0, end: 15.0, text: "y" }], sil, DURATION);
    expect(s[0]).toMatchObject({ start: 5.07, end: 9.06 });
    // 14.0 and 15.0 have no speech edge within 1.2 s (11.82 and 16.54/16.92 are further): they stay
    expect(s[1]).toMatchObject({ start: 14.0, end: 15.0 });
  });
});

describe("keepRanges", () => {
  const silences = parseSilences(SILENCE_LOG, DURATION);
  it("drops the silences, leaving 0.1 s of air, as the hand-cut example did", () => {
    const keep = keepRanges({ duration: DURATION, segments: SEGMENTS, cut: [], silences, trimSilence: true });
    expect(keep[0][0]).toBeCloseTo(1.43, 2);
    expect(keep.at(-1)![1]).toBeCloseTo(34.31, 2);
    expect(keptDuration(keep)).toBeCloseTo(31.67, 1);
  });
  it("keeps the whole clip when silence trimming is off and nothing is cut", () => {
    expect(keepRanges({ duration: 10, segments: [], cut: [], silences: [[2, 3]], trimSilence: false })).toEqual([[0, 10]]);
  });
  it("takes a cut sentence out, edges snapped to the silences around it", () => {
    const keep = keepRanges({ duration: DURATION, segments: SEGMENTS, cut: [10], silences, trimSilence: true });
    expect(keep.at(-1)![1]).toBeLessThan(34.3);
    expect(keptDuration(keep)).toBeLessThan(31.67);
  });
  it("is empty when everything is cut", () => {
    expect(keepRanges({ duration: 5, segments: [{ start: 0, end: 5, text: "x" }], cut: [0], silences: [], trimSilence: true })).toEqual([]);
  });
});

describe("mapTime", () => {
  it("counts only the kept time before a moment", () => {
    const keep: [number, number][] = [[1, 3], [5, 9]];
    expect(mapTime(0.5, keep)).toBe(0);
    expect(mapTime(2, keep)).toBe(1);
    expect(mapTime(4, keep)).toBe(2);
    expect(mapTime(6, keep)).toBe(3);
    expect(mapTime(20, keep)).toBe(6);
  });
});

describe("subtitleLines", () => {
  it("breaks on the speaker's spaces first, and Thai words only when a phrase is too long", () => {
    expect(subtitleLines("ส่วนที่เหลือก็คือติดเกี่ยวกับการขอประวัติ")).toEqual(["ส่วนที่เหลือก็คือติด", "เกี่ยวกับการขอประวัติ"]);
    expect(subtitleLines("พี่ๆ น้องๆ ท่านใหม่ที่คอยกดติดตามเพจด้วย")).toEqual(["พี่ๆ น้องๆ", "ท่านใหม่ที่คอยกดติดตามเพจด้วย"]);
  });
  it("never starts a line with a closing particle", () => {
    for (const l of subtitleLines("ขอบคุณลูกเพจมากมายนะคะ แล้วก็ขอบคุณน้องๆ")) expect(l).not.toMatch(/^(คะ|ค่ะ|ครับ|นะ)/);
  });
  it("lets a short leftover ride with the line before, keeping a space after a number", () => {
    expect(subtitleLines("อนุมัติมาที่ 53,333 บาท")).toEqual(["อนุมัติมาที่ 53,333 บาท"]);
  });
  it("keeps every word", () => {
    const text = "ขอบคุณจริงๆ ขอบคุณทุกท่านที่สนับสนุนมา ณ โอกาสนี้ด้วยค่ะ";
    expect(subtitleLines(text).join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
});

describe("buildSubs", () => {
  const silences = parseSilences(SILENCE_LOG, DURATION);
  it("times every line inside a speech span, in order, with no words lost", () => {
    const subs = buildSubs(SEGMENTS, silences, DURATION);
    const spans = speechSpans(silences, DURATION);
    for (const s of subs) expect(spans.some(([a, b]) => s.start >= a - 1e-6 && s.end <= b + 1e-6)).toBe(true);
    for (let i = 1; i < subs.length; i++) expect(subs[i].start).toBeGreaterThanOrEqual(subs[i - 1].start);
    expect(subs.map((s) => s.text).join("").replace(/\s/g, "")).toBe(SEGMENTS.map((s) => s.text).join("").replace(/\s/g, ""));
  });
  it("a segment that falls in a silence joins the nearest speech", () => {
    // its middle (2.6) is 1.1 s from the speech before the silence and 0.4 s from the speech after
    const subs = buildSubs([{ start: 2.4, end: 2.8, text: "เงียบ" }], [[1.5, 3]], 6);
    expect(subs).toHaveLength(1);
    expect(subs[0].start).toBeGreaterThanOrEqual(3);
  });
  it("needs no silences: one span, the whole clip", () => {
    expect(buildSubs([{ start: 0, end: 2, text: "สวัสดีครับ" }], [], 2)).toEqual([{ start: 0, end: 2, text: "สวัสดีครับ" }]);
  });
});

describe("subsOnOutput", () => {
  it("moves subtitles onto the cut clip and drops ones that were cut", () => {
    const keep: [number, number][] = [[0, 2], [4, 6]];
    expect(subsOnOutput([{ start: 0.5, end: 1.5, text: "a" }, { start: 2.5, end: 3.5, text: "cut" }, { start: 4.5, end: 5.5, text: "b" }], keep))
      .toEqual([{ start: 0.5, end: 1.5, text: "a" }, { start: 2.5, end: 3.5, text: "b" }]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/video/timeline.test.ts` → FAIL (module missing)

- [ ] **Step 4: Implement `src/lib/video/timeline.ts`**

```ts
import type { Segment } from "@/lib/content/clip";

/**
 * The clip's time, from what was heard and what was silent (owner, 2026-10-02). Learned on the
 * owner's own clip: Gemini's times drift a second or more, so the silences measured from the
 * audio decide where speech is, and the words are fitted to that. No I/O here.
 */

export type Span = [number, number];
export interface Sub { start: number; end: number; text: string }

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
  const snapped = snapSegments(a.segments, a.silences, a.duration);
  for (const i of a.cut) {
    const s = snapped[i];
    if (s) keep = subtract(keep, [s.start, s.end]);
  }
  if (a.trimSilence) {
    for (const [s, e] of a.silences) {
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
const PARTICLE = /^(นะคะ|นะครับ|ค่ะ|คะ|ครับ|นะ|จ้ะ|จ้า)/;

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
    const m = out[i].match(PARTICLE);
    if (m) {
      out[i - 1] += m[1];
      out[i] = out[i].slice(m[1].length).trim();
      if (!out[i]) { out.splice(i, 1); i--; }
    }
  }
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].length <= 7) { out[i - 1] += (/[0-9A-Za-z,]$/.test(out[i - 1]) ? " " : "") + out[i]; out.splice(i, 1); }
  }
  if (out.length > 1 && out[0].length <= 4) out.splice(0, 2, `${out[0]} ${out[1]}`);
  return out;
}

/** the words of each speech span, laid out as timed lines in source-clip seconds */
export function buildSubs(segments: Segment[], silences: Span[], duration: number): Sub[] {
  const spans = speechSpans(silences, duration);
  if (spans.length === 0) return [];
  const words: string[][] = spans.map(() => []);
  for (const s of segments) {
    const mid = (s.start + s.end) / 2;
    let best = 0;
    let bestD = Infinity;
    spans.forEach(([a, b], i) => {
      const d = mid < a ? a - mid : mid > b ? mid - b : 0;
      if (d < bestD) { bestD = d; best = i; }
    });
    words[best].push(s.text);
  }
  const subs: Sub[] = [];
  spans.forEach(([a, b], i) => {
    const lines = subtitleLines(words[i].join(" "));
    const total = lines.reduce((n, l) => n + l.length, 0);
    let t = a;
    for (const l of lines) {
      const d = (b - a) * (l.length / total);
      subs.push({ start: r3(t), end: r3(t + d), text: l });
      t += d;
    }
  });
  return subs;
}

/** subtitles on the cut clip's clock; one whose time was all cut is dropped */
export function subsOnOutput(subs: Sub[], keep: Span[]): Sub[] {
  return subs
    .map((s) => ({ start: mapTime(s.start, keep), end: mapTime(s.end, keep), text: s.text }))
    .filter((s) => s.end - s.start > 0.05);
}
```

- [ ] **Step 5: Run tests; adjust only the implementation (not the fixture expectations) until they pass; commit**

Run: `npx vitest run tests/video/timeline.test.ts` → PASS · `npx tsc --noEmit` → clean

```bash
git add src/lib/video/timeline.ts tests/video/timeline.test.ts tests/video/fixtures/c1369.ts
git commit -m "feat(video): a clip's timeline — silences, kept ranges, Thai subtitle lines"
```

---

### Task 3: คำสั่ง ffmpeg สำหรับ prepare และ render (ฟังก์ชันล้วน)

**Files:**
- Create: `src/lib/video/command.ts`
- Test: `tests/video/command.test.ts`

**Interfaces:**
- Consumes: `Span` (Task 2)
- Produces:
  - `interface FfmpegJob { inputs: { name: string; url: string }[]; command: string; outputs: { name: string; file: string; contentType: string }[] }` — names are Rendi aliases (`in_1`, `out_1`); `command` uses `{{in_1}}`/`{{out_1}}` placeholders and omits the leading `ffmpeg`
  - `interface OverlayInput { url: string; y: number; from: number; to: number }`
  - `prepareJob(sourceUrl: string): FfmpegJob` — outputs `out_1 proxy.mp4` (video/mp4), `out_2 silences.txt` (text/plain)
  - `renderJob(sourceUrl: string, keep: Span[], overlays: OverlayInput[]): FfmpegJob` — output `out_1 reel.mp4`

- [ ] **Step 1: Write the failing tests**

`tests/video/command.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prepareJob, renderJob } from "@/lib/video/command";

describe("prepareJob", () => {
  it("makes a 720p preview and writes the silences, from one read of the clip", () => {
    const j = prepareJob("https://s/clip.mp4");
    expect(j.inputs).toEqual([{ name: "in_1", url: "https://s/clip.mp4" }]);
    expect(j.outputs.map((o) => [o.name, o.file])).toEqual([["out_1", "proxy.mp4"], ["out_2", "silences.txt"]]);
    expect(j.command).toContain("-i {{in_1}}");
    expect(j.command).toContain("scale=-2:1280");
    expect(j.command).toContain("silencedetect=noise=-24dB:d=0.25,ametadata=mode=print:file={{out_2}}");
    expect(j.command).toContain("-c:a aac");
    expect(j.command.startsWith("ffmpeg")).toBe(false);
  });
});

describe("renderJob", () => {
  const keep: [number, number][] = [[1.43, 4.72], [4.97, 9.16]];
  const overlays = [{ url: "https://s/hook.png", y: 230, from: 0, to: 2.6 }, { url: "https://s/s0.png", y: 1450, from: 0.1, to: 1.84 }];
  const j = renderJob("https://s/clip.mp4", keep, overlays);

  it("takes the clip and each picture as inputs, in order", () => {
    expect(j.inputs.map((i) => i.name)).toEqual(["in_1", "in_2", "in_3"]);
    expect(j.inputs[1].url).toBe("https://s/hook.png");
    expect(j.outputs).toEqual([{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }]);
  });

  it("trims and joins both streams at the kept ranges, with short fades at the joins", () => {
    expect(j.command).toContain("[0:v]split=2[vs0][vs1]");
    expect(j.command).toContain("[vs0]trim=start=1.430:end=4.720,setpts=PTS-STARTPTS[v0]");
    expect(j.command).toContain("[as1]atrim=start=4.970:end=9.160,asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=4.170:d=0.02[a1]");
    expect(j.command).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]");
  });

  it("lays each picture over its own time, at its own height, on a 1080×1920 30 fps frame", () => {
    expect(j.command).toContain("[vc]scale=1080:1920:flags=lanczos,fps=30,setsar=1[b0]");
    expect(j.command).toContain("[b0][1:v]overlay=x=0:y=230:enable='between(t,0.000,2.600)'[b1]");
    expect(j.command).toContain("[b1][2:v]overlay=x=0:y=1450:enable='between(t,0.100,1.840)'[b2]");
    expect(j.command).toContain("-map \"[b2]\" -map \"[ac]\"");
  });

  it("encodes H.264 crf 20 and AAC 160k, ready for Reels", () => {
    expect(j.command).toContain("-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -profile:v high");
    expect(j.command).toContain("-c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart {{out_1}}");
  });

  it("works with no pictures at all", () => {
    expect(renderJob("https://s/c.mp4", [[0, 5]], []).command).toContain("-map \"[b0]\"");
  });

  it("refuses nothing to keep", () => {
    expect(() => renderJob("https://s/c.mp4", [], [])).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/video/command.test.ts` → FAIL

- [ ] **Step 3: Implement `src/lib/video/command.ts`**

```ts
import type { Span } from "./timeline";

/**
 * The ffmpeg commands a render service runs (owner, 2026-10-02) — the same command for Rendi
 * and for our Lambda, in Rendi's form: inputs and outputs by alias, {{in_1}} / {{out_1}} in the
 * command, no leading "ffmpeg". The render is the one cut by hand on 2026-10-02 that worked.
 */

export interface FfmpegJob {
  inputs: { name: string; url: string }[];
  command: string;
  outputs: { name: string; file: string; contentType: string }[];
}
export interface OverlayInput { url: string; y: number; from: number; to: number }

const f3 = (n: number) => n.toFixed(3);

export function prepareJob(sourceUrl: string): FfmpegJob {
  return {
    inputs: [{ name: "in_1", url: sourceUrl }],
    command: [
      "-i {{in_1}}",
      // the preview: upright, 720×1280, small enough for a phone to play
      "-map 0:v:0 -map 0:a:0 -vf \"scale=-2:1280,fps=30\" -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p",
      "-c:a aac -b:a 96k -ac 2 -movflags +faststart {{out_1}}",
      // the silences, written as text beside it
      "-map 0:a:0 -af \"silencedetect=noise=-24dB:d=0.25,ametadata=mode=print:file={{out_2}}\" -f null -",
    ].join(" "),
    outputs: [
      { name: "out_1", file: "proxy.mp4", contentType: "video/mp4" },
      { name: "out_2", file: "silences.txt", contentType: "text/plain" },
    ],
  };
}

export function renderJob(sourceUrl: string, keep: Span[], overlays: OverlayInput[]): FfmpegJob {
  if (keep.length === 0) throw new Error("nothing to keep");
  const n = keep.length;
  const f: string[] = [
    `[0:v]split=${n}${keep.map((_, i) => `[vs${i}]`).join("")}`,
    `[0:a]asplit=${n}${keep.map((_, i) => `[as${i}]`).join("")}`,
  ];
  keep.forEach(([a, b], i) => {
    const d = b - a;
    f.push(`[vs${i}]trim=start=${f3(a)}:end=${f3(b)},setpts=PTS-STARTPTS[v${i}]`);
    f.push(`[as${i}]atrim=start=${f3(a)}:end=${f3(b)},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${f3(Math.max(0, d - 0.02))}:d=0.02[a${i}]`);
  });
  f.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${n}:v=1:a=1[vc][ac]`);
  f.push("[vc]scale=1080:1920:flags=lanczos,fps=30,setsar=1[b0]");
  overlays.forEach((o, i) => {
    f.push(`[b${i}][${i + 1}:v]overlay=x=0:y=${o.y}:enable='between(t,${f3(o.from)},${f3(o.to)})'[b${i + 1}]`);
  });
  const inputs = [{ name: "in_1", url: sourceUrl }, ...overlays.map((o, i) => ({ name: `in_${i + 2}`, url: o.url }))];
  return {
    inputs,
    command: [
      inputs.map((i) => `-i {{${i.name}}}`).join(" "),
      `-filter_complex "${f.join(";")}"`,
      `-map "[b${overlays.length}]" -map "[ac]"`,
      "-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -profile:v high",
      "-c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart {{out_1}}",
    ].join(" "),
    outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }],
  };
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run tests/video/command.test.ts` → PASS

```bash
git add src/lib/video/command.ts tests/video/command.test.ts
git commit -m "feat(video): the prepare and render ffmpeg commands"
```

---

### Task 4: สไตล์ 4 แบบ และภาพซับ/hook (PNG)

**Files:**
- Create: `src/lib/video/styles.ts`
- Create: `src/lib/video/overlays.tsx`
- Test: `tests/video/overlays.test.ts`

**Interfaces:**
- Consumes: `ClipStyle`, `Hook` (Task 1); `renderPng` (src/lib/content/poster-png.ts); `POSTER_THEMES`, `Theme` (src/lib/card-theme.ts / poster.ts)
- Produces:
  - `interface StyleLook { box: { background: string; color: string; borderRadius: number; padding: string } | null; color: string; stroke: string | null; fontSize: number; hookTopBg: string; hookTopInk: string; hookMainBg: string; hookMainInk: string }`
  - `styleLook(style: ClipStyle, theme?: Theme): StyleLook` — the one definition the preview (CSS) and the render use
  - `STYLE_LABEL: Record<ClipStyle, string>` = `{ box: "กล่องดำ", outline: "ตัวขาวขอบดำ", yellow: "เน้นเหลือง", page: "สีของเพจ" }`
  - `SUB_SIZE = { width: 1080, height: 200 }`, `HOOK_SIZE = { width: 1080, height: 360 }`
  - `subElement(text: string, look: StyleLook): ReactNode`, `hookElement(hook: Hook, look: StyleLook): ReactNode`
  - `renderSubPng(text, look): Promise<Buffer>`, `renderHookPng(hook, look): Promise<Buffer>`

- [ ] **Step 1: Write the failing tests**

`tests/video/overlays.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderHookPng, renderSubPng, STYLE_LABEL } from "@/lib/video/overlays";
import { styleLook } from "@/lib/video/styles";
import { CLIP_STYLES } from "@/lib/content/clip";

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const width = (b: Buffer) => b.readUInt32BE(16);
const height = (b: Buffer) => b.readUInt32BE(20);

describe("styleLook", () => {
  it("has a look and a Thai name for each of the four styles", () => {
    for (const s of CLIP_STYLES) {
      expect(styleLook(s).fontSize).toBeGreaterThan(40);
      expect(STYLE_LABEL[s]).toBeTruthy();
    }
  });
  it("takes the Page's colours for the page style, navy when it has none", () => {
    expect(styleLook("page", "emerald").hookMainBg).not.toBe(styleLook("page").hookMainBg);
    expect(styleLook("page").hookMainBg).toBe(styleLook("page", "navy").hookMainBg);
  });
  it("outline has no box and a stroke", () => {
    expect(styleLook("outline").box).toBeNull();
    expect(styleLook("outline").stroke).toBeTruthy();
  });
});

describe("overlay pictures", () => {
  it("draws a subtitle as a transparent 1080×200 PNG", async () => {
    const png = await renderSubPng("ส่วนที่เหลือก็คือติด", styleLook("box"));
    expect(isPng(png)).toBe(true);
    expect([width(png), height(png)]).toEqual([1080, 200]);
  });
  it("draws a hook with and without its small top line as 1080×360", async () => {
    const a = await renderHookPng({ top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" }, styleLook("yellow"));
    const b = await renderHookPng({ main: "ปิดยอดไปแล้ว" }, styleLook("box"));
    expect([width(a), height(a), width(b), height(b)]).toEqual([1080, 360, 1080, 360]);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run tests/video/overlays.test.ts` → FAIL

- [ ] **Step 3: Implement**

`src/lib/video/styles.ts`:

```ts
import { POSTER_THEMES } from "@/lib/card-theme";
import type { ClipStyle } from "@/lib/content/clip";
import type { Theme } from "@/lib/content/poster";

/**
 * The four looks of words on a clip (owner, 2026-10-02), defined once: the editor's preview
 * draws them in CSS, the render draws them with satori, from these same numbers.
 */
export interface StyleLook {
  box: { background: string; color: string; borderRadius: number; padding: string } | null;
  color: string;
  /** a text outline (satori and CSS -webkit-text-stroke), for the style with no box */
  stroke: string | null;
  fontSize: number;
  hookTopBg: string;
  hookTopInk: string;
  hookMainBg: string;
  hookMainInk: string;
}

export function styleLook(style: ClipStyle, theme: Theme = "navy"): StyleLook {
  switch (style) {
    case "outline":
      return { box: null, color: "#ffffff", stroke: "6px #000000", fontSize: 70, hookTopBg: "#ffffff", hookTopInk: "#111111", hookMainBg: "rgba(0,0,0,0)", hookMainInk: "#ffffff" };
    case "yellow":
      return { box: { background: "#facc15", color: "#111111", borderRadius: 18, padding: "16px 30px" }, color: "#111111", stroke: null, fontSize: 64, hookTopBg: "#111111", hookTopInk: "#facc15", hookMainBg: "#facc15", hookMainInk: "#111111" };
    case "page": {
      const c = POSTER_THEMES[theme] ?? POSTER_THEMES.navy;
      return { box: { background: c.from, color: c.headline, borderRadius: 22, padding: "18px 34px" }, color: c.headline, stroke: null, fontSize: 64, hookTopBg: c.badgeBg, hookTopInk: c.badgeInk, hookMainBg: c.from, hookMainInk: c.headline };
    }
    case "box":
    default:
      return { box: { background: "rgba(0,0,0,0.62)", color: "#ffffff", borderRadius: 22, padding: "18px 34px" }, color: "#ffffff", stroke: null, fontSize: 64, hookTopBg: "#facc15", hookTopInk: "#111111", hookMainBg: "rgba(17,24,39,0.88)", hookMainInk: "#ffffff" };
  }
}
```

`src/lib/video/overlays.tsx`:

```tsx
import type { ReactNode } from "react";
import type { ClipStyle, Hook } from "@/lib/content/clip";
import { renderPng } from "@/lib/content/poster-png";
import type { StyleLook } from "./styles";

/** The words laid on a clip, as transparent pictures the render puts over the video (owner, 2026-10-02). */

export const STYLE_LABEL: Record<ClipStyle, string> = { box: "กล่องดำ", outline: "ตัวขาวขอบดำ", yellow: "เน้นเหลือง", page: "สีของเพจ" };
export const SUB_SIZE = { width: 1080, height: 200 };
export const HOOK_SIZE = { width: 1080, height: 360 };

const text = (look: StyleLook) => ({
  fontFamily: "Plex", fontWeight: 600, fontSize: look.fontSize, lineHeight: 1.25, textAlign: "center" as const,
  color: look.box ? look.box.color : look.color,
  ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}),
});

export function subElement(words: string, look: StyleLook): ReactNode {
  return (
    <div style={{ width: SUB_SIZE.width, height: SUB_SIZE.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", maxWidth: 1000, ...(look.box ? { background: look.box.background, borderRadius: look.box.borderRadius, padding: look.box.padding } : {}), ...text(look) }}>
        {words}
      </div>
    </div>
  );
}

export function hookElement(hook: Hook, look: StyleLook): ReactNode {
  return (
    <div style={{ width: HOOK_SIZE.width, height: HOOK_SIZE.height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {hook.top ? (
        <div style={{ display: "flex", padding: "14px 30px", borderRadius: 18, background: look.hookTopBg, color: look.hookTopInk, fontFamily: "Plex", fontWeight: 600, fontSize: 44, marginBottom: 18 }}>{hook.top}</div>
      ) : null}
      <div style={{ display: "flex", padding: "22px 40px", borderRadius: 24, background: look.hookMainBg, color: look.hookMainInk, fontFamily: "Plex", fontWeight: 600, fontSize: 76, textAlign: "center", maxWidth: 1020, ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}) }}>
        {hook.main}
      </div>
    </div>
  );
}

export const renderSubPng = (words: string, look: StyleLook): Promise<Buffer> => renderPng(subElement(words, look), SUB_SIZE);
export const renderHookPng = (hook: Hook, look: StyleLook): Promise<Buffer> => renderPng(hookElement(hook, look), HOOK_SIZE);
```

(if satori rejects `WebkitTextStroke`, use `textShadow` with eight 3px offsets in black instead and say so in the report; check the PNG with the Read tool.)

- [ ] **Step 4: Run tests; open one PNG to look at the Thai; commit**

Run: `npx vitest run tests/video/overlays.test.ts` → PASS. Write one hook PNG to the scratchpad from a one-off `npx tsx` script or a temporary test write, and view it — the vowels and tone marks must sit right.

```bash
git add src/lib/video/styles.ts src/lib/video/overlays.tsx tests/video/overlays.test.ts
git commit -m "feat(video): four looks for words on a clip, drawn as subtitle and hook pictures"
```

---

### Task 5: ตัว render Rendi

**Files:**
- Create: `src/lib/video/engines/types.ts`
- Create: `src/lib/video/engines/rendi.ts`
- Test: `tests/video/rendi.test.ts`

**Interfaces:**
- Consumes: `FfmpegJob` (Task 3)
- Produces (types.ts):
  - `type JobState = "queued" | "running" | "done" | "failed"`
  - `interface JobStatus { state: JobState; outputs?: Record<string, { url: string; fileId?: string }>; error?: string }`
  - `interface RenderEngine { name: EngineName; submit(job: FfmpegJob, opts: { callbackUrl: string; token: string; uploads?: Record<string, { uploadUrl: string; path: string }> }): Promise<{ id: string }>; status(id: string): Promise<JobStatus | null>; cleanup(status: JobStatus): Promise<void> }` — `status` null means the engine reports by webhook only
  - `class EngineError extends Error { constructor(message: string, readonly retryElsewhere: boolean) }`
- Produces (rendi.ts): `rendiEngine(key: string, maxSeconds: number): RenderEngine`; `RENDI_API = "https://api.rendi.dev/v1"`

- [ ] **Step 1: Write the failing tests**

`tests/video/rendi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { rendiEngine, RENDI_API } from "@/lib/video/engines/rendi";
import { EngineError } from "@/lib/video/engines/types";

const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };
function api(answers: { status?: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("rendiEngine", () => {
  it("submits the command with its inputs, outputs and time limit, and returns the command id", async () => {
    const calls = api([{ body: { command_id: "c1" } }]);
    expect(await rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).toEqual({ id: "c1" });
    expect(calls[0].url).toBe(`${RENDI_API}/run-ffmpeg-command`);
    expect(calls[0].init?.headers).toMatchObject({ "X-API-KEY": "k", "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      input_files: { in_1: "https://s/c.mp4" }, output_files: { out_1: "reel.mp4" },
      ffmpeg_command: "-i {{in_1}} {{out_1}}", max_command_run_seconds: 60,
    });
  });

  it("a refusal for the key or the plan is one to try elsewhere; a bad command is not", async () => {
    api([{ status: 401, body: { detail: "bad key" } }]);
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: true });
    api([{ status: 422, body: { detail: "bad" } }]);
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(rendiEngine("k", 60).submit(job, { callbackUrl: "x", token: "t" })).rejects.toBeInstanceOf(EngineError);
  });

  it("reads a command's state and its output files", async () => {
    api([{ body: { status: "PROCESSING" } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "running" });
    api([{ body: { status: "QUEUED" } }]);
    expect((await rendiEngine("k", 60).status("c1"))?.state).toBe("queued");
    api([{ body: { status: "SUCCESS", output_files: { out_1: { storage_url: "https://r/reel.mp4", file_id: "f1" } } } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "done", outputs: { out_1: { url: "https://r/reel.mp4", fileId: "f1" } } });
    api([{ body: { status: "FAILED", error_message: "boom" } }]);
    expect(await rendiEngine("k", 60).status("c1")).toEqual({ state: "failed", error: "boom" });
  });

  it("deletes its stored outputs once we have them", async () => {
    const calls = api([{ status: 204, body: {} }, { status: 404, body: {} }]);
    await rendiEngine("k", 60).cleanup({ state: "done", outputs: { out_1: { url: "u", fileId: "f1" }, out_2: { url: "u2", fileId: "f2" } } });
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([["DELETE", `${RENDI_API}/files/f1`], ["DELETE", `${RENDI_API}/files/f2`]]);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — FAIL

- [ ] **Step 3: Implement**

`src/lib/video/engines/types.ts`:

```ts
import type { EngineName } from "@/lib/content/clip";
import type { FfmpegJob } from "../command";

export type JobState = "queued" | "running" | "done" | "failed";
export interface JobStatus { state: JobState; outputs?: Record<string, { url: string; fileId?: string }>; error?: string }

/** A service that runs one ffmpeg command for us (owner, 2026-10-02: Rendi or our Lambda, switchable). */
export interface RenderEngine {
  name: EngineName;
  /** uploads: where an engine that writes our storage itself (Lambda) puts each output */
  submit(job: FfmpegJob, opts: { callbackUrl: string; token: string; uploads?: Record<string, { uploadUrl: string; path: string }> }): Promise<{ id: string }>;
  /** null: this engine answers by webhook only */
  status(id: string): Promise<JobStatus | null>;
  /** lets the engine's own copies of the outputs go, once we have ours */
  cleanup(status: JobStatus): Promise<void>;
}

export class EngineError extends Error {
  /** retryElsewhere: the other engine may well succeed (a key, a plan, a network) — not a bad command */
  constructor(message: string, readonly retryElsewhere: boolean) {
    super(message);
    this.name = "EngineError";
  }
}
```

`src/lib/video/engines/rendi.ts`:

```ts
import type { FfmpegJob } from "../command";
import { EngineError, type JobStatus, type RenderEngine } from "./types";

/** Rendi: FFmpeg as a service (https://rendi.dev). Outputs stay on Rendi until deleted. */
export const RENDI_API = "https://api.rendi.dev/v1";

export function rendiEngine(key: string, maxSeconds: number): RenderEngine {
  const headers = { "X-API-KEY": key, "Content-Type": "application/json" };
  async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      return await fetch(`${RENDI_API}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new EngineError("ติดต่อ Rendi ไม่ได้", true);
    }
  }
  return {
    name: "rendi",
    async submit(job: FfmpegJob) {
      const res = await call("/run-ffmpeg-command", {
        method: "POST",
        body: JSON.stringify({
          input_files: Object.fromEntries(job.inputs.map((i) => [i.name, i.url])),
          output_files: Object.fromEntries(job.outputs.map((o) => [o.name, o.file])),
          ffmpeg_command: job.command,
          max_command_run_seconds: maxSeconds,
        }),
      }, 30_000);
      const body = await res.json().catch(() => ({})) as { command_id?: string; detail?: unknown };
      if (!res.ok || !body.command_id) {
        // a key, a plan or a rate limit: the other engine may do it; a 4xx about the command will fail there too
        const elsewhere = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500;
        throw new EngineError(`Rendi ไม่รับงาน (${res.status})`, elsewhere);
      }
      return { id: body.command_id };
    },
    async status(id: string): Promise<JobStatus> {
      const res = await call(`/commands/${encodeURIComponent(id)}`, { method: "GET" }, 15_000);
      if (!res.ok) throw new EngineError(`อ่านสถานะงานจาก Rendi ไม่ได้ (${res.status})`, false);
      const b = await res.json().catch(() => ({})) as {
        status?: string; error_message?: string;
        output_files?: Record<string, { storage_url?: string; file_id?: string }>;
      };
      if (b.status === "SUCCESS") {
        const outputs = Object.fromEntries(Object.entries(b.output_files ?? {})
          .filter(([, f]) => f?.storage_url)
          .map(([k, f]) => [k, { url: f.storage_url!, ...(f.file_id ? { fileId: f.file_id } : {}) }]));
        return { state: "done", outputs };
      }
      if (b.status === "FAILED") return { state: "failed", error: b.error_message ?? "Rendi ทำงานไม่สำเร็จ" };
      return { state: b.status === "QUEUED" ? "queued" : "running" };
    },
    async cleanup(status: JobStatus) {
      for (const f of Object.values(status.outputs ?? {})) {
        if (!f.fileId) continue;
        const res = await call(`/files/${encodeURIComponent(f.fileId)}`, { method: "DELETE" }, 15_000).catch(() => null);
        if (res && !res.ok && res.status !== 404) console.error(`rendi file ${f.fileId} not deleted: ${res.status}`);
      }
    },
  };
}
```

- [ ] **Step 4: Run, commit**

```bash
git add src/lib/video/engines/types.ts src/lib/video/engines/rendi.ts tests/video/rendi.test.ts
git commit -m "feat(video): the Rendi render engine"
```

---

### Task 6: ตัว render AWS Lambda (ฝั่งแอป + ตัว function)

**Files:**
- Create: `src/lib/video/engines/lambda.ts`
- Create: `infra/lambda-ffmpeg/core.mjs`, `infra/lambda-ffmpeg/handler.mjs`, `infra/lambda-ffmpeg/Dockerfile`, `infra/lambda-ffmpeg/README.md`
- Modify: `package.json` (`@aws-sdk/client-lambda`)
- Test: `tests/video/lambda.test.ts`, `tests/video/lambda-core.test.ts`

**Interfaces:**
- Consumes: `RenderEngine`, `EngineError` (Task 5); `FfmpegJob` (Task 3)
- Produces:
  - `parseAwsKey(key: string): { accessKeyId: string; secretAccessKey: string; region: string; functionName: string } | null` — key format `ACCESS_KEY_ID:SECRET:REGION:FUNCTION_NAME`
  - `lambdaEngine(key: string): RenderEngine` — invokes async (`InvocationType: "Event"`) with payload `{ id, job, uploads, callbackUrl, token }`; `status` → `null`; `cleanup` → no-op
  - core.mjs: `splitArgs(command: string): string[]`, `localize(command: string, inputs: Record<string,string>, outputs: Record<string,string>): string`
  - Lambda callback POST body: `{ id: string; token: string; state: "done" | "failed"; outputs?: Record<string, { path: string }>; error?: string }`

- [ ] **Step 1: Install** — `npm install @aws-sdk/client-lambda`

- [ ] **Step 2: Write the failing tests**

`tests/video/lambda.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ cmd: null as unknown, fail: null as Error | null, config: null as unknown }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { constructor(c: unknown) { sent.config = c; } async send(c: unknown) { if (sent.fail) throw sent.fail; sent.cmd = c; return { StatusCode: 202 }; } },
  InvokeCommand: class { constructor(readonly input: unknown) {} },
}));
const { lambdaEngine, parseAwsKey } = await import("@/lib/video/engines/lambda");

const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };
beforeEach(() => { sent.cmd = null; sent.fail = null; });

describe("parseAwsKey", () => {
  it("reads id, secret, region and function name; anything else is null", () => {
    expect(parseAwsKey("AKIA1:sec/ret+x:ap-southeast-1:clip-ffmpeg")).toEqual({ accessKeyId: "AKIA1", secretAccessKey: "sec/ret+x", region: "ap-southeast-1", functionName: "clip-ffmpeg" });
    expect(parseAwsKey("AKIA1:secret")).toBeNull();
  });
});

describe("lambdaEngine", () => {
  it("invokes the function without waiting, carrying the job, where to upload, and how to call back", async () => {
    const e = lambdaEngine("AKIA1:s:ap-southeast-1:clip-ffmpeg");
    const { id } = await e.submit(job, { callbackUrl: "https://app/api/content-video/job", token: "t", uploads: { out_1: { uploadUrl: "https://s/up", path: "p/x.mp4" } } });
    const input = (sent.cmd as { input: { FunctionName: string; InvocationType: string; Payload: Uint8Array } }).input;
    expect(input.FunctionName).toBe("clip-ffmpeg");
    expect(input.InvocationType).toBe("Event");
    expect(JSON.parse(new TextDecoder().decode(input.Payload))).toEqual({ id, job, uploads: { out_1: { uploadUrl: "https://s/up", path: "p/x.mp4" } }, callbackUrl: "https://app/api/content-video/job", token: "t" });
    expect(await e.status(id)).toBeNull();
  });
  it("a bad key or an AWS refusal is an error to try elsewhere", async () => {
    await expect(lambdaEngine("nope").submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: true });
    sent.fail = new Error("AccessDenied");
    await expect(lambdaEngine("A:s:r:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ retryElsewhere: true });
  });
});
```

`tests/video/lambda-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module shipped to Lambda
import { localize, splitArgs } from "../../infra/lambda-ffmpeg/core.mjs";

describe("lambda core", () => {
  it("splits a command like a shell, keeping quoted filters whole", () => {
    expect(splitArgs(`-i a.mp4 -filter_complex "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]" -map "[b]" out.mp4`))
      .toEqual(["-i", "a.mp4", "-filter_complex", "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]", "-map", "[b]", "out.mp4"]);
  });
  it("puts local files where the placeholders were", () => {
    expect(localize("-i {{in_1}} -i {{in_2}} {{out_1}}", { in_1: "/tmp/in_1", in_2: "/tmp/in_2" }, { out_1: "/tmp/out_1.mp4" }))
      .toBe("-i /tmp/in_1 -i /tmp/in_2 /tmp/out_1.mp4");
  });
});
```

- [ ] **Step 3: Implement**

`src/lib/video/engines/lambda.ts`:

```ts
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { EngineError, type RenderEngine } from "./types";

/**
 * Our own ffmpeg on AWS Lambda (owner, 2026-10-02), infra/lambda-ffmpeg. Invoked without
 * waiting; it writes the outputs into our storage itself and calls back. The key is kept in
 * the encrypted key store as ACCESS_KEY_ID:SECRET:REGION:FUNCTION_NAME.
 */
export function parseAwsKey(key: string): { accessKeyId: string; secretAccessKey: string; region: string; functionName: string } | null {
  const parts = key.split(":");
  if (parts.length !== 4 || parts.some((p) => !p)) return null;
  const [accessKeyId, secretAccessKey, region, functionName] = parts;
  return { accessKeyId, secretAccessKey, region, functionName };
}

export function lambdaEngine(key: string): RenderEngine {
  return {
    name: "lambda",
    async submit(job, opts) {
      const aws = parseAwsKey(key);
      if (!aws) throw new EngineError("ตั้งค่า AWS ไม่ครบ", true);
      const id = crypto.randomUUID();
      const client = new LambdaClient({ region: aws.region, credentials: { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey } });
      try {
        await client.send(new InvokeCommand({
          FunctionName: aws.functionName,
          InvocationType: "Event",
          Payload: new TextEncoder().encode(JSON.stringify({ id, job, uploads: opts.uploads ?? {}, callbackUrl: opts.callbackUrl, token: opts.token })),
        }));
      } catch (e) {
        console.error("lambda invoke failed:", e);
        throw new EngineError("ส่งงานให้ AWS ไม่ได้", true);
      }
      return { id };
    },
    async status() { return null; },
    async cleanup() { /* the function writes straight into our storage */ },
  };
}
```

`infra/lambda-ffmpeg/core.mjs`:

```js
// Pure helpers for the clip ffmpeg Lambda — tested in tests/video/lambda-core.test.ts.

/** a command line split like a shell would: double- and single-quoted runs stay one argument, quotes removed only when they wrap a whole word */
export function splitArgs(command) {
  const out = [];
  let cur = "";
  let quote = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      cur += ch;
      continue;
    }
    if (ch === "\"") { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) { if (started) { out.push(cur); cur = ""; started = false; } continue; }
    cur += ch;
    started = true;
  }
  if (started) out.push(cur);
  return out;
}

/** {{in_1}} / {{out_1}} replaced by local paths */
export function localize(command, inputs, outputs) {
  return command.replace(/\{\{((?:in|out)_\d+)\}\}/g, (m, name) => inputs[name] ?? outputs[name] ?? m);
}
```

(single quotes inside the double-quoted filter — `enable='between(...)'` — stay as characters, which is what ffmpeg's filter parser expects; the test pins it.)

`infra/lambda-ffmpeg/handler.mjs`:

```js
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { localize, splitArgs } from "./core.mjs";

const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/ffmpeg/ffmpeg";

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800) || `ffmpeg ${code}`))));
  });
}

async function callback(event, body) {
  await fetch(event.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id, token: event.token, ...body }) });
}

export async function handler(event) {
  const dir = `/tmp/${event.id}`;
  await mkdir(dir, { recursive: true });
  try {
    const inputs = {};
    for (const i of event.job.inputs) { inputs[i.name] = `${dir}/${i.name}`; await download(i.url, inputs[i.name]); }
    const outputs = Object.fromEntries(event.job.outputs.map((o) => [o.name, `${dir}/${o.file}`]));
    await run(splitArgs(localize(event.job.command, inputs, outputs)));
    const done = {};
    for (const o of event.job.outputs) {
      const up = event.uploads[o.name];
      const res = await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": o.contentType, "x-upsert": "false" }, body: await readFile(outputs[o.name]) });
      if (!res.ok) throw new Error(`upload ${o.name} ${res.status}`);
      done[o.name] = { path: up.path };
    }
    await callback(event, { state: "done", outputs: done });
  } catch (e) {
    await callback(event, { state: "failed", error: String(e?.message ?? e).slice(0, 500) }).catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

`infra/lambda-ffmpeg/Dockerfile`:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20
# a static ffmpeg build (https://johnvansickle.com/ffmpeg/) — x86_64 Lambda
RUN dnf install -y tar xz && \
    curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar -xJ -C /opt && \
    mv /opt/ffmpeg-*-amd64-static /opt/ffmpeg && dnf clean all
COPY core.mjs handler.mjs ${LAMBDA_TASK_ROOT}/
CMD ["handler.handler"]
```

`infra/lambda-ffmpeg/README.md` — deploy steps (owner, once there is an AWS account): build and push the image to ECR in `ap-southeast-1`; create the function from the image with **3008 MB memory, 10240 MB ephemeral storage, 900 s timeout**, x86_64; create an IAM user with only `lambda:InvokeFunction` on that function; put `ACCESS_KEY_ID:SECRET:ap-southeast-1:<function>` as the `aws` key on `/admin/ai`; the function needs no AWS permissions of its own (it reads signed URLs and writes signed upload URLs). Include the exact `aws ecr` / `docker` / `aws lambda create-function` commands.

- [ ] **Step 4: Run, commit**

Run: `npx vitest run tests/video/lambda.test.ts tests/video/lambda-core.test.ts` → PASS · `npx tsc --noEmit`

```bash
git add src/lib/video/engines/lambda.ts infra/lambda-ffmpeg tests/video/lambda.test.ts tests/video/lambda-core.test.ts package.json package-lock.json
git commit -m "feat(video): the AWS Lambda render engine and its ffmpeg function"
```

---

### Task 7: งาน — ส่งพร้อมสำรอง, ถามสถานะ, เก็บผลครั้งเดียว, webhook

**Files:**
- Create: `src/lib/video/engines/index.ts` (choosing engines)
- Create: `src/lib/video/jobs.ts`
- Create: `src/app/api/content-video/job/route.ts`
- Modify: `src/lib/wallet/round.ts` (`settleLater`)
- Test: `tests/video/jobs.test.ts`, `tests/video/job-route.test.ts`, `tests/wallet/settle-later.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 5, 6; `providerKey` (src/lib/ai/client.ts); `videoSettings`; `clipReadUrl`, `removeClip` (clip-store); `supabaseAdmin`; `siteUrl` (src/lib/site-url.ts); `parseSilences`, `buildSubs` (Task 2); `settleWallet`, `releaseWallet`, `returnFreeRound` (wallet/store); `chargeSatang` (money)
- Produces:
  - `enginesInOrder(): Promise<RenderEngine[]>` — primary first, the other only if `fallback` and its key exists; `[]` when none is configured
  - `submitJob(pieceId: string, kind: "prepare" | "render", job: FfmpegJob, avoid?: EngineName[]): Promise<EditJob>` — tries engines in order (skipping `avoid`), creates storage destinations, throws `EngineError` when all fail
  - `checkJob(pieceId: string): Promise<{ item: ContentItem; changed: boolean }>` — polls the engine (if it polls), finalizes a done/failed/timed-out job exactly once
  - `finishJob(pieceId: string, jobId: string, result: { state: "done" | "failed"; outputs?: Record<string, { path: string }>; error?: string }): Promise<void>` — used by the webhook and by `checkJob`
  - `initialEdit(v: ClipVideo, silences: [number, number][]): ClipEdit` (exported for Task 9)
  - `settleLater(pass: EditPass, delivered: boolean, costThb: number): Promise<void>` (wallet/round.ts)

Design notes the implementer needs:
- **Destinations**: for each output, `path = <piece>/<uuid>.<ext of output.file>`; for Lambda also `createSignedUploadUrl(path)` → `uploads[name] = { uploadUrl: signedUrl, path }`. For Rendi the paths are chosen at collect time.
- **Recording a job**: write `edit.job` with `saveOutputIf(id, {..output, video: {...video, edit: {...edit, job}}}, undefined, rev)` on the row read by service role (no viewer scope inside the webhook) — add a helper `readPiece(id)` / `writeEdit(item, mutate)` in jobs.ts using `supabaseAdmin().from("ins_content")` + the store's `saveOutputIf` semantics (`output->>rev` guard). A first-ever prepare has no `edit` yet: create `edit` = `{ cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: uuid, job }`.
- **Collect once**: claim by writing `edit.job = { ...job, collecting: startedAt }` guarded on the row's `rev`; only the writer that wins downloads outputs (Rendi: stream `storage_url` → `supabaseAdmin().storage.from(CLIP_BUCKET).upload(path, body, { contentType })`), then writes the final state and clears `edit.job`. The loser re-reads and returns.
- **prepare done**: download `silences.txt` from our bucket, `parseSilences` → `edit.silences`; `edit.proxyPath = <proxy path>`; if `edit.subs` is empty, fill from `initialEdit` (cut from `segment.cut`, subs from `buildSubs`, hook from `hookSuggestion` or the caption's first line cut to 28); remove the silences file.
- **render done**: `edit.renderedPath = path`, `renderedAt = now`, `renderedRev = job.rev` (the rev it was made from, not the current one); remove the previous `renderedPath`; `settleLater(job.pass, true, job.costThb ?? 0)`.
- **failed / timed out (> EDIT_JOB_TIMEOUT_MS)**: `edit.error = "…"`, clear `job`; render → `settleLater(job.pass, false, 0)`.
- **Webhook route** `POST /api/content-video/job`: body `{ id, token, state, outputs, error }` (Lambda). Find the piece with `output->video->edit->job->>id = id` (service role), compare `token` in constant time (`crypto.timingSafeEqual` on equal-length buffers), then `finishJob`. Also accept Rendi's dashboard webhook `{ data: { command_id } }`: find the piece by job id and call `checkJob` (re-poll — Rendi's webhook is unsigned). Always answer 200 quickly for unknown ids (no information leak), 401 for a bad token. `maxDuration = 60`.

- [ ] **Step 1: Write the failing tests**

`tests/wallet/settle-later.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
const w = vi.hoisted(() => ({ settleWallet: vi.fn(async () => 100), releaseWallet: vi.fn(async () => undefined), returnFreeRound: vi.fn(async () => true) }));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/store")>()), ...w }));
const { settleLater } = await import("@/lib/wallet/round");
beforeEach(() => vi.clearAllMocks());

describe("settleLater", () => {
  it("charges a delivered wallet round its cost times the multiplier, never past the hold", async () => {
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, true, 0.9);
    expect(w.settleWallet).toHaveBeenCalledWith("h", 180, 0.9);
  });
  it("hands a failed wallet round's hold back, and a failed free round back to the count", async () => {
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, false, 0);
    expect(w.releaseWallet).toHaveBeenCalledWith("h");
    await settleLater({ paidBy: "free", auditId: 7 }, false, 0);
    expect(w.returnFreeRound).toHaveBeenCalledWith(7);
  });
  it("does nothing for staff, or for a free round that delivered", async () => {
    await settleLater({ paidBy: "staff" }, true, 1);
    await settleLater({ paidBy: "free", auditId: 7 }, true, 1);
    expect(w.settleWallet).not.toHaveBeenCalled();
    expect(w.returnFreeRound).not.toHaveBeenCalled();
  });
});
```

`tests/video/jobs.test.ts` (mock `@/lib/supabase/admin` with an in-memory `ins_content` row honouring the `output->>rev` guard and an in-memory bucket; mock `@/lib/video/engines/index` `enginesInOrder`; mock `@/lib/wallet/round` `settleLater`; stub `fetch` for Rendi downloads):

```ts
// cases, each with its own assertions:
it("submits to the first engine and records the job on the clip", ...)            // edit.job = { kind, engine: "rendi", id, token, tried: ["rendi"] }
it("falls back to the other engine when the first refuses to take it", ...)        // first throws EngineError(retryElsewhere: true) → second used, tried both
it("does not fall back for a bad command", ...)                                     // retryElsewhere false → throws, no second submit
it("throws when no engine is configured", ...)                                      // enginesInOrder → [] → EngineError "ยังไม่ได้ตั้งค่าตัวตัดต่อ"
it("collects a finished prepare: preview kept, silences read, a first edit built", ...)
it("collects a finished render: the take kept, the old take removed, the round charged", ...)
it("a render that lands after an edit is marked with the rev it was made from", ...) // job.rev "r1", edit.rev now "r2" → renderedRev "r1"
it("collects a finished job once when asked twice at the same time", ...)          // Promise.all([checkJob, checkJob]) → one upload, one settleLater
it("a job past 15 minutes has failed: error set, round handed back", ...)
it("a failed job hands the round back and keeps the edit", ...)
```

Write each with concrete fixtures (a `ContentItem` with `output.video.edit.job`, Rendi `status` answers) following the patterns in `tests/content/publish-flow.test.ts` (in-memory row + conditional writes). Every case asserts on the stored row, not only on return values.

`tests/video/job-route.test.ts`:

```ts
// cases:
it("finishes a Lambda job whose token matches", ...)          // finishJob called with outputs
it("refuses a wrong token with 401 and changes nothing", ...)
it("answers 200 and does nothing for an unknown job id", ...)
it("re-polls Rendi for its dashboard webhook instead of trusting the body", ...) // checkJob called, body outputs ignored
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement** `settleLater` in `src/lib/wallet/round.ts` (export; uses `settleWallet`, `releaseWallet`, `returnFreeRound`, `chargeSatang`), `src/lib/video/engines/index.ts`:

```ts
import { providerKey } from "@/lib/ai/client";
import { videoSettings } from "../settings";
import { lambdaEngine } from "./lambda";
import { rendiEngine } from "./rendi";
import type { RenderEngine } from "./types";

/** The engines to try, the owner's pick first; the other only when fallback is on and it has a key. */
export async function enginesInOrder(): Promise<RenderEngine[]> {
  const s = await videoSettings();
  const [rendiKey, awsKey] = await Promise.all([providerKey("rendi"), providerKey("aws")]);
  const make = { rendi: () => (rendiKey ? rendiEngine(rendiKey, s.rendiMaxSeconds) : null), lambda: () => (awsKey ? lambdaEngine(awsKey) : null) };
  const order = s.engine === "lambda" ? (["lambda", "rendi"] as const) : (["rendi", "lambda"] as const);
  const first = make[order[0]]();
  const second = s.fallback ? make[order[1]]() : null;
  return [first, second].filter((e): e is RenderEngine => e !== null);
}
```

then `src/lib/video/jobs.ts` and the route per the design notes above. `checkJob` for an engine whose `status` returns `null` (Lambda) only applies the 15-minute timeout.

- [ ] **Step 4: Run, type check, commit**

```bash
git add src/lib/video/engines/index.ts src/lib/video/jobs.ts src/app/api/content-video/job/route.ts src/lib/wallet/round.ts tests/video/jobs.test.ts tests/video/job-route.test.ts tests/wallet/settle-later.test.ts
git commit -m "feat(video): render jobs — submit with fallback, collect once, webhook, settle the round"
```

---

### Task 8: รอบถอดเสียงเสนอประโยคที่ควรตัดและ hook

**Files:**
- Modify: `src/lib/content/clip-transcribe.ts` (prompt + `parseClipReply`)
- Modify: `src/lib/content/clip-run.ts` (store `hookSuggestion`)
- Test: `tests/content/clip-transcribe.test.ts`, `tests/content/clip-run.test.ts`

**Interfaces:**
- Consumes: `Segment.cut/why`, `Hook`, `MAX_HOOK_MAIN`, `MAX_HOOK_TOP` (Task 1)
- Produces: `parseClipReply(text, durationSec): { segments: Segment[]; caption: string; hook?: Hook } | null` — segments may carry `cut: true` and `why`; `hook.main` cut to 28, `hook.top` to 24; a missing/blank hook is `undefined`

- [ ] **Step 1: Write the failing tests** — append to `tests/content/clip-transcribe.test.ts`:

```ts
describe("parseClipReply — editing suggestions", () => {
  it("keeps a segment's cut mark and reason, and the suggested hook", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 1, text: "เอ่อ", cut: true, why: "คำเติม" }, { start: 1, end: 3, text: "สวัสดีครับ" }],
      caption: "c", hook: { top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" },
    }), 10);
    expect(r?.segments[0]).toMatchObject({ cut: true, why: "คำเติม" });
    expect(r?.segments[1].cut).toBeUndefined();
    expect(r?.hook).toEqual({ top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" });
  });
  it("cuts a hook that runs long, and drops a blank one", () => {
    const r = parseClipReply(JSON.stringify({ segments: [], caption: "c", hook: { top: "x".repeat(40), main: "y".repeat(40) } }), 10);
    expect(r?.hook).toEqual({ top: "x".repeat(24), main: "y".repeat(28) });
    expect(parseClipReply(JSON.stringify({ segments: [], caption: "c", hook: { main: "  " } }), 10)?.hook).toBeUndefined();
  });
  it("ignores a cut that is not true", () => {
    expect(parseClipReply(JSON.stringify({ segments: [{ start: 0, end: 1, text: "ก", cut: "yes" }], caption: "c" }), 10)?.segments[0].cut).toBeUndefined();
  });
});
```

and in `tests/content/clip-run.test.ts` a case: a reply with `hook` → saved `video.hookSuggestion` equals it; a reply without → `hookSuggestion` absent.

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**
  - `SYSTEM` gains two lines before the JSON line:
    - `"งานที่ 3: ทำเครื่องหมาย cut: true ที่ช่วงที่ควรตัดออกเมื่อตัดต่อ พร้อม why สั้นๆ — คำเติม (เอ่อ อ่า อืม), ประโยคที่พูดผิดแล้วพูดใหม่ (ตัดครั้งที่ผิด เก็บครั้งที่ดีที่สุด), ประโยคที่พูดไม่จบ — ช่วงที่ควรเก็บไม่ต้องใส่ cut"`
    - `"งานที่ 4: เขียน hook ตัวหนังสือขึ้นจอช่วงต้นคลิป: main ไม่เกิน 28 ตัวอักษร สรุปประเด็นที่ดึงดูดที่สุด และ top (ไม่บังคับ) ไม่เกิน 24 ตัวอักษร — ห้ามคำโฆษณาเกินจริงเหมือนแคปชัน"`
  - the JSON format line becomes: `ตอบเป็น JSON เท่านั้น รูปแบบ {"segments":[{"start":0,"end":2.5,"text":"...","cut":true,"why":"คำเติม"}],"caption":"...","hook":{"top":"...","main":"..."}}`
  - `parseClipReply`: carry `cut: true` (only when `=== true`) and `why` (string, ≤ 60) onto each kept segment; parse `hook` (object with string `main` non-blank after trim) → `{ main: main.slice(0, 28), ...(top ? { top: top.slice(0, 24) } : {}) }`
  - `clip-run.ts` `keep()` change: `...(heard.hook ? { hookSuggestion: heard.hook } : {})`, and drop a stale `hookSuggestion` when the new reply has none
  - the caption checks are unchanged; the hook is checked when it is rendered (Task 9)

- [ ] **Step 4: Run, commit**

```bash
git add src/lib/content/clip-transcribe.ts src/lib/content/clip-run.ts tests/content/clip-transcribe.test.ts tests/content/clip-run.test.ts
git commit -m "feat(studio): the listen also marks sentences to cut and suggests a hook"
```

---

### Task 9: server actions ของหน้าตัดต่อ และรอบ `ai-edit`

**Files:**
- Create: `src/app/studio/clip-edit.ts` (`"use server"`)
- Create: `src/lib/video/render-run.ts` (the render's server work: checks, pictures, submit)
- Modify: `src/lib/auth/quota.ts` (`"ai-edit"`), `src/lib/wallet/money.ts` (`"ai-edit": 3`), `src/app/studio/wallet/WalletClient.tsx` (label `"ai-edit": "ตัดต่อคลิป"`), `tests/wallet/take-round.test.ts`
- Test: `tests/video/clip-edit-actions.test.ts`, `tests/video/render-run.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8; `getContent`, `saveOutputIf`, `listWords` (store); `onPage`; `requireMember`; `takeRound`; `captionFlags`, `clipYardstick` (clip-transcribe); `modeChecks`; `findWords`; `clipReadUrl`; `recentLooks`-style query for the Page theme
- Produces:
  - `type EditResult = { ok: true; item: ContentItem } | { ok: false; error: string }`
  - `openEdit(id: string): Promise<EditResult>` — guards; no edit/proxy yet and no job → `submitJob(prepare)` (no charge); a job running → `checkJob`
  - `pollEdit(id: string): Promise<EditResult>` — `checkJob`
  - `saveEdit(id: string, patch: { cut?: number[]; trimSilence?: boolean; subs?: { start: number; end: number; text: string }[]; hook?: Hook; style?: ClipStyle }): Promise<EditResult>` — validates (cut indexes in range, subs text ≤ 120 each, ≤ 200 subs, hook lengths, style in list), bumps `edit.rev`, refused when `onPage` or a render job is running
  - `renderEdit(id: string): Promise<EditResult>` — guards → `renderChecks` → `takeRound(viewer, "ai-edit")` → `startRender` → stores `job.pass` — refusal before the round when checks fail
  - `useOriginal(id: string): Promise<EditResult>` — removes `renderedPath` (file too) so the Reel uses the original
  - render-run.ts: `renderChecks(item: ContentItem): Promise<string | null>` (null = ok); `startRender(item: ContentItem, pass: EditPass): Promise<ContentItem>`; `pageTheme(pageId: string | null): Promise<Theme>`

Rules:
- Guards for every action: `video` exists, `transcript` exists (`"ถอดเสียงก่อนแล้วค่อยตัดต่อ"`), not `expired`, not `onPage` (`"Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนตัดต่อ"`).
- `renderChecks`: edit exists with `proxyPath`/`silences` (prepared); no job running; `keptDuration(keepRanges(...)) >= 3` else `"คลิปที่เหลือสั้นเกินไป — Reel ต้องยาวอย่างน้อย 3 วินาที"`; hook `captionFlags(hook.top + "\n" + hook.main, …)` policy `block` → `"hook ผิดกฎโฆษณาของ Facebook: <message> — แก้ก่อนสร้างคลิป"`.
- `startRender`: keep = `keepRanges`; subs on output = `subsOnOutput(edit.subs, keep)`; look = `styleLook(edit.style, await pageTheme(item.pageId))`; PNGs: hook (when `hook.main.trim()` non-empty) from 0 to `min(2.6, kept)`, y 230; each sub y 1450 — upload each to `<piece>/<uuid>.png` with `contentType: "image/png"`, sign for 2 hours; `renderJob(await clipReadUrl(video.path, 7200), keep, overlays)`; `submitJob(id, "render", job)` with `rev = edit.rev`, `pass`, `costThb` estimate: Rendi `((video.sizeBytes + 25e6) / 1e9) * 0.10 * 36`, Lambda `0.002 * 36` (records `costThb` on the job). All of it finishes well inside 300 s (no waiting for the render).
- When `submitJob` throws: `settleLater(pass, false, 0)` and return `{ ok: false, error: "ระบบตัดต่อขัดข้อง ลองใหม่ภายหลัง" }`.

- [ ] **Step 1: Write the failing tests** — `tests/video/render-run.test.ts` (mock storage, `submitJob`, `renderSubPng`/`renderHookPng` to return a 1-byte buffer, `clipReadUrl`):

```ts
// cases:
it("refuses an edit that leaves under 3 seconds", ...)
it("refuses a hook the rules block", ...)                    // hook "การันตีผลตอบแทน" with policy block → message names the rule
it("renders with no hook when it is empty", ...)             // overlays: subs only, none at y 230
it("lays the hook at 230 for its first 2.6 s and each subtitle at 1450 on the cut clock", ...)
it("submits the full-quality original, not the preview", ...) // renderJob in_1 is the signed URL of video.path
it("records the rev it rendered, the round's pass and the cost estimate on the job", ...)
it("hands the round back when no engine takes the job", ...)
```

`tests/video/clip-edit-actions.test.ts`:

```ts
// cases:
it("openEdit starts a free prepare job for a clip that was listened to", ...)
it("openEdit refuses before a transcript, an expired clip, and a held Reel", ...)
it("saveEdit keeps valid changes, bumps the rev, and refuses out-of-range cuts", ...)
it("saveEdit refuses while a render job runs", ...)
it("renderEdit takes an ai-edit round only after the checks pass", ...)
it("useOriginal lets the edited take go", ...)
```

- [ ] **Step 2–4: Run (fail), implement, run (pass), type check, commit**

```bash
git add src/app/studio/clip-edit.ts src/lib/video/render-run.ts src/lib/auth/quota.ts src/lib/wallet/money.ts src/app/studio/wallet/WalletClient.tsx tests/video/clip-edit-actions.test.ts tests/video/render-run.test.ts tests/wallet/take-round.test.ts
git commit -m "feat(studio): edit actions — prepare, save, render with an ai-edit round, back to the original"
```

---

### Task 10: ลงเพจด้วยคลิปที่ตัดต่อแล้ว

**Files:**
- Modify: `src/lib/content/publish-flow.ts` (`clear`, `send`, `PublishResult`)
- Modify: `src/app/studio/publish.ts` (thread `confirmStale`)
- Test: `tests/content/publish-flow.test.ts`

**Interfaces:**
- Produces: `PublishResult` failure gains `confirmStale?: true`; `clear`/`publish` input gains `confirmStale?: boolean`; server actions `publishPiece`, `scheduleOnDay`, `scheduleNextOpen`, `scheduleAt` accept `confirmStale?: boolean`

- [ ] **Step 1: Failing tests** (append to the `describe("a Reel")` block):

```ts
  it("goes up as the edited take when there is one", async () => {
    row = reel(video({ edit: { renderedPath: "p1/edited.mp4", renderedRev: "r1", rev: "r1", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" } }));
    await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true });
    expect(clips.clipReadUrl).toHaveBeenCalledWith("p1/edited.mp4", expect.any(Number));
  });
  it("asks before posting a take older than the edit, and posts it once confirmed", async () => {
    row = reel(video({ edit: { renderedPath: "p1/edited.mp4", renderedRev: "r1", rev: "r2", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" } }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toMatchObject({ ok: false, confirmStale: true });
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true, confirmStale: true })).ok).toBe(true);
  });
  it("posts the original when the edit was never rendered", async () => {
    row = reel(video({ edit: { rev: "r1", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" } }));
    await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true });
    expect(clips.clipReadUrl).toHaveBeenCalledWith(row.output.video!.path, expect.any(Number));
  });
```

- [ ] **Step 2: Run (fail)**

- [ ] **Step 3: Implement**
  - `clear()`: after the spoken check, `if (video?.edit?.renderedPath && video.edit.renderedRev !== video.edit.rev && !input.moving && !input.confirmStale) return { ok: false, error: "แก้ใบสั่งตัดต่อหลังสร้างคลิปแล้ว — จะลงคลิปที่สร้างไว้ล่าสุดไหม", confirmStale: true };`
  - `send()`: `fileUrl = await clipReadUrl(video.edit?.renderedPath ?? video.path, REEL_LINK_SECONDS)`
  - thread `confirmStale` through `publish()` and the four server actions (as `confirmSpoken` was in phase A)

- [ ] **Step 4: Run, commit**

```bash
git add src/lib/content/publish-flow.ts src/app/studio/publish.ts tests/content/publish-flow.test.ts
git commit -m "feat(studio): a Reel goes up as its edited take, asking first when the edit moved on"
```

---

### Task 11: หน้า admin — คีย์ Rendi/AWS และตัว render หลัก

**Files:**
- Modify: `src/app/admin/ai/actions.ts` (render key providers + settings actions)
- Modify: `src/app/admin/ai/AiClient.tsx` (a "ตัวตัดต่อวิดีโอ" section)
- Modify: `src/app/admin/ai/page.tsx` (load settings)
- Test: `tests/admin/video-settings-actions.test.ts`

**Interfaces:**
- Produces: `RENDER_PROVIDERS = ["rendi", "aws"] as const`; `saveRenderKey(provider: "rendi" | "aws", key: string): Promise<Result>` (AWS key must parse with `parseAwsKey`); `saveVideoEngine(s: VideoSettings): Promise<Result>`; `loadAiPage` also returns `video: { settings: VideoSettings; keys: { provider: "rendi" | "aws"; tail: string }[] }`

Rules: render providers are **not** added to the AI `PROVIDERS` list (the AI fallback chain and `checkKeys` must never see them); keys go through the same `ins_set_api_key` RPC and `requireStaff("admin")`; the AWS key's sanitizer keeps `:`; the section shows each key's last 4 characters only, the engine picker (Rendi / AWS Lambda), the fallback switch, and the Rendi time limit (60 = แพลนฟรี, 600 = Pro).

- [ ] **Steps**: failing tests (`saveRenderKey` refuses a malformed AWS key and an unknown provider; stores via RPC; `saveVideoEngine` refuses an unknown engine; non-admin refused) → implement → run → in the browser, `/admin/ai` shows the section and saving works → commit

```bash
git add src/app/admin/ai tests/admin/video-settings-actions.test.ts
git commit -m "feat(admin): render keys and the render engine on the AI page"
```

---

### Task 12: หน้าจอตัดต่อ

**Files:**
- Create: `src/app/studio/clip/ClipEditStudio.tsx` (the editor)
- Create: `src/app/studio/clip/EditPreview.tsx` (player + live overlays)
- Create: `src/app/api/content-video/[id]/proxy/route.ts` (GET → 302 to the proxy's signed link; same guards as `/api/content-video/[id]`)
- Modify: `src/app/studio/clip/ClipEditor.tsx` (ปุ่ม "ตัดต่อ", "คลิปที่ตัดต่อแล้ว" badge, player plays the edited take when there is one)
- Modify: `src/app/api/content-video/[id]/route.ts` (`?take=edited` serves `renderedPath`)
- Modify: `src/app/studio/PublishPanel.tsx`, `src/app/studio/calendar/CalendarBoard.tsx`, `src/app/studio/ContentStudio.tsx` (bulk) — `confirmStale` handling like `confirmSpoken`
- Test: `tests/content/clip-proxy-route.test.ts`

**Interfaces:**
- Consumes: Task 9 actions; `styleLook`, `STYLE_LABEL`; `keepRanges`, `subsOnOutput`, `keptDuration`; `CLIP_STYLES`, `MAX_HOOK_MAIN`, `MAX_HOOK_TOP`
- Produces: `<ClipEditStudio item onItem onClose />`

Behaviour:
- Opening calls `openEdit`; while a job runs (`edit.job`), poll `pollEdit` every 3 s (stop on unmount); show "กำลังเตรียมคลิป…" or "กำลังสร้างคลิป… ปิดหน้านี้ได้ งานจะทำต่อ".
- **EditPreview**: `<video>` from `/api/content-video/<id>/proxy?v=<proxyPath>`; on `timeupdate`, if the current source time is outside every kept range, jump to the next kept start (or pause at the end); overlays are absolutely positioned divs scaled from the 1080×1920 frame (`top: 230/1920`, `top: 1450/1920`) using `styleLook` values converted to CSS (font sizes scaled by the rendered width / 1080); the hook shows while the **output** time (via `mapTime`) is < 2.6; the sub whose **source** time range contains the current time shows.
- Controls: 4 style chips (`STYLE_LABEL`), hook inputs with counters (`MAX_HOOK_TOP`, `MAX_HOOK_MAIN`), the sentence list (checkbox keep/cut — AI-suggested cuts start struck through with `why`; time button seeks), editable subtitle lines grouped under their sentence, the silence switch, "เหลือ m:ss จาก m:ss" from `keptDuration`.
- Edits save with `saveEdit` debounced 800 ms; a refusal shows its message and reloads the item.
- "สร้างคลิป" → `renderEdit`; on success the player switches to `/api/content-video/<id>?take=edited&v=<renderedPath>`; "กลับไปใช้คลิปต้นฉบับ" → `useOriginal`; a "ยังไม่ได้สร้างใหม่" badge when `renderedRev !== rev`.
- Locked (read-only, no buttons) when `onPage(item.publish)`.
- Mobile 375 px: stacked; desktop: preview left, controls right; no sideways scroll; touch targets `min-h-11`.

- [ ] **Steps**: route test (proxy 302 / 404 / 400 / refusal, like `tests/content/clip-view-route.test.ts`) → implement → `npx tsc --noEmit`, `npx eslint src/app/studio src/app/api/content-video`, `npx vitest run` → commit

```bash
git add src/app/studio/clip src/app/api/content-video src/app/studio/PublishPanel.tsx src/app/studio/calendar/CalendarBoard.tsx src/app/studio/ContentStudio.tsx tests/content/clip-proxy-route.test.ts
git commit -m "feat(studio): the clip editor — live preview, four looks, hook, sentences, render"
```

---

### Task 13: ทดสอบกับของจริง (Rendi แพลนฟรี) — controller กับเจ้าของ

- [ ] **Step 1 (owner)**: สมัคร rendi.dev แพลนฟรี แล้วใส่ API key ที่ `/admin/ai` → ตัวตัดต่อวิดีโอ (ตัวหลัก Rendi, เวลา 60 วิ)
- [ ] **Step 2**: dev server → `/studio/write` → คลิป `bd5c725a…` (`C1369.MP4`) → ถอดเสียงอีกครั้ง (ให้ได้ cut/hook จาก Task 8) → ตัดต่อ → รอเตรียมคลิป → ปรับ hook/สไตล์ → สร้างคลิป
- [ ] **Step 3**: เทียบไฟล์ที่ได้กับตัวอย่างทำมือ (ความยาว ≈ 31.7 วิ, ซับตรงปาก, hook 2.6 วิ, 1080×1920, H.264/AAC) ด้วย `ffprobe` และดูภาพ 5 จุด
- [ ] **Step 4**: จดเวลาที่ Rendi ใช้ (`total_processing_seconds`, `ffmpeg_command_run_seconds`) — เกิน 60 วิ → บอกเจ้าของเรื่องแพลน Pro; ดูว่าไฟล์บน Rendi ถูกลบหลังเก็บ
- [ ] **Step 5**: เปิดหน้าตัดต่อบนมือถือ (375 px) — พรีวิวเล่นได้ ข้ามช่วงตัด ซับขึ้นตรงเวลา
- [ ] **Step 6**: `npm run verify` → merge/push ตามที่เจ้าของตัดสิน (migration Task 1 ขึ้นแล้ว)
