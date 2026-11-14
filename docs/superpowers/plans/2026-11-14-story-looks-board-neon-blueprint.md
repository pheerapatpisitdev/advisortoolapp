# Story looks ไวต์บอร์ด · นีออน · บลูพริ้นท์ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three new story-clip looks (`board`, `neon`, `blueprint`) in คลิปเล่าเรื่อง (info shelves) and คลิปตามโจทย์, ready in คลังแอนิเมชัน with stills.

**Architecture:** Each look is a `Kit` in the อินโฟกราฟิก/ปากกาพล็อตเตอร์ route (`src/lib/quote-video/story-info-motion.tsx`), like `plot`, so every knowledge layout and health device is drawn by the existing info drawers in the look's palette. Around the scenes (background, title, subtitle, contact card, footer, prompt-clip words) each look gets a branch next to plot's. Plumbing (types, allowlists, forms, links, catalogue) follows the plot/line precedent commits e45c7f63 and 287b580a (`git show <sha> --stat` is a checklist).

**Tech Stack:** Next.js, TypeScript, satori (tests' renderPng), Remotion (clips), vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-story-looks-board-neon-blueprint-design.md` — every colour, font, Thai name and painter prefix there is exact.

## Global Constraints

- `.env.local` points at the PRODUCTION database. Never run the dev server, never run anything that writes rows, uploads files, calls an AI/TTS or charges a wallet. The worktree has no `.env.local`; keep it so. Remotion renders and satori tests are local and fine.
- Work only in `/Users/pheerapatpisit/Documents/APP/Advisortoolapp-new-looks` (branch `feat/story-looks-board-neon`). `node_modules`, `remotion/node_modules`, `remotion/public` are symlinks — never `git add` them.
- `git add` explicit paths only. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nothing is pushed.
- Ids `board` | `neon` | `blueprint`; Thai names ไวต์บอร์ด | นีออน | บลูพริ้นท์ exactly; order after the existing looks.
- Colours only as `STORY_CLIP_COLORS` keys (`board*`, `neon*`, `bp*`); `tests/calc/palette.test.ts` forbids stray hex in src.
- Do not touch the วิดีโอนำเสนอ themes (`ThemeKey`, `THEME_LABELS`, `VIDEO_THEME_COLORS`).
- `REMOTION_DRAWING` changes once, in Task 4 only; earlier tasks leave `tests/quote-video/remotion-drawing.test.ts` failing only with the "set REMOTION_DRAWING" message (expected) — say so in the report, do not bump it early.
- Before each commit: `npx tsc --noEmit` clean; the task's test files green; eslint clean on touched paths. Task 4 runs the full suite (four quote-video files — recipe-title, recipe-form-race, say-numbers, quote-video — time out at 5 s under load; re-run them alone before calling them failures).

## Review Focus

1. A stored or linked look on a non-info-shelf topic in คลิปเล่าเรื่อง → falls back as plot does (no crash, no new look drawn with people). (Task 1 tests.)
2. Neon and blueprint are dark: every word drawn by the info drawers, the subtitle, the contact card and the footer must be readable (no default dark ink on dark ground). (Task 2/3 pixel tests at a word's location.)
3. คลิปตามโจทย์ with a device scene + a library part + a style reference in each new look renders (deviceFrame, lookGround, freeFrame words). (Task 3 tests.)
4. The info drawers set the module-level `K` from the input's look in every entry point (`infoBody`, `infoDrawn`, `infoShow` callers) — a frame drawn right after another look's frame must not keep the old Kit. (Task 2 test: render plot then neon then plot.)
5. Library previews: every `preview` path in the catalogue exists on disk. (Task 4 test.)

---

### Task 1: Ids, allowlists, forms, links, catalogue, painter prefixes

**Files:** `src/lib/quote-video/story.ts` (art union ~95; `checkedStory` gate ~335-352: the three behave as plot — kept only on INFO_SHELVES), `src/app/studio/story-clip/StoryClipBoard.tsx` (Look type ~70; `readLook` ~96 keeps the three; derived flags ~367-370; submit ~543-547; chips ~880-892 only on info shelves with one blurb line each; a preview for each — a small static card in the look's colours is enough; summary string ~879), `src/lib/scene-library/links.ts` (STORY_LOOKS, PROMPT_STYLES, the plot-only-on-info-shelves rule ~52 generalised to the three), `src/lib/scene-library/catalog.ts` (STORY_LOOKS entries for the three with `style` = same id; drop the three `n("look", …)` unbuilt lines ~138-140; generalise the plot-only special cases ~73 `lookFits` and ~106 topic link to all four info-route looks; `DEVICE_LOOK_ORDER` gains the three), `src/lib/prompt-story/types.ts` (PictureStyle + PICTURE_STYLES), `src/lib/prompt-story/pictures.ts` (STYLE_PREFIX from the spec), `src/lib/prompt-story/checked.ts` (STYLES), `src/lib/prompt-story/frames.tsx` (`freeLook` return type and mapping only — drawing is Task 3), `remotion/src/StoryClip.tsx` line ~77 only if needed for types (drawing is Task 3).
**Tests:** extend `tests/scene-library/{catalog,links,form-links,library-page}.test.*`, `tests/prompt-story/{looks,pictures,frames}.test.*`, `tests/quote-video/story-info.test.ts` (or a new `story-new-looks.test.ts`) with the cases below. Note `tests/scene-library/catalog.test.ts:93` compile tie and `remotion/prepare/library.test.ts:113` count (left for Task 4 — it is not in vitest's default run? check; if it is, update LOOKS and the count to 63 here and say so).

**Interfaces — Produces:** `type StoryArt = … | "board" | "neon" | "blueprint"`; a helper `infoLook(art): boolean` (true for plot and the three) in `story.ts` or where `plot()` lives, used by the gates, the form and the catalogue instead of `=== "plot"`; `PictureStyle` with the three; `freeLook` mapping each to `{ art: <same id> }`.

- [ ] Step 1: failing tests — `checkedStory` keeps `art:"neon"` on a health topic and drops it (as plot) on a non-info topic; `storyStartFrom({look:"board", topic:<non-info>})` drops the look; `promptStartFrom({style:"blueprint"})` keeps it; form: chips ไวต์บอร์ด นีออน บลูพริ้นท์ shown on an info-shelf topic, absent otherwise; `readLook` round-trips each; `PICTURE_STYLES` ids end with board, neon, blueprint; `STYLE_PREFIX` keys include them with the spec's text; catalogue: the three `look-*` items `ready: true` with uses into both forms, devices list 7 looks.
- [ ] Step 2: implement; tests pass; tsc clean (the drawing may still fall back to plot's or info's look at render — acceptable until Task 2).
- [ ] Step 3: commit `feat(looks): ids, forms, links and catalogue for ไวต์บอร์ด นีออน บลูพริ้นท์`.

### Task 2: Three Kits in the info route

**Files:** `src/lib/card-theme.ts` (STORY_CLIP_COLORS keys), `src/lib/quote-video/story-info-motion.tsx` (Kit interface gains what the looks need — e.g. `hand` font, `glow` colour or null, `reveal: "fade" | "write" | "switch"`; `BOARD_KIT`, `NEON_KIT`, `BLUEPRINT_KIT`; the `K =` selection in `infoBody`, `infoDrawn`, and wherever else K is set, via one `kitFor(input)`; `E` reveal per `K.reveal`: write = plot's clip reveal, switch = opacity 0 → flicker (dips at ~25% and ~45% of the piece's duration) → 1; `infoDrawn` draws plot's machine only for plot; blueprint dimension lines on figure rows; neon glow as text-shadow/box-shadow in the line's colour), the five `HAND = "Mali"` sites only where the info route needs the Kit's face (`K.hand`), `src/lib/quote-video/story-motion.tsx` predicates (`info()`/`plot()` and a `look()` accessor) as needed.
**Tests:** new `tests/quote-video/story-new-looks.test.tsx` (pattern: `tests/scene-library/health-draw.test.tsx` 233-352 and `tests/quote-video/story-paper.test.ts`): for each look, satori-render every knowledge layout used by an info-shelf topic and all 8 health devices at the end of their animation (no throw); corner pixel = the look's ground (board: board white inside the frame; neon: near #07060f–#1c1236; blueprint: #1f5aa6 ± grid); a heading pixel in the accent; neon frame has glow (shadow present in markup); Review Focus 4 (plot → neon → plot frames each in their own Kit).

- [ ] Step 1: failing tests. - [ ] Step 2: implement. - [ ] Step 3: look at three stills per look yourself (write PNGs to `tests/scratch/new-looks/` — untracked) and fix anything unreadable; list them in the report. - [ ] Step 4: commit `feat(looks): ไวต์บอร์ด นีออน บลูพริ้นท์ kits in the info route`.

### Task 3: Around the scenes — background, title, subtitle, contact, footer, คลิปตามโจทย์ framing

**Files:** `src/lib/quote-video/story-motion.tsx` (`storyBackground` ~580: board frame + tray, neon violet ground + low lines + pink frame, blueprint grids + border + title block — all as the mockup sketches; `Title` ~214 per look in its face and accent; `Subtitle` ~523 band colours per spec; `Contact` ~459 dark looks via the light-on-dark path; `paperInk` per look), `src/lib/quote-video/story-frames.tsx` (`clipFrame` footer colour per look), `remotion/src/StoryClip.tsx` (~77 skip face preload for the three; ~118 className if CSS is needed), `src/lib/prompt-story/frames.tsx` (`freeFrame` words chain ~126-137: marker sheet / glowing sign / white-on-blue plate; `dressed` flag; `deviceFrame` via `infoDrawn`), `src/lib/prompt-story/asset-picture.tsx` (`lookGround` per look: board #fbfcfd, neon #1c1236, blueprint #1f5aa6 via palette keys).
**Tests:** extend `tests/prompt-story/{frames,looks,asset-scene}.test.*` and the Task 2 test file: each look's opening title, subtitle and contact frames render with readable word pixels (Review Focus 2); a prompt clip in each look with a picture scene, a device scene and an asset scene renders (Review Focus 3); `lookGround` values.

- [ ] Step 1: failing tests. - [ ] Step 2: implement. - [ ] Step 3: look at the stills yourself as in Task 2. - [ ] Step 4: commit `feat(looks): background, titles, subtitles and prompt-clip framing for the new looks`.

### Task 4: Pipeline, stills, fingerprint

**Files:** `remotion/prepare/prepare.test.ts` (a block per look after plot's ~232-250: two info-shelf topics each — board: fiverisks + st-health roomcost; neon: mythclaim + health waiting; blueprint: declare + health agecost — portrait, one square; and the free-clip loops ~271, ~306 gain the three styles), `remotion/prepare/library.test.ts` (LOOKS + count 63), `public/library/*.jpg` (27 new stills via `node remotion/library-stills.mjs` after the props are prepared — read the script's header for the exact steps; it needs the Remotion bundle and fonts in `remotion/public`), `src/lib/quote-video/remotion.ts` (`REMOTION_DRAWING` = the value `tests/quote-video/remotion-drawing.test.ts` prints), optionally `remotion/cloudrun/ship.sh` smoke set (+ one new-look item).
**Tests:** a catalogue test that every `preview` path exists under `public/` (Review Focus 5); full suite.

- [ ] Step 1: prepare blocks + library test; run the prepare suite the way `ship.sh` step 1 does (read it) and make sure it passes locally without network calls to paid APIs (if a step needs TTS or the database, stop and report). - [ ] Step 2: render the 27 stills; look at them; commit them. - [ ] Step 3: bump REMOTION_DRAWING; full suite green; commit `feat(looks): stills, prepare samples and drawing fingerprint for the new looks`.
