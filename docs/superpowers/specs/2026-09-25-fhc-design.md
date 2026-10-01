# /fhc — Financial Health Check — design

Owner request, 2026-09-25. The agency already has a paper-style questionnaire, "แบบสอบถาม
คุณภาพชีวิต (ที่ดี)" (`/Users/pheerapatpisit/Documents/APP/Advisortool/fhc/index.html`): an
agent sits with a customer, fills in ages, income, savings, debts, dependants, and reveals the
"two kinds of assets" and "five events you cannot control" as teaching moments; it prints on
one A4 sheet and shares to LINE. It knows nothing about our plans and has no AI.

This page brings it into the app, scores the customer's finances, ties each of the five events
to a plan we sell priced from the real rate tables, and has the AI write the summary.

## Decisions (owner)

1. **Both audiences.** A switch at the top: ลูกค้าทำเอง / ตัวแทนทำกับลูกค้า. Agent mode adds
   the "เฉลย" reveal buttons, interviewer name + date, names of dependants, and print.
2. **Separate from /plan, one engine.** /fhc ends in the same plan card /plan shows, from the
   same `recommend()` and `pickOrder()`, so every premium matches the sales pages.
3. **Stored without names**, in `ins_plan_runs` like /plan, marked as coming from FHC. Names
   (interviewer, dependants) never leave the browser.
4. Menu: "Financial Health Check" under วางแผนประกัน, after Insurance Planner.
5. Retirement age offers 55 / 60 / 65 only (the ages บำนาญ สมาร์ท 95 starts at), not FHC's 45–75.
6. The app's one navy/sand palette (theme-legacy, like /plan), not FHC's orange.

## The form (phone first; two columns from `sm`)

| Card | Fields |
|---|---|
| อายุ | อายุปัจจุบัน (20–70), เพศ, อายุเกษียณ 55/60/65, อายุเฉลี่ย (75–100, default 85), ความสามารถทำงาน (เต็มที่ / บางส่วน / ไม่ได้). The circle diagram: ปัจจุบัน → เกษียณ → อายุเฉลี่ย, with ปีที่ทำงาน and ปีที่ต้องใช้เงิน under it. |
| ค่าใช้จ่าย & รายได้ | ค่าใช้จ่าย/เดือน, รายได้/เดือน → รายได้ต่อปี, เงินเหลือสุทธิ/เดือน, ค่าความสามารถในการทำงาน (= รายได้ต่อปี × ปีที่ทำงาน; half when ทำงานได้บางส่วน, 0 when ทำงานไม่ได้ — 2026-10-01) |
| เงินเก็บ | เงินสด/ออมทรัพย์, เงินฝากประจำ, อื่นๆ → รวม |
| หนี้สิน | สินเชื่อบ้าน, สินเชื่อรถ, บัตรเครดิต/อื่นๆ → รวม |
| กองทุน/การลงทุน | LTF/RMF, หุ้น/อื่นๆ → รวม; then สินทรัพย์สุทธิ = เงินเก็บ + ลงทุน − หนี้ |
| ทรัพย์สิน 2 ประเภท | มองเห็น: บ้าน รถ ที่ดิน · มองไม่เห็น: ค่าความสามารถ (figure). Agent mode hides it behind เฉลย. |
| บุคคลในความดูแล | up to 4 rows: ความสัมพันธ์ (ลูก / คู่สมรส / พ่อแม่ / อื่นๆ) + อายุ; agent mode adds a name box |
| 5 เหตุการณ์ควบคุมไม่ได้ | เจ็บป่วย, อุบัติเหตุ, ทุพพลภาพถาวร, จากไปโดยไม่ทันตั้งตัว, ตกงาน. Agent mode: each behind เฉลย. |
| ประกันและความต้องการ | ทุนประกันชีวิตรวม, ทุนโรคร้ายแรงรวม, สิทธิ์ค่ารักษา (+ ค่าห้อง), เบี้ยที่จ่ายอยู่/ปี, บำนาญที่คาดว่าจะได้/เดือน, หลังเกษียณอยากมีใช้/เดือน (default 70% of expense), โรงพยาบาลที่อยากใช้, ประกันชีวิตแบบไหน (ข้อ 1/2), งบเบี้ยเพิ่ม/เดือน (default as /plan) |
| ผู้ทำแบบสอบถาม (agent mode) | ชื่อ, วันที่ (today) |

Live figures update as the customer types, as FHC does.

## Mapping to the plan engine

