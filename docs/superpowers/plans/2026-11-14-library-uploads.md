# คลังแอนิเมชัน Phase 3 (Uploads + File Queue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members send pictures and requests into คลังแอนิเมชัน, the owner reviews them, and approved pictures are used in คลิปตามโจทย์ as a scene's picture or as a style reference.

**Architecture:** One table `ins_library_uploads` and files in the private `content-media` bucket under `library/`. Browser-safe rules in `upload-rules.ts`, the server store in `uploads.ts`, one API route for sending and reading files, server actions for the owner's verdicts and deletes. The library page gains two tabs in new component files. คลิปตามโจทย์ gains `PromptScene.asset` and `PromptStoryInput.styleRef`.

**Tech Stack:** Next.js (App Router, server actions, route handlers), TypeScript, Supabase (service role), vitest, satori via `src/lib/draw-png.ts`.

**Spec:** `docs/superpowers/specs/2026-11-14-library-uploads-design.md` (read it first; every Thai string in it is exact copy). Mockup: https://claude.ai/artifact/5YukzCZyi5A2VpEWAk1sVx

## Global Constraints

- `.env.local` points at the PRODUCTION database. Never run the dev server against real actions, never run a script that writes rows, uploads files, calls an AI or charges a wallet. Tests use in-memory fakes (see `tests/scene-library/marks.test.ts` for the house style).
- The migration file is written, never applied. Nothing is pushed.
- `git add` explicit paths only, never `-A`/`.`. Commit messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Thai copy is the spec's, verbatim. Colours are the `--ct-*` tokens the library page already uses; controls are at least `min-h-tap`.
- Limits: name 1–60 chars, note 0–300, 5 MB a file (`5 * 1024 * 1024`), 20 rows a person, 0–3 screenshots on an ask, longest side 1600 px after the page's re-encode.
- `REMOTION_DRAWING` (src/lib/quote-video/remotion.ts) must not change. If `tests/quote-video/remotion-drawing.test.ts` fails, stop and report; do not bump it.
- Before each commit: `npx tsc --noEmit` clean and the task's test files green. Lint the files you touched (`npx eslint <paths>`).
- The owner is `can(viewer, "owner")` (src/lib/auth/access.ts); the demo account is `viewer.kind === "demo"`; the viewer's id is `viewer.agentId`.

## Review Focus

1. A file whose declared type is PNG but whose bytes are HTML/SVG is sent → refused by its first bytes, nothing stored. (Task 1 test.)
2. A member asks the read route for another member's file that is still `wait` or `no` → 404, same as a missing file. (Task 2 test.)
3. Two verdicts race on one row (owner double-press, or a member deletes while the owner approves) → the second changes nothing and says so; no row leaves `ok`/`no` by a verdict. (Task 1 test: decide only `where state = 'wait'`.)
4. An approved part is deleted by its sender between the script being written and the clip being made → the clip is refused before any hold with the spec's line. (Task 4 test.)
5. The uploads table is missing (code deployed before the migration) → the page opens without the new tabs, คลิปตามโจทย์ opens with no library pictures, nothing throws. (Tasks 3 and 4 tests.)

---

### Task 1: Rules, migration and store

