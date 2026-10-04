# Ads Studio: long-form ads with a premium table, no dimensions

Date: 2026-10-05 · Owner request, agreed in chat · Builds on the one-page Ads Studio (c80c62e1)

## Why

The owner finds the four dimensions (hooks × personas × angles × styles) fiddly, does not use them,
and wants Ads Studio to work like Organic Studio. The owner also wants every ad written in a
competitor's long style: a headline with the sum and the premium, benefits as emoji bullets, a
premium table by coverage level × sex, a "check your premium free" line, the agent's contacts,
and hashtags.

## What changes, in one paragraph

Dimensions, the combination queue and the AI analysis are removed. A new campaign is one page
(plan, name, focus, voice, ภาพและโมเดล). In the campaign room, the tools column is a writing
form like Organic Studio's: the angle, who the reader is, the age for the premium table, and how
many ads (1–4). Every ad is long-form: the words are the AI's, every figure is the code's, and
the agent's contacts come from the Page's own settings.

## The owner's view

### New campaign (replaces the three-step wizard)

One form in the tools column: แบบประกัน, ชื่อแคมเปญ, สิ่งที่อยากเน้น, น้ำเสียงแบรนด์ (all but
the plan optional), the ภาพและโมเดล fold (unchanged), and **สร้างแคมเปญ**. Pressing it makes the
campaign and opens its room. It does not write any ads.

### Campaign room, tools column

From top to bottom:

1. The Page and campaign pickers (unchanged).
2. **ช่องทางติดต่อของเพจ** (inside ตั้งค่าเพจ, see Layout): a small fold per Page with ชื่อตัวแทน, Line ID, and an Inbox link
   (prefilled with `https://m.me/<pageId>`). It is saved per Page and shared by all campaigns.
   When it is empty, the fold says so in the warning colour.
3. **The writing form**:
   - **มุมที่อยากเล่า**: ให้ AI เลือก / Organic's angle list without ตัวเลขชัดๆ / พิมพ์เอง.
     With ให้ AI เลือก, each ad in the round takes a different angle. With a chosen angle,
     they all take it, with different openings.
   - **คนอ่านคือใคร**: Organic's chips (ทุกคน, the niches) or typed text.
   - **อายุในตารางเบี้ย**: a number, 30 by default. Every ad in the round is priced at this age.
     The form remembers the last value in this browser.
   - **The press**: − / + for 1–4 ads, the price estimate (adRoundCost), and สร้าง N โฆษณา.
4. **ตั้งค่าแคมเปญ**, folded: ชื่อ, สิ่งที่อยากเน้น, น้ำเสียง, ภาพและโมเดล, ลบแคมเปญนี้.

### Removed

The dimensions editor, the queue strip (QueueBar), "ให้ AI วิเคราะห์มิติ", the wizard's steps 2
and 3, and the dimension chips on ad cards.

### Unchanged

ส่งขึ้น Facebook and its three objectives, the sent tab's เปิดใช้ทั้งชุด / หยุดทั้งชุด / ลองใหม่,
the ad editor, and drawing with the campaign's picks. For the tabs and the rail, see Layout below.

## Layout: one place per tool (owner, 2026-10-05)

The flow is: set up once per Page → pick a campaign → write → check in ร่าง → send → watch in
ส่งแล้ว → write more. Every tool has exactly one home.

**Tools column (left), top to bottom**

1. เพจ + แคมเปญ pickers.
2. The writing form, with the press pinned at the foot of the column.
3. **ตั้งค่าแคมเปญ** (folded): ชื่อ, สิ่งที่อยากเน้น, น้ำเสียง, ภาพและโมเดล, ลบแคมเปญนี้.
4. **ตั้งค่าเพจ** (folded): ช่องทางติดต่อ, and the ad-account connection. The ad-account
   connection moves here from the strip above the columns, and the strip is removed.

**Desk (right)**

- Tabs: **ร่าง · ส่งแล้ว · ถังขยะ**, with ส่งขึ้น Facebook (N) at the end of the row.
- Ad cards. A card in ร่าง has a tick (เลือกส่ง), ทิ้ง, and a press that opens the editor.
- The send dialog: objective, ad account (only when there is more than one), budget, and the
  ticked pieces.
- The editor opens full screen over the page, as today.

**Removed as duplicates or unused**

| Removed | Why | Instead |
|---|---|---|
| The ส่งแล้ว rail on the right | It only led to the ส่งแล้ว tab | The tab |
| The ทั้งหมด tab | It repeats the other tabs | ร่าง |
| ✓ อนุมัติ and the อนุมัติแล้ว tab | Approving and then sending is one choice made twice | Tick on the ร่าง cards; ส่งขึ้น Facebook (N) counts the ticks |
| The ad-account strip above the columns | The account is also chosen in the send dialog | ตั้งค่าเพจ; the dialog asks only when there are 2+ accounts |
| The old one-by-one launches in ส่งแล้ว | A system no longer used; prod has none | Nothing |

