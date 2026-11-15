# Device Round 4 (ออมเงินและเกษียณ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Four system-drawn saving devices (savejar, paidgot, pricerise, pensionsteps) with figures in baht only, a
new คลิปเล่าเรื่อง topic `retiresave`, the devices in คลิปตามโจทย์, ready in คลังแอนิเมชัน with stills.

**Architecture:** Exactly rounds 2 and 3. Worked examples: round 2 for number fields and their sources
(`docs/superpowers/plans/2026-11-14-devices-life-tax.md`, `git log --oneline --grep devices`, drawers in
`src/lib/quote-video/story-life-motion.tsx` / `story-life-info.tsx`, the money shelf in `story-money.ts`, `MONEY_INPUTS`
in `src/lib/story/topics.ts`, `taxback`'s `allowed` check in `src/lib/prompt-story/check.ts`); round 3 for the newest
shape of a device file pair (`story-meta-motion.tsx` with `boxOf`/`enterOf`, `story-meta-info.tsx`), the digit rule
and catalogue/stills (`docs/superpowers/plans/2026-11-15-devices-metaphor.md`). The pension figure: `storyPension` in
`src/lib/quote-video/story.ts`, `pensionVideoFacts` in `src/lib/quote-video/pension.ts`, `quotePension` in
`src/calc/pension/engine.ts` (illustration rows, `totalPension`, `bands`), and how topic `preretire` takes it.

**Tech Stack:** Next.js, TypeScript, satori (tests), Remotion, vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-devices-saving-design.md` (binding: fields, limits, beats, the topic's
scenes, voices and captions, words).

## Global Constraints

- Worktree `/Users/pheerapatpisit/Documents/APP/Advisortoolapp-devices4`, branch `feat/devices-saving`. Never edit
  `/Users/pheerapatpisit/Documents/APP/Advisortoolapp`. `node_modules`, `remotion/node_modules`, `remotion/public` are
  symlinks — never `git add`. No `.env.local`.
- Never run the dev server or anything that writes rows, uploads files, calls a paid AI/TTS or charges a wallet.
  No push/fetch.
- `git add` explicit paths only. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No "%" and none of ผลตอบแทน ดอกเบี้ย กำไร ปันผล IRR on these devices or in the topic. No digit in any word field.
  No invented inflation figure. Colours only via `STORY_CLIP_COLORS` keys; Sriracha text ≤ 400 (`K.bold`); existing
  devices/looks/topics/stills unchanged.
- REMOTION_DRAWING is bumped only in Task 7; before that, `tests/quote-video/remotion-drawing.test.ts` (and
  `tests/scene-library/previews.test.ts` once entries are ready) are expected failures — say so.
- Before each commit: `npx tsc --noEmit` clean, the task's tests green, eslint clean on touched paths. Tasks 5–7 run
  the full suite (some quote-video files time out at 5 s under load — re-run alone).
- Each drawing task writes stills of its work to `tests/scratch/devices4/` (untracked) and the implementer LOOKS at
  them before committing.

## Review Focus

1. A number not from its source (engine in story, brief in prompt) is never drawn; paidgot without both amounts and
   pensionsteps without valid ascending rows are refused. (Tasks 1, 6.)
2. Nine-digit figures with commas and long Thai words fit at all three sizes and seven looks. (Tasks 2–4 stills.)
3. Dark looks (neon, blueprint) keep every word and figure readable. (Task 4 contrast test.)
4. retiresave figures equal the engine's for the spec's example (paid 2,724,410; got 6,023,625; 20 years; ages
   40–59 / 60–95); pension required; no "%" or return word anywhere in the topic. (Task 5.)
5. pricerise draws no figure; pensionsteps' ค่าครองชีพ line carries no figure.

---

### Task 1: Types, registry, checks (mirrors round-2/3 Task 1)
Files: `src/lib/quote-video/story-knowledge.ts` (4 `KnowShow` members, `SAVE_LAYOUTS`, `DeviceLayout` widened,
kspec/knowText/showText, `isSave`, limits), `src/lib/scene-library/devices.ts` (four entries, family "ออมเงิน",
product "saving"), `src/lib/prompt-story/check.ts` (number fields through `num(..., allowed)`; paidgot both amounts
required; pensionsteps rows 1–5 ascending with from ≤ to; word fields digit-free and within limits), tests (new
`tests/scene-library/devices-saving.test.ts`).
- [ ] failing tests (Review Focus 1, 5) → implement → commit `feat(devices): saving device types, registry and checks`.

### Task 2: Draw savejar and paidgot in showBody (paper, warm, line)
Files: new `src/lib/quote-video/story-save-motion.tsx` + dispatch in `showBody`. Tests: each at end of animation and
mid-beat in 3 looks × 3 sizes, with and without optional numbers, 9-digit figures; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 3: Draw pricerise and pensionsteps in showBody
- [ ] same shape (pensionsteps with 1, 4 and 5 rows) → commit.

### Task 4: All four in the info route (plot, board, neon, blueprint; info) with the Kit
Files: new `src/lib/quote-video/story-save-info.tsx` + dispatch. Tests: every look × size draws; dark-look contrast
at word and figure pixels; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 5: The story topic `retiresave`
Files: `src/lib/story/topics.ts` (topic entry on shelf money, figure pension), `src/lib/quote-video/story.ts`
(pension required for retiresave, message "ใส่บำนาญที่ลูกค้าต้องการ"), `src/lib/quote-video/story-money.ts` (five
scenes, voices, captions per spec; figures from the engine), the story form if the topic list/inputs need wiring.
Tests: scene layouts, figures for the spec's example, pension required, no "%"/return words, every offered look draws
every scene; other topics unchanged.
- [ ] tests → implement → full suite (expected failures only) → commit.

### Task 6: คลิปตามโจทย์
Files: `src/lib/prompt-story/writer.ts` (device list, when-lines, JSON fields), `editor-state.ts` (Thai field names),
`check.ts`/`checked.ts` wiring. Tests: writer parsing incl. a number not in the brief left off / paidgot refused, a
digit in a word refused, editor fields, a prompt clip frame per new device.
- [ ] tests → implement → full suite → commit.

### Task 7: Library, stills, samples, fingerprint (mirrors round-3 Task 7)
Files: `src/lib/scene-library/catalog.ts` (the four ready with 7 looks keyed by layout, drop dev lines growing-jar,
inflation-eats, pension-inflation, irr-per-year, topic links), `remotion/prepare/library.test.ts` (count 175 + 28 =
203), `remotion/prepare/prepare.test.ts` (retiresave paper + one info look; one free clip with saving devices),
`public/library/*.jpg` (28 new, spec's example figures), `src/lib/quote-video/remotion.ts` (bump), ship.sh smoke item
`st-save-retiresave`. Render sample MP4s into `tests/scratch/devices4/samples/` (Narisa voice, untracked). Full suite
green.
- [ ] prepare + library test → bump fingerprint → stills (look at them; existing 175 byte-identical) → samples →
  full suite → commit.
