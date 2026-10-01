# คลิปที่ตัวแทนถ่ายเอง → Reel บนเพจ (เฟส A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ตัวแทนอัปโหลดคลิปแนวตั้งที่ถ่ายเอง (แนบเข้าชิ้นสคริปต์ หรือชิ้นใหม่ `clip`) → Gemini ถอดเสียงไทยพร้อมเวลาและร่างแคปชัน → ตรวจคำ → โพสต์/ตั้งเวลาเป็น Facebook Reel ผ่านทางลงเพจเดิมและปฏิทินเดิม

**Architecture:** ไฟล์ไปจากเบราว์เซอร์ถึง bucket `content-video` ตรงๆ (signed upload token + TUS) ไม่ผ่าน Vercel · ข้อมูลคลิปอยู่ใน `ins_content.output.video` (ไม่มีตารางใหม่) · `publish-flow` เดิมเลือก `postReel` แทน `postPhoto` เมื่อชิ้นมี video และอ่านผลตรวจของแคปชันจาก `video.flags` · รอบ `ai-clip` ผ่าน `takeRound`/`payRound` เดิม · cron รายวันเก็บกวาดไฟล์

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, Supabase Storage (service role), Facebook Graph API v23.0 Reels, Gemini API (generateContent + Files API), tus-js-client, vitest

**Spec:** `docs/superpowers/specs/2026-10-02-studio-reels-upload-design.md`

## Global Constraints

- ไฟล์: mp4/mov (`video/mp4`, `video/quicktime`) · 3–90 วินาที · แนวตั้ง (สูง > กว้าง) · ≤ 300MB (`314572800` ไบต์)
- bucket `content-video` private · path `<piece id>/<uuid>.<mp4|mov>` เท่านั้น
- ตั้งเวลา Reel: 15 นาที – **29 วัน** ข้างหน้า (`REEL_MAX_AHEAD_MS`); โพสต์รูปยัง 30 วัน
- ผลตรวจที่ `clear()` ใช้กับ Reel = `output.video.flags` (ของแคปชัน) ไม่ใช่ `item.flags`
- เสียงพูด: **เตือนเท่านั้น** ไม่บล็อก — ขอยืนยันผ่าน `confirmSpoken` เมื่อมีคำเตือนหรือยังไม่ได้ถอดเสียง; การย้ายเวลา (`moving`) ไม่ถามซ้ำ
- รอบ `ai-clip` hold ฿3; ล้มเหลว = ไม่คิดเงิน; ทีมงานไม่จ่าย; นับเป็นรอบฟรีเหมือนรอบอื่น
- ส่งคลิปให้ Gemini: ≤ 100MB (`104857600`) → signed URL ใน `fileData.fileUri`; ใหญ่กว่า → Files API
- ไฟล์อยู่จนลงแล้ว + 48 ชม. (`VERIFY_WINDOW_MS`); ร่างไม่เคยตั้งเวลา 60 วัน → ลบไฟล์ + `video.expired = true`; ไม่แตะ `scheduled`/`posting`
- แก้แคปชันได้เฉพาะชิ้นที่ยังไม่ได้ตั้งเวลา/ลงเพจ
- `Format` เดิม (`post|script|ad`) ไม่เปลี่ยน — ชนิดของแถวคือ `PieceFormat = Format | "clip"`
- Supabase project: `cenysylrzbwfrtuqoeqk` · migration `supabase/migrations/20261002_content_video.sql` · ต้องรันก่อน push (memory: production-rollout)
- เจ้าของต้องตั้ง Storage → Settings → global file size limit ≥ 300MB ใน Dashboard ก่อนทดสอบไฟล์ใหญ่
- ข้อความถึงผู้ใช้ภาษาไทย; comment ภาษาอังกฤษตามแบบไฟล์นั้น พร้อมวันที่ของเจ้าของเมื่อเป็นการตัดสินใจ
- คำสั่งตรวจ: `npx vitest run <file>` · `npx tsc --noEmit` · `npx eslint <files>` · `npm run verify` ก่อน merge

## Review Focus

1. ชิ้นสคริปต์ที่มีคำต้องห้ามในบท (block) แต่แนบคลิปที่แคปชันสะอาด → ต้องลงเป็น Reel ได้ (อ่าน `video.flags` ไม่ใช่ `item.flags`); กลับกัน แคปชันผิด block → ห้ามลงแม้บทสะอาด — Task 4 (tests `a Reel is judged by its caption`)
2. ลบไฟล์ใน bucket ไม่ได้ / signed URL สร้างไม่ได้ ตอนกดลงเพจ → ต้องเป็นความล้มเหลวธรรมดา ("ลองใหม่") ไม่ใช่ `POSSIBLY_POSTED` เพราะยังไม่มีอะไรถึง Facebook — Task 4 (test `no read link: a plain failure`)
3. Facebook ตอบ finish ไม่ชัด (HTTP 502 / ไม่มี `success`) → `unsure` → `POSSIBLY_POSTED`; แต่ล้มที่ขั้น start/upload → แน่ใจว่าไม่มีอะไรขึ้นเพจ — Task 2 (tests `before finish nothing is on the Page`)
4. Cron เก็บกวาดเจอชิ้นที่ `scheduled` แต่ `uploadedAt` เก่ากว่า 60 วัน (ตั้งเวลาไว้นาน) → ห้ามลบไฟล์ — Task 9 (test `never touches a held clip`)
5. แนบคลิปใหม่ทับชิ้นที่ตั้งเวลาไว้แล้ว หรือส่ง `path` ของชิ้นอื่นมาใน `finishClipUpload` → ปฏิเสธ ไม่เขียนทับ — Task 5 (tests `refuses a held piece`, `refuses another piece's path`)

---

### Task 1: ชนิดข้อมูล, migration และกติกาไฟล์คลิป

**Files:**
- Create: `supabase/migrations/20261002_content_video.sql`
- Create: `src/lib/content/clip.ts`
- Modify: `src/lib/content/prompt.ts:16-19` (`PieceFormat`, `FORMAT_LABEL`, `FORMAT_SHORT`)
- Modify: `src/lib/content/output.ts` (`ContentOutput.video`)
- Modify: `src/lib/content/store.ts` (`ContentItem.format`, `toItem`, `saveContent`)
- Modify: `src/lib/content/modes.ts` (ชื่อโหมด "คลิป")
- Test: `tests/content/clip.test.ts`

**Interfaces:**
- Produces (from `src/lib/content/clip.ts`):
  - `CLIP_BUCKET = "content-video"`, `CLIP_HREF = "clip"`, `CLIP_NAME = "คลิป"`, `CLIP_MAX_BYTES`, `CLIP_MIN_SEC = 3`, `CLIP_MAX_SEC = 90`, `CLIP_DRAFT_DAYS = 60`, `MAX_CLIP_BRIEF = 300`, `MAX_CAPTION = 2200`
  - `interface ClipFile { sizeBytes: number; durationSec: number; width: number; height: number; mime: string }`
  - `interface Segment { start: number; end: number; text: string }`
  - `interface SpokenFlag { at: number; kind: "word" | "number" | "policy"; text: string; message: string }`
  - `interface ClipVideo { path; expired?; durationSec; width; height; sizeBytes; mime; uploadedAt; brief?; transcript?: Segment[]; transcribeFailed?: boolean; caption: string; flags: Flags; spokenFlags?: SpokenFlag[] }`
  - `clipProblem(f: ClipFile): string | null`
  - `clipPath(pieceId: string, mime: string): string`, `isClipPath(pieceId: string, path: string): boolean`
  - `NO_FLAGS: Flags`, `clipOutput(disclaimer?: string): ContentOutput`
  - `reelDescription(o: ContentOutput): string`
  - `spokenNotes(v: ClipVideo): string[]`, `clockOf(sec: number): string`
  - `isReelPiece(item: { format: PieceFormat; output: ContentOutput }): boolean`
- Produces (prompt.ts): `type PieceFormat = Format | "clip"`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261002_content_video.sql`:

```sql
-- Clips agents filmed themselves, posted to their Page as Reels (owner, 2026-10-02).
-- A clip piece is format 'clip'; a script piece may carry a clip too. Either way the clip
-- lives in output.video — no table of its own.
alter table public.ins_content drop constraint if exists ins_content_format_check;
alter table public.ins_content add constraint ins_content_format_check
  check (format in ('post', 'script', 'ad', 'clip'));

-- Private: the browser uploads with a signed upload token the server hands out (TUS,
-- x-signature); Facebook and Gemini read through short signed URLs. Files are
-- "<piece id>/<file id>.<mp4|mov>", the only shape src/lib/content/clip.ts accepts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-video', 'content-video', false, 314572800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
```

- [ ] **Step 2: Write the failing tests**

`tests/content/clip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clipPath, clipProblem, clockOf, isClipPath, isReelPiece, reelDescription, spokenNotes, clipOutput, NO_FLAGS, type ClipVideo,
} from "@/lib/content/clip";

const ok = { sizeBytes: 20_000_000, durationSec: 45, width: 1080, height: 1920, mime: "video/mp4" };
const video = (over: Partial<ClipVideo> = {}): ClipVideo => ({
  path: "p/x.mp4", durationSec: 45, width: 1080, height: 1920, sizeBytes: 1, mime: "video/mp4",
  uploadedAt: "2026-10-02T00:00:00Z", caption: "แคปชัน", flags: NO_FLAGS, transcript: [], ...over,
});

describe("clipProblem", () => {
  it("passes a vertical mp4 or mov within 3–90 seconds and 300MB", () => {
    expect(clipProblem(ok)).toBeNull();
    expect(clipProblem({ ...ok, mime: "video/quicktime" })).toBeNull();
    expect(clipProblem({ ...ok, durationSec: 90.3 })).toBeNull();
  });
  it("names what is wrong, in Thai, before anything is uploaded", () => {
    expect(clipProblem({ ...ok, mime: "video/webm" })).toContain(".mp4");
    expect(clipProblem({ ...ok, sizeBytes: 314572801 })).toContain("300MB");
    expect(clipProblem({ ...ok, durationSec: 2 })).toContain("3 วินาที");
    expect(clipProblem({ ...ok, durationSec: 91 })).toContain("90 วินาที");
    expect(clipProblem({ ...ok, width: 1920, height: 1080 })).toContain("แนวตั้ง");
    expect(clipProblem({ ...ok, durationSec: Number.NaN })).not.toBeNull();
    expect(clipProblem({ ...ok, sizeBytes: 0 })).not.toBeNull();
  });
});

