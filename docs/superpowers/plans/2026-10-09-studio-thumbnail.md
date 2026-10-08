# Studio thumbnail (ภาพปกคลิป) — round 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (done natively in one session). Steps use checkbox syntax.

**Goal:** an owner-only `/studio/thumbnail` page that draws 9:16 / 16:9 video covers with AI-drawn Thai words, a free-prompt field, a word check, and a history.

**Architecture:** `drawImage` gets an optional per-call `aspect`; a pure builder (`thumbnail.ts`) makes the prompt and parses headline ideas; `thumbnail-run.ts` does budget → draw → crop → read-back → save; `thumbnail-history.ts` mirrors `describe-history.ts`. Two plain routes, one client board.

**Tech Stack:** Next 15, Supabase (table + private bucket), sharp (crop), vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-studio-thumbnail-design.md`

## Global Constraints

- Owner only: pages `gatePage("/studio/thumbnail", "owner")`, routes `refuseUnless("owner")`.
- Task names start with `content-` (`content-thumbnail`, `content-thumbnail-ideas`) so the monthly ceiling counts them.
- History keeps newest 200; images in private bucket `thumbnail-images` at `<agentId>/<rowId>.jpg`; signed links of one hour.
- Calls that pass no `aspect` to `drawImage` stay 1:1 (Organic unchanged).
- Safe areas: 9:16 text clear of top ~15% and bottom ~25%; 16:9 bottom-right corner clear.
- Production: do NOT apply the migration to the production database or push; the owner approves that.

## Review Focus

- Headline containing quotes / newlines / very long text → prompt still carries it verbatim, trimmed to the limit.
- Free prompt in Thai → translated by the existing `inEnglish`; empty free prompt → the built scene is used.
- Person id that no longer exists → drawn without a person, with a note.
- OpenAI 2:3 result → cropped to exact 9:16; already-exact image is untouched.
- Text-read failure → image still saved, marked unread.

### Task 1: per-call aspect in the image client
**Files:** Modify `src/lib/ai/images.ts`, `src/lib/ai/client.ts`; Create `src/lib/content/crop.ts`; Test `tests/content/thumbnail-aspect.test.ts`
**Produces:** `export type Aspect = "1:1" | "9:16" | "16:9"`; `withAspect(provider: string, params: Record<string, unknown>, aspect?: Aspect): Record<string, unknown>` (google → `aspect_ratio`; openai → `size` 1024x1536 / 1536x1024; undefined → params unchanged); `drawImage({..., aspect?})`; `cropToAspect(bytes: Buffer, aspect: Aspect): Promise<{bytes: Buffer; mimeType: string}>` (centre crop, JPEG, no-op within 1%).
- [ ] Write tests: `withAspect` per provider and undefined; `cropToAspect` on a generated 1024×1536 and 1536×1024 PNG gives exactly the ratio (±1px), on an already-9:16 image returns same bytes.
- [ ] Run, see fail. Implement. Run, pass. Commit.

### Task 2: prompt builder and headline ideas
**Files:** Create `src/lib/content/thumbnail.ts`; Test `tests/content/thumbnail.test.ts`
**Produces:** `STYLES` (4 ids: `bold`, `alert`, `clean`, `warm`); `SIZES`; `thumbnailPrompt({size, style, headline, sub, scene, person?: {pose}}): string`; `parseIdeas(text: string): {headline: string; sub: string}[]`; `ideasMessages(topic: string)`; limits `MAX_HEADLINE=40`, `MAX_SUB=60`, `MAX_TOPIC=4000`.
- [ ] Tests: headline/sub appear verbatim; free `scene` replaces default scene but size, "Draw only the words above", safe-area text and person lines remain; 9:16 vs 16:9 safe-area wording differs; `parseIdeas` handles bad JSON (→ []), caps at 5, trims.
- [ ] Implement, pass, commit.

### Task 3: history store + migration
**Files:** Create `src/lib/content/thumbnail-history.ts`, `supabase/migrations/20261014_thumbnail_history.sql`; Test `tests/content/thumbnail-history.test.ts` (pure parts)
**Produces:** `saveThumbnail(agentId, {settings, imageBytes, mimeType}) → id`, `listThumbnails(agentId)`, `deleteThumbnail(agentId, id)`, `HISTORY_MAX = 200`, `ThumbSettings` type, `parseSettings(unknown): ThumbSettings | null`.
- [ ] Test `parseSettings` rejects bad size/style, clamps lengths. Implement store modelled on `describe-history.ts`. Commit.

### Task 4: run + routes
**Files:** Create `src/lib/content/thumbnail-run.ts`, `src/app/api/content-thumbnail/route.ts`, `src/app/api/content-thumbnail/ideas/route.ts`, `src/app/api/content-thumbnail/[id]/route.ts` (DELETE); Modify `src/app/admin/ai/task-labels.ts`
**Produces:** `makeThumbnail(input): Promise<ThumbResult>`; `makeIdeas(topic)`.
- [ ] Implement per spec (limiter 40/h shared key style, ceiling, budget hold/release, draw with `aspect`, crop, `readPosterText`, save, Thai errors). Typecheck. Commit.

### Task 5: page, board, menu
**Files:** Create `src/app/studio/thumbnail/{page,loading,ThumbnailBoard}.tsx`; Modify `src/lib/shell/menu.ts`, `tests/calc/shell-menu.test.ts`, `src/lib/content/studio-home` (skip)
- [ ] Menu test first (owner sees `/studio/thumbnail`, others do not; route exists). Implement menu + page + board. Run full tests, `tsc`, lint. Browser check on dev server read-only (no generation). Commit.
