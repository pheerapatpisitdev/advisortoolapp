# Ads Studio long-form ads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ads Studio's dimensions with an Organic-like writing form, write every ad in the competitor's long style with a code-built premium table and per-Page contacts, and give every tool one home.

**Architecture:**
- **Figures:** the premium table and the headline figures come from the existing numbers-cases engines, through a new per-plan ladder. A model writes only the words.
- **Writing a round:** reuses Organic's planner (`plan()` in `src/lib/content/write.ts`) plus a new long-ad writer, then assembles the ad in code.
- **UI:** keeps the one-page three-column shell, with the tools and the desk reorganised as in the spec's Layout section.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase (service-role tables `ins_*`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-ads-studio-long-ads-design.md`. Read it before every task.

## Global Constraints

- Every figure in an ad comes from the code: the table, the headline figures, and the contacts. A model never writes a premium.
- No unprovable superlatives in the writer's rules or output: อันดับ 1, ขายดีที่สุด, คุ้มที่สุด, ถูกที่สุด, กล้าเทียบทุกบริษัท.
- Premium cell format: `🙆‍♀️ หญิง = 9,060 บาท/ปี (ตกเดือนละ 755)` and `🕵️‍♂️ ชาย = …`. ตกเดือนละ = ceil(annual baht ÷ 12).
- Prefix the line with `เบี้ยปีแรก` for legacy, cancer, ci123 and iHealthy.
- `primaryText` is at most 2,200 characters. The 125-character fold still shows on the card.
- Round inputs:
  - Age: an integer from 0 to 80, 30 by default.
  - Count: 1 to 4.
  - Angle: Organic's `anglesFor("ad", href)` (which already drops ตัวเลขชัดๆ), "", or "custom" with `custom` ≤ 120.
  - Reader: ≤ `MAX_READER`.
- Page contacts: `agent_name` ≤ 60, `line_id` ≤ 40, `inbox_url` ≤ 200 and must start with `https://`. The Inbox default is `https://m.me/<pageId>`.
- Ladders: copy them verbatim from the table in Task 1.
- Tabs are ร่าง · ส่งแล้ว · ถังขยะ. Ticks are client-only.
- Run the term text through `lifelong()` (`src/lib/content/wording.ts`), as sheets are.
- `ins_ad_campaign.dimensions` / `queue_pos` and `ins_ad_launch` stay in the database. Nothing is dropped.
- `MAX_ANGLES` / `MAX_TONES` stay, because Organic Studio uses them. Only the unused matrix functions and banks go.
- Thai UI copy as given. Match the surrounding code's comment density and naming.

## Review Focus

1. **An age that prices only some rungs or one sex.** For example, iShield WLCI10 sells only to 51, so at 55 nothing prices. Rows with nothing priced are dropped and a missing sex line is left out. When the table is empty, the round is refused before payment. Tests: Task 1, Task 4.
2. **The owner edits an ad later.** The table's figures must stay allowed, because `output.figures` holds them. Test: Task 4.
3. **Contacts typed loosely.** A Line ID with a leading @ or spaces is kept trimmed. An `http://` or `javascript:` inbox is refused. An empty form clears the row. Test: Task 2.
4. **Pieces approved before this change (status `used`).** They show in ร่าง, can be ticked, and send. Tests: Task 5, Task 7.
5. **A ticked piece binned or sent in another tab meanwhile.** The server leaves it out with a reason and does not send it. Test: Task 5.

---

### Task 1: Ladders and the premium table

**Files:**
- Modify: `src/lib/content/numbers.ts`. Add `annualSatang: number` to `NumberSheet`. Add an optional `ladder` to `definePlan` and `PricedPlan`.
- Modify: each `src/lib/content/numbers-cases/*.ts`. Fill `annualSatang` in `price()` from the `PriceLines.annualSatang` it already computes (pension: `annual.quote.annualPremium * 100`). Add the ladder.
- Create: `src/lib/content/premium-table.ts`
- Test: `tests/content/premium-table.test.ts`

