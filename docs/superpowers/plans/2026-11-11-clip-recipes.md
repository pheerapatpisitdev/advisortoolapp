# สูตรคลิป Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three recipe clips (เปิดด้วยคำถาม, เส้นชีวิต, เทียบให้เห็น) for Life Protect portrait Thai Motion clips, picked at random by default on the form, with everything that exists left as it is.

**Architecture:** A recipe is a whole clip: its own scene list, fixed spoken templates and drawing, all filled from `QuoteVideoFacts`. `recipes.ts` (pure: keys, fits, script) is shared by form and server; three `recipe-*.tsx` files draw frames as functions of scene time, the way `kinetic.tsx` does; `remotion/src/Clip.tsx` draws them when `ClipProps.recipe` is set. A recipe's scenes reuse existing `SceneKey` values as slot names (unique within a clip) and are drawn **by index**, so no type is widened.

**Tech Stack:** Next.js server actions, TypeScript, vitest, Remotion 4 on Cloud Run (`remotion/`), inline-style React frames under the `.sat` flex CSS.

**Spec:** `docs/superpowers/specs/2026-11-11-clip-recipes-design.md` (mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88)

## Global Constraints

- Scope: style `motion`, product `LIFEPROTECT`, size portrait, Thai, no riders, no budget. Everywhere else the app behaves exactly as today.
- Every figure on screen and in the voice comes from `QuoteVideoFacts`; no AI writes recipe words.
- No migration: `recipe` lives in the row's `input` JSON. No price, wallet, voice-engine or progress change.
- A clip without `recipe` must produce byte-identical props to today's (no new keys on its props).
- Frames are pure functions of time (no CSS animations, no `Math.random`, no `Date`): Remotion renders frames out of order.
- No `backdrop-filter`, no full-screen `filter: blur` (software GL on Cloud Run).
- Fonts: Kanit 500/800/900 (`ask`), Trirong 400/600/700 (`life`), Plex (`versus`). A font that fails to load fails the render.
- Foot line on every recipe scene: `ตัวอย่างประกอบ · เงื่อนไขตามกรมธรรม์`, plus `facts.footNote` where present.
- Git: `git add` explicit paths only, never `-A`. Branch `feat/clip-recipes`. **Do not push**; the owner says when.
- Local dev writes to the production database: do not create real clips from the local form; verify with tests and stills.
- Mockup-first: the form row (Task 8) is built only after the owner OKs its mockup.

## Review Focus

1. A stored row whose `recipe` is unknown, or no longer fits (rates changed) → the standing navy Motion clip is made, no throw. (Task 7 test)
2. Largest sum and longest names: `lead` of 50,000,000, a 40-letter agent name, a LINE id of 30 letters → no text wider than the frame in any scene. (Tasks 3–5 tests)
3. `versus` when cash value barely passes premiums (diff under 1,000) and when it never does → offered with a readable diff / not offered. (Task 1 test)
4. `localStorage` throwing or empty → สุ่มให้ still returns a fitting recipe. (Task 8 test)
5. A male narrator → every recipe line ends ครับ, none ค่ะ/คะ. (Task 1 test)

## File Structure

| File | Job |
|---|---|
| `src/lib/quote-video/recipes.ts` (new) | keys, names, `recipeFits`, `recipesFor`, `recipeScript`, `readRecipe`, `recipeOf`, `pickRecipe`; no JSX |
| `src/lib/quote-video/recipe-blocks.tsx` (new) | entrances as functions of time, counted figure, foot line, contact block, text fitting |
| `src/lib/quote-video/recipe-ask.tsx`, `recipe-life.tsx`, `recipe-versus.tsx` (new) | one recipe's frames each |
| `src/lib/quote-video/recipes-draw.tsx` (new) | `recipeFrame`, `recipeJoin` |
| `script.ts`, `remotion.ts`, `make.ts`, `actions.ts`, `remotion/src/Clip.tsx`, `remotion/prepare/prepare.test.ts`, `remotion/cloudrun/ship.sh`, `QuoteVideoBoard.tsx` | wiring |
| `tests/quote-video/recipes.test.ts`, `recipe-frames.test.tsx` (new) | tests |

