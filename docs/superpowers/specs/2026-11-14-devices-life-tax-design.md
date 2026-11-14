# คลังแอนิเมชัน — device round 2: ชีวิต โรคร้าย ภาษี มรดก

Owner, 2026-11-14, "ก ทุกข้อ" on mockup https://claude.ai/artifact/GhkRZPUcc6VgzkCDJvMjbs: 1ก the set of 8 below; 2ก three
new คลิปเล่าเรื่อง topics; 3ก the tax figures go in as the current law, shown to the owner as a table before the push.
Built exactly as round 1 (spec 2026-11-13-health-devices-design.md, plan 2026-11-13-health-devices.md, commits
b20c60cb..d4caf488): a device is a `KnowShow` layout drawn by `showBody` (paper, warm, line) and the info route
(plot, info, board, neon, blueprint), timed by `kspec`, words in `knowText`/`showText`.

## The rule that does not move

An AI never types a figure. A device's number fields are inputs (typed by the agent in the story form, or in the
คลิปตามโจทย์ brief, or from the plan the agent picked, or from the tax table below); derived figures (totals, gaps,
refunds) are computed by the drawer from those inputs, never supplied. Each number field is checked against its
sources (`checkDevice` / `deviceAllowed`, as round 1). A device whose numbers cannot be sourced falls back to its
words-only form.

## The eight devices

