# Health devices (คลังแอนิเมชัน phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eight system-drawn health "devices" that draw in every story look, a ประกันสุขภาพ shelf in คลิปเล่าเรื่อง, and device scenes plus two formats in คลิปตามโจทย์.

**Architecture:** Each device is a new `KnowShow` layout, drawn by the existing story drawers (`Scene()` for paper/warm/line, `infoScene()` for plot) and timed by `kspec`. Story clips get fixed health episodes (no AI). Prompt clips get an optional `device` on a scene; the writer may choose it, numbers are checked like today's, and a device scene skips its AI picture and its picture charge.

**Tech Stack:** Next.js (TypeScript), Remotion drawings in React, vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-health-devices-design.md`

## Global Constraints

- Numbers on screen come from the iHealthy sheet/rate table, the picked plan, or what the agent typed. An AI never types a figure; number fields pass `allowedFor` (brief + figure) or the device falls back to its words-only form.
- No 6-digit hex in `src/**` outside `src/lib/card-theme.ts`: new colours go in `STORY_CLIP_COLORS` (`card-theme.ts:310`).
- Every word a device puts on screen goes through `knowText()` (story) or `freeHandText()` (prompt), or the hand font will not carry its letters.
- All three sizes (portrait, square, landscape) and all four story looks (paper, warm = art "minimal" + ground "warm", line, plot).
- Old rows (no `device`, no `format`, no health input) parse and draw exactly as before.
- After any change under the Remotion bundle, paste the new value the failing `tests/quote-video/remotion-drawing.test.ts` prints into `REMOTION_DRAWING` (`src/lib/quote-video/remotion.ts:33`).
- `git add` explicit paths only. Commit per task. Never push (the owner's word decides; pre-push runs ship.sh).
- Thai copy on screen as written in the spec and below.

## Review Focus

1. Room or bill at or below the plan's limit (e.g. SMART room 1,500, customer's room 1,200): the device says the plan covers it, never a negative "จ่ายเอง". Test in Task 3.
2. Ages the plan is not sold at (above the sheet's last age, or plan barred for the age): `agecost` skips those ages; fewer than two ages left → words-only form. Test in Task 2.
3. Long field words in landscape and square: titles at their maximum length shrink to fit (`fitSize`) instead of running off the frame. Test in Task 3.
4. A writer device that fails its number check: the scene stays a picture scene and the price counts it as a picture; the price is computed from the final scenes at make time, not from the first draft. Test in Tasks 8 and 9.
5. An agent who switches a device scene to a picture and leaves the picture words empty is refused with "ใส่คำบรรยายภาพของฉากที่ N" before any charge. Test in Task 8.

---

### Task 1: Device types and registry

**Files:**
- Modify: `src/lib/quote-video/story-knowledge.ts` (`KnowShow` union, `knowText`)
- Create: `src/lib/scene-library/devices.ts`
- Test: `tests/scene-library/devices.test.ts`

**Interfaces:**
- Produces, in `story-knowledge.ts`, eight `KnowShow` members:
  - `{ layout: "split"; title: [string, string]; parts: string[]; whole: string }`
  - `{ layout: "limit"; title: [string, string]; limit: number; used?: number; planName: string }`
  - `{ layout: "room"; title: [string, string]; plan: number; real?: number; planName: string }`
  - `{ layout: "overflow"; title: [string, string]; bill?: number; limit?: number }`
  - `{ layout: "waiting"; title: [string, string]; rows: { at: string; label: string }[] }`
  - `{ layout: "cashless"; title: [string, string]; note: string }`
  - `{ layout: "groupgap"; title: [string, string]; bill?: number; group?: number }`
  - `{ layout: "agecost"; title: [string, string]; rows: { age: number; annual: number }[]; source: string }`
- Produces `HEALTH_LAYOUTS: readonly HealthLayout[]` (the eight layout names) and `type HealthLayout`.
- Produces in `devices.ts`: `interface DeviceInfo { key: HealthLayout; name: string; family: "สุขภาพ"; product: "health"; clips: ("story" | "prompt")[]; numberFields: string[]; wordFields: string[] }` and `DEVICES: DeviceInfo[]`, `deviceInfo(key): DeviceInfo | undefined`. Thai names exactly as the spec's table.

- [ ] **Step 1: Write the failing test** — `DEVICES` has 8 entries whose keys equal `HEALTH_LAYOUTS`; `deviceInfo("room")?.name === "ค่าห้องต่อคืน"`; `numberFields` of `limit` is `["limit","used"]`, of `split` is `[]`; `knowText` of an episode holding one of each layout contains every title, `parts`, `whole`, `note`, every waiting row's `at` and `label`, and `"บาท"`.
- [ ] **Step 2: Run** `npx vitest run tests/scene-library/devices.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the union members, `HEALTH_LAYOUTS`, `devices.ts`, and the `knowText` lines (numbers are drawn with digits and "บาท", so add `"0123456789,บาท"` once when any health layout is present).
- [ ] **Step 4: Run** the test and `npx tsc --noEmit` — expect PASS / no errors (other switches over `layout` may need a `default` until Tasks 3–5; add `return null` defaults only where tsc requires).
- [ ] **Step 5: Commit** `feat(scene-library): health device types and registry`.

### Task 2: Health figures from the iHealthy sheet

**Files:**
- Create: `src/lib/scene-library/health-figures.ts`
- Test: `tests/scene-library/health-figures.test.ts`

**Interfaces:**
- Consumes: `iHealthyFacts()` (`src/lib/ihealthy-facts.ts`), `iHealthyTable()`, `plansFor`, `iHealthyPricing` (`src/lib/ihealthy-table.ts`, `src/lib/ihealthy-quote.ts`).
- Produces: `interface HealthFigures { plan: string; planName: string; annualMax: number; roomPerDay: number; waitingDays: number; specialWaitingDays: number; copayPercent: number; ages: { age: number; annual: number }[] }` and `healthFigures(v: { plan: string; sex: "M" | "F"; age: number }): HealthFigures | string` (Thai error string for a plan not offered at that age, as `storyFigure` does).
- `ages`: the annual premium at 30, 40, 50, 60 for the plan and sex, skipping ages the plan is not offered at.

- [ ] **Step 1: Write the failing test** — SILVER, M, 35 → `roomPerDay === 5500`, `annualMax` equals the table's SILVER `annualMax`, `waitingDays`/`specialWaitingDays` equal `iHealthyFacts().terms`; `ages` is ascending in age and premium; an age above the last offered one is absent; an unknown plan returns `"เลือกแผน"`.
- [ ] **Step 2: Run** `npx vitest run tests/scene-library/health-figures.test.ts` — FAIL.
- [ ] **Step 3: Implement** `healthFigures`. Room: parse sheet row `no === 1` adult value for the plan ("5,500 ต่อวัน" → 5500).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(scene-library): health figures from the iHealthy sheet`.

### Task 3: Draw split, limit, room, overflow (paper, warm, line)

**Files:**
- Modify: `src/lib/quote-video/story-knowledge-motion.tsx` (`kspec`, `Scene()`, `GEO` if new rects are needed)
- Modify: `src/lib/card-theme.ts` (`STORY_CLIP_COLORS`: any new colour)
- Modify: `src/lib/quote-video/remotion.ts` (`REMOTION_DRAWING`)
- Test: `tests/scene-library/health-draw.test.tsx`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `kspec` cases and `Scene()` cases for the four layouts; exported `showBody(show: KnowShow, c: StoryContext, t: number)` that renders one show without an episode (Task 11 calls it). `Scene()` itself becomes a call of `showBody`.

Drawings follow the mockup (https://claude.ai/artifact/JdWaEEaNLGbjUU3SZbPa5T, section ประกันสุขภาพ): split = two cards (capped bars with dashed ceilings / one tall green bar "จ่ายตามจริง"); limit = a tube filling to `used` with `limit` labelled "ต่อปี"; room = bed, a card "ค่าห้องจริง / แผนจ่าย / จ่ายเองต่อคืน"; overflow = a bar crossing a dashed limit line, part above red "จ่ายเอง". Animations from `motion.tsx` kinds (`grow` for bars and the tube, `count` for figures, `pop` for stamps).

- [ ] **Step 1: Write the failing tests** —
  - `kspec` of each layout returns a non-empty record whose windows end within 6 s.
  - Rendering `showBody` with `react-dom/server` `renderToStaticMarkup` for each layout × sizes `["portrait","square","landscape"]` × arts `paper | minimal+warm | line` at `t = 0, 2, 6` does not throw.
  - room with `real: 6000, plan: 4000` contains "2,000" and "จ่ายเองต่อคืน"; with `real: 1200, plan: 1500` contains "แผนนี้จ่ายพอ" and no "-".
  - overflow with `bill: 300000, limit: 200000` contains "100,000"; with no `bill` contains "เลือกวงเงินให้พอ".
  - A 40-character title in landscape renders with a font size below the portrait title's (via the exported `fitSize`).
- [ ] **Step 2: Run** `npx vitest run tests/scene-library/health-draw.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the four `kspec` and `showBody` cases.
- [ ] **Step 4: Run** the test, `tests/calc/palette.test.ts`, `tests/quote-video/story-paper.test.ts`, `tests/quote-video/story-minimal.test.ts`; then `npx vitest run tests/quote-video/remotion-drawing.test.ts`, paste the printed fingerprint, re-run — all PASS.
- [ ] **Step 5: Commit** `feat(scene-library): draw split, limit, room and overflow`.

### Task 4: Draw waiting, cashless, groupgap, agecost (paper, warm, line)

Same files, interfaces and step shape as Task 3, for the other four layouts. waiting = a line with dots at "วันนี้ / อุบัติเหตุ", `waitingDays` "ป่วยทั่วไป", `specialWaitingDays` "บางโรค", and a card "ตามเงื่อนไขของแต่ละแผน"; cashless = hospital, card, a green tick popping, "รพ. ในเครือ", note; groupgap = bar of the bill, short green bar of `group`, card "ขาดอีก" + difference in red, words-only "ประกันกลุ่มอาจไม่พอ" when either number is missing; agecost = rising bars labelled by age, the last bar in the accent colour, `source` under them.

- [ ] **Step 1: Write the failing tests** — the Task 3 render matrix for these four; groupgap `bill: 325000, group: 50000` contains "275,000"; agecost with two rows renders two bars and with one row is never built (Task 6 guards, assert here that `showBody` with `rows.length < 2` returns the words-only card containing `title`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** the same set + fingerprint — PASS.
- [ ] **Step 5: Commit** `feat(scene-library): draw waiting, cashless, groupgap and agecost`.

### Task 5: Draw all eight in plot (infoScene)

**Files:**
- Modify: `src/lib/quote-video/story-info-motion.tsx` (`infoScene` cases, `OWN` icons, `ICONS` if a new icon is needed)
- Modify: `src/lib/quote-video/remotion.ts`
- Test: `tests/scene-library/health-draw.test.tsx` (add)

**Interfaces:**
- Produces: exported `infoShow(show: KnowShow, c: StoryContext, t: number)` (same split as Task 3's `showBody`); `infoScene` calls it. Drawn with `K` (the Kit) and wrapped in `E` so pieces are pen-written left to right.

- [ ] **Step 1: Write the failing test** — every health layout × 3 sizes with `art: "plot"` renders non-null markup at `t = 3` (today's `default:` returns null — the test must fail on it).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** + `tests/quote-video/story-info.test.ts` + fingerprint — PASS.
- [ ] **Step 5: Commit** `feat(scene-library): health devices in the plotter look`.

### Task 6: ประกันสุขภาพ shelf: input and episodes

**Files:**
- Modify: `src/lib/story/topics.ts` (`StoryShelf` + `"health"`, `StoryTopic` + 4 keys, `STORY_TOPICS` rows, `figure: "health"`, `INFO_SHELVES` + `"health"`)
- Modify: `src/lib/quote-video/story.ts` (`StoryVideoInput.health?: StoryHealth`, its checker)
- Create: `src/lib/quote-video/story-health.ts`
- Modify: `src/lib/quote-video/story-knowledge.ts` (`knowEpisode` dispatch, close lookup)
- Modify: `src/lib/quote-video/story-objection.ts` (`groupIns` gains a `groupgap` scene when `input.health?.bill` and `input.health?.group` are typed)
- Test: `tests/scene-library/story-health.test.ts`

**Interfaces:**
- Consumes: `healthFigures` (Task 2), the eight `KnowShow` members (Task 1).
- Produces: `type HealthTopic = "lumpsum" | "roomcost" | "waiting" | "agecost"`; `interface StoryHealth { plan: string; sex: "M" | "F"; age: number; room?: number; bill?: number; group?: number; figures: HealthFigures }`; `storyHealth(v: unknown): StoryHealth | string` (room/bill/group: integers 1 – 10,000,000 or absent; error strings in Thai like `storyPension`'s); `healthScenes(topic: HealthTopic, input: StoryVideoInput, name: string): KnowScene[]`; `HEALTH_CLOSE: Record<HealthTopic, string>`.
- Topic names on the form: เหมาจ่าย กับ แยกจ่าย · ค่าห้องเกิน ใครจ่าย · สมัครวันนี้ คุ้มครองเมื่อไหร่ · ทำตอนอายุน้อย เบี้ยถูกกว่า. Scene order as the spec. Voices: short spoken Thai in the narrator's ending via `spokenBy` (done by `knowEpisode`).

- [ ] **Step 1: Write the failing tests** —
  - each topic yields five scenes with keys `KNOW_KEYS` and layouts in the spec's order;
  - `roomcost` with `room: 6000` on SILVER puts `{ layout: "room", real: 6000, plan: 5500 }`; without `room` the room scene has no `real`;
  - `agecost` uses `figures.ages`; with fewer than two ages the second scene is a `note`, not `agecost`;
  - every number in every scene's show appears in `figures`, in the typed `room/bill/group`, or is their difference;
  - `storyHealth({ plan: "SILVER", sex: "M", age: 35, room: -1 })` returns a Thai error;
  - `groupins` without bill keeps today's scenes exactly (snapshot of the current output), with bill+group gains a `groupgap` scene.
- [ ] **Step 2: Run** `npx vitest run tests/scene-library/story-health.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it and `tests/quote-video/story-video.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(story): ประกันสุขภาพ shelf with four health episodes`.

### Task 7: ประกันสุขภาพ shelf on the story-clip form

**Files:**
- Modify: `src/app/studio/story-clip/StoryClipBoard.tsx` (shelf tab, iHealthy plan picker + sex + age for `figure: "health"`, optional fields ค่าห้องต่อคืนที่ใช้ and ค่ารักษาตัวอย่าง, plus ประกันกลุ่มจ่าย on `groupins`; plot chip allowed on the health shelf)
- Modify: the story-clip server action that parses the form (where `storyPension`/`storyFigure` are called) to call `storyHealth`
- Test: `tests/scene-library/story-health-form.test.ts` (the action's parsing, not the React form)

**Interfaces:**
- Consumes: `storyHealth`, `STORY_TOPICS`, `plansFor(iHealthyTable(), age)` for the plan list.

- [ ] **Step 1: Write the failing test** — the action accepts a health topic with plan/sex/age and stores `input.health.figures`; refuses a health topic without a plan ("เลือกแผน"); ignores `room` on non-health topics.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (form copy: field hints "ไม่ใส่ก็ได้ ระบบใช้คำแทนตัวเลข"). **Step 4: Run** — PASS; then open `/studio/story-clip` in the preview, sign-in permitting, and look at the shelf in phone width light and dark.
- [ ] **Step 5: Commit** `feat(story-clip): ประกันสุขภาพ on the form`.

### Task 8: Device scenes in คลิปตามโจทย์: type, checks, price, no picture

**Files:**
- Modify: `src/lib/prompt-story/types.ts` (`PromptScene.device?: DeviceScene`, `PromptStoryInput.format?`, prices)
- Modify: `src/lib/prompt-story/check.ts` (`checkDevice`), `src/lib/prompt-story/checked.ts`, `src/lib/prompt-story/total.ts`
- Modify: `src/lib/quote-video/make.ts` (`createPromptStory` / picture drawing loop: device scenes are not drawn, `pictures[n] = null`)
- Test: `tests/prompt-story/devices.test.ts`

**Interfaces:**
- Produces: `type DeviceScene = Extract<KnowShow, { layout: HealthLayout }>`; `type PromptFormat = "free" | "drama3" | "claimreview"`; `PROMPT_FORMATS: { id: PromptFormat; name: string }[]` = ตามโจทย์ · ละครสั้น 3 ฉาก · รีวิวเคสเคลม; `checkDevice(d: unknown, allowed: Set<number>): DeviceScene | string`; `pictureScenes(v): number` (scenes without `device`); `promptPicturesPrice` counts `pictureScenes` only.
- Word fields ≤ `SCREEN_MAX` each; `parts` ≤ 4 items; `rows` ≤ 4; a number field not in `allowed` → error string naming it.

- [ ] **Step 1: Write the failing tests** —
  - `checkDevice({ layout: "room", title: ["ค่าห้อง","ต่อคืน"], plan: 5500, real: 6000, planName: "Silver" }, new Set([5500, 6000]))` returns the scene; with `real: 7000` not allowed returns an error containing "real";
  - unknown layout → error; extra unknown keys are dropped;
  - price: 5 scenes, 2 with device, painter standard → `promptPicturesPrice` = 3 × picture price; `promptStoryPrice` and `totalLine` agree;
  - `checkedPromptStory` keeps a valid `device`, drops an invalid one and keeps the scene as a picture scene; refuses a picture scene with empty `picture` with "ใส่คำบรรยายภาพของฉากที่ N";
  - a row without `device`/`format` parses to the same object as before (back-compat);
  - the make path draws pictures only for picture scenes (mock `drawImage`, assert call count 3) and stores `null` for device scenes.
- [ ] **Step 2: Run** `npx vitest run tests/prompt-story/devices.test.ts` — FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** it and `tests/prompt-story/` — PASS.
- [ ] **Step 5: Commit** `feat(prompt-story): device scenes, no picture charge`.

### Task 9: Writer picks devices; formats; one-scene rewrite

**Files:**
- Modify: `src/lib/prompt-story/writer.ts`
- Modify: `src/app/studio/prompt-story/actions.ts` (`writePromptStory` takes `format`; new `rewritePromptScene`)
- Modify: `src/lib/prompt-story/drafts.ts` (rewrite count per draft)
- Test: `tests/prompt-story/writer-devices.test.ts`

**Interfaces:**
- Consumes: `DEVICES` (Task 1), `checkDevice` (Task 8), `PromptFormat`.
- Produces: `writeStory({ brief, scenes, figure, format?, ask })` — the system prompt lists each device's key, Thai name, when it fits (one line from `DeviceInfo`), and its JSON fields; asks for at most half the scenes as devices; adds the format's structure line (ละครสั้น 3 ฉาก: ชีวิตปกติ → เหตุไม่คาดฝัน → ทางออก; รีวิวเคสเคลม: อาการ → ค่ารักษา → ประกันจ่าย → ส่วนที่จ่ายเอง → บทเรียน, no customer name). `rewritePromptScene(draftId: string, scene: number): Promise<{ ok: true; scene: PromptScene } | { ok: false; error: string }>` — free, 3 per draft, error "เขียนฉากใหม่ครบ 3 ครั้งแล้ว".

- [ ] **Step 1: Write the failing tests** (fake `ask`) —
  - a reply with a valid `device` keeps it; with a device number not in the brief keeps the scene as a picture scene and fills `picture` from the reply's `picture` or the screen words;
  - more devices than half the scenes → the extra ones become picture scenes;
  - the system prompt for `format: "claimreview"` contains "ห้ามใส่ชื่อลูกค้า" and the five beats; for `"free"` contains neither;
  - `rewritePromptScene` a fourth time returns the Thai error and does not call `ask`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** + `tests/prompt-story/writer.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(prompt-story): writer picks health devices; formats; rewrite one scene`.

### Task 10: Prompt-story form: format chips and the script editor

**Files:**
- Modify: `src/app/studio/prompt-story/PromptStoryBoard.tsx` (format chips under the brief; รีวิวเคสเคลม line "ไม่ใส่ชื่อลูกค้า ตัวเลขตามที่คุณพิมพ์")
- Modify: `src/app/studio/prompt-story/ScriptEditor.tsx` (per scene: "ภาพ AI" or the device's Thai name + its words as editable fields; numbers shown read-only; switch ภาพ AI ↔ อุปกรณ์; "เขียนฉากนี้ใหม่" with remaining count; the price line updates from `pictureScenes`)

**Interfaces:**
- Consumes: `PROMPT_FORMATS`, `deviceInfo`, `rewritePromptScene`, `promptStoryPrice`.

- [ ] **Step 1:** Implement; keep each new control at the existing editor's tap size and tokens (`--ct-*`).
- [ ] **Step 2: Verify** in the preview (`preview_start`), signed in as the owner: write a health brief, see a device scene, switch it to a picture (price rises by one picture), rewrite a scene three times (fourth disabled), phone width light and dark. Screenshot for the owner.
- [ ] **Step 3: Commit** `feat(prompt-story): formats and device scenes in the editor`.

### Task 11: Draw device scenes in prompt clips

**Files:**
- Modify: `src/lib/prompt-story/frames.tsx` (`freeFrame`: a scene with `device` draws `showBody`/`infoShow` with a `StoryContext` built from `FreeContext` + `freeLook`; `freeHandText` adds `knowText`-style words of devices)
- Modify: `remotion/src/StoryClip.tsx` (no `<Img>` for a device scene; same ground as a picture-less scene)
- Modify: `src/lib/quote-video/remotion.ts`
- Test: `tests/prompt-story/frames.test.ts` (add)

- [ ] **Step 1: Write the failing tests** — `freeFrame` of a device scene for each style × size renders markup containing the device title and no picture layer; `freeHandText` contains the device's words; a scene without device renders identical markup to before (snapshot taken before the change).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** + `tests/prompt-story/` + fingerprint — PASS.
- [ ] **Step 5: Commit** `feat(prompt-story): draw device scenes`.

### Task 12: Samples, smoke render, owner's look

**Files:**
- Modify: `remotion/prepare/prepare.test.ts` (props `st-health-<topic>` for the 4 topics in paper, `st-health-plot`, `st-free-devices`; smoke set in `ship.sh` adds `st-health-roomcost`)
- Modify: `remotion/out/stills.mjs` use only (ignored dir)

- [ ] **Step 1:** Run prepare, render stills of the 8 devices × 4 looks × 3 sizes; look at every still; fix what overflows or overlaps (back to the owning task's file, re-run its test).
- [ ] **Step 2:** Render with real voice: one health story clip per topic (paper), one plot, one prompt clip using the ละครสั้น format with two device scenes; put MP4s and a stills sheet in `tests/scratch/` (untracked) and send them to the owner.
- [ ] **Step 3:** Full suite `npx vitest run`, `npx tsc --noEmit`, `npx eslint` on touched files — all clean.
- [ ] **Step 4: Commit** `chore(video): health samples and smoke set`. Stop: push only on the owner's word.