**Ticks**

- Ticks live in the page only and are not saved. They start empty. ส่งขึ้น Facebook is shut
  until something is ticked.
- The send takes the ticked drafts. A ticked piece still waiting for its picture is shown in the
  dialog as left out, as today.
- Pieces approved earlier (status `used`) show in ร่าง like any draft.
- The server's send accepts drafts and `used` pieces that have not been sent, and refuses
  anything binned or already sent, as it does now.

## The ad itself

`primaryText` is put together in this order. **Bold** parts are written by the code and never by
a model.

| # | Part | Source |
|---|---|---|
| 1 | Opening, 1–2 lines; the first 125 characters must stand alone | AI, from the planner's hook for this ad |
| 2 | **Headline figures**: product name, sum, premium, e.g. `💁‍♀️ คุ้มครองชีวิต 3,000,000 บาท` / `💰 ออมเพียง 9,060 บาท/ปี` | code, from one row of the table (the middle rung, female) |
| 3 | Benefit bullets, 🥇 each, 5–8 lines | AI, from the product brief only |
| 4 | **Premium table** | code (see below) |
| 5 | "Check your premium free" line, e.g. ทักแชทเช็คเบี้ยฟรี แจ้งเพศ อายุ | AI |
| 6 | **Contacts**: 👉 name · 📲 Line: … · 👉 Inbox: … | code, from the Page's contacts |
| 7 | Hashtags, 6–12 | AI |