describe("clip paths", () => {
  it("files a clip under its own piece and nowhere else", () => {
    const p = clipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", "video/quicktime");
    expect(p).toMatch(/^0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f\/[0-9a-f-]{36}\.mov$/);
    expect(isClipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", p)).toBe(true);
    expect(isClipPath("other", p)).toBe(false);
    expect(isClipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/../x.mp4")).toBe(false);
  });
});

describe("reelDescription", () => {
  it("is the caption with the footer every post carries", () => {
    const text = reelDescription({ ...clipOutput(""), video: video({ caption: "ลดหย่อนภาษีได้" }) });
    expect(text.startsWith("ลดหย่อนภาษีได้")).toBe(true);
    // footer() adds the insurer line always, and the tax line when the words speak of tax
    expect(text.split("\n\n").length).toBeGreaterThan(1);
  });
});

describe("spokenNotes", () => {
  it("asks about a clip nobody has listened to", () => {
    expect(spokenNotes(video({ transcript: undefined }))).toEqual(["ยังไม่ได้ตรวจเสียงพูดในคลิป"]);
  });
  it("lists each warning at its second, and nothing when it is clean", () => {
    expect(spokenNotes(video({ spokenFlags: [{ at: 42.4, kind: "word", text: "การันตี", message: "ได้ยินว่า “การันตี”" }] })))
      .toEqual(["0:42 ได้ยินว่า “การันตี”"]);
    expect(spokenNotes(video())).toEqual([]);
  });
  it("reads seconds as m:ss", () => {
    expect(clockOf(0)).toBe("0:00");
    expect(clockOf(65.9)).toBe("1:05");
  });
});

describe("isReelPiece", () => {
  it("is a clip piece, or any piece that carries a clip", () => {
    expect(isReelPiece({ format: "clip", output: clipOutput("") })).toBe(true);
    expect(isReelPiece({ format: "script", output: { ...clipOutput(""), video: video() } })).toBe(true);
    expect(isReelPiece({ format: "post", output: clipOutput("") })).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/content/clip.test.ts`
Expected: FAIL — `Cannot find module '@/lib/content/clip'`

- [ ] **Step 4: Add `PieceFormat` and the labels**

`src/lib/content/prompt.ts` lines 16–19 become:

```ts
export type Format = "post" | "script" | "ad";
/**
 * What a row in ins_content is: a format the writer writes, or a clip an agent filmed (owner,
 * 2026-10-02). The writer's prompts never see "clip" — nothing writes one.
 */
export type PieceFormat = Format | "clip";

export const FORMAT_LABEL: Record<PieceFormat, string> = { post: "โพสต์เฟซบุ๊ก", script: "สคริปต์วิดีโอ", ad: "โฆษณา", clip: "คลิป Reel" };
export const FORMAT_SHORT: Record<PieceFormat, string> = { post: "โพสต์", script: "สคริปต์", ad: "โฆษณา", clip: "คลิป" };
```

(keep any line that was between 16 and 19 that is not one of these three — read the file first.)

- [ ] **Step 5: Add `video` to `ContentOutput`**

`src/lib/content/output.ts`: add `import type { ClipVideo } from "./clip";` at the top, and inside `interface ContentOutput` after `rev?: string;`:

```ts
  /**
   * The clip an agent filmed for this piece — a clip piece's whole point, or a script's once
   * it was filmed (owner, 2026-10-02). A piece that has one goes to the Page as a Reel.
   */
  video?: ClipVideo;
```

- [ ] **Step 6: Write `src/lib/content/clip.ts`**

```ts
import type { ContentOutput } from "./output";
import { footer } from "./output";
import type { PieceFormat } from "./prompt";
import type { Flags } from "./store";

/**
 * A clip an agent filmed and uploads to post as a Reel (owner, 2026-10-02): the rules a file
 * must meet, where it is filed, and what goes to Facebook with it. No I/O here — the browser
 * checks a file with the same clipProblem the server checks it with again.
 */

export const CLIP_BUCKET = "content-video";
/** the plan_href of a clip uploaded on its own, and the name the workbench shows for it */
export const CLIP_HREF = "clip";
export const CLIP_NAME = "คลิป";
/** 300MB: a 90-second phone clip at 1080p is 15–30MB; 4K runs to hundreds (owner chose 300, 2026-10-02) */
export const CLIP_MAX_BYTES = 300 * 1024 * 1024;
/** Reels take 3 to 90 seconds (Facebook's Reels publishing guide) */
export const CLIP_MIN_SEC = 3;
export const CLIP_MAX_SEC = 90;
/** a clip never scheduled keeps its file this long; then the sweep lets it go (owner, 2026-10-02) */
export const CLIP_DRAFT_DAYS = 60;
export const MAX_CLIP_BRIEF = 300;
export const MAX_CAPTION = 2200;

const EXT: Record<string, "mp4" | "mov"> = { "video/mp4": "mp4", "video/quicktime": "mov" };
export const CLIP_MIMES = Object.keys(EXT);

export interface ClipFile {
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  mime: string;
}

/** a stretch of speech, in seconds from the start of the clip */
export interface Segment {
  start: number;
  end: number;
  text: string;
}

/** something said in the clip the checks would flag in a post — said, never blocked (owner, 2026-10-02) */
export interface SpokenFlag {
  at: number;
  kind: "word" | "number" | "policy";
  text: string;
  message: string;
}

export interface ClipVideo {
  /** "<piece id>/<file id>.<ext>" in content-video */
  path: string;
  /** the sweep removed the file; the caption and the transcript stay */
  expired?: boolean;
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  mime: string;
  uploadedAt: string;
  /** what the agent said the clip is about, for a clip uploaded on its own */
  brief?: string;
  /** absent: not transcribed yet, or the last try failed (transcribeFailed) */
  transcript?: Segment[];
  transcribeFailed?: boolean;
  /** the Reel's words; the agent edits them */
  caption: string;
  /** the caption's checks — what clear() reads for a Reel, never item.flags (a script's own) */
  flags: Flags;
  spokenFlags?: SpokenFlag[];
}

/** Why a file cannot be a Reel, in the agent's words; null when it can. */
export function clipProblem(f: ClipFile): string | null {
  if (!EXT[f.mime]) return "รับเฉพาะไฟล์ .mp4 หรือ .mov";
  if (!(f.sizeBytes > 0)) return "ไฟล์ว่าง — เลือกไฟล์ใหม่นะครับ";
  if (f.sizeBytes > CLIP_MAX_BYTES) return "ไฟล์ใหญ่เกิน 300MB — ตั้งกล้องถ่ายที่ 1080p แทน 4K แล้วลองใหม่";
  if (!Number.isFinite(f.durationSec) || f.durationSec <= 0) return "อ่านความยาวคลิปไม่ได้ — ลองบันทึกคลิปใหม่จากแอปกล้อง";
  if (f.durationSec < CLIP_MIN_SEC) return "คลิปสั้นเกินไป — Reel ต้องยาวอย่างน้อย 3 วินาที";
  // a phone's 90-second clip reads 90.3 now and then; Facebook counts whole seconds
  if (f.durationSec > CLIP_MAX_SEC + 0.5) return "คลิปยาวเกิน 90 วินาที — ตัดให้สั้นลงก่อนแล้วอัปโหลดใหม่";
  if (!(f.width > 0 && f.height > 0)) return "อ่านขนาดภาพของคลิปไม่ได้ — ลองบันทึกคลิปใหม่จากแอปกล้อง";
  if (f.height <= f.width) return "คลิปต้องเป็นแนวตั้ง (9:16) — Reel ไม่รับคลิปแนวนอน";
  return null;
}

export function clipPath(pieceId: string, mime: string): string {
  return `${pieceId}/${crypto.randomUUID()}.${EXT[mime] ?? "mp4"}`;
}

/** only a file filed under this piece, in the shape clipPath makes */
export function isClipPath(pieceId: string, path: string): boolean {
  const [dir, file, ...rest] = path.split("/");
  return rest.length === 0 && dir === pieceId && /^[0-9a-f-]{36}\.(mp4|mov)$/.test(file ?? "");
}

export const NO_FLAGS: Flags = { numbers: [], words: [], policy: [], fixes: null };

/** a clip piece's output: no words of the writer's, only the clip and its caption */
export function clipOutput(disclaimer = ""): ContentOutput {
  return { hooks: [], body: "", closing: "", hashtags: [], imagePrompt: "", disclaimer };
}

/** What goes up with the Reel: the caption, then the footer every post carries (output.ts). */
export function reelDescription(o: ContentOutput): string {
  const caption = (o.video?.caption ?? "").trim();
  return [caption, footer({ hooks: [], body: caption, closing: "", disclaimer: o.disclaimer ?? "" })].filter(Boolean).join("\n\n");
}

export function clockOf(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What the agent confirms before a Reel goes: each thing said that a post would be flagged for, or that nobody has listened. */
export function spokenNotes(v: ClipVideo): string[] {
  if (!v.transcript) return ["ยังไม่ได้ตรวจเสียงพูดในคลิป"];
  return (v.spokenFlags ?? []).map((f) => `${clockOf(f.at)} ${f.message}`);
}

export function isReelPiece(item: { format: PieceFormat; output: ContentOutput }): boolean {
  return item.format === "clip" || Boolean(item.output.video);
}
```

- [ ] **Step 7: Type the row as `PieceFormat`**

`src/lib/content/store.ts`:
- import: `import type { AngleId, Format, Length, PieceFormat } from "./prompt";`
- `ContentItem.format: Format;` → `format: PieceFormat;`
- `toItem`: `format: r.format as Format,` → `format: r.format as PieceFormat,`
- `saveContent` row type: `format: Format;` → `format: PieceFormat;`

`src/lib/content/modes.ts`: add `import { CLIP_HREF, CLIP_NAME } from "./clip";` and append `{ href: CLIP_HREF, name: CLIP_NAME },` to `MODE_PLANS`.

- [ ] **Step 8: Run tests and the type check**

Run: `npx vitest run tests/content/clip.test.ts` → PASS
Run: `npx tsc --noEmit`
Expected: errors only where code narrows `item.format` to `Format` (e.g. a `Record<Format, …>` indexed by `item.format`, or `FormatPicker` handed `item.format`). For each: if the code path can never see a clip (a writer's prompt, a form's own format state) cast with `as Format` after an explicit `item.format !== "clip"` guard; if it shows a piece (cards, labels), widen the record to `PieceFormat`. Re-run until clean. Do not change `Format` itself.

- [ ] **Step 9: Apply the migration to the database**

Use the Supabase MCP `apply_migration` on project `cenysylrzbwfrtuqoeqk`, name `content_video`, with the SQL from Step 1. Then confirm:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'content-video';
select pg_get_constraintdef(oid) from pg_constraint where conname = 'ins_content_format_check';
```
Expected: one bucket row, private, 314572800; constraint lists `'clip'`.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261002_content_video.sql src/lib/content/clip.ts src/lib/content/prompt.ts src/lib/content/output.ts src/lib/content/store.ts src/lib/content/modes.ts tests/content/clip.test.ts
git add -u src
git commit -m "feat(studio): clip pieces — format, bucket and the rules a Reel file meets"
```

---

### Task 2: Facebook Reels — `postReel`, `reelState`, `reelLink`

**Files:**
- Modify: `src/lib/facebook/publish.ts`
- Test: `tests/content/reel.test.ts`

**Interfaces:**
- Consumes: `explain`, `PublishError`, `Posted`, `GRAPH` (same file)
- Produces:
  - `REEL_MAX_AHEAD_MS = 29 * 24 * 60 * 60_000`
  - `postReel(opts: { pageId: string; token: string; fileUrl: string; caption: string; at?: Date }): Promise<Posted>` — `Posted.id` = the `video_id`
  - `type ReelState = "published" | "failed" | "unknown"`; `reelState(videoId: string, token: string): Promise<ReelState>`
  - `reelLink(videoId: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/content/reel.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { postReel, reelLink, reelState, PublishError } from "@/lib/facebook/publish";

/** Graph and rupload as a script of answers, in call order; every request is kept to look at. */
function graph(answers: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 500, body: {} };
    return new Response(typeof a.body === "string" ? a.body : JSON.stringify(a.body), { status: a.status ?? 200 });
  }));
  return calls;
}
const form = (init: RequestInit) => Object.fromEntries((init.body as FormData).entries());
afterEach(() => vi.unstubAllGlobals());

const opts = { pageId: "105", token: "t", fileUrl: "https://x.supabase.co/storage/v1/object/sign/content-video/a/b.mp4?token=s", caption: "แคปชัน" };

describe("postReel", () => {
  it("starts, hands Facebook the file's link, and finishes as published", async () => {
    const calls = graph([{ body: { video_id: "v1", upload_url: "u" } }, { body: { success: true } }, { body: { success: true } }]);
    expect(await postReel(opts)).toEqual({ id: "v1" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v23.0/105/video_reels");
    expect(form(calls[0].init)).toMatchObject({ upload_phase: "start" });
    expect(calls[1].url).toBe("https://rupload.facebook.com/video-upload/v23.0/v1");
    expect(calls[1].init.headers).toMatchObject({ Authorization: "OAuth t", file_url: opts.fileUrl });
    expect(form(calls[2].init)).toMatchObject({ upload_phase: "finish", video_id: "v1", video_state: "PUBLISHED", description: "แคปชัน" });
  });

  it("holds it for a time as SCHEDULED, in Unix seconds", async () => {
    const calls = graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { body: { success: true } }]);
    const at = new Date("2026-10-03T12:30:00Z");
    await postReel({ ...opts, at });
    expect(form(calls[2].init)).toMatchObject({ video_state: "SCHEDULED", scheduled_publish_time: String(at.getTime() / 1000) });
  });

  it("before finish nothing is on the Page: a refusal there is sure, whatever came back", async () => {
    graph([{ status: 400, body: { error: { code: 100, message: "bad" } } }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
    graph([{ body: { video_id: "v1" } }, { status: 502, body: "<html>bad gateway</html>" }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
    graph([{ body: {} }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false });
  });

  it("a finish Graph explained is sure; one it did not answer is not", async () => {
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { status: 400, body: { error: { code: 368, message: "blocked" } } }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: false, code: 368 });
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { status: 502, body: "<html/>" }]);
    await expect(postReel(opts)).rejects.toMatchObject({ unsure: true });
    graph([{ body: { video_id: "v1" } }, { body: { success: true } }, { body: {} }]);
    await expect(postReel(opts)).rejects.toBeInstanceOf(PublishError);
  });
});

describe("reelState", () => {
  it("reads published, a failure, and anything still on its way", async () => {
    graph([{ body: { status: { video_status: "ready", publishing_phase: { status: "complete", publish_status: "published" } } } }]);
    expect(await reelState("v1", "t")).toBe("published");
    graph([{ body: { status: { video_status: "error" } } }]);
    expect(await reelState("v1", "t")).toBe("failed");
    graph([{ body: { status: { video_status: "ready", processing_phase: { status: "error" } } } }]);
    expect(await reelState("v1", "t")).toBe("failed");
    graph([{ body: { status: { video_status: "processing", publishing_phase: { publish_status: "scheduled" } } } }]);
    expect(await reelState("v1", "t")).toBe("unknown");
  });
  it("throws on a Graph error — not evidence of anything", async () => {
    graph([{ status: 400, body: { error: { code: 190, message: "expired" } } }]);
    await expect(reelState("v1", "t")).rejects.toBeInstanceOf(PublishError);
  });
});

it("links a Reel by its video id", () => {
  expect(reelLink("v1")).toBe("https://www.facebook.com/reel/v1");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/reel.test.ts`
Expected: FAIL — `postReel is not a function`

- [ ] **Step 3: Implement in `src/lib/facebook/publish.ts`**

Update the file's header comment's first line to "Putting a picture post or a Reel on a Page…". After `MAX_AHEAD_MS` add:

```ts
/** Reels take a schedule up to 29 days ahead (Reels publishing guide, checked 2026-10-02) */
export const REEL_MAX_AHEAD_MS = 29 * 24 * 60 * 60_000;
const RUPLOAD = "https://rupload.facebook.com/video-upload/v23.0";
```

After `postPhoto` add:

```ts
/**
 * A clip as a Reel (owner, 2026-10-02): start, hand Facebook the file's link to fetch, finish.
 * The bytes never pass through here — a 300MB clip would not fit a function's request, and the
 * link is a short signed one Facebook fetches once.
 *
 * Nothing is on the Page until finish is answered, so every failure before it is sure; a finish
 * Graph did not answer (a gateway's page, no `success`) may have gone up, and is unsure.
 */
export async function postReel(opts: { pageId: string; token: string; fileUrl: string; caption: string; at?: Date }): Promise<Posted> {
  const endpoint = `${GRAPH}/${encodeURIComponent(opts.pageId)}/video_reels`;
  const auth = { Authorization: `Bearer ${opts.token}` };

  const startForm = new FormData();
  startForm.append("upload_phase", "start");
  const started = await fetch(endpoint, { method: "POST", headers: auth, body: startForm, signal: AbortSignal.timeout(30_000) });
  const start = await started.json().catch(() => ({})) as GraphError & { video_id?: string };
  if (start.error) throw explain(start, started.status);
  if (!started.ok || !start.video_id) throw new PublishError("Facebook ไม่รับการอัปโหลดคลิป ลองใหม่อีกครั้งนะครับ");
  const videoId = start.video_id;

  // Facebook fetches the file itself; a 300MB clip may take minutes
  const sent = await fetch(`${RUPLOAD}/${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${opts.token}`, file_url: opts.fileUrl },
    signal: AbortSignal.timeout(300_000),
  });
  const upload = await sent.json().catch(() => ({})) as GraphError & { success?: boolean };
  if (upload.error) throw explain(upload, sent.status);
  if (!sent.ok || upload.success !== true) throw new PublishError("Facebook ดึงไฟล์คลิปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");

  const finishForm = new FormData();
  finishForm.append("upload_phase", "finish");
  finishForm.append("video_id", videoId);
  finishForm.append("description", opts.caption);
  if (opts.at) {
    finishForm.append("video_state", "SCHEDULED");
    finishForm.append("scheduled_publish_time", String(Math.floor(opts.at.getTime() / 1000)));
  } else {
    finishForm.append("video_state", "PUBLISHED");
  }
  const finished = await fetch(endpoint, { method: "POST", headers: auth, body: finishForm, signal: AbortSignal.timeout(60_000) });
  const finish = await finished.json().catch(() => ({})) as GraphError & { success?: boolean };
  if (finish.error) throw explain(finish, finished.status);
  if (!finished.ok || finish.success !== true) {
    throw new PublishError("Facebook ตอบกลับไม่ชัดว่ารับคลิปแล้วหรือยัง ลองเช็กในเพจก่อนกดใหม่", undefined, true);
  }
  return { id: videoId };
}

/** Where a Reel can be seen. */
export function reelLink(videoId: string): string {
  return `https://www.facebook.com/reel/${encodeURIComponent(videoId)}`;
}

/** What Facebook says of a Reel: up, failed in its processing, or not decided yet. */
export type ReelState = "published" | "failed" | "unknown";

interface ReelStatus {
  status?: {
    video_status?: string;
    processing_phase?: { status?: string };
    publishing_phase?: { status?: string; publish_status?: string };
  };
}

/**
 * A Reel's state from its video node. "failed" only when Facebook says the video errored —
 * then it will never go up; a Reel still processing, or held for later, is "unknown". Graph
 * errors throw, as postState's do.
 */
export async function reelState(videoId: string, token: string): Promise<ReelState> {
  const { status } = await graphGet<ReelStatus>(videoId, "status", token);
  if (!status) return "unknown";
  if (status.video_status === "error" || status.video_status === "upload_failed"
    || status.processing_phase?.status === "error" || status.publishing_phase?.status === "error"
    || status.publishing_phase?.publish_status === "error") return "failed";
  if (status.publishing_phase?.publish_status === "published") return "published";
  return "unknown";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/content/reel.test.ts tests/content/post-state.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/facebook/publish.ts tests/content/reel.test.ts
git commit -m "feat(facebook): post a clip as a Reel, read its state"
```

---

### Task 3: ที่เก็บไฟล์คลิป — `clip-store.ts`

**Files:**
- Create: `src/lib/content/clip-store.ts`
- Modify: `src/lib/content/store.ts` (`deleteContent` removes the piece's clips too)
- Test: `tests/content/clip-store.test.ts`

**Interfaces:**
- Consumes: `CLIP_BUCKET`, `isClipPath` (Task 1), `supabaseAdmin`
- Produces:
  - `createClipUpload(path: string): Promise<{ token: string }>`
  - `clipSize(path: string): Promise<number | null>`
  - `clipReadUrl(path: string, seconds: number): Promise<string>`
  - `removeClip(path: string): Promise<void>` (best effort, logs)
  - `removeClipsOf(pieceId: string): Promise<void>` (throws on failure — used by deleteContent)

- [ ] **Step 1: Write the failing tests**

`tests/content/clip-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(), createSignedUrl: vi.fn(), list: vi.fn(), remove: vi.fn(),
}));
const from = vi.hoisted(() => vi.fn(() => bucket));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ storage: { from } }) }));

const { clipReadUrl, clipSize, createClipUpload, removeClip, removeClipsOf } = await import("@/lib/content/clip-store");
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const PATH = `${PIECE}/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4`;

beforeEach(() => vi.clearAllMocks());