The example quote used in tests throughout, `LP35`: `quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 })`. Its expected facts: `lead.baht` 2,000,000 · `perDayAmount` "79" · yearly price "28,700" · `payYears` 19 · `lastPayAge` 53 · `coverToAge` 99 · `totalPaid` "545,300" · `breakEven` age 64, cash "553,000" · cover split at age 60, 2,000,000 before and 1,000,000 after. If the variant code or input shape differs, take it from `tests/quote-video/quote-video.test.ts` and keep these expected figures; if a figure differs from this list, stop and report rather than change the expectation.

---

### Task 1: `recipes.ts` — keys, fit rules, spoken script

**Files:**
- Create: `src/lib/quote-video/recipes.ts`
- Test: `tests/quote-video/recipes.test.ts`

**Interfaces:**
- Consumes: `QuoteVideoFacts`, `SceneKey`, `spokenBy`, `spokenBaht` from `./script`.
- Produces:
  ```ts
  export type RecipeKey = "ask" | "life" | "versus";
  export const RECIPE_KEYS: RecipeKey[];                       // ["ask","life","versus"]
  export const RECIPE_NAMES: Record<RecipeKey, string>;        // เปิดด้วยคำถาม / เส้นชีวิต / เทียบให้เห็น
  export const readRecipe: (v: unknown) => RecipeKey | undefined;
  export interface RecipeFigures { yearly: string; splitAge: number; early: string; late: string; paid?: number; cash?: number; diff?: number }
  export function recipeFigures(f: QuoteVideoFacts): RecipeFigures | undefined;  // undefined when the quote has no yearly row or no two aged cover rows
  export function recipeFits(key: RecipeKey, f: QuoteVideoFacts): boolean;
  export const recipesFor: (f: QuoteVideoFacts) => RecipeKey[];
  export function recipeScript(key: RecipeKey, f: QuoteVideoFacts, narrator: "F" | "M"): { key: SceneKey; voice: string }[];
  export function pickRecipe(fitting: RecipeKey[], last: RecipeKey | undefined, roll: number): RecipeKey | undefined; // roll in [0,1)
  ```
- Scene slots (order is the drawing index): ask `lead, cover, price, contact`; life `lead, price, cover, value, contact`; versus `lead, value, cover, contact`.

- [ ] **Step 1: Write the failing tests** in `tests/quote-video/recipes.test.ts`:
  - `recipeFigures(LP35)` equals `{ yearly: "28,700", splitAge: 60, early: "2,000,000", late: "1,000,000", paid: 545300, cash: 553000, diff: 7700 }`.
  - `recipesFor(LP35)` equals `["ask","life","versus"]`.
  - not fitting: facts with `riders` set → `[]`; with `budget` set → `[]`; `lang: "zh"` → `[]`; product `ISHIELD` facts → `[]`; `{ ...LP35, payToEnd: true, payYears: undefined, lastPayAge: undefined }` → `["versus"]`; `{ ...LP35, breakEven: undefined }` → `["ask","life"]`; cash equal to paid → no `versus`; cash = paid + 500 → `versus` fits and `diff` is 500.
  - `recipeScript("ask", LP35, "F")` has keys `["lead","cover","price","contact"]`; joined voices contain `spokenBaht(2000000)`, "เจ็ดสิบเก้า" or the digits form `spokenBaht` gives for 79, "19", "53", "99"; `life` has 5 scenes and contains the spoken 28,700, 2,000,000 and 1,000,000; `versus` has 4 and contains the spoken 545,300, 553,000 and 7,700.
  - `recipeScript(k, LP35, "M")` for each k: no voice matches `/ค่ะ|นะคะ|คะ(\s|$)/`, at least one contains "ครับ".
  - `readRecipe("ask") === "ask"`, `readRecipe("x")`, `readRecipe(undefined)` are `undefined`.
  - `pickRecipe(["ask","life","versus"], "ask", 0)` is `"life"`, with roll 0.99 is `"versus"`; `pickRecipe(["ask"], "ask", 0.5)` is `"ask"` (only one fits: repeating beats nothing); `pickRecipe([], undefined, 0)` is `undefined`.
