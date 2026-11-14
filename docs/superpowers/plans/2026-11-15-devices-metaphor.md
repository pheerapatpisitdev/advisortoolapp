# Device Round 3 (อุปมาเล่าเรื่อง) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eight system-drawn metaphor devices (no figures), the opening scene of eight คลิปเล่าเรื่อง topics
replaced by them, the devices in คลิปตามโจทย์, ready in คลังแอนิเมชัน with stills.

**Architecture:** Exactly round 2's architecture — read `docs/superpowers/plans/2026-11-14-devices-life-tax.md` and
its spec; use `git log --oneline --grep devices` / `git show` on round 2's commits (types/registry, showBody
drawers in `src/lib/quote-video/story-life-motion.tsx`, info drawers in `story-life-info.tsx` with the Kit,
writer/check/editor, catalog/stills/fingerprint) as worked examples. Metaphors are simpler: no number fields, no
sourcing, no derived figures — instead a digit-free rule on every word field.

**Tech Stack:** Next.js, TypeScript, satori (tests), Remotion, vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-devices-metaphor-design.md` (binding: fields, limits, beats, the
eight topic openers, words).

## Global Constraints

- Worktree `/Users/pheerapatpisit/Documents/APP/Advisortoolapp-devices3`, branch `feat/devices-metaphor`. Never
  edit `/Users/pheerapatpisit/Documents/APP/Advisortoolapp`. `node_modules`, `remotion/node_modules`,
  `remotion/public` are symlinks — never `git add`. No `.env.local`.
- Never run the dev server or anything that writes rows, uploads files, calls a paid AI/TTS or charges a wallet.
  No push/fetch.
- `git add` explicit paths only. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No digit (Arabic or Thai) in any metaphor word. Colours only via `STORY_CLIP_COLORS` keys; Sriracha text ≤ 400
  (`K.bold`); existing devices/looks/topics/stills unchanged except the eight openers.
- REMOTION_DRAWING is bumped only in Task 7; before that, `tests/quote-video/remotion-drawing.test.ts` (and
  `tests/scene-library/previews.test.ts` once entries are ready) are expected failures — say so.
- Before each commit: `npx tsc --noEmit` clean, the task's tests green, eslint clean on touched paths. Tasks 5–7 run
  the full suite (some quote-video files time out at 5 s under load — re-run alone).
- Each drawing task writes stills of its work to `tests/scratch/devices3/` (untracked) and the implementer LOOKS at
  them before committing.

## Review Focus

1. A digit or over-long word in any metaphor field → refused (prompt: scene fails its check; story: pinned by
   test), never drawn. (Tasks 1, 6.)
2. Long Thai words (shield arrows, balance sides, notes) fit at all three sizes and seven looks. (Tasks 2–4 stills.)
3. Dark looks (neon, blueprint) keep every word readable. (Task 4 contrast test.)
4. The eight story openers: voice and title byte-equal to the old opener; nothing else in those topics changes.
   (Task 5.)
5. `housepillar` without `spare` draws no second pillar; `balance` tilt follows the field; `shield` 1–5 arrows.

---

### Task 1: Types, registry, words, checks (mirrors round-2 Task 1)
Files: `src/lib/quote-video/story-knowledge.ts` (8 `KnowShow` members, `META_LAYOUTS` beside `LIFE_LAYOUTS`,
`DeviceLayout` widened, kspec/knowText/showText, `isMeta`), `src/lib/scene-library/devices.ts` (eight entries,
family "อุปมา", product "all"), `src/lib/prompt-story/check.ts` (`checkDevice`/`deviceAllowed`: metaphor word
fields digit-free and within limits; shapes of sides/tilt/arrows), tests (new `tests/scene-library/devices-metaphor.test.ts`).
- [ ] failing tests (Review Focus 1, 5) → implement → commit `feat(devices): metaphor device types, registry and checks`.

### Task 2: Draw umbrella, housepillar, lifering, safetynet in showBody (paper, warm, line)
Files: new `src/lib/quote-video/story-meta-motion.tsx` + dispatch in `showBody`. Tests: each at end of animation
and mid-beat in 3 looks × 3 sizes; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 3: Draw seedtree, balance, bridge, shield in showBody
- [ ] same shape → commit.

### Task 4: All eight in the info route (plot, board, neon, blueprint; info) with the Kit
Files: new `src/lib/quote-video/story-meta-info.tsx` + dispatch. Tests: every look × size draws; dark-look contrast
at word pixels; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 5: The eight story openers
Files: `story-family.ts` (pillar), `story-knowledge.ts` (mythjinx, fiverisks), `story-life.ts` (selfemployed),
`story-objection.ts` (pricey, bank, welfare), `story-money.ts` (ciincome). Tests: first scene layout per topic,
voice and title equal the old opener (pin the old strings), other scenes unchanged (snapshot of keys/layouts),
every offered look draws the opener.
- [ ] tests → implement → full suite (expected failures only) → commit.

### Task 6: คลิปตามโจทย์
Files: `src/lib/prompt-story/writer.ts` (device list, when-lines, JSON word fields), `editor-state.ts` (Thai field
names), `check.ts`/`checked.ts` wiring. Tests: writer parsing incl. a digit in a metaphor word refused, editor
fields, a prompt clip frame per new device.
- [ ] tests → implement → full suite → commit.

### Task 7: Library, stills, samples, fingerprint (mirrors round-2 Task 7)
Files: `src/lib/scene-library/catalog.ts` (the eight ready with 7 looks, drop their unbuilt `dev(...)` lines, topic
links), `remotion/prepare/library.test.ts` (count 119 + 56 = 175), `remotion/prepare/prepare.test.ts` (four
openers paper + one other look; one free clip with metaphors), `public/library/*.jpg` (56 new),
`src/lib/quote-video/remotion.ts` (bump), optional ship.sh smoke item. Render sample MP4s into
`tests/scratch/devices3/samples/` (Narisa voice, untracked). Full suite green.
- [ ] prepare + library test → bump fingerprint → stills (look at them; existing 119 byte-identical) → samples →
  full suite → commit.