`headline` and `description` (Meta's short fields), the poster, and `imagePrompt` are written as
they are today.

### The premium table

The table is built for the chosen age, one block per rung of the plan's ladder:

```
แผนคุ้มครองมรดก 3,000,000 บาท
🙆‍♀️ หญิง = 9,060 บาท/ปี (ตกเดือนละ 755)
🕵️‍♂️ ชาย = 11,684 บาท/ปี (ตกเดือนละ 974)
```

- The yearly figure is the engine's annual premium.
- ตกเดือนละ is the annual premium ÷ 12, rounded up. This follows the same convention as ตกวันละ
  (÷ 365, rounded up). It is not the monthly-mode premium.
- The owner agreed to show the yearly figure in ads, which is an exception to the 2026-09-25
  rule. Organic posts keep that rule.
- Where the premium rises with age (legacy, cancer, ci123, iHealthy), the line says เบี้ยปีแรก.
- A rung the plan will not sell at that age or sex is left out. If no rung is left, the round is
  refused before anything is paid for, with: "อายุ N ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น".
- The table line says the term, e.g. "ชำระ 19 ปี คุ้มครองถึงอายุ 99", from the ladder's term.

### Ladders (owner to check)

There are four rungs per plan. Each plan has one fixed term.

| Plan | Level | Rungs | Term |
|---|---|---|---|
| มรดกเพื่อครอบครัว | tier | มรดก 1 / 2 / 3 / 5 ล้าน (tiers 1, 2, 3, 5) | premiums to 99 |
| Life Protect x 2 | sum | 1 / 2 / 3 / 5 ล้าน | WLF19H (19 years) |
| Protection Life | sum | 1 / 2 / 3 / 5 ล้าน | PLB10 (10 years) |
| Easy Protect 6 | sum | 0.5 / 1 / 2 / 3 ล้าน | W99F06A (6 years) |
| Life Treasure | sum | 10 / 15 / 20 / 30 ล้าน | H99F12A (12 years) |
| iShield | sum | 0.5 / 1 / 2 / 3 ล้าน | WLCI10 (10 years) |
| CI 123 | tier | CI 0.5 / 1 / 2 / 5 ล้าน (tiers 1, 2, 3, 6) | premiums to 99 |
| ชุดประกันมะเร็ง | tier | CPR 0.3 / 0.5 / 1 / 3 ล้าน (tiers 1, 2, 4, 6) | premiums to 99 |
| iHealthy Ultra | plan | สมาร์ท / บรอนซ์ / ซิลเวอร์ / โกลด์ (limits 3 / 10 / 15 / 25 ล้าน) | premiums to 99 |
| บำนาญ สมาร์ท 95 | monthly pension | 5,000 / 10,000 / 20,000 / 30,000 ต่อเดือน from 60 | until the pension starts |

The ladders live next to each plan's case in `src/lib/content/numbers-cases/`, and use the same
`price()` engines. To get the annual figure out, `NumberSheet` gains `annualSatang` (and
`firstYear`). A test checks that every plan in `NUMBERS_PLANS` has a ladder.

### Keeping figures true

- The writer is told the table and the headline figures as facts it may refer to. It must not
  restate any premium. The code places the figures.
- The number check (`flagsFor`) runs on the assembled text, with the brief plus the code's lines
  as the yardstick. A figure the AI wrote that is not in either is flagged red on the card, as it
  is today.
- New writer rule: no unprovable superlatives (อันดับ 1, ขายดีที่สุด, คุ้มที่สุด, ถูกที่สุด,
  กล้าเทียบทุกบริษัท). The existing policy check stays.
- Length: `primaryText` up to 2,200 characters. The card still marks the 125-character fold.

### How a round is written

1. Settle the inputs: campaign, Page, plan, angle, reader, age (an integer from 0 to 80), count
   (1–4).
2. Build the table for the age. If it is empty, refuse the round (no charge).
3. Run Organic's `plan()` with `count`, the angle, the reader, and the campaign's focus. `avoid` is
   the hooks of this campaign's earlier ads. This gives one {angle, hook} per ad.
4. One ad-writer call per plan, in parallel, with the table and headline figures as context.
5. Assemble, check, save as `format: "ad"` into the campaign.
6. Draw each picture with the campaign's painter, person and brief. Without a brief, the look is
   chosen as Organic Studio does.

## Data

- **New table `ins_page_contact`**: `page_id text primary key`, `agent_name text`, `line_id text`,
  `inbox_url text`, `updated_at`. RLS is on and it is service_role only, like the other ins_*
  tables. Lengths: 60 / 40 / 200. `inbox_url` must be https.
- **`ins_ad_campaign.dimensions` and `queue_pos`** are left in place and unread. Nothing is
  dropped, so the change can be undone.
- **Pieces**: new ads store `output.ad = { angle, reader, age }` instead of a combo. Old pieces
  keep what they have, and their cards no longer show dimension chips.
- **Picture**: an ad waits for its picture if it has none. The send leaves such a piece out, as
  it does now. This no longer depends on a style.

## Removed code

- `src/lib/ads/dimensions.ts`, `dimension-edit.ts`, `analyze.ts`
- `DimensionsEditor.tsx`, `QueueBar.tsx`
- The dimension paths in both server actions (`analyzeCampaign*`, `queueOf`, `madeCombos`,
  `saveAdRound`'s combo dedupe, `nextVariants`)
- `variantAdMessages` / `writeAdVariants`
- The unused angle × tone matrix (`matrixMessages`, `parseMatrix`, `matrixCells`, `adCopyMessages`,
  the banks)
- `SentRail.tsx`, the ทั้งหมด and อนุมัติแล้ว tabs, the card's ✓ อนุมัติ / ยกเลิกอนุมัติ
- `ConnectBar` as a strip (its contents move into ตั้งค่าเพจ)
- The legacy one-by-one launch list in the sent tab, and the actions that serve only it
  (`launchAd`, `activateAd`, `pauseAd`). `ins_ad_launch` stays in the database.
- Their tests

## Errors

| Case | What happens |
|---|---|
| Age off every rung, or rate tables expired (2027-03-31) | Refused before payment; the message names the age |
| Page has no contacts | The ad ends with "ทักแชทได้เลย" only; the contacts fold warns |
| Planner fails | Falls back as Organic does (its own fallback plans) |
| A writer call fails | That ad is missing and the round says "ได้ N จาก M ชิ้น", as today |
| Budget or ceiling reached | As today |

## Testing

- **Ladders**: every plan has one; every rung prices at age 30 for both sexes; the figures equal
  the engine's; an off-range age drops rungs and an all-off age gives an empty table.
- **Table text**: the exact lines for one plan (golden), with ตกเดือนละ = ceil(annual / 12) and
  เบี้ยปีแรก for age-priced plans.
- **Assembly**: the code's figures are present and verbatim; the contacts block is present or
  absent per Page; an AI premium figure not in the yardstick is flagged.
- **Actions**: a round with a bad age is refused uncharged; reader and angle are cleaned as in
  Organic; contacts are saved and validated (https only, lengths).
- **Ticks and send**: the send takes only ticked drafts; a binned or sent piece is refused; the
  button counts the ticks.
- **Browser**: a new campaign, the room form, ตั้งค่าเพจ, ticking and the send dialog, at
  desktop and 375px.

## Out of scope

- Choosing the term per round. Each plan uses the ladder's term.
- Editing the ladders in the UI.
- English (expat) ads.
- A poster made of the table. The poster stays as it is today.