**Interfaces:**
- Produces:
  - `PricedPlan.ladder?: { term: string; firstYear: boolean; rungs: number; price(rung: number, sex: "M" | "F", age: number, today: Date): NumberSheet | null }`
  - `definePlan` gains `ladder?: { term: string; firstYear: boolean; rungs: Omit<C, "sex" | "age">[] }`.
  - `interface PremiumRow { heading: string; female: number | null; male: number | null }`. The numbers are annual baht.
  - `interface PremiumTable { product: string; age: number; term: string; firstYear: boolean; rows: PremiumRow[] }`
  - `premiumTable(href: string, age: number, today?: Date): PremiumTable | null`. It returns null when the plan has no ladder or every row is empty.
  - `tableText(t: PremiumTable): string`. These are the exact lines of the ad's table block.
  - `headlineFigures(t: PremiumTable): string`. Two lines: sum and premium, taken from the middle row (`rows[Math.floor((rows.length - 1) / 2)]`), female, or male when female is null.

Ladders (rungs are the case fields besides sex and age):

| href | rungs | term (before `lifelong()`) | firstYear |
|---|---|---|---|
| /legacy | tier 1, 2, 3, 5 | `จ่ายเบี้ยถึงอายุ 99` | true |
| /lifeprotect | sum 1M, 2M, 3M, 5M · term WLF19H | `จ่าย 19 ปี คุ้มครองถึงอายุ 99` | false |
| /plb | sum 1M, 2M, 3M, 5M · term PLB10 | `จ่าย 10 ปี คุ้มครอง 10 ปี` | false |
| /easyprotect | sum 0.5M, 1M, 2M, 3M | `จ่าย 6 ปี คุ้มครองถึงอายุ 99` | false |
| /lifetreasure | sum 10M, 15M, 20M, 30M · term H99F12A | `จ่าย 12 ปี คุ้มครองถึงอายุ 99` | false |
| /ishield | sum 0.5M, 1M, 2M, 3M · term WLCI10 | `จ่าย 10 ปี คุ้มครองถึงอายุ 85` | false |
| /ci123 | tier 1, 2, 3, 6 | `จ่ายเบี้ยถึงอายุ 99` | true |
| /cancer | tier 1, 2, 4, 6 | `จ่ายเบี้ยถึงอายุ 99` | true |
| /ihealthy-ultra (Thai only) | plan SMART, BRONZE, SILVER, GOLD | `จ่ายเบี้ยถึงอายุ 99` | true |
| /bumnan95 | monthly 5,000 / 10,000 / 20,000 / 30,000 · from 60 | `จ่ายถึงอายุ 60 รับบำนาญตั้งแต่ 60` | false |

`heading` is the female sheet's `sumLine`, or the male one's when there is no female sheet. Price each rung with the plan's own claim list as `claims`.

- [ ] **Step 1: Write the failing tests** in `tests/content/premium-table.test.ts`. Use `today = new Date("2026-10-05")`.
  - `every NUMBERS_PLANS href has a ladder with 4 rungs`
  - `legacy at 30 has 4 rows, both sexes priced, and female < male in each row`
  - `each cell equals the engine`: `annual` = the sheet's `annualSatang / 100` for that rung, sex and age.
  - `tableText formats a row`: it contains `` `🙆‍♀️ หญิง = ${money(f)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(f / 12))})` `` and starts the block with the row heading.
  - `firstYear plans say เบี้ยปีแรก`: legacy's text contains `เบี้ยปีแรก`; lifeprotect's does not.
  - `ishield at 55 gives null`. Review Focus 1.
  - `an age off some rungs drops only those rows`: pick a plan and age where the engine refuses one rung; assert `rows.length < 4 && rows.length > 0`.
  - `a row priced for one sex only keeps the other null and tableText omits that line`. Use a stub ladder through `definePlan` in the test.
  - `headlineFigures uses the middle row, female first`.
  - `the term passes through lifelong()`: lifeprotect's term contains ตลอดชีพ and not `99`.
- [ ] **Step 2: Run** `npx vitest run tests/content/premium-table.test.ts`. Expected: FAIL, the module is not found.
- [ ] **Step 3: Implement.** Add the ladder support in `definePlan`, `annualSatang` in every `price()`, the ladders above, and `premium-table.ts`. Existing numbers-post tests must keep passing. `annualSatang` is additive.
- [ ] **Step 4: Run** `npx vitest run tests/content` and expect PASS.
- [ ] **Step 5: Commit** `feat(ads): premium table from each plan's ladder`