describe("clip-store", () => {
  it("hands out an upload token for a clip path only", async () => {
    bucket.createSignedUploadUrl.mockResolvedValue({ data: { token: "tok", path: PATH, signedUrl: "u" }, error: null });
    expect(await createClipUpload(PATH)).toEqual({ token: "tok" });
    expect(from).toHaveBeenCalledWith("content-video");
    await expect(createClipUpload("x/../y.mp4")).rejects.toThrow();
  });

  it("reads a file's size from its folder listing; a missing file is null", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", metadata: { size: 1234 } }], error: null });
    expect(await clipSize(PATH)).toBe(1234);
    expect(bucket.list).toHaveBeenCalledWith(PIECE, { search: "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4" });
    bucket.list.mockResolvedValue({ data: [], error: null });
    expect(await clipSize(PATH)).toBeNull();
  });

  it("signs a read link for the asked seconds, and throws when it cannot", async () => {
    bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://s" }, error: null });
    expect(await clipReadUrl(PATH, 3600)).toBe("https://s");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(PATH, 3600);
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(clipReadUrl(PATH, 60)).rejects.toThrow();
  });

  it("removing one file never throws; removing a piece's clips does when storage refuses", async () => {
    bucket.remove.mockResolvedValue({ error: { message: "down" } });
    await expect(removeClip(PATH)).resolves.toBeUndefined();
    bucket.list.mockResolvedValue({ data: [{ name: "a.mp4" }], error: null });
    await expect(removeClipsOf(PIECE)).rejects.toThrow();
    bucket.list.mockResolvedValue({ data: [], error: null });
    await expect(removeClipsOf(PIECE)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/clip-store.test.ts` → FAIL (module missing)

- [ ] **Step 3: Implement `src/lib/content/clip-store.ts`**

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET, isClipPath } from "./clip";

/**
 * The clips in content-video (owner, 2026-10-02). Private: the browser writes with a one-off
 * upload token, Facebook and Gemini read through short signed links, nothing else reads it.
 */

const bucket = () => supabaseAdmin().storage.from(CLIP_BUCKET);
const pieceOf = (path: string) => path.split("/")[0] ?? "";

/** A token the browser uploads one file with (TUS, x-signature); good for two hours. */
export async function createClipUpload(path: string): Promise<{ token: string }> {
  if (!isClipPath(pieceOf(path), path)) throw new Error(`not a clip path: ${path}`);
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error || !data?.token) throw new Error(`เตรียมอัปโหลดไม่สำเร็จ: ${error?.message ?? "no token"}`);
  return { token: data.token };
}

/** The stored file's size, or null when there is no such file. */
export async function clipSize(path: string): Promise<number | null> {
  const [dir, name] = path.split("/");
  const { data, error } = await bucket().list(dir, { search: name });
  if (error) throw new Error(error.message);
  const file = (data ?? []).find((f) => f.name === name);
  const size = (file?.metadata as { size?: number } | undefined)?.size;
  return file && typeof size === "number" ? size : null;
}

export async function clipReadUrl(path: string, seconds: number): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`เปิดไฟล์คลิปไม่ได้: ${error?.message ?? "no link"}`);
  return data.signedUrl;
}

/** A clip nobody needs any more. Best effort: a leftover file is the sweep's to find. */
export async function removeClip(path: string): Promise<void> {
  try {
    const { error } = await bucket().remove([path]);
    if (error) console.error("clip not removed:", error.message);
  } catch (e) {
    console.error("clip not removed:", e);
  }
}

/** Every clip filed under a piece, for a piece deleted for good. */
export async function removeClipsOf(pieceId: string): Promise<void> {
  const { data, error } = await bucket().list(pieceId);
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const { error: gone } = await bucket().remove(data.map((f) => `${pieceId}/${f.name}`));
  if (gone) throw new Error(`ลบคลิปไม่สำเร็จ: ${gone.message}`);
}
```

- [ ] **Step 4: `deleteContent` removes the clips too**

In `src/lib/content/store.ts`, import `import { removeClipsOf } from "./clip-store";` and in `deleteContent`, after the `content-media` removal block and before deleting the row:

```ts
  await removeClipsOf(id);
```

Run: `npx vitest run tests/content/clip-store.test.ts tests/content/store.test.ts` → PASS (if `store.test.ts` mocks `supabaseAdmin().storage.from` per bucket, give `content-video` an empty `list`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/clip-store.ts src/lib/content/store.ts tests/content/clip-store.test.ts tests/content/store.test.ts
git commit -m "feat(studio): content-video storage — upload tokens, read links, removal"
```

---

### Task 4: ลงเพจเป็น Reel ผ่าน `publish-flow` เดิม

**Files:**
- Modify: `src/lib/content/publish-flow.ts` (`PublishResult`, `clear`, `send`, `publish`, `verifyDue`, new `REEL_FAILED`, `CLIP_EXPIRED`)
- Modify: `src/app/studio/publish.ts` (thread `confirmSpoken` through `publishPiece`, `scheduleOnDay`, `scheduleNextOpen`, `scheduleAt`)
- Test: `tests/content/publish-flow.test.ts` (new `describe` blocks; `fb` mock gains `postReel`, `reelState`; new mock for clip-store)

**Interfaces:**
- Consumes: `postReel`, `reelState`, `REEL_MAX_AHEAD_MS` (Task 2); `clipReadUrl` (Task 3); `reelDescription`, `spokenNotes` (Task 1)
- Produces:
  - `PublishResult` failure gains `confirmSpoken?: string[]`
  - `clear(input: { …; confirmSpoken?: boolean })`, `publish(input: { …; confirmSpoken?: boolean })`
  - `REEL_FAILED = "Facebook ประมวลผลคลิปไม่ผ่าน — แนบไฟล์ใหม่แล้วลงอีกครั้ง"`, `CLIP_EXPIRED = "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อนลงเพจ"`
  - server actions `publishPiece`, `scheduleOnDay`, `scheduleNextOpen`, `scheduleAt` accept `confirmSpoken?: boolean`

- [ ] **Step 1: Write the failing tests**

In `tests/content/publish-flow.test.ts`:
- change the `fb` hoisted mock to `{ postPhoto: vi.fn(), postReel: vi.fn(), deletePost: vi.fn(), postState: vi.fn(), reelState: vi.fn() }`
- add before the dynamic import: `const clips = vi.hoisted(() => ({ clipReadUrl: vi.fn() })); vi.mock("@/lib/content/clip-store", () => clips);`
- import `REEL_FAILED, CLIP_EXPIRED` along with the others from publish-flow
- in `beforeEach` add: `fb.postReel.mockImplementation(async () => ({ id: `v${n++}` })); clips.clipReadUrl.mockResolvedValue("https://signed");`

Append:

```ts
describe("a Reel", () => {
  const clean = { numbers: [], words: [], policy: [], fixes: null };
  const video = (over: Partial<NonNullable<ContentOutput["video"]>> = {}): NonNullable<ContentOutput["video"]> => ({
    path: "p1/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", durationSec: 40, width: 1080, height: 1920, sizeBytes: 9, mime: "video/mp4",
    uploadedAt: "2026-10-02T00:00:00Z", caption: "แคปชัน", flags: clean, transcript: [], ...over,
  });
  const reel = (v = video(), format: ContentItem["format"] = "clip", flags = clean) =>
    ({ ...piece(null, { ...output, hooks: [], body: "", video: v }), format, flags });

  it("goes up through postReel with the caption and no poster drawn", async () => {
    row = reel();
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(fb.postReel).toHaveBeenCalledWith(expect.objectContaining({ pageId: PAGE, fileUrl: "https://signed" }));
    expect((fb.postReel.mock.calls[0][0] as { caption: string }).caption.startsWith("แคปชัน")).toBe(true);
    expect(fb.postPhoto).not.toHaveBeenCalled();
    expect(drawPoster).not.toHaveBeenCalled();
    expect(row.publish).toMatchObject({ state: "published", postId: "v100" });
  });

  it("a Reel is judged by its caption: a script's blocked words do not stop it, a blocked caption does", async () => {
    const block = { numbers: [], words: [], policy: [{ code: "x", severity: "block" as const, message: "ผิด", fix: "", match: "" }], fixes: null };
    row = reel(video(), "script", block);
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    row = reel(video({ flags: block }), "script", clean);
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(false);
  });

  it("asks about what was said, once, and lets it go when confirmed", async () => {
    row = reel(video({ spokenFlags: [{ at: 42, kind: "word", text: "การันตี", message: "ได้ยินว่า “การันตี”" }] }));
    const asked = await publish({ id: "p1", pageId: PAGE, at: null });
    expect(asked).toMatchObject({ ok: false, confirmSpoken: ["0:42 ได้ยินว่า “การันตี”"] });
    expect(fb.postReel).not.toHaveBeenCalled();
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).ok).toBe(true);
  });

  it("asks too when nobody has listened to it", async () => {
    row = reel(video({ transcript: undefined }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ confirmSpoken: ["ยังไม่ได้ตรวจเสียงพูดในคลิป"] });
  });

  it("refuses an expired file, and a script with no clip", async () => {
    row = reel(video({ expired: true }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: CLIP_EXPIRED });
    row = { ...piece(), format: "script" };
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(false);
  });

  it("holds up to 29 days, not 30", async () => {
    row = reel();
    expect((await publish({ id: "p1", pageId: PAGE, at: hoursAhead(24 * 29.5).toISOString() })).ok).toBe(false);
    expect((await publish({ id: "p1", pageId: PAGE, at: hoursAhead(24 * 28).toISOString() })).ok).toBe(true);
  });

  it("no read link: a plain failure, nothing sent, not 'may be on the Page'", async () => {
    row = reel();
    clips.clipReadUrl.mockRejectedValue(new Error("storage down"));
    const r = await publish({ id: "p1", pageId: PAGE, at: null });
    expect(r).toMatchObject({ ok: false });
    expect(r).not.toHaveProperty("confirmRepost");
    expect(fb.postReel).not.toHaveBeenCalled();
    expect(row.publish?.state).toBe("failed");
  });

  it("a move re-sends the file and does not ask about what was said again", async () => {
    row = reel(video({ spokenFlags: [{ at: 1, kind: "word", text: "x", message: "m" }] }));
    row = { ...row, publish: pub({ state: "scheduled", postId: "v9", at: hoursAhead(5).toISOString() }) };
    expect((await move("p1", hoursAhead(30))).ok).toBe(true);
    expect(fb.deletePost).toHaveBeenCalledWith("v9", "token");
    expect(fb.postReel).toHaveBeenCalledTimes(1);
  });

  it("a held Reel Facebook failed to process is taken back and marked failed", async () => {
    row = { ...reel(), publish: pub({ state: "scheduled", postId: "v9", at: minutesAgo(30) }) };
    fb.reelState.mockResolvedValue("failed");
    await verifyDue();
    expect(fb.postState).not.toHaveBeenCalled();
    expect(row.publish).toMatchObject({ state: "failed", error: REEL_FAILED });
  });

  it("a held Reel still processing is left as it is", async () => {
    row = { ...reel(), publish: pub({ state: "scheduled", postId: "v9", at: minutesAgo(30) }) };
    fb.reelState.mockResolvedValue("unknown");
    await verifyDue();
    expect(row.publish?.state).toBe("scheduled");
  });
});
```

(`listDue` must return `[row]` for the `verifyDue` cases: add `store.listDue.mockImplementation(async () => [row]);` inside those two tests if the file's `beforeEach` does not already.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/publish-flow.test.ts` → the new `a Reel` tests FAIL; the rest PASS.

- [ ] **Step 3: Implement in `src/lib/content/publish-flow.ts`**

Imports:

```ts
import { deletePost, MAX_AHEAD_MS, MIN_AHEAD_MS, postPhoto, postReel, postState, PublishError, REEL_MAX_AHEAD_MS, reelState, type Posted } from "@/lib/facebook/publish";
import { reelDescription, spokenNotes } from "./clip";
import { clipReadUrl } from "./clip-store";
```

Constants after `MISSED`:

```ts
/** a held Reel Facebook could not process (its video node says error) */
export const REEL_FAILED = "Facebook ประมวลผลคลิปไม่ผ่าน — แนบไฟล์ใหม่แล้วลงอีกครั้ง";
export const CLIP_EXPIRED = "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อนลงเพจ";
/** a Reel's file is read by Facebook through this link; an hour covers a slow fetch */
const REEL_LINK_SECONDS = 60 * 60;
```

`PublishResult`'s failure arm gains:

```ts
    /** things said in a clip a post would be flagged for, or that nobody has listened: confirmed, never blocked (owner, 2026-10-02) */
    confirmSpoken?: string[];
```

`clear()` — signature input gains `confirmSpoken?: boolean`. Replace the body from `if (item.format !== "post") …` down to and including the numbers check with:

```ts
  const video = item.output.video;
  if (item.format !== "post" && !video) return { ok: false, error: "โพสต์ลงเพจได้เฉพาะโพสต์เฟซบุ๊ก หรือชิ้นที่แนบคลิปแล้ว" };
  if (video?.expired) return { ok: false, error: CLIP_EXPIRED };
  const p = item.publish;
  const state = p?.state;
  if (input.moving) {
    if (state !== "scheduled") return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  } else {
    if (state === "scheduled" || state === "published") return { ok: false, error: "ชิ้นนี้โพสต์หรือตั้งเวลาไปแล้ว" };
    if (state === "posting" && !stalePosting(p)) return { ok: false, error: "ชิ้นนี้กำลังส่งไปเพจอยู่ รอสักครู่" };
    if (maybeOnPage(p) && !input.force) return { ok: false, error: POSSIBLY_POSTED, confirmRepost: true };
  }
  if (!video) {
    // a claim paper's stickers were laid by the AI; a person looks before the Page does
    if (item.output.poster?.documents?.length && item.output.paperChecked === false) return { ok: false, error: PAPER_UNCHECKED };
    // words the image model drew: the agent reads them before the Page does, and they must still be the piece's words
    const drawnWords = aiTextState(item.output.poster);
    if (drawnWords === "stale") return { ok: false, error: AI_TEXT_STALE };
    if (drawnWords === "unchecked") return { ok: false, error: AI_TEXT_UNCHECKED };
  }
  // a Reel goes up with its caption, so the caption's checks are the ones that count — a
  // script's own flags are about the script (owner, 2026-10-02)
  const flags = video ? video.flags : item.flags;
  const blocked = (flags.policy ?? []).filter((f) => f.severity === "block");
  if (blocked.length > 0) return { ok: false, error: `ยังผิดกฎโฆษณาของ Facebook: ${blocked[0].message} — แก้ก่อนแล้วค่อยโพสต์` };
  if (flags.numbers.length > 0 && !input.confirmNumbers) {
    return { ok: false, error: "มีตัวเลขที่ไม่ตรงกับตารางเบี้ย", confirmNumbers: flags.numbers };
  }
  // what was said is the agent's to stand behind: asked once, never blocked; a move was asked already
  if (video && !input.moving && !input.confirmSpoken) {
    const notes = spokenNotes(video);
    if (notes.length > 0) return { ok: false, error: "มีสิ่งที่พูดในคลิปที่ควรตรวจก่อนลง", confirmSpoken: notes };
  }
```

and in the time check replace the max line with:

```ts
    const maxAhead = video ? REEL_MAX_AHEAD_MS : MAX_AHEAD_MS;
    if (ahead > maxAhead) return { ok: false, error: `ตั้งเวลาล่วงหน้าได้ไม่เกิน ${video ? 29 : 30} วัน` };
```

`send()` — replace from `let png: Buffer;` through the end of the `postPhoto` try/catch with:

```ts
  const video = item.output.video;
  // a Reel's file is fetched by Facebook through a signed link; a post's poster is drawn here.
  // Either failing leaves nothing on the Page yet: a plain failure.
  let send: () => Promise<Posted>;
  if (video) {
    let fileUrl: string;
    try {
      fileUrl = await clipReadUrl(video.path, REEL_LINK_SECONDS);
    } catch (e) {
      console.error("clip link not made:", e);
      const message = "เปิดไฟล์คลิปไม่ได้ ลองใหม่อีกครั้งนะครับ";
      await fail(message);
      return { ok: false, error: message };
    }
    send = () => postReel({ pageId: page.pageId, token, fileUrl, caption: reelDescription(item.output), at });
  } else {
    let png: Buffer;
    try {
      const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "");
      png = await drawPoster(poster, "square");
    } catch (e) {
      // nothing has left for Facebook yet: a plain failure
      console.error("content poster failed:", e);
      const message = "วาดรูปโพสต์ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";
      await fail(message);
      return { ok: false, error: message };
    }
    send = () => postPhoto({ pageId: page.pageId, token, png, caption: fullText(item.output, hook), at });
  }

  let posted: Posted;
  try {
    posted = await send();
  } catch (e) {
    // (keep the existing comment block and body of this catch unchanged)
```

`publish()` input gains `confirmSpoken?: boolean` (it passes `input` to `clear` already).

`verifyDue()` — replace the lines from `const state = await postState(p.postId, token);` to the end of that `try` block's success handling with:

```ts
      const reel = Boolean(item.output.video);
      const state = reel ? await reelState(p.postId, token) : await postState(p.postId, token);
      if (state === "unknown") return;
      if (state === "published") {
        if (await recordPublishIf(item.id, held, { state: "published" })) lastAsked.delete(item.id);
        return;
      }
      let postId: string | null = p.postId;
      try {
        await deletePost(p.postId, token);
        postId = null;
      } catch (e) {
        console.error("missed post not taken back:", e);
      }
      if (await recordPublishIf(item.id, held, { state: "failed", postId, error: reel ? REEL_FAILED : MISSED })) lastAsked.delete(item.id);
```

- [ ] **Step 4: Thread `confirmSpoken` through the server actions**

`src/app/studio/publish.ts`: add `confirmSpoken?: boolean;` to the input types of `publishPiece`, `scheduleOnDay`, `scheduleNextOpen`, `scheduleAt`, and pass `confirmSpoken: input.confirmSpoken` into every `publish({ … })` call in them (four call sites). `move(...)` calls are unchanged (a move never asks).

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/content/publish-flow.test.ts tests/content/schedule-next-open.test.ts tests/content/actions-page.test.ts` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/publish-flow.ts src/app/studio/publish.ts tests/content/publish-flow.test.ts
git commit -m "feat(studio): a piece with a clip goes to the Page as a Reel"
```

---

### Task 5: อัปโหลด — server actions และตัวอัปโหลดในเบราว์เซอร์

**Files:**
- Create: `src/app/studio/clip.ts` (`"use server"`: `startClipUpload`, `finishClipUpload`, `clipViewUrl`)
- Create: `src/app/studio/clip/upload.ts` (browser: `readClipFile`, `uploadClip`)
- Modify: `package.json` (dependency `tus-js-client`)
- Test: `tests/content/clip-actions.test.ts`

**Interfaces:**
- Consumes: `clipProblem`, `clipPath`, `isClipPath`, `clipOutput`, `NO_FLAGS`, `CLIP_HREF`, `MAX_CLIP_BRIEF`, `ClipFile`, `ClipVideo` (Task 1); `createClipUpload`, `clipSize`, `clipReadUrl`, `removeClip` (Task 3); `getContent`, `saveContent`, `saveOutputIf` (store); `projectPage`; `requireMember`; `onPage` (publish-label)
- Produces:
  - `startClipUpload(input: { pieceId?: string; page?: string; file: ClipFile }): Promise<{ ok: true; pieceId: string; path: string; token: string; item?: ContentItem } | { ok: false; error: string }>` — `item` is the new clip piece when one was made
  - `finishClipUpload(input: { pieceId: string; path: string; file: ClipFile; brief?: string }): Promise<ClipResult>`
  - `type ClipResult = { ok: true; item: ContentItem } | { ok: false; error: string }`
  - `clipViewUrl(id: string): Promise<string | null>` (signed, 1 hour, for the player)
  - browser: `readClipFile(file: File): Promise<ClipFile>`, `uploadClip(opts: { file: File; path: string; token: string; onProgress: (fraction: number) => void; signal?: AbortSignal }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/content/clip-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";

const store = vi.hoisted(() => ({ getContent: vi.fn(), saveContent: vi.fn(), saveOutputIf: vi.fn() }));
const clips = vi.hoisted(() => ({ createClipUpload: vi.fn(), clipSize: vi.fn(), clipReadUrl: vi.fn(), removeClip: vi.fn() }));
const pages = vi.hoisted(() => ({ projectPage: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/clip-store", () => clips);
vi.mock("@/lib/auth/pages", () => pages);
vi.mock("@/lib/auth/viewer", () => ({ requireMember: vi.fn(async () => ({ agentId: "a1", staff: false })) }));

const { finishClipUpload, startClipUpload } = await import("@/app/studio/clip");
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const file = { sizeBytes: 9_000_000, durationSec: 40, width: 1080, height: 1920, mime: "video/mp4" };
const item = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: PIECE, createdAt: "", planHref: "/life-protect", format: "script", angle: "", length: "60",
  output: { ...clipOutput("d"), hooks: ["h"], body: "บท" }, flags: NO_FLAGS, model: null, costThb: 0, status: "draft",
  hookTemplateId: null, publish: null, agentId: "a1", pageId: "105", plan: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  clips.createClipUpload.mockResolvedValue({ token: "tok" });
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => item({ output }));
  pages.projectPage.mockResolvedValue({ ok: true, pageId: "105" });
});

describe("startClipUpload", () => {
  it("refuses a file that is not a Reel before anything is made", async () => {
    expect(await startClipUpload({ page: "105", file: { ...file, width: 1920, height: 1080 } })).toMatchObject({ ok: false });
    expect(store.saveContent).not.toHaveBeenCalled();
    expect(clips.createClipUpload).not.toHaveBeenCalled();
  });

  it("a clip on its own: makes a clip piece in the Page's project, then a token under it", async () => {
    store.saveContent.mockResolvedValue(item({ format: "clip", planHref: "clip" }));
    const r = await startClipUpload({ page: "105", file });
    expect(store.saveContent).toHaveBeenCalledWith(expect.objectContaining({ format: "clip", planHref: "clip", pageId: "105" }));
    expect(r).toMatchObject({ ok: true, pieceId: PIECE, token: "tok" });
    expect((r as { path: string }).path.startsWith(`${PIECE}/`)).toBe(true);
  });

  it("attaches to a script it may see; refuses a post, an unseen piece, and a held one", async () => {
    store.getContent.mockResolvedValue(item());
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: true });
    store.getContent.mockResolvedValue(item({ format: "post" }));
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
    store.getContent.mockResolvedValue(null);
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
    store.getContent.mockResolvedValue(item({ publish: { state: "scheduled", pageId: "105", postId: "v1", at: "2099-01-01T00:00:00Z", error: null } }));
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
  });
});

describe("finishClipUpload", () => {
  const path = `${PIECE}/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4`;

  it("keeps the clip once the file is there at its size, and lets the old file go", async () => {
    const old = `${PIECE}/11111111-2222-4333-8444-555555555555.mp4`;
    store.getContent.mockResolvedValue(item({ output: { ...item().output, video: { path: old, durationSec: 1, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "เดิม", flags: NO_FLAGS } } }));
    clips.clipSize.mockResolvedValue(file.sizeBytes);
    const r = await finishClipUpload({ pieceId: PIECE, path, file, brief: " เรื่องภาษี " });
    expect(r.ok).toBe(true);
    const saved = store.saveOutputIf.mock.calls[0][1] as ContentItem["output"];
    expect(saved.video).toMatchObject({ path, sizeBytes: file.sizeBytes, caption: "เดิม", brief: "เรื่องภาษี" });
    expect(saved.video?.transcript).toBeUndefined();
    expect(clips.removeClip).toHaveBeenCalledWith(old);
  });

  it("refuses a missing file or one of another size", async () => {
    store.getContent.mockResolvedValue(item());
    clips.clipSize.mockResolvedValue(null);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
    clips.clipSize.mockResolvedValue(5);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("refuses another piece's path", async () => {
    store.getContent.mockResolvedValue(item());
    expect((await finishClipUpload({ pieceId: PIECE, path: "other/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", file })).ok).toBe(false);
    expect(clips.clipSize).not.toHaveBeenCalled();
  });

  it("refuses a held piece", async () => {
    store.getContent.mockResolvedValue(item({ publish: { state: "scheduled", pageId: "105", postId: "v1", at: "2099-01-01T00:00:00Z", error: null } }));
    clips.clipSize.mockResolvedValue(file.sizeBytes);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/clip-actions.test.ts` → FAIL (module missing)

- [ ] **Step 3: Implement `src/app/studio/clip.ts`**

```ts
"use server";

import { clipOutput, clipPath, clipProblem, CLIP_HREF, isClipPath, MAX_CLIP_BRIEF, NO_FLAGS, type ClipFile, type ClipVideo } from "@/lib/content/clip";
import { clipReadUrl, clipSize, createClipUpload, removeClip } from "@/lib/content/clip-store";
import { onPage } from "@/lib/content/publish-label";
import { getContent, saveContent, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { projectPage } from "@/lib/auth/pages";
import { requireMember } from "@/lib/auth/viewer";

/**
 * A clip the agent filmed, onto a piece (owner, 2026-10-02). The file goes from the browser to
 * storage directly — these only hand out the token and then look at what arrived.
 */

export type ClipResult = { ok: true; item: ContentItem } | { ok: false; error: string };
type Started = { ok: true; pieceId: string; path: string; token: string; item?: ContentItem } | { ok: false; error: string };

const HELD = "ชิ้นนี้ลงเพจหรือตั้งเวลาไว้แล้ว — ยกเลิกคิวก่อนแนบคลิปใหม่";
const READ_FAILED = "อ่านชิ้นงานไม่ได้ ลองใหม่อีกครั้งนะครับ";

/** a piece a clip may go on: a script or a clip, the asker's to see, not on its way to the Page */
async function attachable(id: string): Promise<{ ok: true; item: ContentItem } | { ok: false; error: string }> {
  const item = await getContent(id).catch(() => undefined);
  if (item === undefined) return { ok: false, error: READ_FAILED };
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  if (item.format !== "script" && item.format !== "clip") return { ok: false, error: "แนบคลิปได้เฉพาะชิ้นสคริปต์หรือชิ้นคลิป" };
  if (onPage(item.publish)) return { ok: false, error: HELD };
  return { ok: true, item };
}

const cleanFile = (f: ClipFile): ClipFile => ({
  sizeBytes: Number(f?.sizeBytes), durationSec: Number(f?.durationSec), width: Number(f?.width), height: Number(f?.height), mime: String(f?.mime ?? ""),
});

export async function startClipUpload(input: { pieceId?: string; page?: string; file: ClipFile }): Promise<Started> {
  await requireMember();
  const file = cleanFile(input.file);
  const problem = clipProblem(file);
  if (problem) return { ok: false, error: problem };
  try {
    let pieceId: string;
    let made: ContentItem | undefined;
    if (input.pieceId) {
      const a = await attachable(input.pieceId);
      if (!a.ok) return a;
      pieceId = a.item.id;
    } else {
      const project = await projectPage(input.page);
      if (!project.ok) return project;
      made = await saveContent({
        planHref: CLIP_HREF, format: "clip", angle: "", length: null, output: clipOutput(""), flags: NO_FLAGS,
        rateVersion: null, model: "", costThb: 0, hookTemplateId: null, pageId: project.pageId,
      });
      pieceId = made.id;
    }
    const path = clipPath(pieceId, file.mime);
    const { token } = await createClipUpload(path);
    return { ok: true, pieceId, path, token, ...(made ? { item: made } : {}) };
  } catch (e) {
    console.error("clip upload not started:", e);
    return { ok: false, error: "เตรียมอัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function finishClipUpload(input: { pieceId: string; path: string; file: ClipFile; brief?: string }): Promise<ClipResult> {
  await requireMember();
  const file = cleanFile(input.file);
  if (clipProblem(file) || !isClipPath(input.pieceId, input.path)) return { ok: false, error: "ข้อมูลคลิปไม่ถูกต้อง อัปโหลดใหม่อีกครั้งนะครับ" };
  try {
    const size = await clipSize(input.path);
    if (size === null || size !== file.sizeBytes) return { ok: false, error: "ไฟล์ไปไม่ครบ — อัปโหลดใหม่อีกครั้งนะครับ" };
    const brief = (typeof input.brief === "string" ? input.brief : "").trim().slice(0, MAX_CLIP_BRIEF);
    // a save can race another (a caption edit): read again and build on that, up to three times
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = await attachable(input.pieceId);
      if (!a.ok) return a;
      const before = a.item.output.video;
      const video: ClipVideo = {
        path: input.path, durationSec: file.durationSec, width: file.width, height: file.height,
        sizeBytes: file.sizeBytes, mime: file.mime, uploadedAt: new Date().toISOString(),
        ...(brief ? { brief } : before?.brief ? { brief: before.brief } : {}),
        // the agent's caption survives a new take; its checks are run again by the transcription
        caption: before?.caption ?? "", flags: before?.flags ?? NO_FLAGS,
      };
      const saved = await saveOutputIf(a.item.id, { ...a.item.output, video }, undefined, a.item.output.rev ?? null);
      if (!saved) continue;
      if (before?.path && before.path !== input.path) await removeClip(before.path);
      return { ok: true, item: saved };
    }
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  } catch (e) {
    console.error("clip upload not finished:", e);
    return { ok: false, error: "บันทึกคลิปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** A link the card's player plays the clip from, for an hour; null when there is none. */
export async function clipViewUrl(id: string): Promise<string | null> {
  await requireMember();
  const item = await getContent(id).catch(() => null);
  const v = item?.output.video;
  if (!v || v.expired) return null;
  return clipReadUrl(v.path, 60 * 60).catch(() => null);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/content/clip-actions.test.ts` → PASS

- [ ] **Step 5: Add tus-js-client and write the browser uploader**

Run: `npm install tus-js-client`

`src/app/studio/clip/upload.ts`:

```ts
"use client";
import { Upload } from "tus-js-client";
import { CLIP_BUCKET, type ClipFile } from "@/lib/content/clip";

/**
 * The browser's half of a clip upload (owner, 2026-10-02): what the file is, read from the
 * phone's own player, and the bytes sent straight to storage in 6MB pieces that carry on
 * after a dropped connection (Supabase resumable uploads, signed with x-signature).
 */

/** the storage host itself, as Supabase's guide asks for large uploads */
function resumableEndpoint(): string {
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const ref = base.hostname.split(".")[0];
  return `https://${ref}.storage.supabase.co/storage/v1/upload/resumable`;
}

export function readClipFile(file: File): Promise<ClipFile> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (d: number, w: number, h: number) => {
      URL.revokeObjectURL(url);
      // a .mov from an iPhone can come with an empty type; its name says what it is
      const mime = file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.mp4$/i.test(file.name) ? "video/mp4" : "");
      resolve({ sizeBytes: file.size, durationSec: d, width: w, height: h, mime });
    };
    v.onloadedmetadata = () => done(v.duration, v.videoWidth, v.videoHeight);
    v.onerror = () => done(Number.NaN, 0, 0);
    v.src = url;
  });
}

