# History of pictures read into prompts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every successful picture read is kept for the person who made it (thumbnail, prompt, Thai summary, colours), latest 200 each, shown and deletable on `/studio/describe`.

**Architecture:** A store module (`describe-history.ts`) over one new table and one private bucket; the existing route saves after a good read and never lets saving change the read's outcome; the browser makes a 256 px thumbnail beside the 1,024 px picture; the page lists the signed-in member's own history.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (table + private storage bucket), vitest (node env, tests under `tests/**`).

**Spec:** `docs/superpowers/specs/2026-10-08-describe-history-design.md` (builds on `2026-10-08-picture-describe-design.md`).

## Global Constraints

- `HISTORY_MAX = 200` per person; older rows and their thumbnails are deleted on each save.
- Thumbnail: JPEG, long side **256 px**, quality 0.7; accepted by the route only as a base64 string of **≤ 150,000** characters that **starts with `/9j/`**; bucket `describe-thumbs` is private, 102,400 bytes, `image/jpeg` only; path `<agent_id>/<row id>.jpg`, both UUIDs.
- A history is **private to its member, the owner included**: every read, delete and clear filters by `agent_id` of the signed-in member, never by an id taken from the request.
- `summary_th` is cut to 300 characters before saving; `prompt` ≤ 2,500.
- Saving never changes a read: on any save error the answer is still `ok: true`, with `saved: false`.
- All user-facing text is Thai, one sentence, no "Error:" prefix, no first person.
- Intro line on the page: `เก็บรูปย่อและ prompt ล่าสุด 200 รายการไว้ให้คุณคนเดียว ลบได้`.
- Stage with explicit paths only; never `git add -A`.
- **The migration changes the production database. It is not applied until the owner says so (Task 4).**

## Review Focus

1. Deleting or clearing with another person's id removes nothing (Task 1, Task 3).
2. The 201st save deletes the oldest row and its file and keeps 200 (Task 1).
3. An insert that fails after the thumbnail is uploaded takes the thumbnail back (Task 1).
4. A thumbnail that is not `/9j/…` or is too long: the read works, `saved: false`, `saveReading` not called (Task 2).
5. `saveReading` throwing still answers `ok: true, saved: false` (Task 2).
6. A thumbnail file that is gone gives `thumbUrl: null`, not a failed page (Task 1).

---

### Task 1: The store, its fake, and the migration file

**Files:**
- Create: `supabase/migrations/20261012_describe_history.sql`
- Create: `src/lib/content/describe-history.ts`
- Create: `tests/helpers/fake-history-db.ts`
- Test: `tests/content/describe-history.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin()` from `@/lib/supabase/admin`; `Swatch`, `parseSwatches` from `@/lib/content/palette`.
- Produces:
  - `export const HISTORY_MAX = 200`, `export const MAX_THUMB_BASE64 = 150_000`
  - `export function isThumbBase64(v: unknown): v is string`
  - `export interface Reading { id: string; createdAt: string; prompt: string; summaryTh: string; palette: Swatch[]; thumbUrl: string | null }`
  - `export async function saveReading(agentId: string, r: { prompt: string; summaryTh: string; palette: Swatch[]; thumbBase64: string }): Promise<string>`
  - `export async function listReadings(agentId: string): Promise<Reading[]>`
  - `export async function deleteReading(agentId: string, id: string): Promise<void>`
  - `export async function clearReadings(agentId: string): Promise<void>`
  - the fake: `export const historyDb: { client; reset(); rows: Row[]; files: Map<string, string>; failNext: { upload?: boolean; insert?: boolean } }`, used as `vi.mock("@/lib/supabase/admin", …)` returning `historyDb.client`.

- [ ] **Step 1: Write the fake** `tests/helpers/fake-history-db.ts`: one table `ins_describe_history` in memory and one bucket `describe-thumbs`, honouring the calls the store makes — `from(t).insert(obj)` (awaitable; stamps a rising `created_at`), `.select(cols)`, `.delete()`, `.eq(col, v)`, `.in(col, vs)`, `.order("created_at", { ascending: false })`, `.limit(n)`, `.range(a, b)`, awaited as `{ data, error }`; `storage.from(bucket).upload(path, bytes, opts)` (error when `failNext.upload`), `.remove(paths)`, `.createSignedUrls(paths, seconds)` answering `{ data: [{ path, signedUrl, error }] }` with `https://signed.test/<path>` for files that exist and `{ signedUrl: null, error: "Object not found" }` for those that do not. Every answer is a copy.
- [ ] **Step 2: Write the failing tests** (`describe-history.test.ts`), each with its assertions:
  - `isThumbBase64`: true for `"/9j/" + "A".repeat(100)`; false for `"iVBOR…"`, for a non-string, for a string over `MAX_THUMB_BASE64`, for a string with a character outside base64 (`"/9j/ !"`).
  - `saveReading` uploads `<agentId>/<id>.jpg` then inserts a row with that `thumb_path`, the prompt, `summary_th` cut to 300 characters, the palette; returns the id; `historyDb.files` holds the thumbnail.
  - an insert that fails after the upload: it throws, and `historyDb.files` is empty again (Review Focus 3).
  - saving 201 times for one agent leaves 200 rows and 200 files, the oldest row and its file gone, the newest present (Review Focus 2); another agent's 5 rows are untouched.
  - `listReadings` returns only that agent's rows, newest first, each with `thumbUrl` `https://signed.test/<path>`; with one file removed from `historyDb.files`, that item has `thumbUrl: null` and the others still list (Review Focus 6).
  - `deleteReading(a, idOfB)` removes nothing from B's rows or files (Review Focus 1); `deleteReading(a, idOfA)` removes the row and file; `deleteReading(a, "not-a-uuid")` does nothing and does not call the database.
  - `clearReadings(a)` removes all of A's rows and files and none of B's.
  - `saveReading("not-a-uuid", …)` throws before any call.