**Files:**
- Create: `src/lib/scene-library/upload-rules.ts` (browser-safe, no server imports)
- Create: `src/lib/scene-library/uploads.ts` (server)
- Create: `supabase/migrations/20261211_library_uploads.sql`
- Modify: `src/lib/auth/member-store.ts` (the delete's returned files gain `library: string[]`; whoever clears Storage after a delete clears these `content-media` paths too — follow how `logos` is handled)
- Test: `tests/scene-library/upload-rules.test.ts`, `tests/scene-library/uploads.test.ts`, extend the member-delete test that already covers `logos`

**Interfaces — Produces:**

```ts
// upload-rules.ts
export type UploadKind = "part" | "style" | "ask";
export type UploadState = "wait" | "ok" | "no" | "queue" | "closed";
export const KIND_NAME: Record<UploadKind, string>;          // ชิ้นส่วนภาพ · ภาพสไตล์ · คำขอชิ้นใหม่
export const KIND_TELLS: Record<UploadKind, string>;         // the mockup's one-line descriptions
export const KIND_HINT: Record<UploadKind, string>;          // "PNG ไม่เกิน 5 MB" · "JPG หรือ PNG ไม่เกิน 5 MB" · "ภาพหน้าจอไม่เกิน 3 ภาพ (ไม่บังคับ)"
export const REASONS: readonly string[];                     // the four, spec order
export const NAME_MAX = 60, NOTE_MAX = 300, FILE_MAX = 5 * 1024 * 1024, PER_PERSON = 20, SHOTS_MAX = 3, SIDE_MAX = 1600;
export const RIGHTS_LINE: string;                            // the spec's rights sentence
export const isUploadKind: (v: unknown) => v is UploadKind;
export const stateWord: (kind: UploadKind, state: UploadState) => string;   // spec "States in words"
/** "png" | "jpeg" | null from the first bytes (89 50 4E 47 0D 0A 1A 0A / FF D8 FF) */
export function sniff(bytes: Uint8Array): "png" | "jpeg" | null;
export interface UploadRow { id: string; agentId: string; kind: UploadKind; name: string; note: string; paths: string[]; state: UploadState; reason: string | null; createdAt: string }
/** what the page may hold: no agentId unless the reader is the owner (then `by` is the display name) */
export interface UploadView { id: string; kind: UploadKind; name: string; note: string; files: number; state: UploadState; reason: string | null; mine: boolean; by?: string }
export const isUploadId: (v: unknown) => v is string;        // uuid

// uploads.ts
export type Sent = { ok: true; id: string; state: UploadState } | { ok: false; error: string };
export async function sendUpload(who: { agentId: string; owner: boolean; demo: boolean }, v: { kind: unknown; name: unknown; note: unknown; rights: boolean; files: { bytes: Buffer }[] }): Promise<Sent>;
export async function myUploads(agentId: string): Promise<UploadRow[]>;          // newest first
export async function sharedUploads(): Promise<UploadRow[]>;                     // state ok, kind part|style, newest first
export async function waitingUploads(): Promise<UploadRow[]>;                    // state wait, oldest first
export type Verdict = "ok" | "no" | "queue" | "closed";
export async function decideUpload(by: string, id: string, verdict: Verdict, reason?: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteUpload(agentId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }>;
/** the row when this reader may see its files: ok for anyone, otherwise the sender or the owner */
export async function readableUpload(who: { agentId: string; owner: boolean }, id: string): Promise<UploadRow | null>;
export async function uploadFile(path: string): Promise<{ bytes: Buffer; type: string } | null>;
/** ok parts (or styles) among these ids, for คลิปตามโจทย์ */
export async function okUploads(ids: string[], kind: "part" | "style"): Promise<UploadRow[]>;
```

Error copy (exact): `"บัญชีทดลองอัปโหลดไม่ได้"`, `"เลือกแบบที่จะส่ง"`, `"ตั้งชื่อ ไม่เกิน 60 ตัวอักษร"`, `"หมายเหตุยาวเกิน 300 ตัวอักษร"`, `"เลือกไฟล์ภาพก่อนส่ง"`, `"แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ"`, `"ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่"`, `"ชิ้นส่วนภาพรับเฉพาะไฟล์ PNG"`, `"รับเฉพาะรูป JPG หรือ PNG"`, `"ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง"`, `"ส่งครบ 20 ไฟล์แล้ว ลบไฟล์เก่าก่อนส่งใหม่"`, `"ส่งไม่สำเร็จ ลองใหม่อีกครั้ง"`, `"ไม่พบไฟล์นี้"`, `"ไฟล์นี้ตรวจไปแล้ว"`, `"เลือกเหตุผลก่อน"`.

- [ ] **Step 1: Failing tests for the rules** — `sniff` on PNG, JPEG, `<svg`, `<html`, empty; `stateWord` for all six spec phrases; `isUploadKind`; `REASONS` equals the spec's four in order.
- [ ] **Step 2: Implement `upload-rules.ts`; tests pass.**
- [ ] **Step 3: Failing store tests** (in-memory fake of the table and of `storage.from("content-media")` upload/remove/download, hoisted like `marks.test.ts`):
  - demo refused; bad kind; empty/long name; long note; `part` with 0 or 2 files; `part` with JPEG bytes → "ชิ้นส่วนภาพรับเฉพาะไฟล์ PNG"; bytes starting `<svg` → refused and **no storage upload happened**; a 5 MB + 1 file; rights unticked on part/style (not needed on ask); ask with 4 shots; ask with 0 files is fine.
  - a member's part is stored as `wait` at `library/<uuid>.png`; the owner's is `ok`; an ask is `wait` for both.
  - the 21st row of a member is refused; the owner's is not; a row insert failure removes the files already uploaded.
  - `decideUpload`: `ok`/`no` only on part|style, `queue`/`closed` only on ask; `no` needs a reason from `REASONS`; a row not in `wait` → "ไฟล์นี้ตรวจไปแล้ว" and unchanged (the update filters `state = 'wait'` and checks a row came back); sets `decided_by`, `decided_at`.
  - `deleteUpload`: only the sender's own row; removes the row then its files; another member's id → "ไม่พบไฟล์นี้".
  - `readableUpload`: `ok` → anyone; `wait`/`no` → sender and owner only; unknown/non-uuid id → null.
  - `sharedUploads` leaves out asks and non-ok rows; `okUploads` returns only ok rows of the asked kind.
- [ ] **Step 4: Implement `uploads.ts`** — files first then the row (as `saveLogo` in `src/lib/content/logo-store.ts`); paths `library/${crypto.randomUUID()}.${ext}`; the cap is a `count` query (`head: true`) on the member's rows.
- [ ] **Step 5: Migration `20261211_library_uploads.sql`** — the table as the spec's Data section (id default `gen_random_uuid()`), two indexes, RLS on, `revoke all … from public, anon, authenticated`, `grant all … to service_role`, a table comment. Then `create or replace function public.ins_member_delete` copied from `supabase/migrations/20261210_library_marks.sql` with: a `v_library jsonb` collected from `select coalesce(jsonb_agg(p), '[]') from ins_library_uploads u, unnest(u.paths) p where u.agent_id = p_member and u.state <> 'ok'`, `delete from ins_library_uploads where agent_id = p_member and state <> 'ok'`, and `'library', v_library` added to the returned object; the same revoke/grant lines after it. Do not touch `ins_demo_wipe`.
- [ ] **Step 6: `member-store.ts`** returns `files.library` (empty list when the function's answer has none, so code deployed before the migration still works) and the caller that clears Storage clears them from `content-media`. Extend that test.
- [ ] **Step 7: tsc, tests, commit** `feat(library): uploads table, rules and store`.

### Task 2: The upload route and the actions

**Files:**
- Create: `src/app/api/library-upload/route.ts`
- Modify: `src/app/studio/library/actions.ts`
- Test: `tests/scene-library/upload-route.test.ts`, `tests/scene-library/upload-actions.test.ts`

**Interfaces:**
- Consumes: Task 1's `sendUpload`, `readableUpload`, `uploadFile`, `decideUpload`, `deleteUpload`, `isUploadId`, `Verdict`.
- Produces:
  - `POST /api/library-upload` — multipart: `kind`, `name`, `note`, `rights` ("1" when ticked), `file` (repeated). Answers `{ ok: true, id, state }` or `{ ok: false, error }` (400; 401 when not signed in, via `refuseUnless()` as `src/app/api/content-logo/route.ts`).
  - `GET /api/library-upload?id=<uuid>&n=<0..2>` — the picture bytes with `cache-control: private, max-age=3600` and `x-content-type-options: nosniff`, content type from the stored extension; 404 `"ไม่พบไฟล์นี้"` for anything the reader may not see.
  - `actions.ts`: `decideLibraryUpload(id: string, verdict: string, reason?: string): Promise<{ ok: true } | { ok: false; error: string }>` (owner only, else `"ไม่พบไฟล์นี้"`) and `removeLibraryUpload(id: string): Promise<{ ok: true } | { ok: false; error: string }>` (`requireMember`).

- [ ] **Step 1: Failing tests** — POST passes the viewer's `agentId`, `owner`, `demo` and the files' bytes to `sendUpload` (mocked) and relays its answer; more than 3 `file` parts or a part over 5 MB is refused before any bytes are buffered into the store call; GET: unknown id, non-uuid id, `n` out of range, a `wait` row asked by a stranger → all 404 with the same body; an `ok` row → 200 with the bytes and both headers. Actions: a non-owner calling `decideLibraryUpload` never reaches `decideUpload`; a verdict outside the four is refused; `removeLibraryUpload` passes the caller's own `agentId`.
- [ ] **Step 2: Implement; tests pass.**
- [ ] **Step 3: tsc, lint, commit** `feat(library): upload route and review actions`.

### Task 3: The page — อัปโหลด, ของฉัน, คิวตรวจ, เลือกดู

**Files:**
- Create: `src/app/studio/library/UploadTab.tsx`, `src/app/studio/library/UploadList.tsx` (the row list used by ของฉัน and คิวตรวจ, with the reasons panel), `src/lib/scene-library/shrink.ts` (browser: re-encode on a canvas)
- Modify: `src/app/studio/library/page.tsx`, `src/app/studio/library/LibraryBoard.tsx`, `src/app/studio/library/loading.tsx` if the tab row is drawn there
- Test: `tests/scene-library/upload-page.test.tsx` (render with `react-dom/server` or the house's testing approach in `tests/scene-library/library-page.test.tsx`), `tests/scene-library/upload-view.test.ts`

**Interfaces:**
- Consumes: Task 1 rules and store; Task 2 route and actions.
- Produces:
  - `uploads.ts` gains `uploadViews(who: { agentId: string; owner: boolean }): Promise<{ mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] } | null>` — `null` when the table cannot be read; `waiting` is empty for a non-owner; `by` filled (via `displayNames` in `src/lib/auth/viewer.ts`) only on `waiting`.
  - `LibraryBoard` props gain `uploads: { mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] } | null`, `sent: number` is derived (`mine.length`), and stand-ins for tests: `send?: (form: FormData) => Promise<Sent>`, `decide?`, `remove?` (defaults call the route/actions).
  - `shrink.ts`: `shrinkForUpload(file: File, kind: UploadKind): Promise<Blob>` — draws onto a canvas at most `SIDE_MAX` on the long side, `image/png` for `part`, `image/jpeg` (0.9) otherwise; when the canvas cannot be used it returns the file itself.

Behaviour (spec "The page"):
- Tabs in order เลือกดู · อัปโหลด · ของฉัน · คิวตรวจ (owner; count = `waiting.length`) · อยากได้มากสุด (owner). With `uploads === null`: no อัปโหลด, no คิวตรวจ, no upload cards, no "ไฟล์ที่ฉันส่ง", and `page.tsx` shows `<LoadFailed what="ไฟล์ที่อัปโหลด" href="/studio/library" />`.
- อัปโหลด for the demo account shows only "บัญชีทดลองอัปโหลดไม่ได้". The file input accepts `image/png,image/jpeg,image/webp`; `ask` allows several (at most 3). The form checks the same things as the server before sending and shows the server's error under the button (`role="alert"`). On success the board adds the new row to `mine` (and for the owner's part/style to `shared`), clears the form, and moves to ของฉัน (owner: stays, with "ส่งแล้ว").
- ของฉัน: "ไฟล์ที่ฉันส่ง (N)" under the existing saved pieces; ลบ asks once in the row itself ("ลบไฟล์นี้?" ยืนยัน / ยกเลิก — `confirm()` is not used anywhere in this app's new code) and removes the row on success.
- คิวตรวจ: two lists as the spec; a verdict removes the row from `waiting` and, for `ok`, adds it to `shared`; a refusal ("ไฟล์นี้ตรวจไปแล้ว") shows under the row and the row is dropped from `waiting` on the next render.
- เลือกดู: type chip "ไฟล์จากสมาชิก" after ลูกเล่น. Upload cards show the picture (`/api/library-upload?id=…&n=0`, `loading="lazy"`, `aspect-[4/3] object-contain` on `--ct-ground`), the name, tags `KIND_NAME[kind]` and "จากสมาชิก", and "ใช้แบบนี้" → `/studio/prompt-story?asset=<id>` (part) or `?ref=<id>` (style) when `open["prompt-story"]`, else "ยังไม่เปิดให้ใช้". They appear when the type chip is ทั้งหมด or ไฟล์จากสมาชิก, the state chip is not เร็วๆ นี้, the product chip is ทุกสินค้า, and the search matches name or note. The count line adds them.

- [ ] **Step 1: Failing tests** — tabs for member / owner / demo / `uploads: null`; the อัปโหลด form's client refusals (no file, long name, rights unticked) never call `send`; a successful send lands on ของฉัน with the row and its state word; ลบ needs the second press; the queue's ไม่ผ่าน needs a reason and calls `decide(id, "no", reason)`; an `ok` verdict moves the row into เลือกดู; upload cards: link by kind, "ยังไม่เปิดให้ใช้" when the form is closed, hidden under เร็วๆ นี้; `uploadViews` hides `agentId` and gives `by` only to the owner's `waiting`; `uploadViews` answers `null` when the store throws.
- [ ] **Step 2: Implement; tests pass.** Keep `LibraryBoard.tsx` changes to wiring; the new UI lives in the two new files.
- [ ] **Step 3: tsc, lint, the whole `tests/scene-library` folder green, commit** `feat(library): upload and review tabs`.

### Task 4: ภาพจากคลัง in คลิปตามโจทย์

**Files:**
- Modify: `src/lib/prompt-story/types.ts`, `checked.ts`, `editor-state.ts`, `total.ts` only if its count needs it, `src/lib/quote-video/make.ts` (`drawPictures`, the redraw path), `src/app/studio/prompt-story/ScriptEditor.tsx`, `PromptStoryBoard.tsx`, `page.tsx`, `actions.ts`, `src/lib/scene-library/links.ts`
- Create: `src/lib/prompt-story/asset-picture.tsx` (the part laid on the look's ground, drawn with `drawPng` from `src/lib/draw-png.ts`)
- Test: `tests/prompt-story/asset-scene.test.ts`, extend the existing checked/editor-state/make tests where they pin picture counts

**Interfaces:**
- Consumes: Task 1 `okUploads`, `uploadFile`, `isUploadId`.
- Produces:
  - `PromptScene` gains `asset?: string`.
  - `types.ts`: `pictureScenes` counts scenes with neither `device` nor `asset` (every price function follows from it).
  - `editor-state.ts`: `SceneKind` gains `{ kind: "asset"; id: string }` (a device still wins); `pictureCount` and `missingPicture` skip asset scenes; `toPicture` drops `asset` as well; `toAsset(s: PromptScene, id: string): PromptScene` drops `device`, sets `asset`.
  - `checked.ts`: a scene's `asset` is kept only when `isUploadId` and the scene has no valid device; an asset scene may have empty picture words.
  - `actions.ts` `makePromptStory`: after `checkedPromptStory`, before anything is held, every asset id must be in `okUploads(ids, "part")`; else `{ ok: false, error: "ภาพจากคลังของฉากที่ N ใช้ไม่ได้แล้ว เลือกภาพใหม่" }` (N = first such scene, from 1). `okUploads` throwing (table missing) is treated as none usable. `redrawPromptPicture` refuses an asset scene: `"ฉากนี้ใช้ภาพจากคลัง ไม่มีการวาดใหม่"`.
  - `asset-picture.tsx`: `assetPicture(part: { bytes: Buffer; type: string }, look: ReturnType<typeof freeLook>, size: VideoSize): Promise<Buffer>` — a PNG of the frame size (`SIZES`), the look's ground colour from `STORY_CLIP_COLORS` (the same ground `StoryClip` paints for that look; plain paper when the style has no look), the part contained in a box 80% of the width and 55% of the height, centred, nothing else drawn.
  - `make.ts` `drawPictures`: an asset scene downloads its part (`uploadFile` of the row's first path), draws `assetPicture`, files it as `pic-<n>.png`, counts no painter cost and is never in `missing` for the hold; a part that cannot be read leaves the scene's picture `null` (paper), as a failed painting does.
  - `page.tsx` passes `assets: { id: string; name: string }[]` (the `ok` parts, `[]` when unreadable) and `startAsset?: string` from `?asset=`; `links.ts` `promptStartFrom` returns `asset` when it is a uuid.
  - `ScriptEditor` props gain `assets` and `startAsset`; a third chip "ภาพจากคลัง" in each scene's radiogroup; chosen, the scene shows the parts as a row of thumbnail buttons (`/api/library-upload?id=…&n=0`, `aria-label` = the part's name, the one in use `aria-checked`), `startAsset` first with "ภาพที่เลือกจากคลัง: <name>"; the line under it: "ภาพวางกลางฉากบนพื้นของหน้าตาคลิป ฉากนี้ไม่คิดค่ารูป". With no parts: "ยังไม่มีภาพในคลัง อัปโหลดได้ที่เมนูคลังแอนิเมชัน". The summary line counts "ภาพจากคลัง N ฉาก" beside devices.

- [ ] **Step 1: Failing tests** — `pictureScenes` and `promptStoryPrice` with one asset and one device among five scenes charge three pictures; `checkedPromptStory` keeps a uuid asset with empty picture words, drops a non-uuid one (then demands picture words), and drops the asset when a valid device is on the scene; `sceneKind`/`pictureCount`/`missingPicture`/`toPicture`/`toAsset`; `makePromptStory` with an asset not in `okUploads` answers the spec's line with the right N and **no hold was taken**; with `okUploads` throwing, the same; `redrawPromptPicture` on an asset scene; `promptStartFrom({ asset })` keeps a uuid and ignores anything else; `drawPictures` (with `assetPicture`, `uploadFile` and the painter faked) files the asset scene's picture, calls the painter only for picture scenes, and a missing part gives `null` without touching the hold.
- [ ] **Step 2: Implement; tests pass.** Keep drafts working: a draft saved with `asset` on a scene is read back with it (check `drafts.ts` and the board's draft state; add the field wherever scenes are copied field by field).
- [ ] **Step 3: `npx vitest run tests/prompt-story tests/quote-video tests/scene-library`, tsc, lint, commit** `feat(prompt-story): a scene's picture from the library`.

### Task 5: ภาพสไตล์ as the painter's reference

**Files:**
- Modify: `src/lib/prompt-story/types.ts`, `checked.ts`, `pictures.ts`, `src/lib/quote-video/make.ts`, `src/app/studio/prompt-story/PromptStoryBoard.tsx` (the picture-style step), `page.tsx`, `actions.ts`, `src/lib/scene-library/links.ts`
- Test: `tests/prompt-story/style-ref.test.ts`

**Interfaces:**
- Consumes: Task 1 `okUploads`, `uploadFile`; Task 4's `promptStartFrom` shape.
- Produces:
  - `PromptStoryInput` gains `styleRef?: string`; `checkedPromptStory` keeps it when `isUploadId`.
  - `makePromptStory`: a `styleRef` not in `okUploads([id], "style")` refuses before any hold: `"ภาพสไตล์ที่เลือกใช้ไม่ได้แล้ว เลือกใหม่หรือเอาออก"`.
  - `pictures.ts`: `picturePrompt(scene, style, withRef = false)` — with a reference the prompt is `` `${scene.picture}. Paint it in the colour palette, texture and line style of the reference image. Do not copy the reference image's subject, people, objects or any text in it. ${SUFFIX}` `` (no `STYLE_PREFIX`); `drawScenePicture(scene, style, painter, size, draw?, ref?: ReferenceImage)` passes `references: [ref]` to the draw when given. `ReferenceImage` is `src/lib/ai/images.ts`'s.
  - `make.ts`: `drawPictures` and the redraw path read the reference once per call (`uploadFile` of the style's first path); a reference that cannot be read draws without it (the clip is not failed).
  - The form: under the four picture styles, a group labelled "ภาพอ้างอิงสไตล์จากคลัง (ไม่บังคับ)": a chip "ไม่ใช้" and one thumbnail chip per `ok` style (name as `aria-label` and caption); under it "AI เลียนโทนสีและลายเส้นได้คร่าวๆ ไม่ตรงทุกเส้น"; the group is not drawn when there are no styles. `page.tsx` passes `styles: { id: string; name: string }[]` and `startRef` from `?ref=`; `promptStartFrom` returns `ref` when it is a uuid that the page then checks against `styles`.
  - Note for the reviewer, not a defect: a drawing with a reference goes down the `image-face` lane of `drawImage` (src/lib/ai/client.ts), so the painter the agent picked is not the model used; the price charged is unchanged.

- [ ] **Step 1: Failing tests** — `picturePrompt` with and without a reference (the with-ref prompt has the scene's words, both instruction sentences and the suffix, and none of `STYLE_PREFIX`); `drawScenePicture` hands the reference to the draw and omits `references` without one; `checkedPromptStory` keeps/drops `styleRef`; `makePromptStory` refusal with no hold; `drawPictures` with an unreadable reference still draws; `promptStartFrom({ ref })`.
- [ ] **Step 2: Implement; tests pass.**
- [ ] **Step 3: Full check** — `npx tsc --noEmit`, `npx vitest run` (the whole suite; four files under `tests/quote-video` are known to time out under load at 5 s — re-run those alone before calling them failures), lint. Commit `feat(prompt-story): a library picture as the style reference`.
