# Device Round 5 (สุขภาพเพิ่มเติม) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eight system-drawn health devices (ipdopd, deductible, copay, renew98, parentshealth, groupcost, hospitals,
paclaim) with figures from the app's own data, a new คลิปเล่าเรื่อง topic `ipdopd`, the devices in คลิปตามโจทย์, ready in
คลังแอนิเมชัน with stills.

**Architecture:** Exactly round 4 (the newest worked example: `git log --oneline e005e605 --grep devices`, files
`src/lib/quote-video/story-save-motion.tsx`, `story-save-info.tsx`, `SAVE_*` in `story-knowledge.ts`, `check.ts` save
cases with `num(..., allowed)` / dropped optional numbers / `fromPlan`-style internal flags, `writer.ts`, `editor-state.ts`,
tests `tests/scene-library/{devices-saving,save-draw,save-info-draw}.test.*`, `tests/prompt-story/writer-save.test.ts`,
story `story-money.ts` retiresave + `story-retiresave*.test.*`, catalog/stills/fingerprint commit 694bfa1f, final fixes
53d11e71). Round 1's health devices and topics (`story-health.ts`, `health-figures.ts`, HEALTH_LAYOUTS) for the health
shelf and `HealthFigures`.

**Tech Stack:** Next.js, TypeScript, satori (tests), Remotion, vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-devices-health2-design.md` (binding: fields, sources, limits, beats, the
topic's scenes, voices, words).

## Global Constraints

- Worktree `/Users/pheerapatpisit/Documents/APP/Advisortoolapp-devices5`, branch `feat/devices-health2`. Never edit
  `/Users/pheerapatpisit/Documents/APP/Advisortoolapp`. `node_modules`, `remotion/node_modules`, `remotion/public` are
  symlinks — never `git add`. No `.env.local`.
- Never run the dev server or anything that writes rows, uploads files, calls a paid AI/TTS or charges a wallet.
  No push/fetch, no gcloud. Samples use the local macOS Narisa voice.
- `git add` explicit paths only. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every figure from a code source or the agent's input; derived figures computed by the drawer; no digit in word fields;
  no "%" except the copay's drawn percent; no return words or IRR; no "รายวัน" for PA weekly; never promise a claim.
  Colours only via `STORY_CLIP_COLORS` keys / the Kit; Sriracha ≤ 400 (`K.bold`); existing devices/looks/topics/stills
  unchanged; bars to scale from zero.
- REMOTION_DRAWING is bumped only in Task 7; before that the fingerprint test (and previews test once entries are ready)
  are expected failures — say so.
- Before each commit: `npx tsc --noEmit` clean, the task's tests green, eslint clean on touched paths. Tasks 5–7 run the
  full suite. Stills PNGs only behind an env flag (as round 4's `SAVE_STILLS=1`); render checks always in the suite and
  fast. Each drawing task LOOKS at its stills before committing.

## Review Focus

1. A number not from its source never drawn; required numbers refuse, optional unsourced dropped; hospital counts match
   the JSON; copay percent equals the sheet's. (Tasks 1, 6.)
2. Long Thai words and 9-digit figures fit at three sizes and seven looks. (Tasks 2–4.)
3. Dark looks keep every word and figure readable (per-element). (Task 4.)
4. Topic ipdopd: figures equal the sheet for GOLD and SMART ("none" OPD), age from input, no "%". (Task 5.)
5. Honest pictures: bars from zero, splits computed, no claim promises, PA weekly never "รายวัน".

---

### Task 1: Types, registry, sources, checks
Files: `story-knowledge.ts` (8 KnowShow members, `HEALTH2_LAYOUTS`, limits, kspec/knowText/showText), `devices.ts`
(8 entries), a small source module (e.g. `src/lib/scene-library/health2-sources.ts`: sheet values per plan, group
premiums lookup, PA values, hospital counts + fetched date, parents cap — browser-safe or kept server-side as the
existing health-figures is), `check.ts` cases, tests `tests/scene-library/devices-health2.test.ts`.
- [ ] failing tests (Review Focus 1) → implement → commit `feat(devices): health round-2 device types, sources and checks`.

### Task 2: Draw ipdopd, deductible, copay, renew98 in showBody (paper, warm, line)
Files: new `src/lib/quote-video/story-health2-motion.tsx` + showBody dispatch; tests; stills looked at.
- [ ] tests → implement → stills → commit.

### Task 3: Draw parentshealth, groupcost, hospitals, paclaim in showBody
- [ ] same shape → commit.

### Task 4: All eight in the info route with the Kit
Files: new `src/lib/quote-video/story-health2-info.tsx` + dispatch (reuse Task 2–3 geometry); per-element dark contrast.
- [ ] tests → implement → stills → commit.

### Task 5: Story topic `ipdopd`
Files: `src/lib/story/topics.ts`, `HealthFigures` (+opd, +renewalToAge) in `health-figures.ts`, `story-health.ts`
(scenes, HEALTH_CLOSE), the story form if needed. Tests: scenes, voices per spec, GOLD and SMART figures, no "%", every
health-shelf look draws.
- [ ] tests → implement → full suite → commit.

### Task 6: คลิปตามโจทย์
Files: `writer.ts` (shapes, when-lines, rule line), `editor-state.ts` (Thai fields), checked.ts plumbing only. Tests:
writer parsing (brief number / fixed-source value accepted; other numbers dropped or refused per spec), editor fields,
a prompt frame per device.
- [ ] tests → implement → full suite → commit.

### Task 7: Library, stills, samples, fingerprint
Files: `catalog.ts` (8 ready; remove the nine dev lines; links), `library.test.ts` (count 259), `prepare.test.ts`
(ipdopd paper + one info look; one prompt clip with four new devices, Narisa), 56 `public/library/*.jpg`, REMOTION_DRAWING
bump, ship.sh smoke `st-health2-ipdopd`. Samples into `tests/scratch/devices5/samples/`.
- [ ] prepare + library test → bump fingerprint → stills (look; existing 203 byte-identical) → samples → full suite → commit.
