# คลังแอนิเมชัน — device round 5: สุขภาพเพิ่มเติม

Owner, 2026-11-15, "ก ทุกข้อ" on mockup https://claude.ai/artifact/Wm8EwCrbxfbEoDYkpdgjNj: 1ก all eight devices below;
2ก the co-payment device draws "20%" (the sheet's figure; the voice never says a percent); 3ก a new คลิปเล่าเรื่อง topic
"ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง". Built exactly as rounds 1–4 (latest: specs 2026-11-15-devices-saving-design.md and
2026-11-15-devices-metaphor-design.md): a device is a `KnowShow` layout drawn by `showBody` (paper, warm, line) and the
info route (plot, info, board, neon, blueprint) through the Kit, timed by `kspec`, words in `knowText`/`showText`.

## The rules that do not move

- An AI never types a figure. Every number comes from a source in code: the iHealthy Ultra sheet
  (`data/riders/ihealthy-ultra.json` via `src/lib/ihealthy-facts.ts` / `src/lib/scene-library/health-figures.ts`), the
  group premium table (`data/group-insurance/premiums.json`), the PA plans (`src/lib/pa-plans.ts`), the hospital list
  (`data/hospitals/ktaxa-network.json`), the tax table (`src/lib/scene-library/tax-th.ts`), or the agent's own form input
  (bill, age). In คลิปตามโจทย์ a number must be in the brief or be one of that device's fixed-source values (listed per
  device below) — checked like round 2's `allowed`. Derived figures (bill splits, per month) are computed by the drawer,
  never supplied.
