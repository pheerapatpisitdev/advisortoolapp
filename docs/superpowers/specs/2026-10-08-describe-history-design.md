# History of pictures read into prompts — design

2026-10-08 · owner's request: "อยากให้เก็บตัวอย่างรูปและ prompt ที่เคยทำด้วย"
Builds on `2026-10-08-picture-describe-design.md` (branch `feat/picture-describe`), whose
"Out of scope: saving the picture or the prompt" and "the picture is never written to the
database or storage" this **reverses** for a small thumbnail and the prompt.

## Goal

Every successful "ถอดรูปเป็น prompt" read is kept for the person who made it — a small
thumbnail, the prompt, its Thai summary and its measured colours — so they can open it again
and copy the prompt. A person's history is theirs alone and holds their latest 200 reads.

## Decisions already made by the owner

- **Automatic** history of every successful read, not a save button (answers ก).
- **Private to each person**, the owner included: nobody sees another's history.
- **Latest 200 per person**; older ones are deleted automatically (answers ข).
- A **thumbnail**, never the full picture: customers' faces may be in what agents upload.
- The history is shown on `/studio/describe`. A picker inside the บรีฟภาพเพิ่มเติม field is **a
  later step**, not in this one.

## What exists and is reused

| Piece | Where | Reuse |
|---|---|---|
| A private bucket the server alone reads; an `ins_*` table with RLS on and no policies | `ins_people`, bucket `content-people`; `lib/content/people-store.ts`, migration `20260924_content_people.sql` | same shape, new table and bucket |
| The engine, its route, and what a result carries | `lib/content/describe-run.ts`, `app/api/content-describe/route.ts` | the route saves after a good read |
| The browser's canvas shrink | `app/studio/ui/shrink-image.ts` | also makes the thumbnail |
| The page and its cards | `app/studio/describe/DescribeBoard.tsx`, `splitPrompt` | a history opens in the same cards |
| `Swatch`, `parseSwatches` | `lib/content/palette.ts` | the saved colours |

## Design

### 1. Storage

Migration `supabase/migrations/20261012_describe_history.sql` (additive only):

- Table `ins_describe_history`: `id uuid primary key default gen_random_uuid()`,
  `agent_id uuid not null references public.agents(id) on delete cascade`,
  `created_at timestamptz not null default now()`,
  `prompt text not null check (char_length(prompt) <= 2500)`,
  `summary_th text not null check (char_length(summary_th) <= 300)`,
  `palette jsonb not null default '[]'`, `thumb_path text not null`.
  Index `(agent_id, created_at desc)`. RLS enabled, **no policies** (service role only).
- Bucket `describe-thumbs`: private, `file_size_limit` 102400, `allowed_mime_types` `image/jpeg`.
- A thumbnail's path is `<agent_id>/<row id>.jpg`, checked against that shape before any storage call.

### 2. The thumbnail

`shrinkImage` also draws the picture to a canvas with long side **256 px** and exports JPEG at
0.7; it comes back as `thumb` (base64) beside `palette` and goes to the route in
`image.thumb`. The route accepts it only if it is a string of at most **150,000** base64
characters that **starts with `/9j/`** (a JPEG's first bytes); anything else means the read
still happens but **is not saved**.

### 3. Saving (`lib/content/describe-history.ts`)

- `HISTORY_MAX = 200`.
- `saveReading(agentId, { prompt, summaryTh, palette, thumbBase64 }): Promise<string>` — cuts
  `summaryTh` to 300 characters (the column's limit; the model's sentence has no cap of its
  own), makes the row's id, uploads the thumbnail, inserts the row (taking the thumbnail back if the insert
  fails), then **trims** the person's rows beyond the newest 200: their thumbnails are removed
  and their rows deleted. Returns the new id.
- The route calls it **after** a good `describePicture`, with the signed-in member's `agentId`
  (`requireMember()`). It never touches the read's outcome: an error is logged, the answer is
  still `ok: true`, with `saved: false`. The answer gains `saved: boolean` and, when saved,
  `id`.
- Nothing is kept for a read that failed.

### 4. Listing and deleting

- `listReadings(agentId): Promise<Reading[]>` — newest first, at most 200, **only this
  agent's rows**; each with a **signed URL** for its thumbnail (one hour), from one batch call.
  `Reading = { id, createdAt, prompt, summaryTh, palette: Swatch[], thumbUrl: string | null }`
  (`thumbUrl` null when the file is gone).
- `deleteReading(agentId, id)` and `clearReadings(agentId)` — filter by **both** `id` and
  `agent_id`, so another person's id removes nothing; remove the thumbnail files, then the rows.
- Server actions `deleteReadingAction(id)` and `clearReadingsAction()` in
  `app/studio/describe/actions.ts` (`"use server"`): `requireMember()`, an id that is not a
  UUID is refused, then the store call.

### 5. The page

- `page.tsx` reads the signed-in member's history on the server (`gatePage` gives the viewer)
  and passes it to `DescribeBoard`; a failed read shows the page without a history and a short
  Thai note, not an error page.
- `DescribeBoard`: after a read with `saved: true` the new item is put first in the list at
  once (its thumbnail is the one the browser just made). A history item shows thumbnail, date,
  Thai summary and colour dots; **pressing it loads it into the result area** (the same cards,
  copy buttons and summary as a fresh read). Each item has **ลบ**; the list has **ลบทั้งหมด**
  (asks once). A read that was not saved says nothing extra.
- The page's intro line changes from "ไม่เก็บรูปไว้" to "เก็บรูปย่อและ prompt ล่าสุด 200
  รายการไว้ให้คุณคนเดียว ลบได้".

### 6. Errors and privacy

| Case | Behaviour |
|---|---|
| Thumbnail missing or not a JPEG | the read works, `saved: false` |
| Storage or insert fails | logged; the read works, `saved: false`; no half-saved row (thumbnail taken back) |
| Delete of someone else's id | removes nothing, answers as if done |
| History read fails on the page | page shows without a history and says so |

- Thumbnails are never given a public URL; signed URLs last an hour.
- The history is never sent to the model.

## Testing

- **Store, with the fake database the repo uses (`tests/helpers`) and a fake bucket:** save
  writes the thumbnail then the row; an insert error takes the thumbnail back; saving the 201st
  deletes the oldest (row and file) and keeps 200; list returns only the asker's rows, newest
  first; delete and clear touch only the asker's rows; a path or id of the wrong shape is refused.
- **Route:** a good read with a good thumbnail calls `saveReading` once with the member's
  agent id and answers `saved: true, id`; a thumbnail that is not `/9j/…` or is too long gives
  `saved: false` and no call; `saveReading` throwing still answers `ok: true, saved: false`.
- **Actions:** a non-UUID id is refused; they pass the signed-in member's id, not one from the
  request.
- **By hand, once** on dev (which writes to production — see below): read two pictures, see both
  in the history, open one, delete one, clear all.

## Needs the owner's yes before it runs

The migration changes the **production** database and storage (it only adds a table, an index
and a bucket). Local dev uses that same database, so the by-hand check cannot happen before it
is applied. It is applied only on the owner's say-so, as with every production migration.

## Out of scope

- A picker for the history inside the บรีฟภาพเพิ่มเติม field; sharing a history between
  people; a team library; keeping the full-size picture; editing a saved prompt; search.
- A time-based expiry (only the 200 cap).
