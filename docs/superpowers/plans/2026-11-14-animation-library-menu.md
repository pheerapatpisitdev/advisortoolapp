# คลังแอนิเมชัน menu (phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Studio page `/studio/library` that lists every clip building block with a preview, sends the agent into the right form with the choice made, and keeps each viewer's saved pieces and "want" votes.

**Architecture:** A browser-safe catalogue built from the code's own lists plus a plain list of unbuilt pieces; one service-role table for marks; the two clip forms learn to read a link; a server page gates and loads, a client board filters in the browser (the `/studio/hooks` pattern).

**Tech Stack:** Next.js (TypeScript, server actions), Supabase (service role), vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-animation-library-menu-design.md`

## Global Constraints

- The migration file is written, never run: no SQL against any database in this plan (`.env.local` is production). Applying it is the owner's decision at push time.
- New per-agent table follows `supabase/migrations/20261113_prompt_drafts.sql`: `agent_id uuid not null` (no foreign key), RLS on, `revoke all … from public, anon, authenticated`, `grant all … to service_role`, a comment, no policies; and is added to `ins_member_delete` and `ins_demo_wipe`.
- Every Studio `page.tsx` contains `await gatePage(` (tests/auth/studio-pages-gated.test.ts).
- No 6-digit hex in `src/**` outside `src/lib/card-theme.ts`; Studio pages use the `--ct-*` tokens and the hooks page's classes.
- Catalogue ids are stable kebab-case ASCII; a ready item must come from a list the forms use (`DEVICES`, `PROMPT_FORMATS`, story looks, `RECIPE_NAMES`, `MUSIC_MOODS`).
- Forms opened without link params behave exactly as today.
- Thai copy as in the spec: ใช้แบบนี้ · อยากได้ · เร็วๆ นี้ · ยังไม่เปิดให้ใช้ · เลือกดู · ของฉัน · อยากได้มากสุด.
- `git add` explicit paths only; commit per task; never push. Commit messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. A link with a topic the viewer's shelf cannot draw in the linked look (e.g. `look=plot` on a shelf outside `INFO_SHELVES`): the form opens on the topic with its default look, no broken state. Test in Task 3.
2. A crafted mark request: unknown item id, `want` on a ready item, or a kind other than save/want is refused with a Thai error and writes nothing. Test in Task 2.
3. Double press on ★ or อยากได้ (two requests at once): one row, and the second press removes it — never a duplicate-key error shown to the agent. Test in Task 2.
4. A viewer who cannot open คลิปตามโจทย์ (not the owner) or whose feature is switched off sees "ยังไม่เปิดให้ใช้", not a link that lands on a locked page. Test in Tasks 1 and 5.
5. Search text with Thai combining marks and mixed case matches names and descriptions; an empty result shows the empty-state line, not a blank grid. Test in Task 5.

---

### Task 1: The catalogue

**Files:**
- Create: `src/lib/scene-library/catalog.ts`
- Test: `tests/scene-library/catalog.test.ts`

**Interfaces:**
- Produces: `type LibraryType = "format" | "device" | "look" | "fx"`; `type LibraryProduct = "all" | "health" | "life" | "saving"`; `type LibraryTool = "quote-video" | "story-clip" | "prompt-story"`; `interface LibraryUse { tool: LibraryTool; label: string; href: string }`; `interface LibraryItem { id: string; type: LibraryType; name: string; tells: string; product: LibraryProduct; ready: boolean; uses: LibraryUse[]; preview?: string; looks?: { id: string; name: string; preview: string }[] }`; `LIBRARY: LibraryItem[]`; `libraryItem(id): LibraryItem | undefined`; `TYPE_NAME: Record<LibraryType, string>` (รูปแบบรายการ, อุปกรณ์ภาพ, สไตล์ภาพ, ลูกเล่น); `PRODUCT_NAME`; `usesFor(item, open: Record<LibraryTool, boolean>): LibraryUse[]` (the uses a viewer may follow); `storyLibraryHref({ topic?, look? })`, `promptLibraryHref({ format?, style? })`.
- Ready items: the 8 `DEVICES` (product health; uses: the story topic that shows it — split→lumpsum, limit→lumpsum, room→roomcost, overflow→roomcost, waiting→waiting, cashless→waiting, groupgap→groupins, agecost→agecost — and คลิปตามโจทย์; `preview` `/library/<key>-paper.jpg`, `looks` for paper, minimal (named แสงอุ่น), line, plot); formats: คลิปขายแผน→`/studio/quote-video`, เล่าเรื่องความรู้→`/studio/story-clip`, and each `PROMPT_FORMATS` entry→`promptLibraryHref({format})`; looks: the four story looks (uses: story-clip and prompt-story with that look; preview `/library/look-<id>.jpg`) and กระจกใส, โน้ตแปะ (uses: quote-video); fx: the three `MUSIC_MOODS` and "เสียงเอฟเฟกต์ตรงจังหวะสำคัญ" (uses: quote-video).
- Unbuilt items (`ready: false`, no uses, no preview): from the mockup's lists — the file `.superpowers/sdd/<plan>/mockup-v5.html` arrays `FAM`, `PROD`, `FORMATS`, `LOOKS`, `AISTY`, `FX` entries marked `"new"` — each given an id and a one-line `tells`.

- [ ] **Step 1: Write the failing test** — ids unique and match `/^[a-z0-9-]+$/`; every `DEVICES` key and every `PROMPT_FORMATS` id has a ready item; no ready item lacks `uses`; no unbuilt item has `uses`; every ready `href` starts with `/studio/` and, parsed by Task 3's parsers once they exist (for now: by `new URL(href, "http://x")`), carries only known param names; `usesFor(device, { "quote-video": true, "story-clip": true, "prompt-story": false })` drops the คลิปตามโจทย์ use; `libraryItem("room")?.name === "ค่าห้องต่อคืน"`.
- [ ] **Step 2: Run** `npx vitest run tests/scene-library/catalog.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(library): the catalogue of clip building blocks`.

### Task 2: Marks — table, store, actions

**Files:**
- Create: `supabase/migrations/20261210_library_marks.sql`
- Create: `src/lib/scene-library/marks.ts`
- Create: `src/app/studio/library/actions.ts`
- Test: `tests/scene-library/marks.test.ts`

**Interfaces:**
- Consumes: `libraryItem` (Task 1), `supabaseAdmin`, `requireMember`.
- Produces: table `ins_library_marks (agent_id uuid not null, item text not null, kind text not null check (kind in ('save','want')), created_at timestamptz not null default now(), primary key (agent_id, item, kind))`; the migration re-creates `ins_member_delete` and `ins_demo_wipe` with one more delete each (copy their latest bodies from 20261113_prompt_drafts.sql and 20261209_demo_account.sql — check no later migration redefines them).
- `type MarkKind = "save" | "want"`; `marksOf(agentId): Promise<{ saved: string[]; wanted: string[] }>`; `wantCounts(): Promise<Record<string, number>>`; `toggleMark(agentId, item, kind): Promise<{ ok: true; on: boolean } | { ok: false; error: string }>` (errors: "ไม่พบรายการนี้ในคลัง", "ชิ้นนี้ใช้ได้แล้ว ไม่ต้องกดอยากได้"); a duplicate-key on insert is treated as already on.
- Action `toggleLibraryMark(item: string, kind: string)` → `requireMember()` then `toggleMark(viewer.agentId, …)`.

- [ ] **Step 1: Write the failing tests** (fake Supabase as tests/prompt-story/drafts.test.ts does) — save then save again → on true then false; want on a ready item refused; unknown item refused; kind "x" refused; insert answering duplicate key → `{ ok: true, on: true }`; `wantCounts` counts only `want`; the migration text contains the table, `enable row level security`, the revoke/grant lines, and `delete from ins_library_marks` inside both functions.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** + tsc — PASS.
- [ ] **Step 5: Commit** `feat(library): saved pieces and want votes`.

### Task 3: The forms read a link

**Files:**
- Create: `src/lib/scene-library/links.ts`
- Modify: `src/app/studio/story-clip/page.tsx`, `src/app/studio/story-clip/StoryClipBoard.tsx`
- Modify: `src/app/studio/prompt-story/page.tsx`, `src/app/studio/prompt-story/PromptStoryBoard.tsx`
- Modify: `src/lib/scene-library/catalog.ts` (href builders move to / import from links.ts)
- Test: `tests/scene-library/links.test.ts`

**Interfaces:**
- Produces: `storyStartFrom(params: Record<string, string | string[] | undefined>): { topic?: StoryTopic; look?: "paper" | "minimal" | "plot" | "line" }` (unknown values dropped; `look: "plot"` dropped when the topic's shelf is not in `INFO_SHELVES`); `promptStartFrom(params): { format?: PromptFormat; style?: "paper" | "warm" | "plot" | "line" }`; `storyLibraryHref`, `promptLibraryHref` (inverse of the parsers).
- Each page passes `start` to its board; the board seeds `topic`/`look.art` (story) or `format`/`style` (prompt) from `start`, and a value from `start` is not overwritten by the localStorage restore on mount (`story-look`, `prompt-story-look`).

- [ ] **Step 1: Write the failing tests** — round trip `storyStartFrom(paramsOf(storyLibraryHref({ topic: "roomcost", look: "plot" })))`; `topic=nope` → `{}`; `look=plot` with `topic=pool48` → topic kept, look dropped; prompt `format=drama3&style=line` parsed, `format=x` dropped; every ready catalogue href parses to a non-empty start or has no params; a pure helper `startLook(start, remembered)` returns the link's look over the remembered one and the remembered one when the link has none.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** + `tests/prompt-story` + `tests/quote-video/story-video.test.ts` + tsc — PASS.
- [ ] **Step 5: Commit** `feat(library): story and prompt forms open from a link`.

### Task 4: Preview pictures

**Files:**
- Create: `remotion/library-stills.mjs` (or a script beside the existing stills tooling) and a line in `remotion/package.json` scripts if that is where such scripts are named
- Create: `public/library/*.jpg`
- Test: `tests/scene-library/previews.test.ts`

**Interfaces:**
- Consumes: catalogue `preview` and `looks[].preview` paths (Task 1).
- Produces: one 216×384 JPEG (quality 85) per path: 8 devices × 4 looks (`/library/<key>-<paper|minimal|line|plot>.jpg`, at the end of the animation, figures of iHealthy Silver, male 35, room 6,000, bill 800,000, group 50,000) and `/library/look-<paper|minimal|line|plot>.jpg`.

- [ ] **Step 1: Write the failing test** — every `preview` path in `LIBRARY` exists under `public/`, is under 40 KB, and no file in `public/library/` is unused.
- [ ] **Step 2: Run** — FAIL. **Step 3: Write the script, render, look at every picture, commit the JPEGs.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(library): preview pictures`.

### Task 5: The page

**Files:**
- Create: `src/app/studio/library/page.tsx`, `src/app/studio/library/LibraryBoard.tsx`, `src/app/studio/library/loading.tsx`
- Create: `src/lib/scene-library/filter.ts`
- Modify: `src/lib/shell/menu.ts` (`keep`: after คลังบุคคล, `{ href: "/studio/library", label: "คลังแอนิเมชัน", icon: …, hue: …, logo: "an" }`), `src/lib/shell/tool-logos.ts`, `src/app/globals.css` (`.tool-logo-an`)
- Modify: `tests/calc/shell-menu.test.ts` (the pinned Studio hrefs)
- Test: `tests/scene-library/filter.test.ts`, `tests/scene-library/library-page.test.tsx`

**Interfaces:**
- Consumes: `LIBRARY`, `usesFor`, `TYPE_NAME`, `PRODUCT_NAME` (Task 1); `marksOf`, `wantCounts`, `toggleLibraryMark` (Task 2); `mayPromptStory`, `closedFor`, `can(viewer, "owner")`.
- Produces: `filterLibrary(items, { q, type, product, state }): LibraryItem[]` in filter.ts (case-insensitive, Thai combining marks ignored via NFC + mark strip, matches name and tells); page: `await gatePage("/studio/library")`, loads marks and counts (a failed load shows `LoadFailed` as hooks does), computes `open: Record<LibraryTool, boolean>`, renders `<LibraryBoard items open saved wanted counts owner />`.
- Board: tabs เลือกดู / ของฉัน / อยากได้มากสุด (owner only); search + three chip rows as the spec; cards and detail as the mockup's หน้าเมนู section; ★ and อยากได้ call `toggleLibraryMark` optimistically and roll back with the error line on failure; a ready item the viewer cannot use shows "ยังไม่เปิดให้ใช้"; empty result line "ไม่พบรายการที่ตรงกับตัวกรอง ลองเลือก “ทั้งหมด”".

- [ ] **Step 1: Write the failing tests** — filter: type/product/state combinations, `q: "คาหอง"` does not match but `q: "ค่าห้อง"` and `q: "ค่าห้อง"` typed with decomposed marks do, empty result is `[]`; page render (server render of the board with a small item set): a non-owner sees no href to `/studio/prompt-story`, an unbuilt item shows "อยากได้ · 3" from counts, the owner sees the อยากได้มากสุด tab and a non-owner does not, the empty-state line shows for a filter with no match; shell-menu test expects `/studio/library` after `/studio/people`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** the tests, `tests/auth/studio-pages-gated.test.ts`, tsc, eslint on touched files — PASS.
- [ ] **Step 5: Verify in the browser** on a temporary mock page that renders the real board with no server calls (removed before commit), phone width, light and dark; screenshot for the owner. The signed-in look on the real page is the owner's.
- [ ] **Step 6: Commit** `feat(library): คลังแอนิเมชัน in Studio`.

### Task 6: Whole run

- [ ] **Step 1:** `npx vitest run`, `npx tsc --noEmit`, eslint on touched files — clean (re-run alone any `tests/quote-video/recipe-*` or `say-numbers` 5 s timeout and report both results).
- [ ] **Step 2:** Confirm `git status` shows no leftover mock page; list the migration file for the owner. Stop: applying the migration and pushing wait for the owner's word.
