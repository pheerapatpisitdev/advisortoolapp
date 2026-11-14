# Device Round 2 (ชีวิต โรคร้าย ภาษี มรดก) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eight new system-drawn devices, a new คลิปเล่าเรื่อง shelf with three topics, the devices in คลิปตามโจทย์, ready in คลังแอนิเมชัน with stills.

**Architecture:** Exactly round 1's architecture — read `docs/superpowers/plans/2026-11-13-health-devices.md` (its tasks 1–12 are the template; each task below names the round-1 task it mirrors) and use `git show <sha>` on round 1's commits as worked examples: b20c60cb (types/registry), ca926562 (figures), ae421c24 + b8236c3e (showBody drawers), 6838c3d5 (plot drawers), 6dbb9c8f + aa1268bb (shelf/episodes), 7f0430ea + babb852e (prompt devices/writer), 41e2464e, 22069e25, d4caf488 (samples/smoke). Since round 1 the info route has Kits for plot/board/neon/blueprint (src/lib/quote-video/story-kits.ts, story-info-motion.tsx `kitFor`, `K.bold` — Sriracha must stay ≤ 400) — new info drawers must use the Kit like the health ones.

**Tech Stack:** Next.js, TypeScript, satori (tests), Remotion, vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-devices-life-tax-design.md` (binding: fields, words, tax table, topics, captions).

## Global Constraints

- Worktree `/Users/pheerapatpisit/Documents/APP/Advisortoolapp-devices2`, branch `feat/devices-life-tax`. Never edit `/Users/pheerapatpisit/Documents/APP/Advisortoolapp`. `node_modules`, `remotion/node_modules`, `remotion/public` are symlinks — never `git add`. No `.env.local`.
- Never run the dev server or anything that writes rows, uploads files, calls a paid AI/TTS or charges a wallet. No push/fetch.
- `git add` explicit paths only. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- An AI never supplies a figure; derived figures are computed in code from sourced inputs. Tax values only in `src/lib/scene-library/tax-th.ts`.
- Colours only via `STORY_CLIP_COLORS` keys; Sriracha text ≤ 400; existing devices/looks/topics unchanged.
- REMOTION_DRAWING is bumped only in Task 7; before that, `tests/quote-video/remotion-drawing.test.ts` (and `tests/scene-library/previews.test.ts` once entries are ready) are expected failures — say so.
- Before each commit: `npx tsc --noEmit` clean, the task's tests green, eslint clean on touched paths. Tasks 6–7 run the full suite (four quote-video files time out at 5 s under load — re-run alone).
- Each drawing task writes stills of its work to `tests/scratch/devices2/` (untracked) and the implementer LOOKS at them before committing.

## Review Focus

1. A device given an AI-made figure that is not in the brief/plan/table → dropped to words-only (or the scene to a picture scene in prompt clips), never drawn. (Tasks 1, 6.)
2. Shares not totalling 100 / split amounts over total / taxback bracket not a table rate → drawn without those figures. (Task 1.)
3. Long Thai names in beneficiary rows and split labels fit at all three sizes. (Tasks 2–4 stills.)
4. Dark looks (neon, blueprint) keep every new device's words readable. (Task 4 contrast test.)
5. A story topic with no typed inputs still makes a clip (words-only devices). (Task 5.)

---

### Task 1: Types, registry, tax table, sourcing (mirrors round-1 Tasks 1–2)
Files: `src/lib/quote-video/story-knowledge.ts` (8 new `KnowShow` members + a `LIFE_LAYOUTS` list beside `HEALTH_LAYOUTS`, kspec/knowText/showText for them, derived-figure helpers), `src/lib/scene-library/devices.ts` (eight entries; widen `DeviceInfo` family/product types), new `src/lib/scene-library/tax-th.ts` (the spec's table, exported constants + `refundAt(premium, rate)`), `src/lib/prompt-story/check.ts` (`checkDevice`/`deviceAllowed` learn the new number fields, the tax table as a source, share/split rules), tests (new `tests/scene-library/devices-life.test.ts`, `tax-th.test.ts`).
- [ ] failing tests (Review Focus 1, 2; tax values pinned; derived figures) → implement → commit `feat(devices): life, CI, tax and legacy device types, registry and tax table`.

### Task 2: Draw lifeneed, beneficiary, cilump, incomestop in showBody (paper, warm, line) (mirrors round-1 Task 3)
Files: a new `src/lib/quote-video/story-life-motion.tsx` (like story-health-motion.tsx) + dispatch in `showBody`; colours keys if needed. Tests: render each at end of animation in 3 looks × 3 sizes; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 3: Draw taxback, taxcap, moneysplit, threegen in showBody (mirrors round-1 Task 4)
- [ ] same shape → commit.

### Task 4: All eight in the info route (plot, board, neon, blueprint; info) (mirrors round-1 Task 5)
Files: `src/lib/quote-video/story-info-motion.tsx` (or a sibling like the health info drawers), using the Kit. Tests: every look × size draws; dark-look contrast at word pixels (Review Focus 4); stills looked at.
- [ ] tests → implement → stills → commit.

### Task 5: The shelf and three topics (mirrors round-1 Tasks 6–7)
Files: `src/lib/story/topics.ts` (shelf "money" in StoryShelf + INFO_SHELVES + the shelf's Thai name wherever shelves are named), new `src/lib/quote-video/story-life.ts` episodes (like story-health.ts), `src/lib/quote-video/story.ts` (inputs on the story input, `checkedStory` validation, captions per spec), `src/app/studio/story-clip/StoryClipBoard.tsx` (the shelf, the topics, the optional inputs, the tax bracket chips), catalogue topic links. Tests: episodes, inputs validated, no-input clip (Review Focus 5), captions, form.
- [ ] tests → implement → commit.

### Task 6: คลิปตามโจทย์ (mirrors round-1 Tasks 8–11)
Files: `src/lib/prompt-story/writer.ts` (device list, when-lines, JSON fields, sources), `check.ts`/`checked.ts` (already learned in Task 1 — wire through), `editor-state.ts` (field names in Thai for the new fields), `frames.tsx` only if needed (device scenes already go through showBody/infoDrawn). Tests: writer parsing incl. a forged figure dropped, editor fields, a prompt clip frame per new device.
- [ ] tests → implement → full suite (expected failures only) → commit.

### Task 7: Library, stills, samples, fingerprint (mirrors round-1 Task 12 and phase-4ก Task 4)
Files: `src/lib/scene-library/catalog.ts` (the eight ready; `readyDevices` covers them with 7 looks; drop their unbuilt `dev(...)` lines; topic links), `remotion/prepare/library.test.ts` (devices list, count 63 + 56 = 119), `remotion/prepare/prepare.test.ts` (each new topic paper + one other look; one free clip with new devices), `public/library/*.jpg` (56 new), `src/lib/quote-video/remotion.ts` (bump), optional ship.sh smoke item. Render one sample MP4 per topic into `tests/scratch/devices2/samples/` (Narisa voice, untracked). Full suite green.
- [ ] prepare + library test → bump fingerprint → stills (look at them; existing 63 byte-identical) → samples → full suite → commit.