### Task 2: Page contacts

**Files:**
- Create: `supabase/migrations/20261009_page_contact.sql`. Table `ins_page_contact`: `page_id text primary key`, `agent_name text check (char_length ≤ 60)`, `line_id text (≤ 40)`, `inbox_url text (≤ 200, ^https://)`, `updated_at timestamptz not null default now()`. RLS on, revoke from public/anon/authenticated, grant to service_role. Follow the pattern of `20261004_page_welcome.sql`.
- Create: `src/lib/ads/page-contact.ts`. The pure part plus the store, in the style of `campaign-store.ts`.
- Modify: `src/app/studio/ads/actions.ts`. Add the actions.
- Test: `tests/ads/page-contact.test.ts`

**Interfaces:**
- Produces:
  - `interface PageContact { agentName: string | null; lineId: string | null; inboxUrl: string | null }`
  - `cleanContact(v: unknown): PageContact | { error: string }`
    - Trims all three fields.
    - Strips one leading `@` from `lineId` and removes inner spaces.
    - `inboxUrl` must parse as a URL with the `https:` protocol, otherwise `{ error: "ลิงก์ Inbox ต้องขึ้นต้นด้วย https://" }`.
    - Cuts to the lengths.
    - An empty string becomes null.
  - `contactBlock(c: PageContact | null): string`. Lines: `👉 ${agentName}`, `📲 Line: @${lineId}`, `👉 Inbox: ${inboxUrl}`, each only when set. When all three are null it returns `ทักแชทได้เลย`.
  - `getPageContact(pageId: string): Promise<PageContact | null>`
  - `savePageContact(pageId: string, c: PageContact): Promise<void>`. When all three fields are null, it deletes the row.
  - Server actions, both owner-only and only for one of the owner's connected Pages (`myPages()`):
    - `pageContact(pageId: string): Promise<{ ok: true; contact: PageContact | null } | { ok: false; error: string }>`
    - `updatePageContact(pageId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests:**
  - `cleanContact` trims and strips `@`: `"  @team paui "` becomes `"teampaui"`.
  - It refuses `http://x`, `javascript:alert(1)` and `m.me/x`.
  - It turns empty strings into null.
  - `contactBlock` with all fields set, with only the Line ID, and with none (`ทักแชทได้เลย`).
  - `updatePageContact` refuses a Page that is not the owner's, and writes nothing.
  - `savePageContact` with all fields null deletes the row.
  - The migration text includes the three checks, `enable row level security` and `grant all on public.ins_page_contact to service_role`.
  - Mock the database as in `tests/ads/campaign-store.test.ts`.
- [ ] **Step 2: Run** `npx vitest run tests/ads/page-contact.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, `page-contact.ts`, and the two actions.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ads): contacts kept per Page`

### Task 3: The long-ad writer and assembly

**Files:**
- Modify: `src/lib/content/ads.ts`.
  - Add `longAdMessages`, `parseLongAd` and `assembleLongAd`.
  - Remove `variantAdMessages`, `matrixMessages`, `parseMatrix`, `matrixCells`, `adCopyMessages`, `fallbackMatrix`, `ANGLE_BANK`, `TONE_BANK`, `AdAngle`, `AdTone`, `AdMatrix` and `AdCell`.
  - Keep `MAX_ANGLES`, `MAX_TONES`, `AD_LIMITS` and `parseAdCopy`, but only if anything still imports it after this task; otherwise remove it.
- Modify: `src/lib/content/write.ts`. Replace `writeAdVariants` with `writeLongAds`.
- Test: `tests/content/long-ad.test.ts`. Delete `tests/content/ad-variants.test.ts`, and trim `tests/content/ads.test.ts` to what remains.

