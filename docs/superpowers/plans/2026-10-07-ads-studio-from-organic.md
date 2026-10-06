# Ads Studio from Organic posts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ads Studio's campaign/writing flow with: pick Organic Studio posts → run them at once as Click-to-Messenger ads → read results with suggestions and act on them.

**Architecture:** New pure modules decide how a post runs (`run-path.ts`), what to suggest (`advice.ts`) and how the results board looks (`board.ts`). A new engine (`run.ts`, on a new `ins_ad_run` table) puts one ad set + one ad per post under one standing Meta campaign per Page + ad account. It resumes from the last saved step, as `send.ts` does. Owner-only server actions (`run-actions.ts`) feed a rewritten `/studio/ads` with two tabs. The old campaign UI is deleted last.

**Tech Stack:** Next.js 15 (app router, server actions), TypeScript, Supabase (service role), Meta Marketing API v23.0 via `src/lib/ads/graph.ts`, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-07-ads-studio-from-organic-design.md`

## Global Constraints

- Owner only: every server action starts with `await requireStaff("owner")`; the page calls `gatePage("/studio/ads", "owner")`.
- Objective is Click-to-Messenger only: `AdGoal { objective: "messages" }`, ad set via `adsetParams` (Thailand, age 20+, THAILAND_UNIVERSAL identity from `thVerifiedIdentity()`).
- New runs create the standing campaign, ad set and ad **ACTIVE**. Old send code keeps its PAUSED defaults.
- Budget is per post per day, whole baht, capped by `maxDailyBudgetThb()` (`ADS_MAX_DAILY_BUDGET_THB`); stored in minor units (baht × 100), checked with `checkDailyBudget`.
- Days offered: 3 / 7 / 14, default 7; daily budget default 200 baht (or the last one used, kept in localStorage key `ads-run-budget`).
- Suggestion baseline fallback: 60 baht per chat.
- Every Meta id used in a Graph path is checked first (`/^act_\d+$/`, `/^\d+$/`, `/^\w+$/`).
- UI copy is Thai, as written in the spec; no new npm dependencies.
- Stage files by explicit path only (`git add <paths>`), never `git add -A`: other sessions share this repo.
- `.env.local` points at the **production** database and Meta: never press ยิงเลย, หยุด, เพิ่มงบ or ยืดเวลา in local dev.
- The migration goes to prod before the code is pushed; pushing and applying it need the owner's OK.

## Review Focus

- **Posts saved with a photo id, not `<page>_<post>`** (62 of 64 published posts): the boost must look up `page_story_id`. If the lookup fails, the post falls back to a new ad instead of failing. Test in Task 5.
- **The same post run twice** (double press, or a post already running): the second run is refused for that post with "โพสต์นี้กำลังรันอยู่ — เพิ่มงบหรือยืดเวลาในแท็บผลแอด". Test in Task 8.
- **A scheduled post whose time has passed but whose state still says scheduled**: it is boostable, not shown as "ขึ้นเพจ <date>". Test in Task 2.
- **เปิดต่อ on a run whose end time has passed**: refused with "แอดนี้จบแล้ว กดยืดเวลาก่อน". **เพิ่มงบ at the cap**: refused with "งบถึงเพดานแล้ว". Tests in Task 6.
- **A run cut by the time budget mid-batch**: the posts not started get no row and an outcome "ส่งไม่ทันในรอบเดียว กดยิงอีกครั้งเพื่อยิงโพสต์ที่เหลือ". Posts already running are untouched. Test in Task 5.

---

### Task 1: `ins_ad_run` / `ins_ad_standing` tables and the run store

**Files:**
- Create: `supabase/migrations/20261011_ad_run.sql`
- Create: `src/lib/ads/run-store.ts`
- Test: `tests/ads/run-store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RunPath = "boost" | "new" | "fallback";
  export type RunStep = "none" | "adset" | "creative" | "ad";
  export interface AdRun {
    id: string; createdAt: string; pageId: string; actId: string; contentId: string | null;
    path: RunPath; storyId: string | null; dailyBudgetMinor: number; endAt: string;
    metaCampaignId: string; adsetId: string | null; imageHash: string | null; creativeId: string | null;
    adId: string | null; step: RunStep; error: string | null; pausedAt: string | null; createdBy: string | null;
  }
  export interface NewRun { pageId: string; actId: string; contentId: string; path: "boost" | "new"; storyId: string | null;
    dailyBudgetMinor: number; endAt: string; metaCampaignId: string; createdBy: string }
  export type RunPatch = Partial<Pick<AdRun, "path" | "storyId" | "adsetId" | "imageHash" | "creativeId" | "adId" | "step" | "error" | "pausedAt" | "dailyBudgetMinor" | "endAt">>;
  export function createRun(r: NewRun): Promise<AdRun>;
  export function getRun(id: string): Promise<AdRun | null>;
  export function listRuns(pageId: string): Promise<AdRun[]>;          // newest first
  export function saveRun(id: string, patch: RunPatch): Promise<void>; // camelCase → snake_case
  export function claimRun(id: string, staleMs: number, now?: Date): Promise<boolean>;
  export function releaseRun(id: string): Promise<void>;
  export function getStanding(pageId: string, actId: string): Promise<string | null>;
  export function saveStanding(pageId: string, actId: string, metaCampaignId: string): Promise<void>; // upsert
  ```

- [ ] **Step 1: Write the migration** `supabase/migrations/20261011_ad_run.sql`. Write a Thai header comment like `20261005_ad_studio_flow.sql`'s, saying: one row per post run; the standing campaign per Page + account; created ACTIVE; ids saved as made so a retry resumes. Then:

```sql
create table if not exists public.ins_ad_standing (
  page_id text not null,
  act_id text not null,
  meta_campaign_id text not null,
  updated_at timestamptz not null default now(),
  primary key (page_id, act_id)
);