- [ ] **Step 2: Run** `npx vitest run tests/quote-video/recipes.test.ts` — FAIL (module not found).
- [ ] **Step 3: Implement.** `recipeFigures`: yearly = the amount of the `prices` row for the yearly instalment (find how the Thai yearly row is labelled in `quoteVideoFacts`; do not rely on `per`, which Thai rows lack); split = first number in `cover[0].label`, `early`/`late` = `cover[0].amount`/`cover[1].amount`, requiring `coverStyle === "bars"`, exactly two rows and a number in the first label; paid/cash from `totalPaid`/`breakEven.cash` digits. Fit rules exactly as the spec's "When a recipe fits". Voices are the spec's "Spoken words" drafts verbatim, figures through `spokenBaht`, each line through `spokenBy(line, narrator)`.
- [ ] **Step 4: Run** the test — PASS.
- [ ] **Step 5: Commit** `git add src/lib/quote-video/recipes.ts tests/quote-video/recipes.test.ts && git commit -m "feat(video): recipe keys, fit rules and spoken script"`

### Task 2: `recipe-blocks.tsx` — shared motion and pieces

**Files:**
- Create: `src/lib/quote-video/recipe-blocks.tsx`
- Test: `tests/quote-video/recipe-frames.test.tsx` (new file, first cases)

**Interfaces:**
- Produces:
  ```ts
  export type Enter = "up" | "slam" | "wipe" | "left" | "right" | "pop" | "fade" | "grow";
  /** the style of a piece s seconds after its cue (s < 0: not yet shown); settled at s >= 0.55 (grow: 1.1) */
  export function enter(kind: Enter, s: number, unit: number): CSSProperties;
  /** a figure counted up over 0.9 s from 0.2 s after its cue, eased out cubic, thousands separated */
  export function counted(baht: number, s: number): string;
  /** the largest font size, capped at `cap`, at which `text` fits `room` px on one line (0.6 em a letter, digits and Thai alike) */
  export function fitSize(text: string, room: number, cap: number): number;
  export interface RecipeClip { facts: QuoteVideoFacts; figures: RecipeFigures; contact: { name: string; phone: string; line?: string }; total: number; scenes: { start: number; dur: number }[] }
  export function footLine(c: RecipeClip, w: number, h: number, color: string): ReactNode;
  export function contactBlock(c: RecipeClip, lead: string, s: number, w: number, unit: number, face: { family: string; weight: number; color: string; accent: string }): ReactNode;
  ```
- `unit = w / 1080`. Curves match the mockup's CSS keyframes (`up` 12% of width rise, `slam` scale 2.2→0.94→1 with −6°→1°→0, `wipe` clip-path inset right 100%→0, `left`/`right` 30% of width, `pop` 0.3→1.12→1, `grow` scaleY 0→1 from the bottom).

- [ ] **Step 1: Write failing tests**: `enter("up", -0.1, 1).opacity === 0`; `enter(k, 2, 1)` for every kind has opacity 1 (or undefined) and no transform other than identity / `none`; `counted(2000000, 0) === "0"`, `counted(2000000, 5) === "2,000,000"`, `counted` is non-decreasing over s = 0…1.2 in 0.05 steps; `fitSize("2,000,000", 900, 400) <= 400` and `fitSize("50,000,000", 900, 400) * 0.6 * 10 <= 900`; `contactBlock` rendered with `renderToStaticMarkup` for a 40-letter name contains the name and phone, and its name font size (read from the markup) × 0.6 × 40 ≤ the room given.
- [ ] **Step 2: Run** `npx vitest run tests/quote-video/recipe-frames.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the functions above. `footLine` draws the constraint's foot text and `facts.footNote` under it when present.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git add src/lib/quote-video/recipe-blocks.tsx tests/quote-video/recipe-frames.test.tsx && git commit -m "feat(video): recipe entrances, counted figure, contact block"`

### Tasks 3, 4, 5: one recipe's frames each

Same shape for each; do them as three tasks with three commits.

**Files:**
- Create: `src/lib/quote-video/recipe-ask.tsx` (Task 3), `recipe-life.tsx` (Task 4), `recipe-versus.tsx` (Task 5)
- Test: `tests/quote-video/recipe-frames.test.tsx`

**Interfaces:**
- Consumes: Task 2's exports; `RecipeFigures` from Task 1.
- Produces: `export function askFrame(c: RecipeClip, index: number, t: number, T: number, w: number, h: number): ReactNode` and likewise `lifeFrame`, `versusFrame`. `t` is scene time, `T` clip time. Each returns one `w×h` root div with its own ground colour.