`toPlanInput(fhc)`: savings = cash + fixed + other + stocks; retireLump = LTF/RMF (so nothing
counts twice); children = ages of rows marked ลูก; otherDependants = any other row; debts = the
three debts; `lifeExpectancy` = อายุเฉลี่ย (new optional `PlanInput` field; `retireNeed` spreads
the lump sum to it instead of the fixed 85 when present); everything else one to one.

## Scores — `src/lib/fhc/assumptions.ts`, each threshold named

| Score | Figure | Green | Yellow | Red |
|---|---|---|---|---|
| เงินสำรองฉุกเฉิน | (เงินสด + ฝากประจำ) ÷ ค่าใช้จ่าย/เดือน | ≥ 6 เดือน | ≥ 3 | < 3 |
| เงินเหลือต่อเดือน | (รายได้ − ค่าใช้จ่าย) ÷ รายได้ | ≥ 20% | ≥ 10% | < 10% |
| หนี้ (ไม่รวมบ้าน) | (สินเชื่อรถ + บัตรเครดิต/อื่นๆ) ÷ รายได้ต่อปี — the home loan left out from 2026-10-01, a mortgage of several years' income being ordinary; it still counts in the life need and net worth | < 1 เท่า | ≤ 3 | > 3 |
| ความคุ้มครองชีวิต | (ทุนชีวิต + เงินเก็บ) ÷ ที่ควรมี (`lifeNeed`) | ≥ 100% | ≥ 50% | < 50% |
| ค่ารักษาและโรคร้าย | `healthNeed.covered`, `ciNeed.gap = 0` | both | one | neither |
| เกษียณ | ที่มีต่อเดือน ÷ ที่อยากมี (`retireNeed`) | ≥ 100% | ≥ 50% | < 50% |

A score with nothing to divide by (no expense, no income) shows "—" and counts as no data.

## The five events → our plans

| Event | Score it reads | Answer on the card |
|---|---|---|
| เจ็บป่วย | ค่ารักษาและโรคร้าย | the plan card's health and CI offers, priced |
| อุบัติเหตุ | none | สัญญาเพิ่มเติมอุบัติเหตุ แนบกับแบบประกันชีวิต — เบี้ยขึ้นกับอาชีพ ปรึกษาตัวแทน (no price: the calculators do not ask occupation class, by owner rule) |
| ทุพพลภาพถาวร | none | สัญญาเพิ่มเติมยกเว้นเบี้ย (WP) — ปรึกษาตัวแทน |
| จากไปโดยไม่ทันตั้งตัว | ความคุ้มครองชีวิต | the plan card's life offer, priced |
| ตกงาน | เงินสำรองฉุกเฉิน | no insurance for it: the emergency fund to aim for (ค่าใช้จ่าย × 6) |

## Result, in order

1. AI summary: จุดแข็ง (up to 3), จุดที่ต้องระวัง (up to 3), เริ่มตรงไหน (one line).
2. Six scores, coloured, each with its figure.
3. The five events with their answers.
4. The /plan card (`PlanView`), AI-ordered, with the folded advice.
5. Buttons: พิมพ์ / PDF (agent mode), ส่งไป LINE, แก้ข้อมูล.

## AI

`runFhc` (server action) cleans the form, calls `pickOrder` (8 s cap) and `recommend`, computes
the scores, logs the run, returns figures. `explainFhc(form, order)` then runs two small-tier
calls in parallel: the plan's folded advice (`explain`, unchanged) and a new `fhc-summary`
call returning `{"strengths":[...],"risks":[...],"start":"..."}`. Accepted items are
digit-free and at most 200 characters, three per list; anything else falls back to sentences
built from the scores (green labels as strengths, red as risks) and `fixedSummary` for start.

## Print and LINE

Print: the result section plus the interviewer and date, on the app's A4 portrait sheet; the
form is hidden in print. LINE: `https://line.me/R/msg/text/?…` with a plain-text summary
(scores, the plan's lines with premiums, the disclaimer); the person picks the recipient in LINE.

## Storage and admin

`ins_plan_runs` row: `input` = the plan input plus `from: "fhc"` and the anonymous FHC figures
(no names), `result` = the plan result plus the scores. `/admin/crm`'s table gets a ที่มา
column (plan / FHC). No migration.

## Testing

- `tests/fhc/health.test.ts`: derived figures (work years, lifetime income, net worth), each
  score's thresholds and no-data case, `toPlanInput` mapping (children, dependants, no double
  count), events' statuses.
- `tests/fhc/summary.test.ts`: valid reply, digit, too long, junk, model down → fallbacks.
- `tests/plan/needs.test.ts`: `lifeExpectancy` spreads the lump sum.
- Browser at phone size, both modes: live figures, reveal buttons, result, print preview
  hides the form, LINE link built; `/admin/crm` shows the ที่มา column.