create table if not exists public.ins_ad_run (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_id text not null,
  act_id text not null,
  content_id uuid references public.ins_content(id) on delete set null,
  path text not null check (path in ('boost', 'new', 'fallback')),
  story_id text,
  daily_budget_minor int not null check (daily_budget_minor > 0),
  end_at timestamptz not null,
  meta_campaign_id text not null,
  adset_id text,
  image_hash text,
  creative_id text,
  ad_id text,
  step text not null default 'none' check (step in ('none', 'adset', 'creative', 'ad')),
  error text,
  claimed_at timestamptz,
  paused_at timestamptz,
  created_by uuid
);
create index if not exists ins_ad_run_page on public.ins_ad_run (page_id, created_at desc);
create index if not exists ins_ad_run_content on public.ins_ad_run (content_id);

alter table public.ins_ad_standing enable row level security;
alter table public.ins_ad_run enable row level security;
revoke all on public.ins_ad_standing from public, anon, authenticated;
grant all on public.ins_ad_standing to service_role;
revoke all on public.ins_ad_run from public, anon, authenticated;
grant all on public.ins_ad_run to service_role;
```

- [ ] **Step 2: Write the failing tests** in `tests/ads/run-store.test.ts`. Use the fake `supabaseAdmin` builder from `tests/ads/send-store.test.ts`, copied and trimmed to the calls used. The tests:
  - `createRun` inserts `{ page_id, act_id, content_id, path, story_id, daily_budget_minor, end_at, meta_campaign_id, created_by }` and returns a camelCase `AdRun` with `step: "none"`.
  - `saveRun("r1", { adsetId: "9", step: "adset", error: null })` updates `{ adset_id: "9", step: "adset", error: null }` filtered `id = r1`, and sends no other keys.
  - `claimRun` updates `claimed_at` with `.or("claimed_at.is.null,claimed_at.lt.\"<iso>\"")` and returns `true` only when one row comes back.
  - `listRuns("p1")` filters `page_id = p1` and orders `created_at` desc.
  - `saveStanding` upserts on `page_id,act_id`; `getStanding` returns `meta_campaign_id`, or null when there is no row.
  - The migration text contains `enable row level security` for both tables and no `grant` to `anon` or `authenticated`.

- [ ] **Step 3: Run** `npx vitest run tests/ads/run-store.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `src/lib/ads/run-store.ts`** in the style of `send-store.ts`: a `fromRow` mapper, throw `new Error(error.message)` on any Supabase error, and quote the stale timestamp in `claimRun` as `claimSend` does.

- [ ] **Step 5: Run** `npx vitest run tests/ads/run-store.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261011_ad_run.sql src/lib/ads/run-store.ts tests/ads/run-store.test.ts
git commit -m "feat(ads): ins_ad_run and ins_ad_standing — one run per post, standing campaign per Page"
```

---

### Task 2: How a post runs, and the spend sum

**Files:**
- Create: `src/lib/ads/run-path.ts`
- Test: `tests/ads/run-path.test.ts`

**Interfaces:**
- Consumes: `ContentItem`, `Publish` from `@/lib/content/store`.
- Produces:
  ```ts
  export const RUN_DAYS = [3, 7, 14] as const;
  export type RunDays = (typeof RUN_DAYS)[number];
  export const DEFAULT_RUN_DAYS: RunDays = 7;
  export const DEFAULT_RUN_BAHT = 200;
  export type PostPath =
    | { kind: "boost"; postId: string }
    | { kind: "new" }
    | { kind: "scheduled"; at: string }
    | { kind: "none"; reason: string };
  export function postPath(p: Pick<ContentItem, "format" | "status" | "publish" | "output">, now: Date): PostPath;
  /** "<page>_<post>" ready to use; null when postId is a photo id and needs the page_story_id lookup */
  export function storyIdOf(pageId: string, postId: string): string | null;
  export function spendCeiling(posts: number, bahtPerDay: number, days: number): number;
  export function endAtOf(now: Date, days: number): string; // ISO, now + days × 24 h
  export function isRunDays(v: unknown): v is RunDays;
  ```