**Content per scene:** the spec's tables for each recipe, with the mockup's layout, palette, cue order and delays (the mockup's `--d` values are the cue times in seconds; its HTML is at the artifact link and in the session scratchpad as `clip-recipes-mockup.html`). Palettes: ask ground `#ffd23f`, ink `#111`, mark `#e63946`, inverted scenes (index 1 and 3) swap ground and ink; life ground `#0f3d3a`, ink `#f6efe0`, gold `#f2b84b`; versus ground `#fbfaf7`, ink `#1b2a4a`, blue `#1e56d6`, grey `#c9d2e3`, pill `#ff5a3c`.

Decisions the mockup does not settle:
- `ask` scene 2 figure and `versus` diff use `fitSize` so the largest sum fits; the figure is `counted(lead.baht, t − cue)`.
- `life`: the rail's gold fill height is a function of **`T`**: at each scene's start it stands at `[8, 34, 52, 78, 100]%` and eases to the next over the first 1.2 s of the scene, so it never jumps at a join. The dot stays at 47% of the height.
- `versus` scene 2 bars: heights `paid / max(paid, cash)` and `cash / max(paid, cash)` of the bar area, both scaled by `enter("grow")`. Scene 3 shows `+{diff}` with thousands separators.

- [ ] **Step 1: Write failing tests** (per recipe): for every scene index and `t` in `[0, 0.3, dur/2, dur − 0.01]`, `renderToStaticMarkup(xFrame(clip, i, t, start + t, 1080, 1920))` does not throw and contains the foot line; at `t = dur/2` the markup contains the scene's figures for LP35 (ask: "2,000,000", "79", "28,700", "19", "53", "99"; life: "35", "53", "60", "99", "28,700", "2,000,000", "1,000,000"; versus: "545,300", "553,000", "+7,700"); the last scene contains the contact name and LINE. Review Focus 2: with `lead.baht` 50,000,000 (and cover amounts to match) and a 40-letter name, every `font-size` × 0.6 × its text length ≤ 1080 for one-line pieces (write one helper that walks the markup for `white-space:nowrap` pieces). `life`: the rail fill height parsed at `T = scenes[1].start − 0.01` and `+0.01` differs by less than 1% of `h`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the frame function.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** e.g. `git add src/lib/quote-video/recipe-ask.tsx tests/quote-video/recipe-frames.test.tsx && git commit -m "feat(video): เปิดด้วยคำถาม recipe frames"`

### Task 6: Remotion wiring, fonts, stills

**Files:**
- Create: `src/lib/quote-video/recipes-draw.tsx`
- Modify: `src/lib/quote-video/remotion.ts` (`ClipProps`, `RemotionMotion`), `remotion/src/Clip.tsx`, `remotion/prepare/prepare.test.ts`
- Test: `tests/quote-video/remotion.test.ts`, `tests/quote-video/recipe-frames.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // recipes-draw.tsx
  export function recipeFrame(key: RecipeKey, c: RecipeClip, index: number, t: number, T: number, w: number, h: number): ReactNode;
  /** how scene `index` comes in over XFADE: ask a hard cut, life a cross-fade, versus slideleft (Clip.tsx crossing kinds; "cut" = no style on either scene) */
  export const recipeJoin: (key: RecipeKey) => "cut" | "fade" | "slideleft";
  // remotion.ts — RemotionMotion gains:
  recipe?: RecipeKey;
  ```
- `clipProps` output for a motion without `recipe` is unchanged (no `recipe` key present).

- [ ] **Step 1: Write failing tests**: `recipeFrame` returns the same markup as the recipe's own frame function for each key; `recipeJoin` values as above; in `remotion.test.ts`, `clipProps` of an existing navy fixture `toEqual` its current expected object (no `recipe` key), and with `recipe: "ask"` carries `recipe: "ask"`.
- [ ] **Step 2: Run** `npx vitest run tests/quote-video/remotion.test.ts tests/quote-video/recipe-frames.test.tsx` — FAIL.
- [ ] **Step 3: Implement** `recipes-draw.tsx` and the `recipe?` field.
- [ ] **Step 4: `Clip.tsx`.** Add to `FONTS`: `["Kanit","fonts/Kanit-500.ttf",500]`, `…-800`, `…-900`, `["Trirong","fonts/Trirong-400.ttf",400]`, `…-600`, `…-700`. After the `chat` branch add a `p.recipe` branch: build `RecipeClip` from `p.facts`, `recipeFigures(p.facts)` (throw `"recipe does not fit"` when undefined), `p.contact`, `p.total`, `p.scenes`; draw each on-screen scene with `recipeFrame(p.recipe, clip, s, t, T, w, h)` inside `KeepWords`, joined by `recipeJoin` (`cut`: incoming scene drawn above with no style; others through `crossing`); no ground, hero, theme, festival, mascot, carry or icon layers; `Audio` as the other branches; `FxSound` with the whoosh cues only, as `kinetic` has. `useLoaded` must not fetch a theme hero or background for a recipe clip.
- [ ] **Step 5: Fonts and samples in `prepare.test.ts`.** Add `googleFont("Kanit", 500|800|900, …)` and `googleFont("Trirong", 400|600|700, …)` beside Mali's. Add a block that writes `props/r-ask.json`, `r-life.json`, `r-versus.json` with a silent wav each, built from LP35 through `recipeScript` → `planScenes` → `clipProps`, the way the `c-lp` sample is built (voice seconds: 0.07 s a letter, minimum 2 s, as the iHealthy block does).
- [ ] **Step 6: Run** the prepare step and render stills: `npx vitest run --config remotion/prepare/vitest.config.ts`, then with `remotion/out/stills.mjs` (see its header for `DRAWING=`) one still at the middle of every scene of the three samples. Read each PNG: no clipped or overlapping text, Thai vowels and tone marks intact in Kanit 900 and Trirong 700, colours as the mockup. Fix and repeat until clean.
- [ ] **Step 7: Run** the two test files — PASS (the fingerprint test is expected to fail until Task 9).
- [ ] **Step 8: Commit** `git add src/lib/quote-video/recipes-draw.tsx src/lib/quote-video/remotion.ts remotion/src/Clip.tsx remotion/prepare/prepare.test.ts tests/quote-video/remotion.test.ts tests/quote-video/recipe-frames.test.tsx && git commit -m "feat(video): Remotion draws recipe clips; Kanit and Trirong"` (add the font files too if `remotion/public/fonts` is tracked: check `git ls-files remotion/public/fonts`).

### Task 7: server wiring — input, script, props, names

**Files:**
- Modify: `src/lib/quote-video/script.ts` (`VideoInput`), `src/lib/quote-video/recipes.ts`, `src/lib/quote-video/make.ts` (both `quoteVideoScript` call sites, ~332 and ~425, and the returned `motion$`), `src/app/studio/quote-video/actions.ts` (the checked input ~165–183, the preview script ~255–259, the ledger name ~690)
- Test: `tests/quote-video/recipes.test.ts`, `tests/quote-video/quote-video.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // script.ts VideoInput: recipe?: RecipeKey
  // recipes.ts
  /** the recipe a stored input is made with: style motion, portrait, a known key that fits these facts; else undefined */
  export function recipeOf(input: { style?: unknown; size?: unknown; recipe?: unknown }, f: QuoteVideoFacts): RecipeKey | undefined;
  ```

- [ ] **Step 1: Write failing tests**: `recipeOf({ style: "motion", recipe: "ask" }, LP35) === "ask"`; `undefined` for style `classic`, for `size: "square"`, for `recipe: "nope"`, and for `recipe: "versus"` with `breakEven` removed (Review Focus 1). In `quote-video.test.ts`, following how that file already exercises the checked input and `quotePartsFor`: a Life Protect motion input with `recipe: "life"` keeps `recipe`, and drops `theme`, `mascot`, `carry`, `brief`, `lines`, with `length` stored as `"short"`; the same input with riders drops `recipe` and keeps today's fields; the parts for a recipe row have 5 scenes keyed `lead, price, cover, value, contact`, `motion$.recipe === "life"`, `motion$.theme === "navy"`, no `priceJar`/`coverRoad`, `shown.loop === false`, customer `""`; the parts for a row with `recipe: "versus"` whose facts no longer fit equal the parts of the same row without `recipe`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `make.ts`: one local helper returning `recipeOf(row.input, facts)`; where it is set, the script is `recipeScript(recipe, facts, narrator)`, each scene's plan line carries no motion windows beyond what gives `dur = LEAD + voiceSec + TAIL` (read `planScenes` and pass the minimal `SceneMotion`), and `motion$` is `{ theme: "navy", recipe, sex, facts, customer: "", narrator, contact, shown: { loop: false, extra: <the empty Extra> } }`. `actions.ts`: keep `recipe` only when style is `motion`, size portrait, not foreign, not `all`, and `recipeFits`; then drop the fields listed in the test and store `length: "short"` (a recipe clip goes on public Pages like the 15-second clip: no customer name). The preview script returns `recipeScript` with `written: false`. The ledger/list name reads `Motion · ${RECIPE_NAMES[recipe]}`.
- [ ] **Step 4: Run** `npx vitest run tests/quote-video` — PASS except the fingerprint test.
- [ ] **Step 5: Commit** with the explicit paths above, message `feat(video): recipe clips made from the stored input`.

### Task 8: the form row การเล่า

**Files:**
- Modify: `src/app/studio/quote-video/QuoteVideoBoard.tsx`
- Test: `tests/quote-video/recipes.test.ts`

- [ ] **Step 1: Mockup first.** Read the form's Motion section as it is; publish an Artifact mockup of the new row (chips สุ่มให้ · เปิดด้วยคำถาม · เส้นชีวิต · เทียบให้เห็น · แบบเดิม with a small still each; the folded rows and the line "สูตรนี้มีสี ความยาว และบทของตัวเอง"; the finished clip card naming its recipe), before/after, phone width. **Stop until the owner says yes.** Apply any change they ask to this task.
- [ ] **Step 2: Failing test** (Review Focus 4): a pure helper `nextRecipe(fitting: RecipeKey[], read: () => string | null, roll: number): RecipeKey | undefined` in `recipes.ts` returns a fitting key when `read` throws, when it returns `null`, and when it returns `"garbage"`; never returns the stored last key when two or more fit.
- [ ] **Step 3: Implement** the helper, then the row as approved: shown only for Life Protect + Motion + portrait + Thai + no riders + at least one fitting recipe; state `"random" | RecipeKey | "old"`, default `"random"`, remembered under `quote-video-recipe-choice`; at the press of สร้าง, `"random"` resolves through `nextRecipe` with `localStorage` key `quote-video-last-recipe`, which is then written with what was made; the resolved key goes in the input as `recipe`; `"old"` sends none. Follow the file's own try/catch pattern around storage.
- [ ] **Step 4: Run** `npx vitest run tests/quote-video/recipes.test.ts` and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Look at it.** Start the dev server with the preview tool, open the form signed in as the demo user if the session allows, check the row at desktop and phone width, light and dark. Do not press สร้าง (local dev writes to production). If sign-in is not possible, say so in the report.
- [ ] **Step 6: Commit** `git add src/app/studio/quote-video/QuoteVideoBoard.tsx src/lib/quote-video/recipes.ts tests/quote-video/recipes.test.ts && git commit -m "feat(video): การเล่า row — สุ่มให้ by default"`

### Task 9: fingerprint, smoke set, whole-suite check

**Files:**
- Modify: `src/lib/quote-video/remotion.ts` (`REMOTION_DRAWING`), `remotion/cloudrun/ship.sh` (smoke loop)

- [ ] **Step 1:** Run `npx vitest run tests/quote-video/remotion-drawing.test.ts`; set `REMOTION_DRAWING` to the fingerprint its failure message names; run again — PASS.
- [ ] **Step 2:** In `ship.sh` add `r-ask` to the smoke loop's list (`paper st-pool48 st-free c-lp r-ask`) and to the header comment.
- [ ] **Step 3:** Run the whole suite `npx vitest run`, `npx tsc --noEmit`, `npx eslint src tests remotion/src` — all clean.
- [ ] **Step 4:** Render the three sample clips to MP4 locally (`remotion/render.mjs`, see its header) and watch each through with the frames tool or by stills every 0.5 s: movement as the mockup, no flash at joins, the life rail continuous.
- [ ] **Step 5: Commit** `git add src/lib/quote-video/remotion.ts remotion/cloudrun/ship.sh && git commit -m "feat(video): recipe drawing fingerprint; r-ask in the smoke set"`
- [ ] **Step 6: Report to the owner** in Thai: the three MP4s, anything that differs from the mockup, what was not checked (real voice, real clip from the live form). Wait for the owner's word before any push; the push builds the new Remotion job (~10–12 min).
