# Ads Studio desktop redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Rebuild /studio/ads as an Ads Manager–style desktop page: top bar, campaign table with results, ads list + Facebook-feed preview, create drawer.
**Architecture:** Server reads stay in `src/app/studio/ads/actions.ts` (+ one new results read); pure view logic in `src/lib/ads/*.ts` with tests; UI components under `src/app/studio/ads/`. State lives in the address (`?page= ?campaign= ?tab= ?days= ?ad=`).
**Tech Stack:** Next.js App Router, React client components, Tailwind with the app's `--ct-*` variables, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-05-ads-studio-desktop-design.md`

## Global Constraints
- No server rule changes (figures from code, owner line, flags, send/activate/pause/delete keep their behaviour and confirm texts).
- No migration. `.env.local` points at production: no dev server writes; browser checks are look-only.
- Desktop first (≥1024px: `lg:`); below that everything stacks in one column, no horizontal page scroll (a table may scroll inside its own wrapper).
- Thai copy; tap targets min-h-11 (44px) on controls; aria for tabs (`role=tablist/tab`, `aria-selected`), switches (`role=switch`, `aria-checked`), drawer (`role=dialog`, `aria-modal`, focus moved in and returned, Esc closes).
- Reuse existing components (WriteForm, NewCampaignForm, CampaignSettings, PageSettings, SendDialog, SentSend, AdEditor, PictureFields) — move/wrap, don't fork.
- Commit per task, message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. A campaign with sends on two ad accounts / several sends: on-state, budget and results sum correctly; turning it off pauses every on send.
2. A campaign with no sends: switch disabled, results "—", not 0.
3. `?ad=` naming a piece not in the sub-tab (binned/sent meanwhile): falls back to the first, no crash.
4. Results range change (7→30) re-reads; rows with no `ins_ad_daily` data show "—".
5. The drawer closes on Esc/backdrop without losing a round in progress (a running round keeps the drawer open and says so).

---

### Task 1: Results data
**Files:** Create `src/lib/ads/results.ts`; modify `src/app/studio/ads/actions.ts`; tests `tests/ads/results.test.ts`.
**Produces:**
- `interface AdResult { spend: number; impressions: number; clicks: number; messaging: number }`
- `sumResults(rows: { ad_id: string; spend: number|string; impressions: number; link_clicks: number; clicks: number; messaging_started: number }[], adIdsByKey: Map<string, string[]>): Map<string, AdResult>` — pure; key = campaign id or piece id; clicks = link_clicks.
- `costPer(spend: number, n: number): number | null` (null when n = 0).
- Server: `campaignResults(pageId: string, days: 7 | 30): Promise<{ ok: true; byCampaign: Record<string, AdResult>; byPiece: Record<string, AdResult>; fetchedAt: string | null } | { ok: false; error: string }>` — owner-only, Page in `myPages()`; reads the Page's campaigns' sends' items (ad ids, piece ids), then `ins_ad_daily` rows `date >= today-days` for those ad ids (chunk 100 ids per `in`).
- [ ] tests (aggregation incl. two sends/two accounts, missing rows → absent key, costPer null), red → implement → green → commit `feat(ads): results of sent ads by campaign and piece`.

### Task 2: Pure view helpers
**Files:** Create `src/lib/ads/manager-view.ts`; tests `tests/ads/manager-view.test.ts`.
**Produces:**
- `campaignState(sends: { activatedAt: string|null; pausedAt: string|null }[], drafts: number): "on" | "paused" | "draft"` (on if any `switchedOn`; paused if any send; else draft).
- `onBudget(sends: { activatedAt; pausedAt; dailyBudgetBaht: number }[]): number | null`.
- `totals(rows: AdResult[]): AdResult`.
- `parseDays(v: unknown): 7 | 30` (default 7); `parseTab(v: unknown, hasCampaign: boolean): "campaigns" | "ads" | "page"`.
- `foldAt(text: string, n = 125): number` — index of the fold in code points, at a whitespace/line boundary ≤ n.
- [ ] tests, red → green → commit `feat(ads): manager view helpers`.

### Task 3: Shell, top bar, tabs, campaign table
**Files:** Create `src/app/studio/ads/TopBar.tsx`, `CampaignTable.tsx`; rewrite `AdsStudio.tsx` layout; modify `page.tsx` (read `?tab ?days ?ad`, load `campaignResults` and the sends needed for state/budget per campaign — add a light server read `campaignRows(pageId)` returning per campaign `{ id, name, planName, drafts, sent, sends: {id, activatedAt, pausedAt, dailyBudgetBaht, accountName}[] }` if the home read lacks it).
- Top bar per spec (+ สร้าง menu opens the drawer from Task 5 — until then link to `?new=1`).
- Campaign table per spec with switch (calls existing `activateSendAction`/`pauseSendAction` for each relevant send, with the existing confirm texts via `ask`), row menu ลบแคมเปญ (existing delete), totals row, "อัปเดตล่าสุด …".
- Tabs with roles; ตั้งค่าเพจ tab renders PageSettings (+ CampaignSettings when a campaign is open).
- [ ] tsc/eslint/vitest clean → commit `feat(ads): Ads Manager–style shell and campaign table`.

### Task 4: Ads tab — list + feed preview
**Files:** Create `src/app/studio/ads/AdsList.tsx`, `FeedPreview` reuse/extend (existing `FeedPreview.tsx` — read it first), modify `CampaignRoom.tsx` (becomes the ads tab body: list left `lg:w-[42%]`, preview right sticky).
- List per spec incl. sub-tabs, ticks (`pruneTicks`), per-piece results, send button + SendDialog, sent sub-tab with SentSend panels.
- Preview per spec: full text with the fold marked (`foldAt`), image, headline/description/CTA; actions แก้ไข (AdEditor), ทิ้ง/กู้คืน (`setAdStatus`), วาดรูปใหม่ (existing draw); `?ad=` selection with fallback.
- [ ] tsc/eslint/vitest clean → commit `feat(ads): ads list beside a full feed preview`.

### Task 5: Create drawer
**Files:** Create `src/app/studio/ads/CreateDrawer.tsx`; move WriteForm/NewCampaignForm usage into it; add server read `headlinePreview(campaignId, { age, sex, rung })` → `{ ok: true; headline: string; table: string }` (owner-only, Page-checked; uses `premiumTable` + `headlineFigures` + `tableText`) for the live preview.
- Drawer per spec; a running round keeps it open with the elapsed seconds; on finish closes and selects the first new ad.
- [ ] tsc/eslint/vitest (+ a test for `headlinePreview`) → commit `feat(ads): create in a drawer with the figures previewed`.

### Task 6: Verify
- [ ] Full `npx vitest run` (known failure: tests/chat/session-turn), `NEXT_DIST_DIR=.next-build npx next build`, grep for dead components (`SentRail`, old Columns props) and remove what nothing imports; controller does the browser look at 1440 and 375.