export function uploadClip(opts: { file: File; path: string; token: string; onProgress: (fraction: number) => void; signal?: AbortSignal }): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new Upload(opts.file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { "x-signature": opts.token, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: CLIP_BUCKET,
        objectName: opts.path,
        contentType: opts.file.type || "video/mp4",
        cacheControl: "3600",
      },
      // Supabase takes exactly 6MB chunks
      chunkSize: 6 * 1024 * 1024,
      onProgress: (sent, total) => opts.onProgress(total ? sent / total : 0),
      onError: (e) => reject(e),
      onSuccess: () => resolve(),
    });
    opts.signal?.addEventListener("abort", () => { void upload.abort(); reject(new DOMException("aborted", "AbortError")); });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}
```

- [ ] **Step 6: Probe the upload once against the real bucket**

With the dev server running and the migration applied, in the Browser pane on `/studio/write` run (javascript_tool) a 1-second-file test is not possible without a clip; instead upload a real short vertical mp4 through the form in Task 8. If the first upload answers 401/403 from `*.storage.supabase.co`:
1. fetch the project's publishable key with the Supabase MCP `get_publishable_keys`
2. add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<key>` to `.env.local` (main folder) and to Vercel env (Production + Preview), and to `.env.example` with an empty value
3. add `apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""` to the `headers` above
Record which was needed in the commit message.

- [ ] **Step 7: Commit**

```bash
git add src/app/studio/clip.ts src/app/studio/clip/upload.ts tests/content/clip-actions.test.ts package.json package-lock.json
git commit -m "feat(studio): upload a clip straight to storage, then keep it on its piece"
```

---

### Task 6: Gemini อ่านวิดีโอได้

**Files:**
- Modify: `src/lib/ai/types.ts` (`ChatMessage.video`)
- Modify: `src/lib/ai/providers.ts` (`googleParts`, `CallArgs.mediaResolution`, google caller)
- Modify: `src/lib/ai/client.ts` (`ChatOptions.mediaResolution`, pass through; `providerKey`)
- Create: `src/lib/ai/gemini-files.ts`
- Test: `tests/ai/gemini-video.test.ts`