| key | ชื่อ | input fields (numbers) | words | drawn |
|---|---|---|---|---|
| `lifeneed` | ทุนชีวิตที่ควรมี | debts?, expenses? (per year), years?, education?, have? | title | stacked blocks (debts, expenses × years, education) with their amounts; card: ควรมีทุนรวม = sum; มีอยู่แล้ว = have; ขาดอีก = sum − have (red). Words-only: the blocks without figures and "ทุนชีวิตควรครอบคลุมหนี้และค่าใช้จ่ายของครอบครัว". |
| `beneficiary` | ผู้รับประโยชน์ | rows[].share? (%) | title, rows[].name (≤ 4) | a policy card, arrows to each person with name and share; shares, when all given, must total 100 (else drawn without %). Line: "ระบุชื่อและสัดส่วนในใบคำขอ". |
| `cilump` | เงินก้อนตอนวินิจฉัย | sum? | title, note | doctor's certificate → arrow → a stack of notes; card "จ่ายเป็นเงินก้อน" + sum; line "เมื่อแพทย์วินิจฉัยตามเงื่อนไขกรมธรรม์". sum from the iShield plan figure or typed. |
| `incomestop` | รายได้หยุดระหว่างรักษา | monthly?, months? | title | income line (green) broken by a dashed red gap labelled "หยุดรักษา N เดือน"; card "รายได้หาย monthly × months = lost". |
| `taxback` | ภาษีที่ได้คืนตามฐาน | premium?, bracket? (one of the table's rates) | title | the brackets as a ladder (5%…35%), each with premium-capped × rate; the agent's bracket highlighted; line "ฐานภาษี X% → ได้คืน Y". The deductible premium is capped at the life cap (100,000). |
| `taxcap` | เพดานลดหย่อนรวม | — (all from the table) | title | the table's rows; footer "ตามเกณฑ์กรมสรรพากร ตรวจสอบเงื่อนไขก่อนใช้สิทธิ". |
| `moneysplit` | แบ่งเงินให้คนในบ้าน | total?, parts[].amount? | title, parts[].label (≤ 3) | a sum splits to 2–3 boxes; amounts, when all given, must not exceed total. total from the plan's sum assured or typed. |
| `threegen` | ส่งต่อสามรุ่น | — | title, rows (3 generation labels), note | three generations with an arrow passing the money on; note line. |

All 8: three sizes, all seven looks (paper, warm, line, plot, board, neon, blueprint; the retired info look as plot's
code path draws it). Registry `src/lib/scene-library/devices.ts` gains them with `family` "ชีวิต ภาษี มรดก" and
`product` "life" (taxback, taxcap: "saving"? — no: keep the catalogue's product: lifeneed, beneficiary,
moneysplit, threegen = life; cilump, incomestop = health; taxback, taxcap = saving).

## The tax table (`src/lib/scene-library/tax-th.ts`, browser-safe)

Year label: **ปีภาษี 2569**. Personal income tax brackets on net income: 0–150,000 ยกเว้น; 150,001–300,000 5%;
300,001–500,000 10%; 500,001–750,000 15%; 750,001–1,000,000 20%; 1,000,001–2,000,000 25%; 2,000,001–5,000,000 30%;
over 5,000,000 35%. Deduction caps: เบี้ยประกันชีวิต (กรมธรรม์ 10 ปีขึ้นไป) 100,000; เบี้ยประกันสุขภาพตนเอง 25,000
(รวมกับประกันชีวิตไม่เกิน 100,000); เบี้ยประกันสุขภาพพ่อแม่ 15,000; เบี้ยประกันชีวิตแบบบำนาญ 15% ของเงินได้ ไม่เกิน
200,000 (รวมกับกองทุนเพื่อการเกษียณอื่นไม่เกิน 500,000). These are the controller's reading of current law; the
owner checks the table before the push and every figure lives only in this file.

## คลิปเล่าเรื่อง: a new shelf

`StoryShelf` gains `"money"`, name **ทุนชีวิต ภาษี มรดก**, and joins `INFO_SHELVES` (so plot and the three new looks are
offered). Three topics, five scenes each:
1. **ทุนชีวิตเท่าไหร่ถึงพอ** (`lifeneed`) — ask → lifeneed → beneficiary → moneysplit → recap. Form inputs (all
   optional, baht): หนี้คงเหลือ, ค่าใช้จ่ายครอบครัวต่อปี, จำนวนปีที่ต้องดูแล, ค่าการศึกษาลูก, ทุนประกันที่มีอยู่.
2. **ป่วยหนัก รายได้หายไปไหน** (`ciincome`) — ask → incomestop → cilump → list (ค่าใช้จ่ายที่ยังเดินระหว่างรักษา) →
   recap. Inputs: รายได้ต่อเดือน, จำนวนเดือนที่หยุดรักษา, ทุนโรคร้ายแรง.
3. **เบี้ยประกันลดหย่อนได้เท่าไหร่** (`taxback`) — ask → taxcap → taxback → note (เงื่อนไขกรมธรรม์ 10 ปี, แถลงในแบบ
   ภ.ง.ด.) → recap. Inputs: เบี้ยประกันชีวิตต่อปี, ฐานภาษี (chips of the table's rates).
Captions of these topics carry "ตัวเลขในคลิปเป็นตัวอย่างจากที่ตัวแทนกรอก" and, for the tax topic, "ตามเกณฑ์กรมสรรพากร
ปีภาษี 2569 ตรวจสอบเงื่อนไขก่อนใช้สิทธิ". Every word on screen and in the voice is plain Thai the owner can read; no
promise of returns; no "ปลอดภาษี" beyond the deduction itself.

## คลิปตามโจทย์

The writer's device list gains the eight (with `when` lines), their JSON fields and number sources: figures from the
brief, the plan figure, or the tax table (taxcap draws only from the table; taxback's bracket must be one of the
table's rates). The script editor shows the new devices' word fields and figures as round 1's do. Price unchanged
(a device scene is not a picture).

## The library

The eight catalogue entries (`device-beneficiary`, `device-life-sum-needed`, `device-ci-lump-sum`,
`device-ci-income-stops`, `device-tax-refund-by-bracket`, `device-tax-cap-total`, `device-split-money-home`,
`device-three-generations`) become ready, each with the seven-look switcher and stills
`/library/<key>-<look>.jpg` (8 × 7 = 56 new JPEGs), linking to their story topic (threegen: the lifeneed topic) and
คลิปตามโจทย์.

## Shipping

One REMOTION_DRAWING change; prepare samples (each new topic in paper + one other look, one prompt clip with new
devices); before the push the owner sees: the tax table, stills of the 8 in all looks, sample clips. No database
change.

## Tests

Per device: kspec/knowText, number sourcing (typed, plan, table, words-only fallback, shares total 100, split ≤
total), derived figures computed (never read from AI fields), draws in every look and size without throwing, readable
words. Tax table values pinned. Topics: episodes, form inputs, checkedStory. Prompt: writer parsing, checks, editor.
Catalogue ready + previews on disk.
