# Ads Studio: content types (round 1 — numbers, knowledge, story)

Date: 2026-10-06 · Owner chose ตัวเลขชัดๆ, รีวิวเคลม, ความรู้/เล่าเรื่อง; plan approved in chat ("ทำเลย"):
round 1 = types 2, 4, 5 below; รีวิวเคลม is round 2 (not here).

## Types (a chip row at the top of the create drawer, kept per campaign in the draft; default 1)
1. **แอดยาว + ตารางเบี้ย** — today's long ad, unchanged.
2. **ตัวเลขชัดๆ** — a short ad on figures alone, from the code:
   - The sheet is the plan's ladder priced at the form's age, sex and row (`ladder.price(rung, sex, age, today)` — the same settle/fallback as the headline). No sheet → refused before payment ("แบบนี้คิดเบี้ยที่อายุ/เพศนี้ไม่ได้").
   - primaryText = an AI opening line (one, ≤125 chars, no figures) + `numbersBody(sheet)` + a CTA line + the contacts block. The Meta headline comes from the existing `headlines()` call (numbers headline, figure-free rule as Organic), description from the CTA.
   - Poster = `numbersPoster(sheet, theme, lang)` (the campaign theme, else navy); no AI picture is drawn for it.
   - figures = numbersYardstick([sheet]) + contacts, as Organic numbers posts keep theirs.
   - English for an English campaign (iHealthy on an Expat Page) via the en plan's sheet.
3. **ความรู้** — a myth put right / FAQ / checklist about the plan's product type, tied to the plan:
   - Sub-kind chips: ความเข้าใจผิด · คำถามที่ถามบ่อย · เช็กลิสต์ก่อนซื้อ.
   - Written by the long-ad writer with a knowledge system variant: no premium table, no bullets of figures; 3–6 short points; facts only from the brief (the brief stripped of premiums/sample people as today); ends with the CTA and contacts (code-placed). No premiums (same flags), no superlatives, the owner line applies (sex/age/row only if mentioned).
4. **เล่าเป็นเรื่อง** — a short imagined situation the reader recognises, turning to the plan; same writer variant rules as ความรู้ (no table, CTA + contacts code-placed). The angle select still applies (it steers the situation).

Common to 2–4: the round's planner, owner line, budget hold, flags, save as format "ad" into the campaign; `output.ad.kind = "long" | "numbers" | "knowledge" | "story"` (+ `sub` for knowledge); the card/list shows a small chip of the kind; the drawer's right pane shows, for type 2, the numbers body + poster preview, for 3–4 "ไม่มีตารางเบี้ยในแอดแบบนี้" plus the contacts block; the round's price estimate unchanged (one writer call per ad).

## iHealthy emphasis (owner, 2026-10-06)
For iHealthy campaigns (both languages) the writer is told to put the ad's weight on what the annual lump-sum limit covers — cancer treatment (chemotherapy, radiotherapy), major surgery and ICU, inpatient stays at private hospitals, kidney dialysis — and not on the pay or cover period. These facts are added to the iHealthy brief's ad block from `data/riders/ihealthy-ultra.json` benefit rows (categories 1, 4, 9, 10, 11 and the outpatient/extras only where the headline's plan has them — read the per-plan amounts in the data; leave out a category the plan pays nothing for). No "heart surgery" example and no hospital names (controller default until the owner rules); "โรงพยาบาลเอกชน" / "private hospitals" only. The special 120-day waiting period for cancer and tumours goes into the cautions.

## Testing
Numbers ad: the body equals numbersBody of the ladder sheet for that age/sex/row (both languages); refused when unpriced. Knowledge/story: system prompt has no table and has the kind's rules; assembled text has CTA + contacts and no table. iHealthy brief block lists exactly the categories the plan pays for (per-plan test), includes the 120-day caution.
