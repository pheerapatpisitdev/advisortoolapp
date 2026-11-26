# คลิปตามโจทย์ โมชันกราฟิก Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new default look for คลิปตามโจทย์ in which the writer picks a designed layout per scene and Remotion animates it, as the owner approved on the ข mockup.

**Architecture:** An input-level `design: "motion"` and a per-scene `motion` layout ride through the existing prompt-story pipeline (writer → checks → draft → editor → make → Remotion). New drawing lives in `src/lib/prompt-story/motion/` as pure functions of scene time `t` returning satori-style JSX (px on the 1080 frame), used by `remotion/src/StoryClip.tsx` and, scaled down, by a browser preview in the editor. Device scenes reuse the อินโฟกราฟิก route through a new `MOTION_KIT`.

**Tech Stack:** Next.js 15 / React 19, TypeScript, Remotion (Cloud Run), vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-prompt-story-motion-design.md`. Visual reference: the mockup page at https://claude.ai/artifact/L7fHebBLfnTWYD4JqUNLRq (its source is in the session scratchpad as `prompt-story-look.src.html`; its geometry tables are in em, 1 em = 30 px).

## Global Constraints

- Absent `design` means หน้าตาเดิม: every existing clip, draft and test behaves exactly as today (the `oldMarkup` hash in `tests/prompt-story/frames.test.ts` must not change).
- The field is `design`, never a new `style` value (`input.style === "motion"` already means a วิดีโอนำเสนอ Motion clip in make.ts, progress.ts, recipes.ts, history-read.ts).
- Font: "Prompt" at 400, 600, 800 for every word of the look; no Mali, Sriracha or other handwriting face.
- Colours: `mgNavy #06235f`, `mgNavy2 #0d3a8c`, `mgCream #fbf6ec`, `mgDot rgba(6,35,95,0.09)`, `mgGold #f2c75c`, `mgCoral #e4572e`, `mgRed #c2412d`, `mgTeal #2f9c97`, `mgInk #1d2433`, `mgGrey #e6dfd2`, `mgMute #8a8f9c`, `mgScrim rgba(6,14,36,0.78)` — keys in `STORY_CLIP_COLORS` (src/lib/card-theme.ts).
- Thai names: design choice **โมชันกราฟิก (ใหม่)** / **หน้าตาเดิม**; step title **หน้าตาคลิป และสไตล์รูป**; style heading in motion **สไตล์ภาพ AI**; layouts **เปิดเรื่อง, ภาพการ์ด, ตัวเลขใหญ่, เทียบสองฝั่ง, เช็กลิสต์, ภาพเต็มจอ, อุปกรณ์, ภาพจากคลัง**; icons ปรอท โรงพยาบาล เงิน หัวใจ โล่ บ้าน.
- Writer model for motion only: `prefer: "claude-sonnet-5"`, `within: ["gemini-3.7-flash", "gpt-5"]` (model_names, not row ids), `effort: "low"`. The `video-script` lane and `tests/ai/lanes.test.ts` stay unchanged.
- Every number on screen comes from the brief or the plan figure, checked by `check.ts`; the drawing never computes a new figure.
- Drawing is a pure function of `t`: no CSS animations, transitions, timers or `useCurrentFrame` inside `src/`; every div/span lays out under `.sat` (display:flex, position:relative).
- Commit messages end with the attribution lines the session gives; branch `claude/vigilant-noether-3146ec`.

## Review Focus

1. A long Thai line in square or landscape overflows its box — every layout line goes through `fitSize`; Task 6 tests the longest allowed line in all three sizes stays inside the frame width.
2. A brief with no numbers, yet the writer picks `number` — `checkMotion` refuses, the retry happens, then the scene falls back to a `hook`; Task 3 tests it.
3. The price shown, the editor's count, the pictures drawn and the refund disagree — all four call `paints()`; Task 4 tests a motion script whose price equals the number of `drawScenePicture` calls.
4. The agent switches a scene's layout and back and loses what they typed — Task 8 parks the previous layout per scene and tests the round trip.
5. An old clip or draft (no `design`) re-rendered after this ships looks different — Task 5 and Task 7 keep the `oldMarkup` hash and add a test that `freeLook` of an input without `design` is unchanged.