**Interfaces:**
- Consumes: `PremiumTable`, `tableText` and `headlineFigures` (Task 1); `contactBlock` (Task 2); `PiecePlan` (`src/lib/content/plan.ts`).
- Produces:
  - `longAdMessages(brief: string, p: PiecePlan, ctx: Omit<LongAdContext, "contact">): ChatMessage[]`
    - The system prompt keeps `CORE_RULES`, `POSTER_JSON`, `POSTER_RULES` and the headline/description limits from `adSystem()`, and adds:
      - the long-format rules: an opening that stands alone in 125 characters, 5–8 bullets each starting with 🥇, one line inviting a free premium check by sex and age, and 6–12 hashtags;
      - "ห้ามเขียนเบี้ยหรือตัวเลขเบี้ยใดๆ ระบบใส่ตารางเบี้ยให้เอง";
      - the superlative ban.
    - The reply shape is `{"opening":"…","bullets":["…"],"cta":"…","hashtags":["#…"],"headline":"…","description":"…",<poster>}`.
  - `interface LongAd { opening: string; bullets: string[]; cta: string; hashtags: string[]; headline: string; description: string; imagePrompt: string; poster: unknown }`
  - `parseLongAd(reply: string): LongAd | null`
    - Returns null without an opening or a headline.
    - Keeps at most 8 bullets. A bullet missing 🥇 gets it prefixed.
    - Adds `#` to hashtags that lack it, and keeps at most 12.
  - `assembleLongAd(ad: LongAd, figures: { headline: string; table: string; contact: string }): string`
    - Order: opening, headline figures, bullets, table, cta, contact, hashtags.
    - Blocks are joined with `"\n.\n"`, the competitor's spacer. Hashtags go on one line, space-separated.
    - The result is cut to 2,200 characters at a line boundary, dropping hashtags first.
  - `interface LongAdContext { table: string; headline: string; contact: string; reader: string; focus: string; voice: string }`. The model is shown everything except `contact`. `longAdMessages` takes `Omit<LongAdContext, "contact">`.
  - `writeLongAds(opts: { brief: string; plans: PiecePlan[]; ctx: LongAdContext; prefer?: string; clock?: Deadline; saveMs?: number }): Promise<Round>`
    - It has the same shape and timing as `writeAdVariants`.
    - It assembles each piece with `assembleLongAd(ad, { headline: ctx.headline, table: ctx.table, contact: ctx.contact })`.
    - Each piece's `output`:
      - `hooks: [headline]`, `body: assembled`, `closing: description`, `angle: plan.angle`, `hashtags: []`, `imagePrompt`, `disclaimer: DISCLAIMER`, and `poster` when present.
      - `ad: { angle: plan.angle, tone: "" }`. The round fills in `reader` and `age` (Task 4).

- [ ] **Step 1: Write the failing tests:**
  - The system prompt of `longAdMessages` contains `ห้ามเขียนเบี้ย`, `🥇` and each banned superlative.
  - The user message contains the table text and the plan's hook.
  - `parseLongAd`:
    - prefixes 🥇;
    - cuts the bullets to 8;
    - adds `#` to hashtags;
    - returns null without a headline.
  - `assembleLongAd`:
    - puts the blocks in order;
    - keeps the table verbatim, including every figure;
    - keeps the result under 2,200 characters, dropping hashtags first when it is too long.
- [ ] **Step 2: Run** `npx vitest run tests/content/long-ad.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then delete the removed functions and their tests. `npx tsc --noEmit -p .` must still compile everywhere except `src/app/studio/actions.ts`, which Task 4 fixes.
- [ ] **Step 4: Run** `npx vitest run tests/content`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ads): long-form ad writer with code-placed figures`

### Task 4: The campaign round on the server