- [ ] **Step 3: Run** `npx vitest run tests/content/describe-history.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 4: Write the migration** (additive only, in the style of `20260924_content_people.sql`): table, index `(agent_id, created_at desc)`, RLS enabled with no policies, bucket insert `on conflict (id) do nothing` — exactly the columns, checks and limits in the spec's section 1.
- [ ] **Step 5: Implement** `describe-history.ts` per the signatures. Queries the fake supports and the store must use: save = `upload` → `insert` → `select("id, thumb_path").eq("agent_id", a).order("created_at", { ascending: false }).range(HISTORY_MAX, HISTORY_MAX + 999)` → `storage.remove` + `delete().in("id", ids)`; list = `select(...).eq("agent_id", a).order(...).limit(HISTORY_MAX)` then one `createSignedUrls(paths, 3600)`; delete = `select("thumb_path").eq("id", id).eq("agent_id", a)` → `remove` → `delete().eq("id", id).eq("agent_id", a)`; clear the same with `agent_id` alone. Palette read back through `parseSwatches`.
- [ ] **Step 6: Run** the test file and `npx tsc --noEmit` — Expected: PASS, no new type errors (errors in `tests/calc/ishield-assistant.test.ts` belong to another session).
- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261012_describe_history.sql src/lib/content/describe-history.ts tests/helpers/fake-history-db.ts tests/content/describe-history.test.ts
git commit -m "feat(studio): a store for the history of pictures read into prompts"
```

---

### Task 2: The route saves; the browser makes the thumbnail

**Files:**
- Modify: `src/app/api/content-describe/route.ts`
- Modify: `src/lib/content/describe-run.ts` (the `ok: true` variant of `DescribeResult` gains `saved?: boolean; id?: string`)
- Modify: `src/lib/content/picture-shrink.ts` (`shrunkSize` takes an optional side)
- Modify: `src/app/studio/ui/shrink-image.ts`, `src/app/studio/describe-call.ts`, `src/app/studio/ui/DescribePicker.tsx`
- Test: `tests/content/describe-route.test.ts`, `tests/content/picture-shrink.test.ts`

**Interfaces:**
- Consumes: `isThumbBase64`, `saveReading` (Task 1); `requireMember` from `@/lib/auth/viewer`.
- Produces:
  - `shrunkSize(w: number, h: number, side = MAX_SIDE): { w: number; h: number }`, `export const THUMB_SIDE = 256`
  - `Shrunk` gains `thumb: string` (base64 JPEG); `describeCall(image: { base64; mimeType; palette?; thumb? })`
  - `DescribeOk` (DescribePicker.tsx) gains `thumbUrl?: string` (`data:image/jpeg;base64,…`), set by `DescribePicker` before `onDone`
  - route answer for a good read: `{ ok: true, prompt, summaryTh, costThb, saved: boolean, id?: string }`

- [ ] **Step 1: Write the failing tests.**
  - `picture-shrink.test.ts`: `shrunkSize(4000, 3000, THUMB_SIDE)` → `{ w: 256, h: 192 }`; `shrunkSize(100, 80, THUMB_SIDE)` → unchanged.
  - `describe-route.test.ts` (mock `@/lib/content/describe-history` with `isThumbBase64` real and `saveReading` a spy; add `requireMember` → `{ agentId: "11111111-1111-4111-8111-111111111111" }` to the viewer mock): a good read with a good thumb calls `saveReading` once with that agent id, the engine's `prompt`, `summaryTh`, the palette and the thumb, and answers `saved: true` and the returned `id`; a thumb not starting `/9j/`, a missing thumb, and one over the limit each give `saved: false` and no call (Review Focus 4); `saveReading` rejecting still answers `ok: true, saved: false` (Review Focus 5); an engine answer of `ok: false` calls `saveReading` never.