- Unsourced OPTIONAL numbers are dropped (round 4's final ruling); a device that cannot be drawn without its numbers
  fails its check and the scene falls back.
- Word fields refuse any digit (`/\p{Nd}/u`), FORBIDDEN / FREE_FORBIDDEN words, and "IRR" (`/\birr\b/i`) as round 4.
  No claim of what a claim will pay beyond the sheet; "ตามเงื่อนไข" wording as round 1.
- The only percent drawn is the co-payment's "20%" (owner 2ก), from `copayPercent`; no voice, caption or word field
  carries "%".

## The eight devices

All have `title: [string, string]` (either line may be ""), `note?: string`. Limits: title lines ≤ 20, note ≤ 34,
labels ≤ 14; baht whole numbers ≤ 1,000,000,000; ages 1–99.

| layout | ชื่อ | fields (numbers) | fixed-source values (prompt) | drawn |
|---|---|---|---|---|
| `ipdopd` | สองประตู ผู้ป่วยใน ผู้ป่วยนอก | `room` (baht/day, required), `opd`: number \| "none" \| "actual" (required), `planName?` (words) | sheet row 1 and rows 18/19 values of the six plans | two doors (blue ผู้ป่วยใน, green ผู้ป่วยนอก) open in turn; cards "ค่าห้อง {room} บาท/วัน" and "วงเงินรวม/ปี {opd} บาท"; `opd` "none" → "แผนนี้ไม่มีผู้ป่วยนอก"; "actual" → "ตามที่จ่ายจริง"; line "ผู้ป่วยนอกรวมค่าแพทย์ ยา และกายภาพ" (rows 18/19 share one limit). |
| `deductible` | ส่วนรับผิดชอบแรก | `deductible` (required), `bill?` | 30,000 / 50,000 / 100,000 | a bill bar; the first part (gold, "เราจ่าย") up to `deductible`, the rest (green, "ประกันจ่าย"); amounts drawn only when `bill` is given (computed: min(bill, deductible) and the rest, never negative; bill ≤ deductible → all gold, line "ยังไม่ถึงส่วนที่ประกันจ่าย"); card "ส่วนรับผิดชอบแรกของแผน {deductible} บาทต่อปี". |
| `copay` | ร่วมจ่าย | `percent` (required, must equal the sheet's copayPercent), `bill?` | 20 | a bill sheet split by a dashed red line; "เราจ่าย {percent}%" and "ประกันจ่ายส่วนที่เหลือ"; with `bill`, a card "บิล {bill} → เราจ่าย {floor(bill×percent/100)}" and "ประกันจ่าย {bill − ours}". |
| `renew98` | ต่ออายุได้ถึง | `to` (required, sheet renewalToAge 98), `age?` (today) | 98 | a timeline from "วันนี้" (age when given) to "ต่อได้ถึง อายุ {to}"; a dashed arc; card "ไม่เกินระยะเวลาของสัญญาหลัก" / "เบี้ยปรับตามช่วงอายุ". Never "เบี้ยเท่าเดิม", never "ต่อได้แน่นอน". `age` ≥ `to` → age dropped. |
| `parentshealth` | ประกันสุขภาพให้พ่อแม่ | `cap` (required, = HEALTH_PARENTS_CAP 15,000) | 15,000 | two parents (ผู้เอาประกัน) and a child (ลูกจ่ายเบี้ย); card "ลูกนำเบี้ยไปลดหย่อนภาษีได้" / "ไม่เกิน {cap} บาท" / "ต่อปี รวมพ่อและแม่"; foot "ตามเกณฑ์กรมสรรพากร ปีภาษี 2569" (TAX_YEAR from tax-th). |
| `groupcost` | ต้นทุนต่อหัว ประกันกลุ่ม | `perYear` (required), `people?` words label (e.g. "พนักงาน 10–25 คน" — the band words come from code, not AI digits: see below) | values of `healthIpdPremiums` | a row of six people; card "ต่อคนต่อปี {perYear} บาท"; card "เฉลี่ยต่อคนต่อเดือน {floor(perYear/12)} บาท" (computed). The band line is drawn from a `band` key ("10-25" \| "26-50" \| "51-100") mapped to words in code, so no digit enters a word field. |
| `hospitals` | โรงพยาบาลในเครือ | `total` (required), `rows[]` 1–5 of `{ province (words), count }` | counts computed from the hospital JSON by a code helper (total 537; per province) | bars for up to five provinces to one scale from zero, count at the end of each; title line 2 may carry the total via the drawer ("{total} แห่งทั่วประเทศ"); foot "ข้อมูล ณ {fetched date}" from the JSON (code, not words); line "ดูรายชื่อเต็มได้ที่เว็บบริษัท". A count not equal to the JSON's count for that province is refused. |
| `paclaim` | อุบัติเหตุหนึ่งครั้ง | `medical` (required, per accident), `weekly?`, `weeks?` (= PA_WEEKLY_MAX_WEEKS 52 when weekly given) | the PA plans' `medical` and `weekly` values, 52 | card "ค่ารักษาต่ออุบัติเหตุ ไม่เกิน {medical} บาท"; when `weekly`: card "ทำงานไม่ได้ชั่วคราว สัปดาห์ละ {weekly} บาท" and "สูงสุด {weeks} สัปดาห์". Never "รายวัน". Never "ค่ารักษา X บาท" as a typical bill. |

Registry (`src/lib/scene-library/devices.ts`): family **"สุขภาพ"** (same as round 1) unless the registry's existing
health family name differs — use the existing one; products: ipdopd, deductible, copay, renew98, hospitals = "health";
parentshealth = "health"; groupcost = "health"; paclaim = "health". `when` lines per device, no FORBIDDEN word.

## คลิปเล่าเรื่อง: "ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง"

Topic key `ipdopd`, shelf `health`, `figure: "health"` (the iHealthy plan + sex + age every health topic takes). Five
scenes, the female voice ("คะ/ค่ะ") like the other health topics; figures from `input.health.figures` (extend
`HealthFigures` with `opd` from rows 18/19 as number/"none"/"actual", and `renewalToAge`), the age from the input,
hospital counts from the code helper:

1. `knowAsk` ask — title "ผู้ป่วยใน" / "ผู้ป่วยนอก ต่างกันยังไง?"; voice "ไปหาหมอแล้วกลับบ้าน กับต้องนอนโรงพยาบาล
   ประกันสุขภาพดูแลต่างกันนะคะ"
2. ipdopd — title "สองประตู" / "คนละวงเงิน"; voice (OPD number) "แผน iHealthy {planName} นอนโรงพยาบาล ค่าห้อง
   {room}ต่อวัน ส่วนไปหาหมอแล้วกลับบ้าน มีวงเงินรวม {opd}ต่อปีค่ะ" — with `withBaht` like the other health voices;
   "none" → "…ส่วนไปหาหมอแล้วกลับบ้าน แผนนี้ไม่ได้รวมไว้ค่ะ"; "actual" → "…จ่ายตามที่จ่ายจริง ตามเงื่อนไขของแผนค่ะ".
3. renew98 — title "ต่ออายุได้ถึง" / "อายุเก้าสิบแปด"; voice "แผนนี้ต่ออายุได้ถึงอายุเก้าสิบแปด ไม่เกินระยะเวลาของสัญญาหลัก
   และเบี้ยปรับตามช่วงอายุค่ะ" (title words carry no digit; the drawn figure 98 comes from the sheet).
4. hospitals — title "โรงพยาบาลในเครือ" / "ทั่วประเทศ"; voice "มีโรงพยาบาลในเครือทั่วประเทศ ดูรายชื่อเต็มได้ที่เว็บ
   บริษัทค่ะ"
5. `knowRecap` — lines big "ผู้ป่วยใน คนละวงเงินกับผู้ป่วยนอก", big "เลือกแผนให้ตรงกับที่ใช้จริง" (green), small "ตาม
   เงื่อนไขของแผน"; voice "จำง่าย ๆ ค่ะ นอนโรงพยาบาลกับไปหาหมอแล้วกลับบ้าน มีวงเงินคนละส่วน เลือกแผนให้ตรงกับที่เราใช้
   จริง"
HEALTH_CLOSE: "อยากรู้ว่าแผนไหนมีผู้ป่วยนอก ทักมาได้เลย".

Every look the health shelf offers draws every scene. Other topics unchanged.

## คลิปตามโจทย์

The writer's device list gains the eight with `when` lines and JSON fields; numbers must be in the brief or among the
device's fixed-source values; optional unsourced numbers dropped; required ones refuse the device. The script editor
shows the fields in Thai (ค่าห้องต่อวัน, ผู้ป่วยนอกต่อปี, ส่วนรับผิดชอบแรก, ยอดบิล, ร่วมจ่าย, ต่ออายุถึงอายุ, อายุวันนี้, เพดาน
ลดหย่อน, เบี้ยต่อคนต่อปี, กลุ่มพนักงาน, จำนวนโรงพยาบาล, จังหวัด, ค่ารักษาต่ออุบัติเหตุ, ชดเชยต่อสัปดาห์, จำนวนสัปดาห์).
Price unchanged.

## The library

Eight catalogue entries ready, keyed by layout, seven-look switcher, stills `/library/<layout>-<look>.jpg` (8 × 7 = 56
new; the existing 203 byte-identical). Remove the unbuilt `dev(...)` lines ipd-opd, copay, deductible, renewable-to-age,
hospital-map, health-for-parents, group-cost-per-head, pa-cost-per-visit, pa-daily-benefit (check prod marks first);
keep medical-inflation, preexisting, tax-health-premium, ci-uncovered-costs unbuilt. ipdopd, renew98, hospitals link
to topic ipdopd; the other five to คลิปตามโจทย์ only. Stills use: iHealthy GOLD (room 9,000; OPD 12,000; deductible
50,000; copay 20, bill 100,000; renew to 98, age 35), parents cap 15,000, group IPD plan 1 biz1 10–25 (2,552/yr →
212/month), hospitals from the JSON (total 537; กรุงเทพมหานคร 135, ชลบุรี 49, ระยอง 38, สมุทรปราการ 25, นนทบุรี 22 —
province names as the JSON spells them, shortened only by a code map if too long), PA Platinum 03 (medical 150,000;
weekly 3,000; 52 weeks).

## Shipping

One REMOTION_DRAWING change; prepare samples (topic ipdopd in paper + one info look; one prompt clip with four of the new
devices); the owner sees stills and samples before the push. No database change.

## Tests

Per device: kspec/knowText, every look × size draws, dark looks keep words and figures readable (per-element contrast as
round 4), digits/return words/IRR refused in words, limits, required numbers refuse, optional unsourced dropped, the
"none"/"actual" OPD cases, deductible bill below/above, copay split arithmetic, renew age ≥ to dropped, hospital count
must match the JSON, groupcost per-month computed. Story: ipdopd topic five scenes, figures equal the sheet for GOLD and
SMART ("none"), no "%" in voice/caption. Prompt: writer parsing, editor fields. Catalogue ready + previews; count 203 +
56 = 259.