**Interfaces:**
- Produces:
  - `ChatMessage.video?: { uri: string; mimeType: string }`
  - `CallArgs.mediaResolution?: "low"`, `ChatOptions.mediaResolution?: "low"`
  - `providerKey(provider: string): Promise<string | null>` (client.ts)
  - `uploadToGemini(opts: { apiKey: string; body: ReadableStream<Uint8Array>; sizeBytes: number; mimeType: string; displayName: string }): Promise<string>` — resolves to the file's `uri` once `ACTIVE`

- [ ] **Step 1: Write the failing tests**

`tests/ai/gemini-video.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS, googleParts } from "@/lib/ai/providers";
import { uploadToGemini } from "@/lib/ai/gemini-files";

afterEach(() => vi.unstubAllGlobals());

describe("a video in a Gemini message", () => {
  it("goes ahead of the words, as fileData", () => {
    expect(googleParts({ role: "user", content: "ถอดเสียง", video: { uri: "https://s/v.mp4", mimeType: "video/mp4" } }))
      .toEqual([{ fileData: { mimeType: "video/mp4", fileUri: "https://s/v.mp4" } }, { text: "ถอดเสียง" }]);
  });

  it("asks for low media resolution when told", async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }));
    }));
    await CALLERS.google({ apiKey: "k", model: "gemini-3.7-flash", messages: [{ role: "user", content: "x" }], maxTokens: 10, mediaResolution: "low" });
    expect((sent.generationConfig as Record<string, unknown>).mediaResolution).toBe("MEDIA_RESOLUTION_LOW");
  });
});

describe("uploadToGemini", () => {
  it("starts a resumable upload, sends the bytes, and waits for ACTIVE", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const answers = [
      new Response("{}", { headers: { "x-goog-upload-url": "https://up/1" } }),
      new Response(JSON.stringify({ file: { name: "files/abc", uri: "https://g/files/abc", state: "PROCESSING" } })),
      new Response(JSON.stringify({ name: "files/abc", uri: "https://g/files/abc", state: "ACTIVE" })),
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); return answers.shift()!; }));
    const body = new Blob([new Uint8Array(4)]).stream();
    expect(await uploadToGemini({ apiKey: "k", body, sizeBytes: 4, mimeType: "video/mp4", displayName: "clip", pollMs: 0 })).toBe("https://g/files/abc");
    expect(calls[0].init?.headers).toMatchObject({ "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": "4" });
    expect(calls[1].url).toBe("https://up/1");
    expect(calls[1].init?.headers).toMatchObject({ "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" });
    expect(calls[2].url).toContain("/v1beta/files/abc");
  });

  it("throws when the file fails to process", async () => {
    const answers = [
      new Response("{}", { headers: { "x-goog-upload-url": "https://up/1" } }),
      new Response(JSON.stringify({ file: { name: "files/abc", uri: "u", state: "FAILED" } })),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => answers.shift()!));
    await expect(uploadToGemini({ apiKey: "k", body: new Blob([]).stream(), sizeBytes: 0, mimeType: "video/mp4", displayName: "c", pollMs: 0 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/ai/gemini-video.test.ts` → FAIL

- [ ] **Step 3: Implement**

`src/lib/ai/types.ts` — in `ChatMessage` after `images?`:

```ts
  /** a video for Gemini to watch and hear — a signed link or a Files API uri; only the google caller reads it */
  video?: { uri: string; mimeType: string };
```

`src/lib/ai/providers.ts`:
- `CallArgs` gains `/** Gemini only: how finely to read pictures and video; "low" for listening to a clip */ mediaResolution?: "low";`
- `googleParts` becomes:

```ts
export function googleParts(m: ChatMessage): unknown[] {
  return [
    ...(m.video ? [{ fileData: { mimeType: m.video.mimeType, fileUri: m.video.uri } }] : []),
    ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } })),
    { text: m.content },
  ];
}
```

- the `google` caller destructures `mediaResolution` and its `generationConfig` gains `...(mediaResolution === "low" ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),`

`src/lib/ai/client.ts`:
- `ChatOptions` gains `/** passed to Gemini as is; see CallArgs.mediaResolution */ mediaResolution?: "low";`
- `chat({ …, mediaResolution })` and the `call({ … })` inside it passes `mediaResolution`
- add near `liveKeys`:

```ts
/** A provider's key, as the chain would use it — for calls that are not a chat (Gemini's Files API); null when off or missing. */
export async function providerKey(provider: string): Promise<string | null> {
  return liveKeys(await loadConfig())[provider] ?? null;
}
```

`src/lib/ai/gemini-files.ts`:

```ts
/**
 * A clip too big for Gemini to fetch by link (over 100MB) handed to it through the Files API
 * (owner, 2026-10-02): a resumable upload in one go, then a wait until Gemini has read it.
 * Files are kept by Google for 48 hours and then dropped on their own.
 */
const BASE = "https://generativelanguage.googleapis.com";

export async function uploadToGemini(opts: {
  apiKey: string; body: ReadableStream<Uint8Array>; sizeBytes: number; mimeType: string; displayName: string;
  /** between looks at a file still processing; tests pass 0 */
  pollMs?: number;
}): Promise<string> {
  const start = await fetch(`${BASE}/upload/v1beta/files?key=${opts.apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(opts.sizeBytes),
      "X-Goog-Upload-Header-Content-Type": opts.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: opts.displayName } }),
    signal: AbortSignal.timeout(30_000),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`gemini upload not started: ${start.status}`);

  const sent = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Length": String(opts.sizeBytes), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: opts.body,
    // a stream as a request body needs half duplex in Node's fetch
    duplex: "half",
    signal: AbortSignal.timeout(300_000),
  } as RequestInit & { duplex: "half" });
  const got = await sent.json().catch(() => ({})) as { file?: { name?: string; uri?: string; state?: string } };
  let file = got.file;
  if (!sent.ok || !file?.name || !file.uri) throw new Error(`gemini upload failed: ${sent.status}`);

  const pollMs = opts.pollMs ?? 2000;
  for (let i = 0; i < 90 && file.state !== "ACTIVE"; i++) {
    if (file.state === "FAILED") throw new Error("gemini could not read the clip");
    if (pollMs) await new Promise((r) => setTimeout(r, pollMs));
    const res = await fetch(`${BASE}/v1beta/${file.name}?key=${opts.apiKey}`, { signal: AbortSignal.timeout(10_000) });
    file = await res.json().catch(() => ({})) as typeof file;
    if (!file?.name || !file.uri) throw new Error(`gemini file unreadable: ${res.status}`);
  }
  if (file.state !== "ACTIVE") {
    if (file.state === "FAILED") throw new Error("gemini could not read the clip");
    throw new Error("gemini took too long to read the clip");
  }
  return file.uri;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ai/gemini-video.test.ts tests/content/provider-reasoning.test.ts` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/types.ts src/lib/ai/providers.ts src/lib/ai/client.ts src/lib/ai/gemini-files.ts tests/ai/gemini-video.test.ts
git commit -m "feat(ai): Gemini watches a video — by link, or through the Files API"
```

---

### Task 7: ถอดเสียง + ร่างแคปชัน + ตรวจ (รอบ `ai-clip`)

**Files:**
- Create: `src/lib/content/clip-transcribe.ts` (prompt, reply parser, checks — no I/O)
- Create: `src/lib/content/clip-run.ts` (the run: file to Gemini, call, checks, save)
- Modify: `src/app/studio/clip.ts` (`transcribeClip`)
- Modify: `src/lib/auth/quota.ts:27` (`AI_ROUNDS` + `"ai-clip"`)
- Modify: `src/lib/wallet/money.ts:39-46` (`ROUND_HOLD_THB["ai-clip"] = 3`)
- Modify: `src/app/studio/wallet/WalletClient.tsx:8` (label `"ai-clip": "ถอดเสียงคลิป"`)
- Modify: `tests/wallet/take-round.test.ts:55` (expected `p_rounds` gains `"ai-clip"`)
- Test: `tests/content/clip-transcribe.test.ts`, `tests/content/clip-run.test.ts`

**Interfaces:**
- Consumes: `ClipVideo`, `Segment`, `SpokenFlag`, `NO_FLAGS`, `MAX_CAPTION` (Task 1); `clipReadUrl` (Task 3); `chat`, `providerKey`, `BudgetExceeded` (client.ts); `uploadToGemini` (Task 6); `findWords`, `strayNumbers` (check.ts); `checkPolicy`; `modeChecks`; `briefFor`; `listWords`, `getContent`, `saveOutputIf`; `takeRound`, `payRound`, `ceilingBeforeRound`
- Produces:
  - `CLIP_MODEL = "gemini-3.7-flash"`, `GEMINI_LINK_MAX_BYTES = 100 * 1024 * 1024`
  - `clipMessages(ctx: { script: string; brief: string; product: string }): ChatMessage[]`
  - `parseClipReply(text: string, durationSec: number): { segments: Segment[]; caption: string } | null`
  - `spokenFlagsOf(segments: Segment[], words: ContentWord[], yardstick: string, checks: Partial<ModeChecks>): SpokenFlag[]`
  - `captionFlags(caption: string, yardstick: string, words: ContentWord[], checks: Partial<ModeChecks>): Flags`
  - `clipYardstick(item: ContentItem): string`
  - `runTranscribe(item: ContentItem): Promise<ClipResult>` (clip-run.ts)
  - `transcribeClip(id: string): Promise<ClipResult>` (server action)

- [ ] **Step 1: Write the failing tests for the pure part**

`tests/content/clip-transcribe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { captionFlags, clipMessages, parseClipReply, spokenFlagsOf } from "@/lib/content/clip-transcribe";

const words = [{ word: "การันตี", kind: "banned" as const, fix: null }];

describe("parseClipReply", () => {
  it("reads segments in order and the caption", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 2.5, text: "สวัสดีครับ" }, { start: 2.5, end: 6, text: "วันนี้มาเล่าเรื่องภาษี" }],
      caption: "ลดหย่อนภาษีได้ #ประกัน",
    }), 10);
    expect(r).toEqual({ segments: [{ start: 0, end: 2.5, text: "สวัสดีครับ" }, { start: 2.5, end: 6, text: "วันนี้มาเล่าเรื่องภาษี" }], caption: "ลดหย่อนภาษีได้ #ประกัน" });
  });

  it("drops segments that are empty, backwards, out of order or past the clip's end, keeps the rest", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 1, text: "ก" }, { start: 3, end: 2, text: "กลับหัว" }, { start: 0.5, end: 2, text: "ย้อน" },
        { start: 1, end: 2, text: "  " }, { start: 2, end: 99, text: "เกิน" }, { start: 2, end: 3, text: "ข" }],
      caption: "c",
    }), 10);
    expect(r?.segments.map((s) => s.text)).toEqual(["ก", "ข"]);
  });

  it("is null for a reply that is not JSON, or has no segment and no caption", () => {
    expect(parseClipReply("not json", 10)).toBeNull();
    expect(parseClipReply(JSON.stringify({ segments: [], caption: "" }), 10)).toBeNull();
  });

  it("reads JSON wrapped in a code fence, and cuts a caption that runs long", () => {
    const r = parseClipReply("```json\n" + JSON.stringify({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "x".repeat(5000) }) + "\n```", 10);
    expect(r?.caption.length).toBe(2200);
  });
});

describe("spokenFlagsOf", () => {
  it("flags a banned word, a stray figure and a policy breach at the second it was said", () => {
    const f = spokenFlagsOf([
      { start: 0, end: 3, text: "สวัสดีครับ" },
      { start: 42.4, end: 45, text: "ผมการันตีเลยครับ" },
      { start: 50, end: 53, text: "เบี้ยแค่ 999 บาทต่อเดือน" },
    ], words, "เบี้ย 1,200 บาท", {});
    expect(f.find((x) => x.kind === "word")).toMatchObject({ at: 42.4, text: "การันตี" });
    expect(f.find((x) => x.kind === "number")).toMatchObject({ at: 50 });
    expect(f.every((x) => x.message.length > 0)).toBe(true);
  });

  it("is empty for a clean clip", () => {
    expect(spokenFlagsOf([{ start: 0, end: 2, text: "สวัสดีครับ" }], words, "", {})).toEqual([]);
  });
});

describe("captionFlags", () => {
  it("checks the caption as a post's words are checked", () => {
    const f = captionFlags("การันตีคืนเงิน 999 บาท", "", words, {});
    expect(f.words.map((w) => w.word)).toEqual(["การันตี"]);
    expect(f.numbers.length).toBeGreaterThan(0);
    expect(f.fixes).toBeNull();
  });
});

describe("clipMessages", () => {
  it("tells Gemini what the clip is about and asks for JSON in Thai", () => {
    const m = clipMessages({ script: "บทพูด", brief: "", product: "Life Protect" });
    const all = m.map((x) => x.content).join("\n");
    expect(all).toContain("บทพูด");
    expect(all).toContain("Life Protect");
    expect(all).toContain("segments");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/clip-transcribe.test.ts` → FAIL

- [ ] **Step 3: Implement `src/lib/content/clip-transcribe.ts`**

```ts
import type { ChatMessage } from "@/lib/ai/types";
import { findWords, strayNumbers, type ContentWord } from "./check";
import { MAX_CAPTION, type Segment, type SpokenFlag } from "./clip";
import type { ModeChecks } from "./mode-checks";
import { checkPolicy } from "./policy";
import type { Flags } from "./store";

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

export function parseClipReply(text: string, durationSec: number): { segments: Segment[]; caption: string } | null {
  let raw: unknown;
  try { raw = JSON.parse(unfence(text)); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { segments?: unknown; caption?: unknown };
  const segments: Segment[] = [];
  let last = 0;
  for (const s of Array.isArray(r.segments) ? r.segments : []) {
    const seg = s as { start?: unknown; end?: unknown; text?: unknown };
    const start = Number(seg.start);
    const end = Number(seg.end);
    const words = typeof seg.text === "string" ? seg.text.trim() : "";
    // a stretch that runs backwards, starts inside the one before it (a quarter-second of
    // overlap is the model's rounding), or runs past the end of the clip is not kept
    if (!words || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < last - 0.25 || end > durationSec + 1) continue;
    segments.push({ start, end, text: words.slice(0, 500) });
    last = end;
  }
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
```

(If `WordKind` names the banned kind differently than `"banned"`, use the value `ins_content_words.kind` holds for banned words — `supabase/migrations/20260923_content.sql` uses `'banned'`.)

- [ ] **Step 4: Run the pure tests**

Run: `npx vitest run tests/content/clip-transcribe.test.ts` → PASS

- [ ] **Step 5: Write the failing tests for the run**