- [ ] **Step 2: Run** `npx vitest run tests/content/describe-route.test.ts tests/content/picture-shrink.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the route change (after `describePicture`, only on `ok`; `saveReading` inside try/catch that logs; the spread of the engine's answer plus `saved`/`id`) and the `shrunkSize` side parameter.
- [ ] **Step 4: Implement the browser side** (no unit test: canvas): `shrinkImage` also draws the picture to a canvas sized by `shrunkSize(w, h, THUMB_SIDE)` and returns `thumb` from `toBlob("image/jpeg", 0.7)` (empty string if it fails — then the read is not saved); `describeCall` sends it as `image.thumb`; `DescribePicker` passes it and calls `onDone({ ...r, thumbUrl })` when `thumb` is non-empty.
- [ ] **Step 5: Run** the two test files, `npx tsc --noEmit` (no new errors) and `npx eslint` on the changed files — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/app/api/content-describe/route.ts src/lib/content/describe-run.ts src/lib/content/picture-shrink.ts src/app/studio/ui/shrink-image.ts src/app/studio/describe-call.ts src/app/studio/ui/DescribePicker.tsx tests/content/describe-route.test.ts tests/content/picture-shrink.test.ts
git commit -m "feat(studio): a good read is saved to the member's history, with a thumbnail"
```

---

### Task 3: Actions, page and history list

**Files:**
- Create: `src/app/studio/describe/actions.ts`
- Modify: `src/app/studio/describe/page.tsx`, `src/app/studio/describe/DescribeBoard.tsx`
- Test: `tests/content/describe-actions.test.ts`

**Interfaces:**
- Consumes: `listReadings`, `deleteReading`, `clearReadings`, `Reading` (Task 1); `DescribeOk.thumbUrl`, route's `saved`/`id` (Task 2); `requireMember`, `gatePage`.
- Produces: `export async function deleteReadingAction(id: string): Promise<{ ok: boolean }>`, `export async function clearReadingsAction(): Promise<{ ok: boolean }>` (`"use server"`); `DescribeBoard({ initial }: { initial: Reading[] | null })`.

- [ ] **Step 1: Write the failing tests** (`describe-actions.test.ts`, mocking `@/lib/auth/viewer` `requireMember` → `{ agentId: A }` and the store): `deleteReadingAction(id)` calls `deleteReading(A, id)` with the **signed-in agent's id**, never one from the arguments; a non-UUID id answers `{ ok: false }` and calls nothing; `clearReadingsAction()` calls `clearReadings(A)`; a store that throws answers `{ ok: false }` and logs.
- [ ] **Step 2: Run** `npx vitest run tests/content/describe-actions.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the two actions.
- [ ] **Step 4: Implement the page.** `page.tsx` keeps `await gatePage("/studio/describe")`, uses its returned viewer's `agentId`, calls `listReadings(agentId).catch(() => null)`, passes `initial` to the board, and its intro uses the Global Constraints line. `DescribeBoard`: state `items` (from `initial`, `null` means the list could not be read and a short Thai note is shown instead) and `current` (the result shown). After a read with `saved: true` the new item (id from the route, `thumbUrl` from `DescribeOk.thumbUrl`, `createdAt` now) goes first. A history item shows thumbnail (or a plain box when `thumbUrl` is null), date (`th-TH`), Thai summary and colour dots (`style.background` = hex); pressing it sets `current` so the same cards, copy buttons and summary show. Each item has **ลบ** (calls `deleteReadingAction`, removes it from `items` on `ok`); the list has **ลบทั้งหมด** after one `window.confirm`. A failed delete says `ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ`.
- [ ] **Step 5: Run** `npx vitest run tests/content/describe-actions.test.ts tests/auth/studio-pages-gated.test.ts`, `npx tsc --noEmit` (no new errors), `npx eslint src/app/studio/describe` — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/app/studio/describe tests/content/describe-actions.test.ts
git commit -m "feat(studio): the history on the ถอดรูปเป็น prompt page, with delete and clear"
```

---

### Task 4: Apply the migration (needs the owner's yes), check by hand, verify

**Files:** none new.

- [ ] **Step 1: Stop and ask the owner** to apply `supabase/migrations/20261012_describe_history.sql` to the production database (it only adds a table, an index and a bucket). Do not apply it before an explicit yes. Apply it with the Supabase tool for the production project `cenysylrzbwfrtuqoeqk`, then read back that the table and the `describe-thumbs` bucket exist.
- [ ] **Step 2: Start a dev server from this worktree** (the launch config must be added temporarily where the preview tool reads it, and put back right after the server is up) and, signed in as the owner on it, read two pictures: both appear at the top of the history with thumbnail, summary and colour dots; open one — its cards show; delete one — it goes; reload — the other is still there; clear all — the list is empty.
- [ ] **Step 3: Check the file side:** in Supabase read `ins_describe_history` and the bucket's objects for this agent: a deleted item left no row and no file.
- [ ] **Step 4: Verify the lot:** `npx tsc --noEmit` (only the other session's errors), `npx vitest run tests/content tests/wallet tests/calc/shell-menu.test.ts tests/auth` — Expected: no failures from this branch.
- [ ] **Step 5: Report** to the owner what was applied and checked; do not push or merge.