- [ ] **Step 1: Write the failing tests**:
  - published with `publish.postId "105_77"` → `{ kind: "boost", postId: "105_77" }`;
  - `state "scheduled"`, `at` one hour ahead → `{ kind: "scheduled", at }`;
  - `state "scheduled"`, `at` one hour **ago** → `{ kind: "boost", postId }` (Review Focus);
  - `publish: null` with `output.poster` set → `{ kind: "new" }`; `state "failed"` / `"cancelled"` with poster → `{ kind: "new" }`;
  - no publish and no poster → `{ kind: "none", reason: "โพสต์นี้ยังไม่มีรูป" }`;
  - `status "trashed"` → `{ kind: "none", reason: "โพสต์นี้อยู่ในถังขยะ" }`; `format "script"` → `{ kind: "none", reason: "ยิงได้เฉพาะโพสต์" }`;
  - `storyIdOf("105", "105_77") === "105_77"`; `storyIdOf("105", "1070061492680588") === null`; `storyIdOf("105", "999_77") === null` (another Page's story);
  - `spendCeiling(2, 200, 7) === 2800`;
  - `endAtOf(new Date("2026-10-07T00:00:00Z"), 7) === "2026-10-14T00:00:00.000Z"`;
  - `isRunDays(7)` is true and `isRunDays(5)` is false.

- [ ] **Step 2: Run** `npx vitest run tests/ads/run-path.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/ads/run-path.ts`.** Checks run in this order: format, trashed, published or past-scheduled, future-scheduled, poster, none.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/run-path.ts tests/ads/run-path.test.ts
git commit -m "feat(ads): how an Organic post runs as an ad — boost, new, scheduled"
```

---

### Task 3: Suggestion rules

**Files:**
- Create: `src/lib/ads/advice.ts`
- Test: `tests/ads/advice.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const BASELINE_FALLBACK_THB = 60;
  export function baselineCost(rows: { spend: number; messaging_started: number }[]): number; // whole baht; fallback when 0 chats
  export type AdviceKind = "raise" | "wait" | "stop";
  export interface Advice { kind: AdviceKind; reason: string }
  export function advise(a: { spend: number; chats: number; baseline: number; running: boolean }): Advice | null;
  ```

- [ ] **Step 1: Write the failing tests.** Use baseline 50 unless stated. Expected copy, with whole-baht figures rounded with `Math.round` and the ratio shown to one decimal without a trailing `.0`:
  - `baselineCost([])` → 60; `baselineCost([{spend:3355,messaging_started:65},{spend:2394,messaging_started:39}])` → 55.
  - not running → `null`.
  - spend 40, chats 0 → `{ kind: "wait", reason: "ใช้ไป ฿40 ยังน้อยกว่าค่าเฉลี่ยต่อแชท ฿50 รอดูต่อ" }`.
  - spend 100, chats 0 → `{ kind: "stop", reason: "ใช้ไป ฿100 = 2 เท่าของค่าเฉลี่ย ยังไม่มีแชท" }`.
  - spend 150, chats 2 (฿75/แชท ≥ 1.5 × 50, spend ≥ 3 × 50) → `{ kind: "stop", reason: "฿75/แชท แพงกว่าค่าเฉลี่ย ฿50 เกิน 1.5 เท่า" }`.
  - spend 100, chats 3 (฿33 ≤ 0.7 × 50) → `{ kind: "raise", reason: "฿33/แชท ถูกกว่าค่าเฉลี่ย ฿50 ได้ 3 แชทแล้ว" }`.
  - spend 100, chats 2 (฿50) → `{ kind: "wait", reason: "฿50/แชท ใกล้ค่าเฉลี่ย ฿50 รอดูต่อ" }`.
  - spend 75, chats 0 (1.5 × baseline: no rule fires) → `{ kind: "wait", reason: "ใช้ไป ฿75 ยังไม่มีแชท รอดูต่อ" }`.

- [ ] **Step 2: Run** `npx vitest run tests/ads/advice.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `advise`.** Rules run top to bottom and the first match wins, exactly as in the spec's table. A `running: false` ad returns null before any rule.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/advice.ts tests/ads/advice.test.ts
git commit -m "feat(ads): suggestion rules against the Page's cost per chat"
```

---

### Task 4: Graph params for ACTIVE runs and boosted posts

**Files:**
- Modify: `src/lib/ads/graph.ts:115-206`
- Test: `tests/ads/graph.test.ts` (add cases)

**Interfaces:**
- Produces (old call sites unchanged; every new argument is optional with today's default):
  ```ts
  type MetaStatus = "PAUSED" | "ACTIVE";
  campaignParams(name, objective = "traffic", status: MetaStatus = "PAUSED")
  adsetParams({ ...existing, endTime?: string, status?: MetaStatus })   // end_time sent only when given
  adParams({ ...existing, status?: MetaStatus })
  export function storyCreativeParams(c: { name: string; storyId: string }): Record<string, string>; // { name, object_story_id }
  export function pageStoryOf(body: Record<string, unknown>): string | null; // body.page_story_id when a "<digits>_<digits>" string
  ```

- [ ] **Step 1: Add the failing tests:**
  - `campaignParams("x", "messages", "ACTIVE").status === "ACTIVE"`, and the two-argument call still gives `"PAUSED"`;
  - `adsetParams({...messages, endTime: "2026-10-14T00:00:00.000Z", status: "ACTIVE"})` has `end_time` equal to that string and `status: "ACTIVE"`, and without `endTime` it has no `end_time` key;
  - `adParams({..., status: "ACTIVE"}).status === "ACTIVE"`;
  - `storyCreativeParams({ name: "n", storyId: "105_77" })` deep-equals `{ name: "n", object_story_id: "105_77" }`;
  - `pageStoryOf({ page_story_id: "105_77" }) === "105_77"`, `pageStoryOf({}) === null`, `pageStoryOf({ page_story_id: "x/../y" }) === null`.

- [ ] **Step 2: Run** `npx vitest run tests/ads/graph.test.ts`. Expected: the new cases FAIL.

- [ ] **Step 3: Implement.** Above `storyCreativeParams`, add a doc comment saying it boosts the Page post as it stands: its likes and comments stay on the post.

- [ ] **Step 4: Run** `npx vitest run tests/ads/graph.test.ts tests/ads/send.test.ts`. Expected: PASS (send tests prove the defaults did not move).

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/graph.ts tests/ads/graph.test.ts
git commit -m "feat(ads): graph params for ACTIVE runs, end time and boosted Page posts"
```

---

### Task 5: The run engine

**Files:**
- Create: `src/lib/ads/run.ts`
- Test: `tests/ads/run.test.ts`

**Interfaces:**
- Consumes: Task 1 store, Task 2 `PostPath` / `storyIdOf` / `endAtOf`, Task 4 params, plus existing `graph`, `idOf`, `hashOf`, `imageParams`, `creativeParams`, `bangkokDay`, `RESULT_UNKNOWN`, `NO_ID`, `NO_HASH`, `checkDailyBudget`, `maxDailyBudgetThb`, `thVerifiedIdentity`.
- Produces:
  ```ts
  export const RUN_TIME_BUDGET_MS = 120_000;
  export const RUN_CLAIM_STALE_MS = 300_000;
  export const OUT_OF_TIME = "ส่งไม่ทันในรอบเดียว กดยิงอีกครั้งเพื่อยิงโพสต์ที่เหลือ";
  export const FELL_BACK = "บูสต์ไม่ได้ ทำเป็นแอดใหม่จากโพสต์แทน";
  export interface RunPost { contentId: string; path: { kind: "boost"; postId: string } | { kind: "new" }; headline: string; text: string }
  export interface RunInput { pageId: string; pageName: string; actId: string; currency: string | null;
    dailyBudgetBaht: number; days: number; posts: RunPost[]; createdBy: string }
  export interface RunDeps {
    store: typeof import("./run-store");
    token(actId: string): Promise<string | null>;
    poster(contentId: string): Promise<Buffer | null>;
    post(contentId: string): Promise<RunPost | null>;  // for a resume
    thIdentity?: () => string | null; fetchFn?: typeof fetch; now?: () => Date; startedAt?: number;
  }
  export interface PostOutcome { contentId: string; runId: string | null; ok: boolean; path: RunPath | null; note: string | null; error: string | null }
  export type RunResult = { ok: true; outcomes: PostOutcome[] } | { ok: false; error: string };
  export function runPosts(input: RunInput, deps: RunDeps): Promise<RunResult>;
  export function resumeRun(runId: string, deps: RunDeps): Promise<PostOutcome>;
  ```

**How it works.** Write this as `run.ts`'s doc comment, in the style of `send.ts`'s:
1. Checks before anything is made, each returning `{ ok: false, error }` with `send.ts`'s Thai messages (copy `NO_TOKEN`, `BAD_IDS`, `NO_TH_IDENTITY`): no posts; budget (`checkDailyBudget(input.dailyBudgetBaht, input.currency, maxDailyBudgetThb())`); `days` in `RUN_DAYS`; ids; identity; token.
2. **Standing campaign:** `store.getStanding(pageId, actId)`. If an id is stored, `GET {id}?fields=effective_status`. Reuse it unless the GET fails or the status is `DELETED` / `ARCHIVED`. Otherwise `POST {act}/campaigns` with `campaignParams("AdvisorTool · ทักแชท · <pageName>", "messages", "ACTIVE")`, then `saveStanding`.
3. Posts run **one at a time**. Before each, if `now - begun >= RUN_TIME_BUDGET_MS`, the post gets outcome `{ ok: false, runId: null, error: OUT_OF_TIME }` and no row. Otherwise `createRun` (path `boost` with `storyIdOf(...)` or `new`, `endAt: endAtOf(now, days)`), then `drivePost` under `claimRun` / `releaseRun`.
4. **drivePost**, resuming from the saved fields. Each id is saved the moment Meta returns it:
   - **Ad set** (if `adsetId` is null): `adsetParams({ name: "AdvisorTool · <headline 40 chars> · <bangkokDay>", campaignId, dailyBudgetMinor, identity, goal: { objective: "messages" }, pageId, endTime: run.endAt, status: "ACTIVE" })`.
   - **Creative** (if `creativeId` is null):
     - `boost`: if `storyId` is null, `GET {postId}?fields=page_story_id` and save the result of `pageStoryOf`. Then `storyCreativeParams`.
     - `new` / `fallback`: upload the poster (`imageParams`), save `imageHash`, then `creativeParams({ goal: { objective: "messages" }, primaryText: text, headline, description: null, ... })`.
   - **Ad**: `adParams({ ..., status: "ACTIVE" })`, then save `adId` and `step: "ad"`.
5. **Fallback.** On the `boost` path, any of these switches the run to `fallback`: the story lookup fails or gives null, the creative POST fails, or the ad POST fails with an error **other than** `RESULT_UNKNOWN`. The switch is `saveRun({ path: "fallback", creativeId: null, error: null })`, then the post continues on the new-ad path within the same call. The outcome's `note` is `FELL_BACK`. `RESULT_UNKNOWN` never falls back: it saves the error so a retry resumes.
6. Any other failure saves `error` on the run and gives `{ ok: false, error }` for that post. The other posts go on.

- [ ] **Step 1: Write the failing tests.** Use a fake store (in-memory maps implementing the Task 1 functions) and a fake `fetchFn` that answers by URL and method. Each test asserts the Graph calls made, in order, and the final run row:
  - boost with `postId "105_77"`: campaign POST (no standing stored) → `saveStanding`; adset POST with `status=ACTIVE` and `end_time`; creative POST with `object_story_id=105_77`; ad POST `ACTIVE`; outcome `{ ok: true, path: "boost" }`.
  - standing stored and `effective_status: "ACTIVE"`: no campaign POST.
  - standing stored but GET answers `DELETED`: a new campaign POST, and `saveStanding` gets the new id.
  - photo id `postId "1070061492680588"`: GET `1070061492680588?fields=page_story_id` → `"105_88"` saved as `storyId` and used (Review Focus).
  - photo lookup answers an error → path `fallback`, image + messages creative made, `note: FELL_BACK`, ok true (Review Focus).
  - boost creative POST refused (`{ error: { message: "Invalid parameter" } }`) → fallback, ok true.
  - ad POST answers `RESULT_UNKNOWN` (fetch throws) → no fallback, `error` saved, ok false; `resumeRun` then makes only the ad.
  - draft (`kind: "new"`) with no poster → ok false with `"โพสต์นี้ยังไม่มีรูป"`, no ad set made. Check the poster **before** the ad set: fetch posters for new-path posts first, as `runSend` does.
  - two posts, `now` past `RUN_TIME_BUDGET_MS` after the first → second outcome `{ runId: null, error: OUT_OF_TIME }`, and no second run row (Review Focus).
  - budget over cap → `{ ok: false }` with `checkDailyBudget`'s message, and no Graph call.

- [ ] **Step 2: Run** `npx vitest run tests/ads/run.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/ads/run.ts`.** Name ad sets and ads `"AdvisorTool · <first 40 chars of headline> · <bangkokDay(now)>"`.

- [ ] **Step 4: Run** `npx vitest run tests/ads/run.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/run.ts tests/ads/run.test.ts
git commit -m "feat(ads): run engine — one ACTIVE ad set and ad per post, boost with fallback, resumable"
```

---

### Task 6: Controls on a run, and on any ad

**Files:**
- Create: `src/lib/ads/run-controls.ts`
- Test: `tests/ads/run-controls.test.ts`

**Interfaces:**
- Consumes: Task 1 store (`getRun`, `saveRun`, `claimRun`, `releaseRun`), `graph`, `maxDailyBudgetThb`.
- Produces:
  ```ts
  export type Control = "pause" | "resume" | "raise" | "extend";
  export const RAISE_FACTOR = 1.5;
  export const EXTEND_DAYS = 7;
  export function raisedBudgetMinor(currentMinor: number, capBaht: number): number; // whole baht ×1.5 rounded up, ≤ cap
  export function extendedEnd(endAt: string, now: Date): string;                    // max(endAt, now) + 7 days
  export type ControlResult = { ok: true; run: AdRun } | { ok: false; error: string };
  export function controlRun(runId: string, control: Control, deps: {
    store: typeof import("./run-store"); token(actId: string): Promise<string | null>;
    fetchFn?: typeof fetch; now?: () => Date; capBaht?: number;
  }): Promise<ControlResult>;
  export function setAdStatus(adId: string, status: "PAUSED" | "ACTIVE", token: string, fetchFn?: typeof fetch): Promise<{ ok: true } | { ok: false; error: string }>;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `raisedBudgetMinor(20000, 500) === 30000`; `raisedBudgetMinor(20100, 500) === 30200`; `raisedBudgetMinor(40000, 500) === 50000`.
  - `extendedEnd("2026-10-10T00:00:00.000Z", new Date("2026-10-07T00:00:00Z")) === "2026-10-17T00:00:00.000Z"`, and with `now` after `endAt` it counts from `now`.
  - `pause` → POST `{adsetId}` `status=PAUSED`, then `saveRun({ pausedAt })`.
  - `resume` → POST `status=ACTIVE`, then `pausedAt: null`. When `endAt < now` it is refused with `"แอดนี้จบแล้ว กดยืดเวลาก่อน"` and makes no Graph call (Review Focus).
  - `raise` at 500 baht with cap 500 → `"งบถึงเพดานแล้ว"`, no Graph call (Review Focus). Otherwise POST `daily_budget`, then `saveRun({ dailyBudgetMinor })`.
  - `extend` → POST `end_time`, then `saveRun({ endAt })`.
  - A run with no `adsetId` → `"ชุดโฆษณายังสร้างไม่เสร็จ"`.
  - Meta answering without `success: true` → `"Facebook ไม่ยืนยันการเปลี่ยนแปลง"`.
  - `setAdStatus("123", "PAUSED", "t")` → POST `123` `status=PAUSED`; a non-`\w+` id is refused without a call.

- [ ] **Step 2: Run** `npx vitest run tests/ads/run-controls.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Every control holds `claimRun` with `RUN_CLAIM_STALE_MS` (from Task 5) and re-reads the run under the claim.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/run-controls.ts tests/ads/run-controls.test.ts
git commit -m "feat(ads): pause, resume, raise and extend a run; pause any ad"
```

---

### Task 7: The results board

**Files:**
- Create: `src/lib/ads/board.ts`
- Test: `tests/ads/board.test.ts`

**Interfaces:**
- Consumes: `AdRun` (Task 1), `advise` / `Advice` (Task 3), `costPer` from `results.ts`, `PosterSpec`.
- Produces:
  ```ts
  export interface BoardDaily { ad_id: string; ad_name: string | null; campaign_name: string | null; account_id: string; spend: number; messaging_started: number }
  export type BoardStatus = "running" | "paused" | "review" | "rejected" | "ended" | "unknown";
  export const STATUS_LABEL: Record<BoardStatus, string>; // รัน / หยุด / รอตรวจ / ไม่ผ่าน / จบแล้ว / —
  export function boardStatus(effective: string | null, run: AdRun | null, now: Date): BoardStatus;
  export interface BoardRow {
    adId: string; actId: string; title: string; poster: PosterSpec | null; contentId: string | null;
    run: AdRun | null; campaignName: string | null; spend: number; chats: number; costPerChat: number | null;
    status: BoardStatus; advice: Advice | null;
  }
  export function boardRows(a: {
    daily: BoardDaily[]; runs: AdRun[]; posts: Map<string, { title: string; poster: PosterSpec | null }>;
    statuses: Map<string, string>; baseline: number; now: Date;
  }): BoardRow[];
  export function boardTotals(rows: BoardRow[]): { spend: number; chats: number; costPerChat: number | null };
  ```

- [ ] **Step 1: Write the failing tests:**
  - Daily rows for one ad on two days sum into one row.
  - A run whose ad has no daily rows yet still appears, with spend 0, chats 0 and the post's title.
  - A row whose ad belongs to a run gets that run's `contentId`, and its title comes from `posts`. Any other row's title is `ad_name ?? campaign_name ?? adId`, and `run` is null.
  - `boardStatus`:
    - ACTIVE with a run whose `endAt` has passed → `"ended"`;
    - `"PENDING_REVIEW"` and `"IN_PROCESS"` → `"review"`;
    - `"DISAPPROVED"` and `"WITH_ISSUES"` → `"rejected"`;
    - `"PAUSED"`, `"ADSET_PAUSED"` and `"CAMPAIGN_PAUSED"` → `"paused"`;
    - `"ACTIVE"` → `"running"`;
    - null → `"unknown"`.
  - Advice is computed only for `"running"` rows (`running: status === "running"`).
  - Order: running rows first, then the rest; within each group, by spend, highest first.
  - `boardTotals` sums spend and chats, and `costPerChat` is `costPer(spend, chats)`.

- [ ] **Step 2: Run** `npx vitest run tests/ads/board.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/ads/board.ts`.** It is a pure module with no I/O.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/board.ts tests/ads/board.test.ts
git commit -m "feat(ads): results board rows, status and totals"
```

---

### Task 8: Owner server actions

**Files:**
- Create: `src/app/studio/ads/connection-actions.ts` (moved from `actions.ts`: `Connection`, `connection()`, `expiries()`, `pendingChoices()`, `chooseAdManageAccounts()`, unchanged behaviour)
- Create: `src/app/studio/ads/run-actions.ts`
- Test: `tests/ads/run-actions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7, `listContent`, `getContent`, `fullText`, `drawPoster`, `adManageAccounts`, `adManageToken`, `adAccountToken`, `adAccounts`, `myPages`, `syncAds`, `audit`, `requireStaff`, `supabaseAdmin`, `graph`.
- Produces (all `"use server"`, owner-gated, each catches and logs and returns `SOMETHING_BROKE` = `"ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ"`):
  ```ts
  export interface PostCard { id: string; title: string; planHref: string; poster: PosterSpec | null; path: PostPath; createdAt: string;
    live: boolean; lastCostPerChat: number | null }
  export function adsPage(pageId?: string): Promise<{ pages: { pageId: string; pageName: string }[]; pageId: string | null; connection: Connection }>;
  export function postsForAds(pageId: string): Promise<{ ok: true; posts: PostCard[] } | { ok: false; error: string }>;
  export function runPostsAction(input: { pageId: string; actId: string; contentIds: string[]; dailyBudgetBaht: number; days: number }): Promise<RunResult>;
  export function retryRunAction(runId: string): Promise<PostOutcome>;
  export function boardAction(pageId: string, days: unknown): Promise<
    { ok: true; rows: BoardRow[]; totals: ReturnType<typeof boardTotals>; baseline: number; fetchedAt: string | null; controllable: string[] }
    | { ok: false; error: string }>;
  export function refreshResultsAction(): Promise<{ ok: true; errors: string[] } | { ok: false; error: string }>;
  export function controlRunAction(runId: string, control: Control): Promise<ControlResult>;
  export function controlAdAction(adId: string, actId: string, status: "PAUSED" | "ACTIVE"): Promise<{ ok: true } | { ok: false; error: string }>;
  ```

What each action decides:
- `postsForAds`: `listContent({ pageId }, 120)` keeps `format === "post"` and non-trashed, newest first. `title` is `output.hooks[0]` cut to 60 characters. `live` is true when a run for that content has `adId`, no `pausedAt` and `endAt > now`. `lastCostPerChat` comes from that content's newest run's ad over the last 30 days of `ins_ad_daily`.
- `runPostsAction`: the Page must be in `myPages()` and the account in `adManageAccounts()`. Each content id must belong to this Page, and its `postPath` must be boost or new. Ids that are not are skipped with an outcome giving the reason. A content id that is `live` is skipped with `"โพสต์นี้กำลังรันอยู่ — เพิ่มงบหรือยืดเวลาในแท็บผลแอด"` (Review Focus). The rest go to `runPosts` with `deps.post` / `deps.poster` built like `sendDeps` (poster: `drawPoster(output.poster, "square")`; text: `fullText(output)`; headline: `hooks[0]`). Then `audit("ads-run", pageId, {...})` and `revalidatePath("/studio/ads", "layout")`.
- `boardAction`: rows of `ins_ad_daily` for the range (`bangkokSince(parseDays(days))`, paged by 1000 as `metaCampaigns` does) where `page_id = pageId`, plus rows for the Page's run ad ids. The baseline is the Page's last 30 days. Statuses come from `GET ?ids=<≤50 ids>&fields=effective_status`, per account, with `adManageToken(act) ?? adAccountToken(act)`. A failed status read leaves those ads `"unknown"`, not an error. `controllable` lists the ad ids whose account has an `adManageToken`.
- `refreshResultsAction`: `syncAds({ days: 3 })`, returning each error's `message` with the account's name.
- `controlAdAction`: refused unless the account is in `adManageAccounts()`.

- [ ] **Step 1: Write the failing tests.** Use `vi.mock` for the auth, store, content and Meta modules, as `tests/ads/results-action.test.ts` does:
  - `runPostsAction` with a live content id → that outcome carries the live message, and `runPosts` is called without it.
  - A content id from another Page → skipped with `"โพสต์นี้ไม่ได้อยู่ในเพจนี้"`.
  - An account not connected → `{ ok: false, error: "บัญชีโฆษณานี้ยังไม่ได้เชื่อมสำหรับสร้างแอด" }`.
  - `requireStaff` throwing → the action throws (it is not swallowed).
  - `boardAction` → a status read failure yields `"unknown"` rows and still `ok: true`.
  - `postsForAds` → a trashed post and a script are not listed; `live` is true for a run with an ad, no pause and a future `endAt`.

- [ ] **Step 2: Run** `npx vitest run tests/ads/run-actions.test.ts`. Expected: FAIL.

- [ ] **Step 3: Move the connection code to `connection-actions.ts`.** Point `PageSettings.tsx`'s import at it. Then implement `run-actions.ts`.

- [ ] **Step 4: Run** `npx vitest run tests/ads` and `npx tsc --noEmit`. Expected: PASS, apart from tests for files Task 11 deletes, if they break. Name any such test in the commit body.

- [ ] **Step 5: Commit**
```bash
git add src/app/studio/ads/connection-actions.ts src/app/studio/ads/run-actions.ts src/app/studio/ads/actions.ts src/app/studio/ads/PageSettings.tsx tests/ads/run-actions.test.ts
git commit -m "feat(ads): owner actions — Organic posts, run, results board, controls"
```

---

### Task 9: The page and the ยิงแอด tab

**Files:**
- Rewrite: `src/app/studio/ads/page.tsx`, `src/app/studio/ads/AdsStudio.tsx`
- Create: `src/app/studio/ads/PostGrid.tsx`, `src/app/studio/ads/RunDialog.tsx`, `src/app/studio/ads/ConnectionPanel.tsx`
- Create: `src/lib/ads/studio-url.ts`
- Test: `tests/ads/studio-url.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // studio-url.ts
  export type StudioTab = "post" | "results";
  export function studioUrl(o: { page: string | null; tab: StudioTab; days: 7 | 30; settings?: boolean }): string; // /studio/ads?page=&tab=&days=&settings=1
  export function parseStudioTab(v: unknown): StudioTab;  // "results" or default "post"
  ```

The screens, as in the spec and the wireframe:
- **`page.tsx`** gates the owner and reads `page`, `tab`, `days` (`parseDays`), `settings` and `fb` / `warn` / `detail` (the Facebook login's outcome, shown in ConnectionPanel). It loads `adsPage` + `postsForAds` for `post`, or `adsPage` + `boardAction` for `results`. Keep `maxDuration = 300`.
- **`AdsStudio.tsx`** is the top bar: Ads Studio, Page `<select>` (navigates with `studioUrl`), tabs ยิงแอด · ผลแอด, 7/30 วัน (results tab only), and a settings icon button that toggles ConnectionPanel via `settings=1`. With no Page, it keeps the current "ยังไม่มีเพจที่เชื่อมกับระบบ" line. With no baht account in `connection.accounts`, it shows "ยังไม่ได้เชื่อมบัญชีโฆษณา — กดไอคอนตั้งค่าเพื่อเชื่อม".
- **`ConnectionPanel.tsx`** is the connection half of `PageSettings.tsx`, moved verbatim: the accounts list, choices, connect button and outcome notes. It contains no contacts form.
- **`PostGrid.tsx`**:
  - Filter chips ขึ้นเพจแล้ว (boost + scheduled, the default) / ร่าง (new / none), and a plan `<select>` of the plans present.
  - Cards in a responsive grid (2 columns on a phone, 4 on a desk), each showing the poster via `posterUrl`, the title, and a line:
    - `บนเพจ`;
    - `ร่าง · ทำเป็นแอดใหม่`;
    - `ขึ้นเพจ <d MMM HH:mm Thai>` (not tickable);
    - the `none` reason (not tickable);
    - plus `เคยยิง ฿X/แชท` when `lastCostPerChat`, and `กำลังรัน` when `live` (not tickable).
  - Tick with `aria-pressed`, and a sticky foot bar "เลือก N โพสต์" + **ยิงแอด N โพสต์**.
  - With no posts, it shows "ยังไม่มีโพสต์ของเพจนี้ — ทำโพสต์ใน Organic Studio" with a link to `/studio`.
- **`RunDialog.tsx`** (modal, focus-trapped and Escape to close, like `SendDialog.tsx`):
  - Heading "ยิงแอดทักแชท" and the line "ปุ่ม “ส่งข้อความ” เปิดแชทเพจ บอทตอบต่อ · ไทย อายุ 20+".
  - Fields: งบต่อโพสต์/วัน (number, default from localStorage `ads-run-budget` else `DEFAULT_RUN_BAHT`, wrapped in try/catch) and นานกี่วัน (`RUN_DAYS`, default `DEFAULT_RUN_DAYS`). The account select appears only when more than one baht account exists.
  - An over-cap note, as SendDialog has.
  - The sum: "N โพสต์ × ฿B × D วัน = ใช้สูงสุด ฿T" (`spendCeiling`).
  - **ยิงเลย** → `runPostsAction`, with a seconds counter and a `beforeunload` guard while busy.
  - Then one line per outcome: "กำลังรัน", or "กำลังรัน · บูสต์ไม่ได้ ทำเป็นแอดใหม่จากโพสต์แทน", or the error with a **ลองใหม่** button (`retryRunAction`) when it has a `runId`. Below that: **ดูผลแอด** (to the results tab) and **ปิด**.

- [ ] **Step 1: Write the failing tests** for `studioUrl` / `parseStudioTab`:
  - `studioUrl({ page: "105", tab: "results", days: 30 }) === "/studio/ads?page=105&tab=results&days=30"`;
  - `settings: true` appends `&settings=1`;
  - `page: null` omits `page`;
  - `parseStudioTab("x") === "post"`.

- [ ] **Step 2: Run** `npx vitest run tests/ads/studio-url.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `studio-url.ts`, then the components.** Use the existing `styles.ts` tokens (`field`, `solid`, `plain`, `chip`, `TONES`) and the `var(--ct-*)` colours. Every tap target is at least `min-h-11`.

- [ ] **Step 4: Run** `npx vitest run tests/ads/studio-url.test.ts` and `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ads/studio-url.ts tests/ads/studio-url.test.ts src/app/studio/ads/page.tsx src/app/studio/ads/AdsStudio.tsx src/app/studio/ads/PostGrid.tsx src/app/studio/ads/RunDialog.tsx src/app/studio/ads/ConnectionPanel.tsx
git commit -m "feat(ads): Ads Studio picks Organic posts and runs them as Messenger ads"
```

---

### Task 10: The ผลแอด tab

**Files:**
- Create: `src/app/studio/ads/ResultsBoard.tsx`
- Modify: `src/app/studio/ads/AdsStudio.tsx` (render it for `tab === "results"`)

**Interfaces:**
- Consumes: `boardAction`'s result, `refreshResultsAction`, `controlRunAction`, `controlAdAction`, `STATUS_LABEL`, `raisedBudgetMinor`, `extendedEnd`, `RAISE_FACTOR`, `EXTEND_DAYS`.

What it shows:
- Three figures: ใช้ไป N วัน, แชท, เฉลี่ย/แชท (`boardTotals`). Under them, "ค่าเฉลี่ยของเพจ 30 วัน ฿X/แชท" and the last sync time ("อัปเดตล่าสุด <time>"), with **อัปเดตผลตอนนี้** (busy state, then `router.refresh()`, and any errors listed).
- Rows on a desk: thumbnail, title, the status pill, ใช้ไป, แชท, ฿/แชท, the advice chip (เพิ่มงบ in the success tone, ควรหยุด in the bad tone, รอดูต่อ neutral) with its reason under it, and buttons. On a phone the same fields stack in a card.
- Buttons:
  - **Run rows:** หยุด (running) / เปิดต่อ (paused), เพิ่มงบ, ยืดเวลา. เพิ่มงบ and ยืดเวลา open a small confirm naming the new amount ("งบใหม่ ฿X/วัน") or the new end date, then call `controlRunAction`.
  - **Other rows:** หยุด / เปิดต่อ only when the ad id is in `controllable`, plus **เปิดใน Ads Manager** (`https://adsmanager.facebook.com/adsmanager/manage/ads?act=<digits>&selected_ad_ids=<adId>`, `target="_blank"`).
- An action's error shows on its row, and success calls `router.refresh()`.
- With no rows, it shows "ยังไม่มีแอดที่รันในช่วงนี้ — เลือกโพสต์ในแท็บยิงแอด".

- [ ] **Step 1: Implement `ResultsBoard.tsx` and wire it in.**
- [ ] **Step 2: Run** `npx tsc --noEmit && npx next lint --dir src/app/studio/ads`. Expected: no errors.
- [ ] **Step 3: Commit**
```bash
git add src/app/studio/ads/ResultsBoard.tsx src/app/studio/ads/AdsStudio.tsx
git commit -m "feat(ads): results board with suggestions, pause, raise and extend"
```

---

### Task 11: Remove the old flow

**Files:**
- Delete:
  - `src/app/studio/ads/` components: `AdEditor.tsx`, `AdPreview.tsx`, `AdsList.tsx`, `CampaignRoom.tsx`, `CampaignSettings.tsx`, `CampaignTable.tsx`, `ClaimFields.tsx`, `Columns.tsx`, `CreateDrawer.tsx`, `FeedPreview.tsx`, `HeadlinePreview.tsx`, `MetaCampaigns.tsx`, `NewCampaignForm.tsx`, `PageSettings.tsx`, `PictureFields.tsx`, `SendDialog.tsx`, `SentSend.tsx`, `SentTab.tsx`, `TopBar.tsx`, `UnsyncedNote.tsx`, `WriteForm.tsx`;
  - `src/app/studio/ads/` helpers: `form-ready.ts`, `rules.ts`, `Fold.tsx` (if unused by ConnectionPanel), and `actions.ts` — whatever is still needed was moved in Task 8;
  - the tests of deleted modules only.
- Rewrite: `src/app/studio/ads/[id]/page.tsx` and `src/app/studio/ads/new/page.tsx` → `redirect("/studio/ads")`.

- [ ] **Step 1: Find every importer.** Run `grep -rn "studio/ads/\(actions\|AdEditor\|CampaignRoom\|SendDialog\|WriteForm\|ClaimFields\|PictureFields\)" src tests`. Anything outside `src/app/studio/ads` that imports these must be repointed or kept. For example, a route posting `campaign` for รีวิวเคลม ads keeps working against `campaign-store`. List what you find in the commit body.
- [ ] **Step 2: Delete the files and rewrite the two redirect pages.** Keep every `src/lib/ads/*` and `src/lib/content/*` module: the later move of ad kinds into Organic reuses them. Delete a lib module only if `tsc` and a grep show nothing imports it **and** it only served the deleted UI (`manager-view.ts`, `campaign-table.ts`, `ads-list.ts`, `campaign-view.ts`, `sent-view.ts`, `room-view.ts`, `meta-campaigns.ts`, `form-ready`). When in doubt, keep it.
- [ ] **Step 3: Run** `npm run verify` (tsc, lint, vitest, build). Expected: all pass, except the known unrelated failure `tests/chat/session-turn.test.ts`. Name it in the report if it still fails.
- [ ] **Step 4: Commit**
```bash
git add -u src/app/studio/ads tests/ads src/lib/ads   # -u stages only deletions/edits of tracked files in these paths
git commit -m "refactor(ads): remove the campaign/writing flow — Ads Studio runs Organic posts"
```

---

### Task 12: Browser check and rollout notes

- [ ] **Step 1: Check in the browser.** Start the `dev` preview and open `/studio/ads` signed in as the owner; the owner signs in themselves. Check on desktop and at `resize_window` mobile:
  - the grid shows real Organic posts, with the right line for published, scheduled and draft posts;
  - ticking opens the foot bar;
  - the dialog's sum updates as the fields change;
  - ผลแอด shows the Page's real rows, including Ads Manager campaigns;
  - there are no console errors.

  **Do not press ยิงเลย or any control**: local dev uses the production database and Meta.
- [ ] **Step 2: Screenshot** both tabs for the owner.
- [ ] **Step 3: Write the rollout to the owner. Do not do it without their yes.**
  1. Apply `20261011_ad_run.sql` to prod `cenysylrzbwfrtuqoeqk`, then verify both tables exist with RLS on and no anon or authenticated grants.
  2. Merge and push to main (Vercel deploys).
  3. The owner's first live run: one post, 100 บาท, 3 days. Then check in Ads Manager: one campaign "AdvisorTool · ทักแชท · <Page>", one ad set ACTIVE with an end date, and one ad. Also check whether it boosted or fell back.
