# คลังแอนิเมชัน — device round 4: ออมเงินและเกษียณ

Owner, 2026-11-15, "ก ทุกข้อ" on mockup https://claude.ai/artifact/1nafbw1BhKjpotwszE5x4P:
1ก figures in baht only (no %, no IRR, no word ผลตอบแทน); 2ก fund risk 1–8 and portfolio mix held back (no fund
product in the app); 3ก a new คลิปเล่าเรื่อง topic "เก็บเงินไว้ใช้ตอนเกษียณ". Built exactly as rounds 1–3 (specs
2026-11-13-health-devices-design.md, 2026-11-14-devices-life-tax-design.md, 2026-11-15-devices-metaphor-design.md): a
device is a `KnowShow` layout drawn by `showBody` (paper, warm, line) and the info route (plot, info, board, neon,
blueprint) through the Kit, timed by `kspec`, words in `knowText`/`showText`.

## The rules that do not move

- An AI never types a figure (round 2's rule). Every number on these devices comes from the บำนาญ สมาร์ท 95 engine
  (`src/calc/pension/engine.ts`, the same one /bumnan95 uses) in คลิปเล่าเรื่อง, or from the brief's own numbers in
  คลิปตามโจทย์ (checked like round 2's `allowed` set). A number that cannot be sourced is left off; a device that
  cannot be drawn without its numbers (paidgot, pensionsteps) fails its check and the scene falls back.
- No percent sign, no IRR, and none of the FORBIDDEN return words (ผลตอบแทน ดอกเบี้ย กำไร ปันผล) anywhere on these
  devices or in the new topic's voice and captions. Word fields pass the FORBIDDEN / FREE_FORBIDDEN checks and, as
  round 3, refuse any digit (`/\p{Nd}/u`).
- No inflation rate exists in the app and none is invented: inflation is drawn without figures.

## The four devices

All have `title: [string, string]` (either line may be ""), `note?: string`.

| layout | ชื่อ | number fields | words | drawn (beats) |
|---|---|---|---|---|
| `savejar` | กระปุกโตทุกปี | `years?` (paying years, 1–60), `paid?` (total paid, baht) | title, note | a jar with a gold lid fills in four steps, each step marked "ปีที่ N" (N = round(years × k / 4), k = 1..4; marks without numbers when `years` is absent); a card under it: "ส่งรวม {years} ปี" + "{paid} บาท" (blue). Without `paid` the card shows only the years line; without both, the card reads "ส่งทีละปี". |
| `paidgot` | ส่งเท่าไร ได้คืนเท่าไร | `paid` (required), `got` (required), `payFrom?`, `payTo?`, `getFrom?`, `getTo?` (ages) | title, note | two bars to one scale grow in turn: ส่งรวม (blue) and บำนาญรวม (green), each with its baht above and "อายุ a–b" under when both ages of that bar are given. Fixed line under: "ตามตารางผลประโยชน์ของแผน". Either amount missing → refused. |
| `pricerise` | เงินเท่าเดิม ซื้อได้น้อยลง | — | title, note (default "ราคาของสูงขึ้นทุกปี") | two baskets: "วันนี้" with five goods and a banknote, "อีกหลายปี" with the same banknote and three goods; the two extra goods fade out of the second basket; a red line "เงินก้อนเดิม ของในตะกร้าน้อยลง". No figure. |
| `pensionsteps` | บำนาญขั้นบันได | `rows[]` 1–5 of `{ from, to, annual }` (required) | title, note (default "ค่าครองชีพก็สูงขึ้น วางแผนเผื่อไว้") | green steps rise one by one, each with its baht a year above and "a–b" under; a red dashed rising line labelled "ค่าครองชีพ" (no figure) draws over them; caption "บาทต่อปี ตามช่วงอายุ". Rows must ascend by age with from ≤ to; otherwise refused. |

Limits (longer is refused, not cut): title lines ≤ 20, note ≤ 34. Numbers: whole numbers; baht ≤ 1,000,000,000;
ages 1–99; years 1–60. Every word and figure fits at all three sizes and seven looks (stills looked at); the longest
figures to test are 9 digits with commas (e.g. 123,456,789).

Registry (`src/lib/scene-library/devices.ts`): family **"ออมเงิน"**, product **"saving"**, clips story + prompt,
numberFields as above, a `when` line each for the writer, e.g. savejar: "เงินที่ส่งเข้าแผนบำนาญสะสมทีละปี ใช้ตัวเลขจาก
โจทย์เท่านั้น". No `when` line says a FORBIDDEN word.

## คลิปเล่าเรื่อง: "เก็บเงินไว้ใช้ตอนเกษียณ"

Topic key `retiresave`, shelf `money` (ทุนชีวิต ภาษี มรดก), `figure: "pension"`, blurb "เงินเท่าเดิมซื้อได้น้อยลง
ส่งทีละปี ได้คืนเป็นบำนาญ". The pension figure is the same input ใกล้เกษียณ (`preretire`) takes (sex, age, annuity
age, pay, monthly pension) and is **required** for this topic: without it the form says "ใส่บำนาญที่ลูกค้าต้องการ".
Five scenes, the female voice ("คะ") like the other money topics:

1. `knowAsk` ask — title "เกษียณแล้ว" / "เงินเก็บพอไหม?"; voice "เกษียณแล้ว เงินเดือนหยุด แต่ค่าใช้จ่ายยังเดินต่อทุกเดือน
   เงินที่เก็บไว้จะพอใช้ไปอีกกี่ปีคะ"
2. pricerise — title "เงินเท่าเดิม" / "ซื้อได้น้อยลง"; voice "ของที่วันนี้ซื้อได้เต็มตะกร้า อีกหลายปีข้างหน้า เงินก้อนเดิม
   ซื้อได้น้อยลง เพราะราคาของขยับขึ้นทุกปีค่ะ"
3. savejar — title "ส่งทีละปี" / "ก้อนโตขึ้นเรื่อยๆ"; years = the plan's paying years, paid = the engine's premiums
   summed over the illustration (floored to the baht); voice "ทางหนึ่งคือแบ่งเงินส่งเข้าแผนบำนาญทุกปี ตั้งแต่วันนี้
   จนถึงวันเกษียณค่ะ"
4. paidgot — title "ส่งเท่าไร" / "ได้คืนเท่าไร"; paid as above with ages (age … last paying age), got = the engine's
   `totalPension` with ages (annuity start … 95); voice "พอถึงวันเกษียณ แผนจ่ายบำนาญกลับมาทุกปี ไปจนอายุเก้าสิบห้า
   ทุกตัวเลขอยู่ในตารางผลประโยชน์ของแผนค่ะ"
5. `knowRecap` — lines big "ราคาของขึ้นทุกปี", big "เตรียมบำนาญไว้ก่อน" (green), small "ตรวจสอบเงื่อนไขก่อนตัดสินใจ";
   the money shelf's usual recap voice pattern.

Caption line: "ตัวเลขจากตารางผลประโยชน์ บำนาญ สมาร์ท 95 ตรวจสอบเงื่อนไขก่อนตัดสินใจ". Every look the money shelf
offers draws every scene. `pensionsteps` is not in the topic (library and คลิปตามโจทย์ only).

## คลิปตามโจทย์

The writer's device list gains the four with their `when` lines and JSON fields; their numbers must be numbers in the
brief (round 2's `allowed` check); paidgot without both amounts, and pensionsteps without valid rows, fail the check
and fall back to a picture scene. The script editor shows the fields in Thai (ปีที่ส่ง, ยอดส่งรวม, บำนาญรวม,
อายุเริ่มส่ง/ส่งถึง, อายุเริ่มรับ/รับถึง, ช่วงอายุ, บำนาญต่อปี). Price unchanged.

## The library

Four catalogue entries become ready, keyed by layout (savejar, paidgot, pricerise, pensionsteps), each with the
seven-look switcher and stills `/library/<layout>-<look>.jpg` (4 × 7 = 28 new; the existing 175 byte-identical). The
unbuilt `dev(...)` lines growing-jar, inflation-eats, pension-inflation and irr-per-year are removed (prod had no
marks on them, checked 2026-11-15). fund-risk-1-8, portfolio-mix and past-returns-chart stay unbuilt. Library
stills use the mockup's example: ชาย 40 ปี, บำนาญเดือนละ 10,000 from 60, pay until 60 → paid 2,724,411 over 20 years
(ages 40–59), totalPension 6,023,625 (60–95), bands 118,110 / 157,480 / 196,851 / 236,221 (60–75, 76–80, 81–85, 86–95).

## Shipping

One REMOTION_DRAWING change; prepare samples (retiresave in paper + one info look; one prompt clip with saving
devices); before the push the owner sees stills of the four in all looks and the sample clips. No database change.

## Tests

Per device: kspec/knowText, every look × size draws without throwing, dark looks keep words and figures readable,
digits refused in word fields, limits, paidgot/pensionsteps refused without their numbers, rows order. Story:
retiresave's five scenes, figures equal the engine's for the example, pension required, no FORBIDDEN word or "%" in
voice/caption/screen words. Prompt: writer parsing (a number not in the brief left off / scene refused), editor
fields. Catalogue ready + previews on disk; count 175 + 28 = 203.