`tests/content/clip-run.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";

const ai = vi.hoisted(() => ({ chat: vi.fn(), providerKey: vi.fn(), BudgetExceeded: class extends Error {} }));
const store = vi.hoisted(() => ({ getContent: vi.fn(), saveOutputIf: vi.fn(), listWords: vi.fn(async () => []) }));
const clips = vi.hoisted(() => ({ clipReadUrl: vi.fn(async () => "https://signed") }));
const files = vi.hoisted(() => ({ uploadToGemini: vi.fn(async () => "https://g/files/1") }));
vi.mock("@/lib/ai/client", () => ai);
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/clip-store", () => clips);
vi.mock("@/lib/ai/gemini-files", () => files);

const { runTranscribe } = await import("@/lib/content/clip-run");
const video = (over = {}) => ({
  path: "p/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", durationSec: 20, width: 1080, height: 1920, sizeBytes: 9_000_000,
  mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS, ...over,
});
const item = (v = video()): ContentItem => ({
  id: "p", createdAt: "", planHref: "clip", format: "clip", angle: "", length: null, output: { ...clipOutput(""), video: v },
  flags: NO_FLAGS, model: null, costThb: 0, status: "draft", hookTemplateId: null, publish: null, agentId: "a", pageId: "105", plan: null,
});
const reply = (o: unknown) => ({ text: JSON.stringify(o), model: "gemini-3.7-flash", provider: "google", inputTokens: 1, outputTokens: 1, costThb: 0.3 });

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockImplementation(async () => item());
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => ({ ...item(), output }));
});

describe("runTranscribe", () => {
  it("hands Gemini a link for a clip up to 100MB, keeps the transcript, caption and checks", async () => {
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 1, end: 3, text: "สวัสดีครับ" }], caption: "แคปชันใหม่" }));
    const r = await runTranscribe(item());
    expect(r.ok).toBe(true);
    const sent = ai.chat.mock.calls[0][0];
    expect(sent).toMatchObject({ only: "gemini-3.7-flash", json: true, mediaResolution: "low" });
    expect(sent.messages.at(-1).video).toEqual({ uri: "https://signed", mimeType: "video/mp4" });
    expect(files.uploadToGemini).not.toHaveBeenCalled();
    const v = (store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!;
    expect(v).toMatchObject({ transcript: [{ start: 1, end: 3, text: "สวัสดีครับ" }], caption: "แคปชันใหม่", spokenFlags: [] });
    expect(v.transcribeFailed).toBeUndefined();
  });

  it("uploads a clip over 100MB through the Files API", async () => {
    ai.providerKey.mockResolvedValue("k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([new Uint8Array(1)]).stream())));
    ai.chat.mockResolvedValue(reply({ segments: [], caption: "c" }));
    await runTranscribe(item(video({ sizeBytes: 200_000_000 })));
    expect(files.uploadToGemini).toHaveBeenCalled();
    expect(ai.chat.mock.calls[0][0].messages.at(-1).video.uri).toBe("https://g/files/1");
    vi.unstubAllGlobals();
  });

  it("keeps a caption the agent already wrote", async () => {
    store.getContent.mockImplementation(async () => item(video({ caption: "ของตัวแทน" })));
    ai.chat.mockResolvedValue(reply({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "ของ AI" }));
    await runTranscribe(item(video({ caption: "ของตัวแทน" })));
    expect((store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!.caption).toBe("ของตัวแทน");
  });

  it("an unreadable reply: marked failed, said so, nothing delivered", async () => {
    ai.chat.mockResolvedValue(reply("nonsense"));
    const r = await runTranscribe(item());
    expect(r.ok).toBe(false);
    expect((store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!.transcribeFailed).toBe(true);
  });

  it("an expired clip is not sent", async () => {
    const r = await runTranscribe(item(video({ expired: true })));
    expect(r.ok).toBe(false);
    expect(ai.chat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `npx vitest run tests/content/clip-run.test.ts` → FAIL

- [ ] **Step 7: Implement `src/lib/content/clip-run.ts`**

```ts
import { BudgetExceeded, chat, providerKey } from "@/lib/ai/client";
import { uploadToGemini } from "@/lib/ai/gemini-files";
import type { ClipResult } from "@/app/studio/clip";
import { briefFor } from "./brief";
import type { ClipVideo } from "./clip";
import { clipReadUrl } from "./clip-store";
import { captionFlags, clipMessages, CLIP_MODEL, GEMINI_LINK_MAX_BYTES, parseClipReply, spokenFlagsOf } from "./clip-transcribe";
import { modeChecks } from "./mode-checks";
import { contentProduct } from "./products";
import { getContent, listWords, saveOutputIf, type ContentItem } from "./store";

/**
 * A clip's listening round, on the server (owner, 2026-10-02). Called by transcribeClip only,
 * which holds the limits and the wallet; a result that is not ok is not charged.
 */

const LISTEN_TIMEOUT_MS = 240_000;
const UNREAD = "ถอดเสียงไม่สำเร็จ — กด “ถอดเสียงอีกครั้ง” หรือเขียนแคปชันเองได้เลย";

/** where a figure said or written may come from: the plan's own figures, the script, the agent's note */
export function clipYardstick(item: ContentItem): string {
  const v = item.output.video;
  return [briefFor(item.planHref)?.text ?? "", item.output.hooks.join("\n"), item.output.body, item.output.closing, v?.brief ?? ""].join("\n");
}

async function videoUri(v: ClipVideo): Promise<string> {
  const link = await clipReadUrl(v.path, 60 * 60);
  if (v.sizeBytes <= GEMINI_LINK_MAX_BYTES) return link;
  const key = await providerKey("google");
  if (!key) throw new Error("no Gemini key");
  const file = await fetch(link, { signal: AbortSignal.timeout(300_000) });
  if (!file.ok || !file.body) throw new Error(`clip not read for Gemini: ${file.status}`);
  return uploadToGemini({ apiKey: key, body: file.body, sizeBytes: v.sizeBytes, mimeType: v.mime, displayName: v.path });
}

/** writes what the listening found onto the piece's clip, on the newest copy of the piece */
async function keep(id: string, path: string, change: (v: ClipVideo) => ClipVideo): Promise<ContentItem | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = await getContent(id);
    const v = now?.output.video;
    // the clip was swapped for another meanwhile: this one's findings are not that one's
    if (!now || !v || v.path !== path) return null;
    const saved = await saveOutputIf(id, { ...now.output, video: change(v) }, undefined, now.output.rev ?? null);
    if (saved) return saved;
  }
  return null;
}

export async function runTranscribe(item: ContentItem): Promise<ClipResult> {
  const v = item.output.video;
  if (!v) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
  if (v.expired) return { ok: false, error: "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อน" };
  try {
    const uri = await videoUri(v);
    const messages = clipMessages({
      script: [item.output.hooks[0] ?? "", item.output.body, item.output.closing].filter(Boolean).join("\n"),
      brief: v.brief ?? "",
      product: contentProduct(item.planHref)?.name ?? "",
    });
    messages[messages.length - 1] = { ...messages[messages.length - 1], video: { uri, mimeType: v.mime } };
    const reply = await chat({
      tier: "large", task: "content-clip", messages, only: CLIP_MODEL, json: true,
      maxTokens: 6000, timeoutMs: LISTEN_TIMEOUT_MS, mediaResolution: "low",
    });
    const heard = parseClipReply(reply.text, v.durationSec);
    if (!heard) {
      console.error(`clip reply unreadable (${reply.model}, ${reply.outputTokens} tokens)`);
      await keep(item.id, v.path, (now) => ({ ...now, transcribeFailed: true }));
      return { ok: false, error: UNREAD };
    }
    const words = await listWords();
    const yardstick = clipYardstick(item);
    const checks = modeChecks(item.planHref, v.brief);
    const saved = await keep(item.id, v.path, (now) => {
      const caption = now.caption.trim() ? now.caption : heard.caption;
      const next: ClipVideo = {
        ...now, transcript: heard.segments, caption,
        flags: captionFlags(caption, yardstick, words, checks),
        spokenFlags: spokenFlagsOf(heard.segments, words, yardstick, checks),
      };
      delete next.transcribeFailed;
      return next;
    });
    if (!saved) return { ok: false, error: "คลิปถูกเปลี่ยนระหว่างถอดเสียง — ลองถอดเสียงอีกครั้ง" };
    return { ok: true, item: saved };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: "ถึงงบค่า AI ของเดือนนี้แล้ว" };
    console.error("clip transcription failed:", e);
    await keep(item.id, v.path, (now) => ({ ...now, transcribeFailed: true })).catch(() => null);
    return { ok: false, error: UNREAD };
  }
}
```

- [ ] **Step 8: Register the round and add the action**

- `src/lib/auth/quota.ts:27`: `export const AI_ROUNDS = ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft", "ai-clip"] as const;`
- `src/lib/wallet/money.ts` `ROUND_HOLD_THB`: add `"ai-clip": 3,`
- `src/app/studio/wallet/WalletClient.tsx:8`: add `"ai-clip": "ถอดเสียงคลิป",` to the labels record
- `tests/wallet/take-round.test.ts:55`: append `"ai-clip"` to the expected `p_rounds`

Append to `src/app/studio/clip.ts`:

```ts
import { ceilingBeforeRound } from "@/lib/content/ceiling";
import { runTranscribe } from "@/lib/content/clip-run";
import { takeRound } from "@/lib/auth/quota";
import { payRound } from "@/lib/wallet/round";
import { limiter } from "@/lib/assistant/rate-limit";

const listensPerHour = limiter(20, 60 * 60_000);

/** ถอดเสียง: one paid round per press (owner, 2026-10-02); a round that fails is not charged. */
export async function transcribeClip(id: string): Promise<ClipResult> {
  const viewer = await requireMember();
  if (!listensPerHour(`clip:${viewer.agentId ?? "staff"}`)) return { ok: false, error: "ถอดเสียงครบ 20 ครั้งในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  const item = await getContent(id).catch(() => null);
  if (!item?.output.video) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${ceiling} บาทแล้ว` };
  const pass = await takeRound(viewer, "ai-clip");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => runTranscribe(item));
}
```

(move these imports to the top of the file with the others; check `ceilingBeforeRound`'s return type in `src/lib/content/ceiling.ts` and word the refusal the way `generateDraft` does with `capReached` — reuse that helper if it is exported.)

Add a test to `tests/content/clip-actions.test.ts` mocking `@/lib/auth/quota` (`takeRound` → `{ ok: true, paidBy: "staff" }`), `@/lib/content/ceiling` (`ceilingBeforeRound` → `null`), `@/lib/content/clip-run` (`runTranscribe` → `{ ok: true, item }`), and `@/lib/wallet/round` (`payRound: (_p, run) => run()`):

```ts
it("transcribeClip takes an ai-clip round and runs it", async () => {
  store.getContent.mockResolvedValue(item({ output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS } } }));
  const r = await transcribeClip(PIECE);
  expect(quota.takeRound).toHaveBeenCalledWith(expect.anything(), "ai-clip");
  expect(r.ok).toBe(true);
});
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run tests/content/clip-transcribe.test.ts tests/content/clip-run.test.ts tests/content/clip-actions.test.ts tests/wallet` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 10: Commit**

```bash
git add src/lib/content/clip-transcribe.ts src/lib/content/clip-run.ts src/app/studio/clip.ts src/lib/auth/quota.ts src/lib/wallet/money.ts src/app/studio/wallet/WalletClient.tsx tests/content/clip-transcribe.test.ts tests/content/clip-run.test.ts tests/content/clip-actions.test.ts tests/wallet/take-round.test.ts
git commit -m "feat(studio): listen to a clip — timed Thai transcript, a caption, warnings by the second"
```

---

### Task 8: แก้แคปชัน (`saveClipCaption`)

**Files:**
- Modify: `src/app/studio/clip.ts`
- Test: `tests/content/clip-actions.test.ts`

**Interfaces:**
- Consumes: `captionFlags` (Task 7), `clipYardstick` (Task 7), `listWords`, `modeChecks`, `saveOutputIf`, `getContent`, `onPage`
- Produces: `saveClipCaption(id: string, caption: string): Promise<ClipResult>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/content/clip-actions.test.ts` (add `listWords: vi.fn(async () => [{ word: "การันตี", kind: "banned", fix: null }])` to the `store` mock and import `saveClipCaption`):

```ts
describe("saveClipCaption", () => {
  const withClip = (over: Partial<ContentItem> = {}) => item({
    output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "เดิม", flags: NO_FLAGS } },
    ...over,
  });

  it("keeps the words and checks them again", async () => {
    store.getContent.mockResolvedValue(withClip());
    const r = await saveClipCaption(PIECE, "  การันตีครับ  ");
    expect(r.ok).toBe(true);
    const v = (store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!;
    expect(v.caption).toBe("การันตีครับ");
    expect(v.flags.words.map((w) => w.word)).toEqual(["การันตี"]);
  });

  it("refuses a Reel already held or posted, and a piece with no clip", async () => {
    store.getContent.mockResolvedValue(withClip({ publish: { state: "scheduled", pageId: "105", postId: "v", at: "2099-01-01T00:00:00Z", error: null } }));
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    store.getContent.mockResolvedValue(item());
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/clip-actions.test.ts` → the new tests FAIL

- [ ] **Step 3: Implement**

Append to `src/app/studio/clip.ts` (imports at the top: `captionFlags` from `@/lib/content/clip-transcribe`, `clipYardstick` from `@/lib/content/clip-run`, `modeChecks` from `@/lib/content/mode-checks`, `listWords` from the store, `MAX_CAPTION` from clip):

```ts
/**
 * The agent's caption, kept and checked again. Only before the Reel is held: changing a held
 * one means sending the whole file again — cancel the schedule first (owner, 2026-10-02).
 */
export async function saveClipCaption(id: string, caption: string): Promise<ClipResult> {
  await requireMember();
  const text = (typeof caption === "string" ? caption : "").trim().slice(0, MAX_CAPTION);
  try {
    const words = await listWords();
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      const v = item?.output.video;
      if (!item || !v) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
      if (onPage(item.publish)) return { ok: false, error: "Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนแก้แคปชัน" };
      const flags = captionFlags(text, clipYardstick(item), words, modeChecks(item.planHref, v.brief));
      const saved = await saveOutputIf(id, { ...item.output, video: { ...v, caption: text, flags } }, undefined, item.output.rev ?? null);
      if (saved) return { ok: true, item: saved };
    }
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วบันทึกอีกครั้ง" };
  } catch (e) {
    console.error("clip caption not saved:", e);
    return { ok: false, error: "บันทึกแคปชันไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/content/clip-actions.test.ts` → PASS

```bash
git add src/app/studio/clip.ts tests/content/clip-actions.test.ts
git commit -m "feat(studio): edit a clip's caption, checked as a post's words are"
```

---

### Task 9: เก็บกวาดไฟล์ (cron รายวัน)

**Files:**
- Create: `src/lib/content/clip-sweep.ts`
- Create: `src/app/api/content-video/sweep/route.ts`
- Modify: `vercel.json` (cron `0 4 * * *`)
- Test: `tests/content/clip-sweep.test.ts`

**Interfaces:**
- Consumes: `CLIP_BUCKET`, `CLIP_DRAFT_DAYS`, `ClipVideo` (Task 1); `VERIFY_WINDOW_MS` (publish-flow); `supabaseAdmin`; `refuseUnlessCron`
- Produces:
  - `type SweepRow = { id: string; video: ClipVideo | null; state: string | null; at: string | null; rev: string | null }`
  - `type SweepFile = { piece: string; name: string; createdAt: string }`
  - `sweepPlan(files: SweepFile[], rows: Map<string, SweepRow>, now: Date): { remove: string[]; expire: string[] }` (pure)
  - `sweepClips(now?: Date): Promise<{ removed: number; expired: number }>`

- [ ] **Step 1: Write the failing tests for the pure plan**

`tests/content/clip-sweep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sweepPlan, type SweepFile, type SweepRow } from "@/lib/content/clip-sweep";
import { NO_FLAGS } from "@/lib/content/clip";

const now = new Date("2026-12-31T00:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const file = (piece: string, name: string, h = 30): SweepFile => ({ piece, name, createdAt: ago(h) });
const row = (id: string, name: string, over: Partial<SweepRow> = {}, uploadedH = 30): SweepRow => ({
  id, rev: "r", state: null, at: null,
  video: { path: `${id}/${name}`, durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: ago(uploadedH), caption: "", flags: NO_FLAGS },
  ...over,
});

describe("sweepPlan", () => {
  it("removes a file whose piece is gone, and a file no piece points at, once a day old", () => {
    const rows = new Map([["a", row("a", "keep.mp4")]]);
    const plan = sweepPlan([file("gone", "x.mp4"), file("a", "old.mp4"), file("a", "keep.mp4"), file("a", "fresh.mp4", 2)], rows, now);
    expect(plan.remove.sort()).toEqual(["a/old.mp4", "gone/x.mp4"]);
    expect(plan.expire).toEqual([]);
  });

  it("lets a posted clip's file go 48 hours after it went up", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "published", at: ago(49) })],
      ["b", row("b", "v.mp4", { state: "published", at: ago(10) })],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now);
    expect(plan.remove).toEqual(["a/v.mp4"]);
    expect(plan.expire).toEqual(["a"]);
  });

  it("lets a never-scheduled clip's file go after 60 days", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", {}, 24 * 61)],
      ["b", row("b", "v.mp4", { state: "failed" }, 24 * 61)],
      ["c", row("c", "v.mp4", {}, 24 * 59)],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4"), file("c", "v.mp4")], rows, now);
    expect(plan.remove.sort()).toEqual(["a/v.mp4", "b/v.mp4"]);
    expect(plan.expire.sort()).toEqual(["a", "b"]);
  });

  it("never touches a held clip, however old", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "scheduled", at: ago(-24) }, 24 * 90)],
      ["b", row("b", "v.mp4", { state: "posting", at: ago(1) }, 24 * 90)],
    ]);
    expect(sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now)).toEqual({ remove: [], expire: [] });
  });

  it("does not expire a clip already expired", () => {
    const r = row("a", "v.mp4", {}, 24 * 61);
    r.video!.expired = true;
    expect(sweepPlan([file("a", "v.mp4")], new Map([["a", r]]), now)).toEqual({ remove: ["a/v.mp4"], expire: [] });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/clip-sweep.test.ts` → FAIL

- [ ] **Step 3: Implement `src/lib/content/clip-sweep.ts`**

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET, CLIP_DRAFT_DAYS, type ClipVideo } from "./clip";
import { VERIFY_WINDOW_MS } from "./publish-flow";

/**
 * Once a day, the clips nobody needs (owner, 2026-10-02): a posted Reel's file 48 hours after
 * it went up (Facebook has its own copy, and the check that it went up is done), a clip never
 * scheduled after 60 days, and files no piece points at. A held or sending Reel's file is never
 * touched — a move sends it again.
 */

export interface SweepRow { id: string; video: ClipVideo | null; state: string | null; at: string | null; rev: string | null }
export interface SweepFile { piece: string; name: string; createdAt: string }

const DAY = 24 * 60 * 60_000;
const HELD = new Set(["scheduled", "posting"]);

export function sweepPlan(files: SweepFile[], rows: Map<string, SweepRow>, now: Date): { remove: string[]; expire: string[] } {
  const remove: string[] = [];
  const expire = new Set<string>();
  const t = now.getTime();
  for (const f of files) {
    const path = `${f.piece}/${f.name}`;
    const r = rows.get(f.piece);
    const v = r?.video;
    if (!r || !v || v.path !== path) {
      // an upload left half way, a clip replaced, a piece deleted: a day's grace for one still arriving
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
  }
  return { remove, expire: [...expire] };
}

export async function sweepClips(now = new Date()): Promise<{ removed: number; expired: number }> {
  const db = supabaseAdmin();
  const bucket = db.storage.from(CLIP_BUCKET);
  const { data: dirs, error } = await bucket.list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  const pieces = (dirs ?? []).map((d) => d.name).filter(Boolean);
  if (pieces.length === 0) return { removed: 0, expired: 0 };

  const files: SweepFile[] = [];
  for (const piece of pieces) {
    const { data } = await bucket.list(piece, { limit: 100 });
    for (const f of data ?? []) files.push({ piece, name: f.name, createdAt: f.created_at ?? now.toISOString() });
  }
  const { data: found, error: readErr } = await db.from("ins_content")
    .select("id, output, publish_state, publish_at").in("id", pieces);
  if (readErr) throw new Error(readErr.message);
  const rows = new Map<string, SweepRow>();
  for (const r of (found ?? []) as { id: string; output: { video?: ClipVideo; rev?: string } | null; publish_state: string | null; publish_at: string | null }[]) {
    rows.set(r.id, { id: r.id, video: r.output?.video ?? null, state: r.publish_state, at: r.publish_at, rev: r.output?.rev ?? null });
  }

  const plan = sweepPlan(files, rows, now);
  const marked = new Set<string>();
  for (const id of plan.expire) {
    const { data } = await db.from("ins_content").select("output").eq("id", id).maybeSingle();
    const output = (data as { output?: { video?: ClipVideo; rev?: string } } | null)?.output;
    if (!output?.video) continue;
    let q = db.from("ins_content").update({ output: { ...output, video: { ...output.video, expired: true }, rev: crypto.randomUUID() } }).eq("id", id);
    q = output.rev ? q.eq("output->>rev", output.rev) : q.is("output->>rev", null);
    const { data: done, error: e } = await q.select("id");
    if (e) console.error(`clip ${id} not marked expired:`, e.message);
    else if ((done ?? []).length === 1) marked.add(id);
  }
  // a piece's file goes only after its row says expired — a row left pointing at nothing would
  // offer a dead player; one not marked this time is tried again tomorrow
  const waiting = new Set(plan.expire.filter((id) => !marked.has(id)));
  const removable = plan.remove.filter((p) => !waiting.has(p.split("/")[0]));
  const expired = marked.size;
  for (let i = 0; i < removable.length; i += 100) {
    const { error: e } = await bucket.remove(removable.slice(i, i + 100));
    if (e) console.error("clips not removed:", e.message);
  }
  return { removed: removable.length, expired };
}
```

- [ ] **Step 4: The route and the cron**

`src/app/api/content-video/sweep/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sweepClips } from "@/lib/content/clip-sweep";
import { refuseUnlessCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel calls this once a day (vercel.json) with the cron secret; see clip-sweep.ts. */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  try {
    return NextResponse.json(await sweepClips());
  } catch (e) {
    console.error("clip sweep failed:", e);
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
```

`vercel.json` `crons` gains `{ "path": "/api/content-video/sweep", "schedule": "0 4 * * *" }`.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/content/clip-sweep.test.ts` → PASS

```bash
git add src/lib/content/clip-sweep.ts src/app/api/content-video/sweep/route.ts vercel.json tests/content/clip-sweep.test.ts
git commit -m "feat(studio): a daily sweep lets clips go once Facebook has them, or after 60 idle days"
```

---

### Task 10: หน้าจอ — ฟอร์มคลิป, การ์ด, หน้าแก้, ลงเพจ, ปฏิทิน

**Files:**
- Create: `src/app/studio/clip/ClipTools.tsx` (the "คลิป" form)
- Create: `src/app/studio/clip/useClipUpload.ts` (start → TUS → finish → transcribe)
- Create: `src/app/studio/clip/ClipCard.tsx` (card for a clip piece)
- Create: `src/app/studio/clip/ClipEditor.tsx` (player, caption, warnings, transcript, PublishPanel)
- Modify: `src/app/studio/ContentStudio.tsx` (mode, cards, editor switch, bulk `whyNot`, bulk confirmSpoken note)
- Modify: `src/app/studio/ScriptCard.tsx` (แนบคลิป button, ▶ badge)
- Modify: `src/app/studio/PublishPanel.tsx` (confirmSpoken, 29 days, Reel link)
- Modify: `src/lib/content/calendar.ts` (`BoardItem.reel`), `src/app/studio/calendar/page.tsx` (fill it), `src/app/studio/calendar/CalendarBoard.tsx` (▶, link, confirmSpoken)
- Modify: `src/lib/content/store.ts` `listWaiting` (Reels wait on the rail too)

**Interfaces:**
- Consumes: everything above. `useClipUpload` returns `{ busy: boolean; progress: number | null; note: string | null; send: (file: File, target: { pieceId?: string; page?: string; brief?: string }) => Promise<ContentItem | null> }`

UI work is checked in the browser, not vitest (vitest runs `tests/**/*.test.ts` in node only).

- [ ] **Step 1: `useClipUpload`**

`src/app/studio/clip/useClipUpload.ts`:

```ts
"use client";
import { useState } from "react";
import { clipProblem } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { finishClipUpload, startClipUpload, transcribeClip } from "../clip";
import { readClipFile, uploadClip } from "./upload";

/**
 * One clip from the phone to its piece: read, checked, uploaded straight to storage, kept,
 * then listened to. `onItem` hears the piece at each step, so the card shows it as it goes.
 */
export function useClipUpload(onItem: (item: ContentItem) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(file: File, target: { pieceId?: string; page?: string; brief?: string }): Promise<ContentItem | null> {
    setNote(null);
    const meta = await readClipFile(file);
    const problem = clipProblem(meta);
    if (problem) { setNote(problem); return null; }
    setBusy(true);
    setProgress(0);
    try {
      const started = await startClipUpload({ pieceId: target.pieceId, page: target.page, file: meta });
      if (!started.ok) { setNote(started.error); return null; }
      if (started.item) onItem(started.item);
      try {
        await uploadClip({ file, path: started.path, token: started.token, onProgress: setProgress });
      } catch {
        setNote("อัปโหลดไม่สำเร็จ — เช็กสัญญาณเน็ตแล้วกดอัปโหลดอีกครั้ง ระบบจะต่อจากที่ค้างไว้");
        return null;
      }
      setProgress(1);
      const kept = await finishClipUpload({ pieceId: started.pieceId, path: started.path, file: meta, brief: target.brief });
      if (!kept.ok) { setNote(kept.error); return null; }
      onItem(kept.item);
      setProgress(null);
      setNote("อัปโหลดแล้ว กำลังถอดเสียงและร่างแคปชัน…");
      const heard = await transcribeClip(kept.item.id).catch(() => null);
      if (!heard) { setNote("ถอดเสียงไม่สำเร็จ — กด “ถอดเสียงอีกครั้ง” ที่การ์ดได้"); return kept.item; }
      if (!heard.ok) { setNote(heard.error); return kept.item; }
      onItem(heard.item);
      setNote(null);
      return heard.item;
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return { busy, progress, note, send };
}
```

- [ ] **Step 2: `ClipTools`** — the form

`src/app/studio/clip/ClipTools.tsx`:

```tsx
"use client";
import { useId, useRef, useState } from "react";
import { CLIP_MIMES, MAX_CLIP_BRIEF } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { FormSection } from "../ui/form-parts";
import { useClipUpload } from "./useClipUpload";

/** คลิป (owner, 2026-10-02): a clip the agent filmed, uploaded to become a Reel on the Page. */
export function ClipTools({ page, onItem, folded, formId }: {
  page?: string;
  onItem: (item: ContentItem) => void;
  folded?: boolean;
  formId?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [brief, setBrief] = useState("");
  const { busy, progress, note, send } = useClipUpload(onItem);
  const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

  async function go() {
    if (!file) { input.current?.click(); return; }
    const done = await send(file, { page, brief: brief.trim() });
    if (done) { setFile(null); setBrief(""); if (input.current) input.current.value = ""; }
  }

  return (
    <div id={formId} className="space-y-4 p-4">
      <div className={folded ? "hidden lg:block" : ""}>
        <FormSection title="คลิปที่ถ่ายแล้ว">
          <p className="text-xs text-[var(--ct-mute)]">แนวตั้ง · 3–90 วินาที · .mp4 หรือ .mov · ไม่เกิน 300MB — ระบบถอดเสียง ร่างแคปชัน และตรวจคำให้</p>
          <label htmlFor={`${id}-file`} className="mt-2 block text-sm font-medium">ไฟล์คลิป</label>
          <input
            ref={input} id={`${id}-file`} type="file" accept={[...CLIP_MIMES, ".mov", ".mp4"].join(",")} disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-[var(--ct-line)] file:bg-[var(--ct-panel)] file:px-3"
          />
          <label htmlFor={`${id}-brief`} className="mt-3 block text-sm font-medium">คลิปนี้พูดเรื่องอะไร (ไม่บังคับ)</label>
          <textarea
            id={`${id}-brief`} value={brief} maxLength={MAX_CLIP_BRIEF} rows={2} disabled={busy}
            onChange={(e) => setBrief(e.target.value)} placeholder="เช่น ลดหย่อนภาษีด้วยประกันบำนาญ" className={field}
          />
        </FormSection>
      </div>
      {progress !== null && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 overflow-hidden rounded-full bg-[var(--ct-soft)]">
          <div className="h-full bg-[var(--ct-accent)] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}
      <button
        type="button" onClick={go} disabled={busy}
        className="min-h-11 w-full rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
      >
        {busy ? (progress !== null && progress < 1 ? `กำลังอัปโหลด ${Math.round(progress * 100)}%` : "กำลังถอดเสียง…") : file ? "อัปโหลดคลิป" : "เลือกไฟล์คลิป"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire the mode into `ContentStudio`**

In `src/app/studio/ContentStudio.tsx`:
- `type Mode = "plan" | "claim" | "recruit" | "knowledge" | "draft" | "clip";` and add `"clip"` to `MODES`; add `["clip", CLIP_NAME]` to `MODE_OPTIONS` (import `CLIP_NAME`, `isReelPiece` from `@/lib/content/clip`; `ClipTools` from `./clip/ClipTools`; `ClipCard` from `./clip/ClipCard`; `ClipEditor` from `./clip/ClipEditor`)
- add a function next to `saved`:

```tsx
  /** a clip piece as it arrives and changes (clip/useClipUpload.ts): new ones go on top of รอตรวจ */
  function clipArrived(next: ContentItem) {
    if (view.current.items.some((x) => x.id === next.id)) { saved(next); return; }
    if (tab !== "draft") return;
    setItems((list) => [next, ...list]);
    setCounts((c) => ({ ...c, draft: c.draft + 1 }));
  }
```

(check the names `view`, `tab`, `setCounts` against the file; they are used by `published` above.)
- after the `<div hidden={mode !== "draft"}>…</div>` block add:

```tsx
          <div hidden={mode !== "clip"}>
            <ClipTools page={project?.pageId} onItem={clipArrived} folded={!formOpen} formId={mode === "clip" ? formId : undefined} />
          </div>
```

- the card branch: replace `{item.format === "script" ? (<ScriptCard … />) : (<PieceCard … />)}` with three arms — `item.format === "clip"` → `<ClipCard item={item} index={i} busy={busy.has(item.id)} onEdit={() => openEditor(item.id)} onStatus={(s) => changeStatus(item, s)} onDelete={() => remove(item)} onItem={clipArrived} />`; `script` → the `ScriptCard` with the new `onItem={clipArrived}` prop (Step 5); else `PieceCard` as now
- the editor: where `<PieceEditor key={editingItem.id} … />` is rendered, render instead when `isReelPiece(editingItem)`:

```tsx
              <ClipEditor
                key={editingItem.id}
                item={editingItem}
                planner={planner}
                onSaved={saved}
                onPublished={published}
                onStatus={(s) => changeStatus(editingItem, s)}
                onItem={clipArrived}
                onClose={closeEditor}
                suggestDay={forDay}
              />
```
- `whyNot` (ตั้งเวลาหลายชิ้น) becomes:

```tsx
  const whyNot = (i: ContentItem): string | undefined => {
    const reel = Boolean(i.output.video);
    const policy = (reel ? i.output.video!.flags : i.flags).policy ?? [];
    return i.format !== "post" && !reel ? "ไม่ใช่โพสต์"
      : i.output.video?.expired ? "ไฟล์คลิปหมดอายุ"
        : policy.some((f) => f.severity === "block") ? "ผิดกฎ Facebook"
          : drawing.has(i.id) ? "รอภาพ"
            : onPage(i.publish) ? "ตั้งเวลาแล้ว" : undefined;
  };
```
- the bulk send's left-behind note (line ~890) becomes `!res ? "การเชื่อมต่อหลุด" : res.confirmNumbers ? "มีตัวเลขต้องยืนยัน" : res.confirmSpoken ? "มีเสียงพูดต้องตรวจ" : res.error`

- [ ] **Step 4: `ClipCard`**

`src/app/studio/clip/ClipCard.tsx`:

```tsx
"use client";
import { useRef } from "react";
import { clockOf } from "@/lib/content/clip";
import { publishLabel } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { ask } from "../ask";
import { useClipUpload } from "./useClipUpload";

/** A clip piece on the workbench: the clip's facts, its caption, what to check, and แนบใหม่ (owner, 2026-10-02). */
export function ClipCard({ item, index, busy, onEdit, onStatus, onDelete, onItem }: {
  item: ContentItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  onItem: (item: ContentItem) => void;
}) {
  const v = item.output.video;
  const input = useRef<HTMLInputElement>(null);
  const upload = useClipUpload(onItem);
  const warnings = (v?.spokenFlags?.length ?? 0) + (v ? v.flags.words.length + v.flags.numbers.length + (v.flags.policy?.length ?? 0) : 0);
  const blocking = (v?.flags.policy ?? []).some((f) => f.severity === "block");
  const label = publishLabel(item.publish);
  const cell = "flex min-h-11 items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${item.status === "trashed" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ct-hair)] px-3 py-2.5">
        <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">▶ คลิป {index + 1}</span>
        {v && <span className="text-xs text-[var(--ct-mute)]">{[clockOf(v.durationSec), `${(v.sizeBytes / 1_048_576).toFixed(0)}MB`, label].filter(Boolean).join(" · ")}</span>}
        {warnings > 0 && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${warnings}`}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-2 px-3 py-3 text-sm">
        {!v ? <p className="text-[var(--ct-mute)]">ยังไม่มีไฟล์คลิป — แนบคลิปได้เลย</p>
          : v.expired ? <p className="text-[var(--ct-warn-ink)]">ไฟล์คลิปหมดอายุ — แนบใหม่ได้</p>
            : !v.transcript ? <p className="text-[var(--ct-mute)]">{v.transcribeFailed ? "ถอดเสียงไม่สำเร็จ — เปิดแก้ไขเพื่อลองอีกครั้ง" : "กำลังถอดเสียง…"}</p>
              : null}
        {v?.caption && <p className="line-clamp-4 whitespace-pre-line leading-relaxed">{v.caption}</p>}
        {upload.note && <p role="status" className="text-xs text-[var(--ct-mute)]">{upload.note}</p>}
      </div>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void upload.send(f, { pieceId: item.id });
        e.target.value = "";
      }} />
      <div className="grid grid-cols-3 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
        <button type="button" className={cell} onClick={onEdit} disabled={busy || !v}>แก้ไข / ลงเพจ</button>
        <button type="button" className={cell} onClick={() => input.current?.click()} disabled={busy || upload.busy}>
          {upload.busy ? (upload.progress !== null && upload.progress < 1 ? `${Math.round(upload.progress * 100)}%` : "กำลังถอดเสียง…") : v ? "แนบใหม่" : "แนบคลิป"}
        </button>
        {item.status === "trashed"
          ? <button type="button" className={cell} onClick={async () => { if (await ask("ลบคลิปนี้ถาวร?", "ลบถาวร")) onDelete(); }} disabled={busy}>ลบถาวร</button>
          : <button type="button" className={cell} onClick={() => onStatus("trashed")} disabled={busy}>ทิ้ง</button>}
      </div>
    </article>
  );
}
```

(check `publishLabel`'s signature in `src/lib/content/publish-label.ts`; ScriptCard's own buttons are the model for the button row and its trash/delete wording — copy theirs if they differ.)

- [ ] **Step 5: `ScriptCard` gains แนบคลิป**

In `src/app/studio/ScriptCard.tsx`:
- `Props` gains `/** a clip arrived on this script (clip/useClipUpload.ts) */ onItem: (item: ContentItem) => void;`
- import `useRef` and `useClipUpload`; inside the component: `const input = useRef<HTMLInputElement>(null); const upload = useClipUpload(onItem); const filmed = item.output.video && !item.output.video.expired;`
- in the header's meta line add `filmed && "มีคลิปแล้ว ▶"` to the list joined by " · "
- add the hidden file input (as in ClipCard) and, in the button row, a button: `{filmed ? "แนบคลิปใหม่" : "แนบคลิปที่ถ่ายแล้ว"}` that clicks it, showing `upload.progress`/`กำลังถอดเสียง…` while busy, and `upload.note` under the list
- when `filmed`, the existing แก้ไข button reads `แก้ไข / ลงเพจ` (it opens ClipEditor through ContentStudio's switch)

- [ ] **Step 6: `ClipEditor`**

`src/app/studio/clip/ClipEditor.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { clockOf, MAX_CAPTION, reelDescription } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { onPage } from "@/lib/content/publish-label";
import { clipViewUrl, saveClipCaption, transcribeClip } from "../clip";
import { PublishPanel } from "../PublishPanel";
import { BackIcon } from "../ui/editor-icons";

/**
 * A Reel before it goes (owner, 2026-10-02): the clip to watch, the caption to edit, what was
 * said that a post would be flagged for — each jumps the player to its second — and ลงเพจ.
 */
export function ClipEditor({ item, planner, onSaved, onPublished, onStatus, onItem, onClose, suggestDay }: {
  item: ContentItem;
  planner?: boolean;
  onSaved: (item: ContentItem) => void;
  onPublished: (item: ContentItem) => void;
  onStatus: (status: ContentItem["status"]) => void | Promise<unknown>;
  onItem: (item: ContentItem) => void;
  onClose: () => void;
  suggestDay?: string | null;
}) {
  const v = item.output.video;
  const player = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [caption, setCaption] = useState(v?.caption ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const locked = onPage(item.publish);
  const dirty = caption.trim() !== (v?.caption ?? "").trim();

  useEffect(() => { void clipViewUrl(item.id).then(setSrc).catch(() => setSrc(null)); }, [item.id, v?.path]);
  useEffect(() => { setCaption(v?.caption ?? ""); }, [v?.caption]);

  /** PublishPanel's beforePublish: the caption on screen is the one that goes */
  async function save(): Promise<boolean> {
    if (!dirty) return true;
    const r = await saveClipCaption(item.id, caption);
    if (!r.ok) { setNote(r.error); return false; }
    onSaved(r.item);
    return true;
  }

  async function listen() {
    setWorking(true);
    setNote("กำลังถอดเสียง…");
    const r = await transcribeClip(item.id).catch(() => null);
    setWorking(false);
    if (!r) { setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ"); return; }
    if (!r.ok) { setNote(r.error); return; }
    setNote(null);
    onItem(r.item);
  }

  const seek = (at: number) => { if (player.current) { player.current.currentTime = at; void player.current.play(); } };
  const flags = v?.flags;

  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-1 text-sm"><BackIcon className="size-4" />กลับ</button>
        <h2 className="text-base font-semibold">คลิป Reel</h2>
      </div>
      {!v ? <p className="text-sm">ยังไม่มีคลิป</p> : v.expired ? <p className="text-sm text-[var(--ct-warn-ink)]">ไฟล์คลิปหมดอายุ — แนบใหม่ที่การ์ด</p> : (
        <video ref={player} src={src ?? undefined} controls playsInline className="mx-auto max-h-[60vh] rounded-lg bg-black" />
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">แคปชัน</span>
        <textarea
          value={caption} onChange={(e) => setCaption(e.target.value)} readOnly={locked} rows={6} maxLength={MAX_CAPTION}
          className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--ct-accent)]"
        />
        {locked && <span className="text-xs text-[var(--ct-mute)]">ตั้งเวลาแล้ว — ยกเลิกคิวก่อนถ้าจะแก้แคปชัน</span>}
      </label>
      {!locked && dirty && (
        <button type="button" onClick={() => void save()} className="min-h-11 rounded-lg border border-[var(--ct-line)] px-4 text-sm">บันทึกแคปชัน</button>
      )}

      {flags && (flags.words.length + flags.numbers.length + (flags.policy?.length ?? 0)) > 0 && (
        <div className="rounded-lg bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          <p className="font-medium">ในแคปชัน</p>
          <ul className="mt-1 list-disc pl-5">
            {flags.words.map((w, i) => <li key={`w${i}`}>คำว่า “{w.word}”{w.fix ? ` — ใช้ “${w.fix}” แทน` : ""}</li>)}
            {flags.numbers.map((n, i) => <li key={`n${i}`}>ตัวเลข {n} ไม่ตรงกับตารางเบี้ย</li>)}
            {(flags.policy ?? []).map((f, i) => <li key={`p${i}`}>{f.message}</li>)}
          </ul>
        </div>
      )}

      {v && (
        <div className="rounded-lg border border-[var(--ct-hair)] p-3 text-sm">
          <p className="font-medium">เสียงพูดในคลิป</p>
          {!v.transcript ? (
            <div className="mt-1 space-y-2">
              <p className="text-[var(--ct-mute)]">{v.transcribeFailed ? "ถอดเสียงไม่สำเร็จ" : "ยังไม่ได้ถอดเสียง"} — ลงเพจได้ แต่ระบบจะขอให้ยืนยันว่ายังไม่ได้ตรวจเสียงพูด</p>
              <button type="button" onClick={listen} disabled={working} className="min-h-11 rounded-lg border border-[var(--ct-line)] px-4 disabled:opacity-50">ถอดเสียงอีกครั้ง</button>
            </div>
          ) : (
            <>
              {(v.spokenFlags ?? []).length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {v.spokenFlags!.map((f, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => seek(f.at)} className="min-h-11 text-left text-[var(--ct-warn-ink)] underline">
                        {clockOf(f.at)} · {f.message}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[var(--ct-mute)]">ไม่พบคำที่ต้องระวัง</p>}
              <p className="mt-1 text-xs text-[var(--ct-mute)]">ระบบถอดเสียงอาจได้ยินผิด — กดเวลาเพื่อฟังตรงนั้น</p>
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer">ข้อความที่ถอดได้</summary>
                <ol className="mt-1 space-y-1">
                  {v.transcript.map((s, i) => (
                    <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                      <button type="button" onClick={() => seek(s.start)} className="text-xs tabular-nums text-[var(--ct-accent)]">{clockOf(s.start)}</button>
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>
      )}

      {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}

      {!planner && v && !v.expired && (
        <PublishPanel item={{ ...item, output: { ...item.output, video: { ...v, caption } } }} hook={0} beforePublish={save}
          onPublished={onPublished} drawing={false} suggestDay={suggestDay ?? null} onBusy={() => undefined} />
      )}
      <p className="sr-only">{reelDescription(item.output)}</p>
      {item.status === "draft" && (
        <button type="button" onClick={() => void onStatus("used")} className="min-h-11 text-sm text-[var(--ct-accent)] underline">ย้ายไปใช้จริง</button>
      )}
    </section>
  );
}
```

(check `PublishPanel`'s `suggestDay`/`onBusy` prop types in `src/app/studio/PublishPanel.tsx:28-50` and match them; drop the `sr-only` line if lint flags it as unused noise.)

- [ ] **Step 7: `PublishPanel` — confirmSpoken, 29 days, Reel link**

In `src/app/studio/PublishPanel.tsx`:
- import `REEL_MAX_AHEAD_MS`, `reelLink` from `@/lib/facebook/publish` (client-safe: plain constants and a string function — if the file imports server-only code, copy the constant as `const REEL_MAX_AHEAD_MS = 29 * 24 * 60 * 60_000;` beside the existing `MAX_AHEAD_MS` and inline `reelLink`)
- `const reel = Boolean(item.output.video); const maxAhead = reel ? REEL_MAX_AHEAD_MS : MAX_AHEAD_MS;` — use `maxAhead` at line ~140 (`ahead > maxAhead`, message `ตั้งเวลาได้ไม่เกิน ${reel ? 29 : 30} วันข้างหน้า`) and in the `max={…}` of the time input (~274)
- in `send()` add `let confirmSpoken = false;` beside `confirmNumbers`, pass `confirmSpoken` to both `scheduleNextOpen` and `publishPiece`, and after the `confirmNumbers` branch:

```tsx
        if (res.confirmSpoken && !confirmSpoken) {
          const go = await ask(`ตรวจสิ่งที่พูดในคลิปก่อนลง:\n${res.confirmSpoken.join("\n")}\n\nฟังแล้ว และยังจะลงไหม?`, "ลงต่อ");
          if (!go) return;
          confirmSpoken = true;
          continue;
        }
```
- the ดูโพสต์ link (~232): `href={reel ? reelLink(item.publish.postId) : postLink(item.publish.postId)}`

- [ ] **Step 8: Calendar**

- `src/lib/content/calendar.ts` `BoardItem` gains `/** a Reel (a clip), not a picture post */ reel: boolean;`
- `src/app/studio/calendar/page.tsx` where the `BoardItem` is built: `reel: Boolean(item.output.video),`; `hook: item.output.video ? (item.output.video.caption.split("\n")[0] || "คลิป") : (item.output.hooks[0] ?? ""),`; `body: item.output.video ? item.output.video.caption : item.output.body,`; for `blocked` read `(item.output.video ? item.output.video.flags : item.flags).policy`
- `src/app/studio/calendar/CalendarBoard.tsx`:
  - import `reelLink`; where `postLink(item.postId)` is used (~682) use `item.reel ? reelLink(item.postId) : postLink(item.postId)`
  - where the card draws `item.imageUrl` (the poster thumbnail), when `item.reel` draw instead `<div aria-label="คลิป Reel" className="flex aspect-square items-center justify-center rounded bg-[var(--ct-soft)] text-lg text-[var(--ct-accent)]">▶</div>` (find the `<img` that uses `imageUrl`)
  - `type Confirmed = { confirmNumbers: boolean; confirmSpoken: boolean; force: boolean };`, initialise `confirmSpoken: false`, add after the numbers branch (~129):

```tsx
      if (res.confirmSpoken && !ok.confirmSpoken) {
        if (!(await ask(`ตรวจสิ่งที่พูดในคลิปก่อนลง:\n${res.confirmSpoken.join("\n")}\n\nฟังแล้ว และยังจะตั้งเวลาไหม?`, "ตั้งเวลาต่อ"))) return false;
        ok.confirmSpoken = true;
        continue;
      }
```
  (match the loop's own control flow — if it uses `continue` for the numbers branch do the same) and pass `confirmSpoken` in the two calls (`scheduleOnDay`, `scheduleAt`) at ~200 and ~702
- `src/lib/content/store.ts` `listWaiting`: replace `.eq("format", "post")` with `.or("format.eq.post,output->video->>path.not.is.null")` and update its comment to "Posts and Reels that could go on the calendar…"

- [ ] **Step 9: Type check, lint, unit tests**

Run: `npx tsc --noEmit && npx eslint src/app/studio src/lib/content && npx vitest run`
Expected: clean, all PASS

- [ ] **Step 10: Check it in the browser**

Start `preview_start {name: "dev"}` and sign in as the owner (the dev login of this app). On `/studio/write`:
1. สร้างจาก → คลิป: the form shows; pick a landscape mp4 → the Thai refusal shows, nothing uploads (network tab: no request to `storage.supabase.co`)
2. pick a vertical mp4 (record ~10 s on a phone, AirDrop it) → progress bar runs, a ▶ คลิป card appears in รอตรวจ, then a caption; `read_console_messages` has no errors
3. แก้ไข / ลงเพจ → ClipEditor: the player plays, the transcript lists times, pressing a time seeks the player
4. edit the caption to include "การันตี" → บันทึกแคปชัน → the caption warning shows
5. on a script card: แนบคลิปที่ถ่ายแล้ว → the same flow ends with "มีคลิปแล้ว ▶" on the card
6. resize to mobile (375 wide): the form, card and editor fit with no sideways scroll
If step 2 fails with 401/403 from storage, do Task 5 Step 6.

- [ ] **Step 11: Commit**

```bash
git add src/app/studio src/lib/content/calendar.ts src/lib/content/store.ts
git commit -m "feat(studio): คลิป form, clip cards and editor, Reels on the calendar"
```

---

### Task 11: ทดสอบกับเพจจริงและปล่อย

**Files:** none new (fixes go to the task that owns the code, with a test)

- [ ] **Step 1: Owner prerequisites** — ask the owner to (a) set Supabase Storage global file size limit to 300MB, (b) name a test Page they are happy to post a Reel on and take down.

- [ ] **Step 2: On the test Page, from the dev server**
1. clip uploaded on its own (iPhone .mov ~60 s) → ลงเลย → the Reel appears on the Page within a few minutes; `GET /{video_id}?fields=status` (Graph API Explorer or a one-off `reelState` call) answers in the documented shape
2. another clip → ตั้งเวลา 1 ชั่วโมงข้างหน้า → it shows in Meta Business Suite's planner; drag it to tomorrow on `/studio/calendar` → the old one is gone from the planner, the new one is there
3. ยกเลิกคิว → gone from the planner (this confirms `DELETE /{video_id}` on a scheduled Reel)
4. a clip that says "การันตี" → the editor lists it at the right second; ลงเลย asks to confirm first
5. an Android mp4 ~45 s → posts
6. a clip over 100MB (4K, ~30 s) → transcription completes (Files API path)
If 1 fails because Facebook cannot fetch the signed link, note the error in the spec and open a fix task (upload the bytes via rupload `offset`/`file_size` from a streamed download instead).

- [ ] **Step 3: Sweep dry check** — call `/api/content-video/sweep` locally with `Authorization: Bearer $CRON_SECRET` (`curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/content-video/sweep`) → `{ removed, expired }` with nothing of the test clips removed (they are fresh).

- [ ] **Step 4: Full verification** — `npm run verify` → clean

- [ ] **Step 5: Roll out** (memory: production-rollout) — migration is already on `cenysylrzbwfrtuqoeqk` (Task 1 Step 9); merge the branch to `main` and push only with the owner's go-ahead; after the Vercel deploy, check one upload on production with the test Page.