---

### Task 1: Types, layouts and what is painted

**Files:**
- Modify: `src/lib/prompt-story/types.ts`
- Modify: `src/lib/prompt-story/editor-state.ts` (`painted`, `pictureCount`, `missingPicture`)
- Modify: `src/lib/prompt-story/total.ts`
- Test: `tests/prompt-story/motion-types.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `export type PromptDesign = "motion"`; `PromptStoryInput.design?: PromptDesign`
  - `export const MOTION_ICONS = ["fever", "hospital", "money", "heart", "shield", "home"] as const; export type MotionIcon`
  - `export type MotionLayout = { kind: "hook"; lines: string[]; key: number; icon: MotionIcon } | { kind: "card"; tag: string; chips: [string, string] } | { kind: "number"; value: number; unit: string; tag: string; bill: string } | { kind: "compare"; title: string; bad: MotionSide; good: MotionSide } | { kind: "check"; lines: [string, string]; ticks: [string, string, string]; photo: boolean } | { kind: "full"; lines: string[]; key: number }` with `MotionSide = { head: string; lines: [string, string] }`
  - `export type MotionKind = MotionLayout["kind"]`; `export const MOTION_KINDS: { id: MotionKind; name: string }[]` in the spec's order with the Thai names
  - `export const MOTION_LIMITS = { line: 22, tag: 24, chip: 16, unit: 10, bill: 22, title: 24, head: 16, side: 22, tick: 28 }`
  - `PromptScene.motion?: MotionLayout`
  - `export function paints(scene: PromptScene, design?: PromptDesign): boolean` — false for device or asset; true when no design; false for `showFigure`; true for card/full, check only with `photo`, true when `motion` is missing; false otherwise
  - `pictureScenes(v: Pick<PromptStoryInput, "scenes" | "design">)` counts `paints`; `promptPicturesPrice` follows
- Produces (editor-state.ts): `painted(s, design?)`, `pictureCount(scenes, design?)`, `missingPicture(scenes, design?)` take the design; `total.ts totalLine` counts with `paints`.

- [ ] **Step 1: Write the failing tests** in `tests/prompt-story/motion-types.test.ts`: `paints` truth table (device → false; asset → false; no design + plain scene → true; motion + hook → false; motion + card → true; motion + check photo false → false, true → true; motion + showFigure + card → false; motion + no `motion` field → true); `pictureScenes` of a 5-scene motion script [hook, card, number, compare, check photo] is 2; the same scenes with no design is 5; `MOTION_KINDS.map(k => k.name)` equals `["เปิดเรื่อง","ภาพการ์ด","ตัวเลขใหญ่","เทียบสองฝั่ง","เช็กลิสต์","ภาพเต็มจอ"]`; `pictureCount(scenes, "motion")` equals `pictureScenes`.
- [ ] **Step 2:** `npx vitest run tests/prompt-story/motion-types.test.ts` — FAIL (exports missing).
- [ ] **Step 3:** Implement the interfaces above; thread `design` through `painted`/`pictureCount`/`missingPicture` (`missingPicture` asks for picture words only where `paints`) and `totalLine`.
- [ ] **Step 4:** `npx vitest run tests/prompt-story` — the new file passes and nothing else changes (the one pre-existing `asset-scene.test.ts` font failure, caused by missing `remotion/public/fonts`, may remain).
- [ ] **Step 5:** Commit `feat(prompt-story): โมชันกราฟิก layouts and what a scene paints`.

### Task 2: Checking a layout

**Files:**
- Modify: `src/lib/prompt-story/check.ts`
- Modify: `src/lib/prompt-story/checked.ts`
- Test: `tests/prompt-story/motion-check.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `paints`.
- Produces: `export function checkMotion(m: unknown, allowed: Set<number>, forNumber: Set<number>): MotionLayout | string[]` — returns a cleaned layout (strings trimmed, single spaces) or reasons as `"motion.<field>: why"`. Rules: shape per kind (hook 1–3 lines, key in -1..lines-1, icon in `MOTION_ICONS`; card 2 chips; number `value` an integer in `forNumber`; compare two sides with 2 lines each; check exactly 2 lines and 3 ticks, `photo` boolean; full 1–2 lines, key -1..lines-1); every string non-empty and within `MOTION_LIMITS`; every string through the same forbidden-word and stray-number rules as `screen` (reuse the private `wordReasons` / `FREE_FORBIDDEN`).
- `checkScene` also returns `checkMotion` reasons when `scene.motion` is set; `checkScript` therefore covers it.
- `checkedPromptStory` keeps `design` only when it is `"motion"`; keeps a scene's `motion` when `checkMotion(…, allowedFor(brief, figure), deviceAllowed(brief, figure))` passes, refuses the request with the scene number otherwise; requires picture words only where `paints(scene, design)`.