**Files:**
- Modify: `src/app/studio/actions.ts` (`generateContent`'s ad branch, `GenerateInput`).
  - Remove `AdQueue`, `madeCombos`, `saveAdRound` and `nextVariants`.
  - Remove the ad-only use of `adAngles` / `adTones`, but only if Organic no longer sends them for format "ad". Otherwise leave them.
- Test: `tests/ads/campaign-write.test.ts`. Rewrite it for the new round.

**Interfaces:**
- Consumes: Tasks 1–3, `plan()` from `src/lib/content/write.ts`, and `getCampaign` / `listCampaignPieces` from `src/lib/ads/campaign-store.ts`.
- Produces:
  - `GenerateInput` for an ad: `{ format: "ad", campaignId, count, angle, custom, reader, age }`. Every other field is read from the campaign.
  - The saved piece's `output.ad` is `{ angle, tone: "", reader, age }`. Extend the `ad` type in `src/lib/content/output.ts` with `reader?: string; age?: number`, and drop `hook/persona/style/combo` from new writes. Keep them optional for old pieces.
  - `output.figures` = `tableText(table) + "\n" + headlineFigures(table)`.

Order inside the ad branch:
1. Check the owner, the campaign, and that its Page is connected.
2. Clean the inputs to the Global Constraints.
3. `premiumTable(campaign.planHref, age)`. If it is null, return `{ ok: false, error: \`อายุ ${age} ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น\` }`. This happens before `perHour`, `takeRound` and any hold.
4. Hold the budget as today.
5. Call `plan()` with:
   - `count` and `angle: angleText(angle, custom)`;
   - `avoid` = the campaign's earlier `hooks[0]`s, plus `usedHooks()`;
   - `reader`, and `goal: ""`, `fact: ""`, `lang: "th"`;
   - the campaign's `hint`, prefixed to the angle text when set.
6. Call `writeLongAds` with `ctx = { table: tableText(table), headline: headlineFigures(table), contact: contactBlock(await getPageContact(campaign.pageId)), reader, focus: hint, voice: brandVoice }`.
7. Run `flagsFor(output, "th", \`${brief.text}\n${figures}\`, words, null)`.
8. Save with `campaignId` and `dressed(output)`, through `saveAll` and `roundResult`.

- [ ] **Step 1: Write the failing tests.** Mock the AI as the existing `campaign-write.test.ts` does.
  - A round of 2 saves 2 ads whose body contains `tableText`.
  - `output.figures` is set, and `output.ad` carries `{ reader, age }`.
  - An age where `premiumTable` is null returns the age message, and `takeRound` and the AI are not called. Review Focus 1.
  - `avoid` passed to the planner includes the campaign's earlier headlines.
  - Saving an edit of the body that keeps the table produces no number flag. Review Focus 2: call `saveContentEdits` on the saved piece with the body unchanged, and assert no figure flags.
  - The count is clamped to 1–4 and the age to 0–80 (31.7 becomes 31; "x" becomes 30).
- [ ] **Step 2: Run** `npx vitest run tests/ads/campaign-write.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/ads tests/content` and `npx tsc --noEmit -p .` (ignore `.next*` noise). Expected: PASS, and no errors in `src/app/studio/actions.ts`.
- [ ] **Step 5: Commit** `feat(ads): a round writes long ads from the planner and the premium table`

### Task 5: Campaign and send actions without dimensions, approval or legacy launches

**Files:**
- Modify: `src/app/studio/ads/actions.ts`
  - `createAdCampaign`: no `dimensions`, and no `DIMENSIONS_SHORT`.
  - Remove `analyzeCampaignDraft`, `analyzeCampaign`, `queueOf`, `QueueView`, the `madeCombos` copy, `variantOf`, the `legacy` field of the room, `launchAd`, `activateAd` and `pauseAd`.
  - `sendApproved`: accept a piece whose status is `draft` or `used`, refuse `trashed`, and refuse one already sent, as now.
  - `picturePending` becomes `p.output.poster && !p.output.poster.background`.
- Modify: `src/lib/ads/campaign-store.ts`. Drop `dimensions`, `queuePos` and `Dimension(s)` from the type and the writes. Leave the columns.
- Modify: `src/lib/ads/campaign-view.ts`. `AdTab` is `"draft" | "sent" | "trash"`, and `adTab` maps `used` to `draft`. `tabCounts` follows.
- Modify: `src/lib/ads/room-view.ts`. `picturePending` takes `{ poster }` only. `sendBlocker({ ticked, … })` says `ติ๊กเลือกแอดในแท็บร่างก่อน` when nothing is ticked.
- Modify: `src/lib/ads/sent-view.ts`. Remove `legacyButtons` and its helpers when nothing uses them.
- Delete: `src/lib/ads/dimensions.ts`, `src/lib/ads/dimension-edit.ts`, `src/lib/ads/analyze.ts`, and their tests (`tests/ads/dimensions.test.ts`, `tests/ads/dimension-edit.test.ts`, `tests/ads/analyze.test.ts`).
- Modify tests: `tests/ads/studio-flow-actions.test.ts`, `tests/ads/launch-actions.test.ts`, `tests/ads/campaign-store.test.ts`, `tests/ads/campaign-view.test.ts`, `tests/ads/room-view.test.ts`, `tests/ads/sent-view.test.ts`.

**Interfaces:**
- Produces:
  - `CampaignInput = { pageId; planHref; name?; hint?; brandVoice?; theme?; writer?; painter?; person?; pictureBrief? }`
  - `AdCampaignRoom` without `queue` and `legacy`.
  - `RoomPiece.tab: "draft" | "sent" | "trash"`
  - `sendBlocker(s: { ticked: number; accounts; thIdentity; pageConnected }): string | null`

- [ ] **Step 1: Update and write the failing tests:**
  - `createAdCampaign` without dimensions succeeds.
  - `adTab({status:"used"}, false)` is `"draft"`.
  - `sendApproved` sends `draft` and `used` pieces, leaves out a `trashed` one with its reason, and leaves out an already-sent one. Review Focus 4 and 5.
  - `picturePending` is true for a poster without a background, whatever `ad` holds.
  - `sendBlocker` with `ticked: 0` says `ติ๊กเลือกแอดในแท็บร่างก่อน`.
- [ ] **Step 2: Run** `npx vitest run tests/ads`. Expected: FAIL where the behaviour changed.
- [ ] **Step 3: Implement and delete.**
- [ ] **Step 4: Run** `npx vitest run tests/ads tests/content`. Expected: PASS. Run `npx tsc --noEmit -p .`. Only the UI files that Tasks 6–7 rewrite may still error.
- [ ] **Step 5: Commit** `refactor(ads): no dimensions, approval step or one-by-one launches`

### Task 6: Tools column

**Files:**
- Create: `src/app/studio/ads/NewCampaignForm.tsx`. One page: plan, name, focus, voice, `PictureFields`, and **สร้างแคมเปญ**. On success, `router.push(\`/studio/ads?campaign=${id}\`)`.
- Create: `src/app/studio/ads/WriteForm.tsx`
  - **มุมที่อยากเล่า**: `anglesFor("ad", planHref)` + ให้ AI เลือก + พิมพ์เอง…
  - **คนอ่านคือใคร**: `NICHES` chips + text.
  - **อายุในตารางเบี้ย**: a number from 0 to 80. Remember it in localStorage under the key `ads-table-age`.
  - The press: reuse `PressBar` from `src/app/studio/ui/form-parts.tsx`, with max 4, unit แอด, and the note `adRoundCost(count, picks)`.
- Create: `src/app/studio/ads/PageSettings.tsx`. A fold with two parts:
  - ช่องทางติดต่อ: three inputs and บันทึก, which calls `updatePageContact`. The Inbox field is prefilled with `https://m.me/<pageId>` when nothing is saved, and the fold shows the warning tone until something is saved.
  - บัญชีโฆษณา: `ConnectBar`'s contents moved in, with the same props and behaviour.
- Modify:
  - `CampaignSettings.tsx`: folded by default; no dimensions, no write button, no `Analyse`.
  - `CampaignRoom.tsx`: the tools are the pickers, then `WriteForm`, then `CampaignSettings`, then `PageSettings`. `write()` sends `{ angle, custom, reader, age, count }`. Every new piece goes on the drawing line, drawn with `pictureRequest("", campaign.pictureBrief)`. An empty request lets the drawing choose the look, as Organic does.
  - `AdsStudio.tsx`: remove the `ConnectBar` strip. The "new" view uses `NewCampaignForm` and `PageSettings`.
  - `page.tsx`: load `pageContact` for the Page.
- Delete: `NewCampaignWizard.tsx`, `DimensionsEditor.tsx`, `QueueBar.tsx`, `ConnectBar.tsx` (after its contents move).
- Test: `tests/ads/studio-view.test.ts`, extended where its pure helpers change. The UI itself is checked in Task 8.

**Interfaces:**
- Consumes: `pageContact` / `updatePageContact` (Task 2), the ad `GenerateInput` (Task 4), `CampaignInput` (Task 5), and `PictureFields` / `adRoundCost` (existing).
- Produces: `WriteForm` props `{ planHref: string; picks: { writer; painter; person }; writing: boolean; disabled: boolean; onWrite(input: { angle: string; custom: string; reader: string; age: number; count: number }): void }`.

- [ ] **Step 1: Implement the components and wire them.**
- [ ] **Step 2: Run** `npx tsc --noEmit -p .` and `npx eslint src/app/studio/ads`. Expected: clean.
- [ ] **Step 3: Run** `npx vitest run tests/ads`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(ads): tools column — new campaign in one page, writing form, Page settings`

### Task 7: Desk — tabs, ticks, send

**Files:**
- Modify: `CampaignRoom.tsx`.
  - The tabs are ร่าง / ส่งแล้ว / ถังขยะ.
  - `ticked: Set<string>` lives in state. Clear it on a send, and drop ids that leave ร่าง after a refresh.
  - The button reads `ส่งขึ้น Facebook (${ticked.size})`.
  - Remove the rail column: `Columns` without `rail`, or `rail={null}`. Make `Columns` accept that.
- Modify: `AdCard.tsx`.
  - In ร่าง, the card shows a checkbox labelled `เลือกส่ง` and ✕ ทิ้ง.
  - Remove ✓ อนุมัติ / ยกเลิกอนุมัติ, the dimension chips, and the legacy launch step label.
  - Show `output.ad.age` as a small chip `ตาราง อายุ N` when it is present.
- Modify: `SendDialog.tsx`. It takes the ticked pieces. Show the account select only when more than one THB account exists; otherwise use the single one. Update the blocker copy.
- Modify: `SentTab.tsx`. Remove the legacy list.
- Delete: `SentRail.tsx`.
- Test: `tests/ads/room-view.test.ts`. Add `pruneTicks(ticked: Set<string>, draftIds: string[]): Set<string>` to `src/lib/ads/room-view.ts` and test it. Ids no longer in ร่าง drop out. Review Focus 5 on the client side.

- [ ] **Step 1: Write the failing test** for `pruneTicks`: `{a,b,c}` with drafts `[a,c]` gives `{a,c}`, and an empty draft list gives an empty set.
- [ ] **Step 2: Run** `npx vitest run tests/ads/room-view.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `pruneTicks` and the UI changes.
- [ ] **Step 4: Run** `npx vitest run tests/ads`, `npx tsc --noEmit -p .` and `npx eslint src/app/studio/ads`. Expected: clean.
- [ ] **Step 5: Commit** `feat(ads): tick drafts to send; tabs ร่าง · ส่งแล้ว · ถังขยะ; no rail`

### Task 8: Verify end to end

`.env.local` points at the production database. Do not press สร้างแคมเปญ, สร้าง, บันทึก or send in the browser. Look only.

- [ ] **Step 1:** Run the full suite with `npx vitest run`. Expected: everything passes except the known `tests/chat/session-turn.test.ts`.
- [ ] **Step 2:** Run `NEXT_DIST_DIR=.next-build npx next build`. Expected: success.
- [ ] **Step 3:** Start the `dev` preview and open `/studio/ads` at desktop width and at 375px. Check:
  - the new-campaign form;
  - ตั้งค่าเพจ, with both of its parts;
  - no ConnectBar strip;
  - no rail;
  - no console errors.
- [ ] **Step 4:** Render one assembled ad without the browser. Run a one-off script under the scratchpad that calls `premiumTable("/legacy", 30)`, `tableText`, `headlineFigures` and `assembleLongAd` with a fixed `LongAd`. Send its text to the owner to look at.
- [ ] **Step 5:** Grep for leftovers: `grep -rn "dimension\|QueueBar\|SentRail\|อนุมัติแล้ว\|ConnectBar" src/app/studio/ads src/lib/ads`. Expected: no live uses. Comments that explain the history are fine.
- [ ] **Step 6:** Commit any fixes with `fix(ads): …`.

Rollout is not part of this plan. Applying `20261009_page_contact` to prod, merging and pushing each wait for the owner's go-ahead, per `production-rollout`.