- [ ] **Step 1: Write the failing tests:** a valid layout of each kind passes and comes back equal; `number` with `value: 68000` passes for brief "ค่ารักษา 68,000 บาท" and fails with reason containing `motion.value` for brief "ลูกป่วยบ่อย"; a hook with 4 lines fails; a chip of 17 letters fails; a tick containing "เบี้ย" fails (forbidden); a compare line "จ่าย 99,999" fails when 99999 is not in the brief; `checkScene({voice, screen, picture: "", motion: {kind:"hook",…}}, allowed)` returns `[]`; `checkedPromptStory` drops `design: "classic"` and keeps `"motion"`; it accepts a motion hook scene with empty picture words and refuses a card scene with empty picture words.
- [ ] **Step 2:** run the file — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run tests/prompt-story` passes (bar the known font failure).
- [ ] **Step 5:** Commit `feat(prompt-story): check a โมชันกราฟิก layout like the screen words`.

### Task 3: The writer writes layouts

**Files:**
- Modify: `src/lib/prompt-story/writer.ts`
- Test: `tests/prompt-story/writer-motion.test.ts`

**Interfaces:**
- Consumes: Task 1–2 (`checkMotion`, `paints`).
- Produces: `writeStory(input: { …today's fields…; design?: PromptDesign })` and `rewriteScene(input: { …; design?: PromptDesign })`. With `design: "motion"`: the scene shape asks for `"motion": {…}` (one JSON shape per kind, with the limits, the icon list and their Thai meaning); the rules say first scene `hook`, avoid neighbours of the same kind, painted scenes at most `Math.ceil(n / 2)`, `picture` words only for painted scenes, `number.value` only a number written in the brief or the plan; `sceneOf` keeps `motion` only when `checkMotion` passes; failing scenes get the one retry with reasons; a scene still failing becomes `{ …plainLine, motion: plainMotion(screen) }` where `export const plainMotion = (screen: string): MotionLayout => ({ kind: "hook", lines: [screen], key: -1, icon: "heart" })`; after the retry, painted scenes beyond the cap become `plainMotion` too (from the last backwards); `defaultAsk` for motion calls `chat({ tier: "small", task: WRITER_TASK, json: true, prefer: "claude-sonnet-5", within: ["gemini-3.7-flash", "gpt-5"], effort: "low", maxTokens: Math.max(3000, 900 + 450 * count), timeoutMs: 60_000 + 3_000 * Math.max(0, count - 8), … })`. Without `design`, prompts and calls are byte-identical to today.

- [ ] **Step 1: Write the failing tests** (pass `ask` like `tests/prompt-story/writer.test.ts`, and mock `@/lib/ai/client` like `writer-devices.test.ts:209` for the model test): the motion prompt contains each kind name and `"motion"`; without `design` the prompt equals today's (snapshot the string from a call with no design before the change, or assert it does not contain `"motion"`); a reply with valid layouts comes back with them; a reply whose scene 2 has `{kind:"number", value: 12345}` for a brief without 12345 is retried once with a reason mentioning `motion.value`, and if still wrong scene 2 becomes `plainMotion(screen)` and `notes` includes 1; four painted scenes in a 5-scene reply leave at most 3 painted (`pictureScenes`); `chat` is called with `prefer: "claude-sonnet-5"` and `within: ["gemini-3.7-flash","gpt-5"]` for motion and without `prefer` for no design; `rewriteScene` with `design: "motion"` returns a scene with a checked `motion`.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement; update the file's doc comment ("never Claude" stays true for หน้าตาเดิม only).
- [ ] **Step 4:** `npx vitest run tests/prompt-story` passes.
- [ ] **Step 5:** Commit `feat(prompt-story): the writer picks a layout per scene for โมชันกราฟิก, written by Sonnet 5`.

### Task 4: Drafts, actions and making the clip

**Files:**
- Modify: `src/app/studio/prompt-story/actions.ts` (`writePromptStory`, `rewritePromptScene`, `makePromptStory`)
- Modify: `src/lib/quote-video/make.ts` (`drawPictures` ~l.600, `FIELD`/`reasonWords` ~l.948, `createPromptStory` ~l.958, `redrawPicture` ~l.1001, `redrawScene` ~l.1069)
- Modify: `src/app/studio/quote-video/actions.ts:568` (the redraw list)
- Test: `tests/prompt-story/motion-make.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `writePromptStory(v: { …; design?: unknown })` stores `design` in `asked` and passes it to `writeStory`; `rewritePromptScene` reads `asked.design`; `makePromptStory` passes `design` to `checkedPromptStory`. `drawPictures` paints exactly the scenes where `paints(scene, input.design)` and stores `null` elsewhere; the refund and the hold use the same count; `redrawPicture`/`redrawScene` refuse a scene that does not paint with the existing refusal wording; the redraw list treats `!paints` scenes as not redrawable; `reasonWords` names `motion.*` reasons in Thai ("แบบฉาก").

- [ ] **Step 1: Write the failing tests** (follow `tests/prompt-story/make.test.ts` mocks): a motion clip [hook, card, number, compare, check photo] calls `drawScenePicture` twice (scenes 1 and 4) and stores `pictures` `[null, "<id>/pic-1.png", null, null, "<id>/pic-4.png"]`; the money held equals `promptStoryPrice` of the same input; a failing card picture refunds one picture; `redrawPicture` on the hook scene is refused; `writePromptStory` with `design: "motion"` saves `asked.design === "motion"` and calls `writeStory` with it; with `design: "x"` nothing is stored.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run tests/prompt-story tests/quote-video` passes.
- [ ] **Step 5:** Commit `feat(prompt-story): โมชันกราฟิก through drafts, pricing and picture drawing`.

### Task 5: The look's colours, font and device Kit

**Files:**
- Modify: `src/lib/card-theme.ts` (`STORY_CLIP_COLORS` `mg*` keys)
- Modify: `src/lib/quote-video/story-kits.ts` (`MOTION_KIT`, `KITS`)
- Modify: `src/lib/quote-video/story.ts:100` (`art` union gains `"motion"`; not `INFO_ARTS`)
- Modify: `src/lib/quote-video/story-motion.tsx` (`info()` true for `"motion"`; `dressedGround` gets a `"motion"` branch before the blueprint fall-through)
- Modify: `src/lib/prompt-story/frames.tsx` (`freeLook` returns `{ art: "motion" }` when `input.design === "motion"`, whatever the style; export `deviceBody(device, c, t)` = the body `deviceFrame` draws, without its subtitle)
- Modify: `src/lib/prompt-story/asset-picture.tsx` (`lookGround` motion = `mgNavy`)
- Modify: `remotion/src/Clip.tsx` (`FONTS` gains Prompt 400/600/800, registered after `plexUnder` so Prompt's own faces win)
- Modify: `remotion/prepare/prepare.test.ts` (download Prompt 400/600/800 with `googleFont` into `PUB/fonts/Prompt-<w>.ttf`)
- Test: `tests/prompt-story/motion-look.test.tsx`

**Interfaces:**
- Produces: `MOTION_KIT: Kit` — `page: mgNavy`, `hand: "Prompt"`, `bold: 600`, `reveal: "fade"`, `gold: mgGold`, `red: mgCoral`, `green: mgTeal`, `white`/`sub`/`sky` white, `card: mgCream`, `mute: mgMute`, `dress: { band: mgScrim, words: white, spoken: mgGold, foot: "rgba(255,255,255,0.55)", cardEdge: mgGold }`, no glow, no machine; `kitFor("motion") === MOTION_KIT`; `freeLook({ style: "paper", design: "motion" })` → `{ art: "motion" }`; `deviceBody` exported.

- [ ] **Step 1: Write the failing tests:** `kitFor("motion").hand === "Prompt"`; `freeLook` with design motion and each of three styles returns `{art:"motion"}`, without design returns today's values for all 14 styles; `renderToStaticMarkup(storyBackground("portrait", {…art:"motion"}))` contains `#06235f` and not the blueprint `#1f5aa6`; `deviceBody` of a `limit` device in motion renders markup containing `font-family:Prompt`; `tests/prompt-story/frames.test.ts` still passes unchanged (the `oldMarkup` hash).
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run tests/prompt-story tests/quote-video tests/scene-library` passes (known font failures aside).
- [ ] **Step 5:** Commit `feat(prompt-story): โมชันกราฟิก colours, Prompt font and device Kit`.

### Task 6: Drawing the layouts

**Files:**
- Create: `src/lib/prompt-story/motion/ease.ts` — `clamp`, `ease` (cubic out), `inout`, `spring(x) = x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(10 * x)`, `rise(t, start, dy?, from?)` → `{ opacity, transform }`
- Create: `src/lib/prompt-story/motion/fit.ts` — `letters(text)` (base letters, Thai marks `[ัิ-ฺ็-๎]` not counted), `fitSize(text: string, widthPx: number, maxPx: number, perLetter = 0.62): number`
- Create: `src/lib/prompt-story/motion/geo.ts` — per `VideoSize` geometry of each layout, the mockup's tables × 30 px
- Create: `src/lib/prompt-story/motion/icons.tsx` — the six icons as stroked SVG paths drawn in by `strokeDashoffset`
- Create: `src/lib/prompt-story/motion/layouts.tsx`
- Create: `src/lib/prompt-story/motion/chrome.tsx`
- Test: `tests/prompt-story/motion-draw.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 5 (colours), `SIZES`, `wordTimes` (timeline.ts), `captionShown`/`wordAt` (caption.ts), `figureLines` (frames.tsx), `abs`/`box` (quote-video/motion.tsx).
- Produces:
  - `export type MotionCtx = { size: VideoSize; dur: number; picture?: string; figure: { text: string; big?: boolean }[] | null }`
  - `export function motionBody(scene: PromptScene, ctx: MotionCtx, t: number): JSX.Element` — the scene's ground and layout (or the figure card when `scene.showFigure` and `ctx.figure`), transparent outside its ground, at `SIZES[size]` px; the motion and timings of the mockup's `hook`, `card`, `number`, `compare`, `check` functions; `full` = the picture full-bleed, pushed 1.06→1.16 with a slow pan, a top/bottom scrim and its lines risen with the key swept in gold; `number` counts 0 → `value` over 1.5 s from 0.35 s (`toLocaleString("en-US")`)
  - `export function MotionSubtitle(p: { words: string[]; voiceSec: number; size: VideoSize; t: number }): JSX.Element` — the dark pill, one line-sized piece (`captionShown` with Prompt's width), the spoken word on gold, the next words at 0.5 opacity
  - `export function motionBars(p: { size: VideoSize; T: number; starts: number[]; durs: number[] }): JSX.Element`
  - `export function motionWipe(p: { x: number; size: VideoSize }): JSX.Element` — the gold edge at x (0–1 of the width)
  - `export function motionContact(p: { contact: StoryContext["contact"]; customer: string; narrator: "F" | "M"; size: VideoSize; t: number }): JSX.Element` — the mockup's contact card, reading the same contact fields `Contact` (story-motion.tsx:482) reads (photo when present, else the initial), the kicker `contactFor(customer)` or `contactMore`, the two `contactLines(narrator)`, the footer

- [ ] **Step 1: Write the failing tests** with `renderToStaticMarkup`: for every kind × every size, `motionBody` at `t = dur - 0.6` contains each of the layout's strings and `font-family:Prompt`; `number` at t=0 contains `>0<` and at t=2.5 contains `68,000`; a hook's key line has the gold `#f2c75c` behind it at t=2 and not at t=0.2; `fitSize` of a 22-letter line in square stays ≤ the box width / (22 × 0.62); `motionBody` of a `showFigure` scene shows the three `figureLines`; `MotionSubtitle` at a time inside word 2 marks word 2 with the gold background; `motionContact` shows the agent's name and both contact lines; the markup never contains `animation` or `transition`.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5:** Commit `feat(prompt-story): draw the โมชันกราฟิก layouts as functions of time`.

### Task 7: Remotion draws a โมชันกราฟิก clip

**Files:**
- Modify: `remotion/src/StoryClip.tsx`
- Modify: `src/lib/quote-video/remotion.ts` (`REMOTION_DRAWING`)
- Modify: `remotion/prepare/prepare.test.ts` (a block `st-free-motion`: 5 scenes hook, card, number, compare, check-with-photo, plus one with a `limit` device, portrait; and one landscape)
- Test: `tests/quote-video/remotion-drawing.test.ts` (fingerprint), `tests/prompt-story/motion-clip.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`freeLook`, `deviceBody`, `MOTION_KIT`), Task 6.
- Produces: in `StoryClip`, when `kind === "free"` and `input.design === "motion"`: each scene layer draws `motionBody` (device → `deviceBody` on the `storyBackground` motion ground; library part → its picture on that ground; contact → `motionContact`) with `MotionSubtitle` of its voice; the incoming layer is clipped `inset(0 ${(1 - e) * 100}% 0 0)` with `e = inout(t / XFADE)` and `motionWipe` at `e`; the outgoing layer shifts left by `12 * inout` %; `motionBars` on top; the full-bleed `<Img>` push is not drawn for motion scenes (the layouts place their own pictures). The scene's `picture` URL reaches `motionBody` through `ctx.picture`. หน้าตาเดิม's path is untouched.
- Extract the per-scene element building into `export function motionLayer(p: { scene: PromptScene | null; input: PromptStoryInput; c: StoryContext; t: number; dur: number; picture?: string }): JSX.Element` in `src/lib/prompt-story/motion/clip.tsx` (`scene: null` = the contact scene; `c.words`/`c.voiceSec` feed the subtitle) so it is testable without Remotion.
- Install `remotion/`'s own dependencies (`npm ci` in `remotion/`) before running the fingerprint test or its type check.

- [ ] **Step 1: Write the failing test** `motion-clip.test.tsx`: `motionLayer` for each scene of the prepare block at three times returns markup with the right layout strings; a device scene's layer contains the device's title and `MotionSubtitle`; the contact layer has the name.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement `motionLayer` and the StoryClip branch; add the prepare block; run `npx vitest run tests/quote-video/remotion-drawing.test.ts`, copy the printed fingerprint into `REMOTION_DRAWING`, run it again.
- [ ] **Step 4:** `npx vitest run` (whole suite) passes, known font failures aside; `npx tsc --noEmit` clean; `npx tsc --noEmit -p remotion` (or the remotion project's check) clean.
- [ ] **Step 5:** Commit `feat(prompt-story): Remotion draws โมชันกราฟิก clips (new drawing <fingerprint>)`.

### Task 8: The editor — layout per scene and a preview

**Files:**
- Modify: `src/lib/prompt-story/editor-state.ts`
- Create: `src/app/studio/prompt-story/MotionFields.tsx`
- Create: `src/app/studio/prompt-story/MotionPreview.tsx` (`"use client"`)
- Modify: `src/app/studio/prompt-story/ScriptEditor.tsx`
- Test: `tests/prompt-story/motion-editor.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 6.
- Produces:
  - `export function motionDefault(kind: MotionKind, scene: PromptScene, numbers: number[]): MotionLayout | string` — a layout built from the scene's screen words (hook/full: `[screen]`; card: tag = screen, chips from its first two words or empty; compare/check: screen as title/first line, the rest empty for the agent to fill); `number` takes the first of `numbers` that appears in the scene's voice or screen, else the first of `numbers`, else returns `"ตัวเลขใหญ่ต้องมีตัวเลขในโจทย์หรือแผน"`
  - `export function toMotion(scene: PromptScene, layout: MotionLayout): PromptScene` (drops `device`/`asset`, keeps everything else)
  - `Draft.parkedMotion?: Record<number, Partial<Record<MotionKind, MotionLayout>>>` — switching away parks the layout, switching back restores it
  - `ScriptEditor` takes `design?: PromptDesign`; with motion its radio group is labelled `แบบของฉาก ${i+1}` and lists `MOTION_KINDS` then อุปกรณ์ and ภาพจากคลัง; `MotionFields` shows the layout's fields (labels as the mockup's editor: ป้ายบน, ป้ายที่ 1, ป้ายที่ 2, คำบรรยายภาพ, ตัวเลข (มาจากโจทย์ แก้ไม่ได้), หน่วย, หัวใบเสร็จ, หัวข้อ, ฝั่งแรก (✕), ฝั่งสอง (✓), ข้อ 1–3, ภาพวงกลม มี/ไม่มี, and a ★ คำเน้น toggle per hook/full line); the top line reads `ภาพ AI ${n} ฉาก · แบบฉากที่ระบบวาด ${m} ฉาก (ไม่คิดค่ารูป)`
  - `MotionPreview({ scene, size })` — renders `motionBody` at 1080-frame px inside a box scaled to its width, a `requestAnimationFrame` clock looping `t` over `dur + 1.2` and holding the end, `prefers-reduced-motion` shows `t = dur - 0.6` still; adds `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;800&display=swap" precedence="default">`; device and library scenes show the text `ระบบวาดตอนสร้างคลิป` instead
- Without `design` the editor renders exactly as today.

- [ ] **Step 1: Write the failing tests:** `motionDefault("number", scene with voice "ค่ารักษา 68,000 บาท", [68000, 5])` → `value: 68000`; with `[]` → the Thai refusal string; switching scene 0 hook → card → hook restores the hook's edited line (through the editor's move helpers); `renderToStaticMarkup(<ScriptEditor design="motion" …/>)` contains `แบบของฉาก 1` and `เปิดเรื่อง` and the count line; without design it contains `ภาพของฉาก 1` as today.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run tests/prompt-story` passes.
- [ ] **Step 5:** Commit `feat(prompt-story): pick each scene's layout in the editor, with a live preview`.

### Task 9: The form — โมชันกราฟิก by default

**Files:**
- Modify: `src/app/studio/prompt-story/PromptStoryBoard.tsx` (step 2 at l.219)
- Test: `tests/prompt-story/motion-form.test.tsx`

**Interfaces:**
- Consumes: Tasks 4, 8.
- Produces: `design` state, default `"motion"`, stored with `Look` in localStorage so the agent's last choice returns; a radiogroup `หน้าตาคลิป` with the two choices above the style groups; step title `หน้าตาคลิป และสไตล์รูป`; with motion the style groups sit under the heading `สไตล์ภาพ AI`; `writePromptStory` and `makePromptStory` receive `design` (`undefined` for หน้าตาเดิม); `ScriptEditor` receives it; changing the design after a script is written asks the agent to write again (the existing draft is dropped, as changing the scene count does today — follow that path).

- [ ] **Step 1: Write the failing test:** the board's markup contains `หน้าตาคลิป และสไตล์รูป`, `โมชันกราฟิก (ใหม่)` checked by default and `หน้าตาเดิม`; the write action mock receives `design: "motion"` by default and no `design` after choosing หน้าตาเดิม (follow `tests/prompt-story/page-render.test.tsx` for how the board is rendered).
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run` passes; `npx tsc --noEmit` and `npm run lint` clean.
- [ ] **Step 5:** Commit `feat(prompt-story): โมชันกราฟิก is the form's default look`.

### Task 10: Show the owner, ship

- [ ] **Step 1:** Render stills of the prepare block (portrait, square, landscape; one frame per scene) with Remotion locally if `remotion/` installs here, else with `renderToStaticMarkup` + Playwright of `motionLayer`; screenshot the form's step 2 and the editor.
- [ ] **Step 2:** Show the owner the form's look switch (not in the mockup) and the stills; apply what they ask.
- [ ] **Step 3:** `git push -u origin claude/vigilant-noether-3146ec`; open a draft PR whose body says the owner must run `remotion/cloudrun/ship.sh` from the Mac after merge, before Vercel serves the change.
