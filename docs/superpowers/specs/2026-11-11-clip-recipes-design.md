# สูตรคลิป Motion: same figures, three new ways to tell them — design

Owner, 2026-11-11. Asked to consult on Motion Graphic in the video work; the cause named was
"หน้าตาซ้ำ น่าเบื่อ" in every part (order of scenes, picture style, movement: answer ง). Chose approach ก
(scene blocks + recipes) over one-off formats and an AI director. Mockup
https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88, answers **ก ก ก**: all three recipes; the form's
default is "สุ่มให้"; each recipe keeps its own colours and typeface. Owner also confirmed: this is an
addition, everything that exists stays.

Status: spec only. Nothing is built.

## สรุปสำหรับเจ้าของ (ภาษาไทย)

- เพิ่ม "สูตรคลิป" 3 แบบในหน้า วิดีโอนำเสนอ: **เปิดด้วยคำถาม**, **เส้นชีวิต**, **เทียบให้เห็น**
- รอบแรก: Life Protect, แนวตั้ง, ภาษาไทย, ไม่มีสัญญาเพิ่มเติม คลิปยาวประมาณ 15–20 วินาที
- หน้าเลือกเริ่มที่ "สุ่มให้": กดสร้างแต่ละครั้งได้สูตรที่ไม่ซ้ำครั้งก่อน เลือกเองได้เสมอ และ "แบบเดิม" ยังอยู่ในรายการ
- ตัวเลขทุกตัวมาจากหน้าคำนวณ ไม่มี AI แต่งตัวเลข เคสที่สูตรไหนเล่าไม่ได้ ระบบข้ามสูตรนั้นเอง
- ราคาเท่าคลิป Motion เดิม ต้นทุนวาดเท่าเดิม คลิปเก่าและธีมเก่าไม่ถูกแตะ
- รอบแรกยังไม่มี: แผนอื่น, จัตุรัส/แนวนอน, ภาษาอื่น, โจทย์การเล่า, น้องโล่, ธีมเทศกาล ในคลิปสูตรใหม่

## Goal

A Motion clip made twice from the same quote should not look like the same clip. Today every theme
repaints one fixed order (lead → price → cover → value → contact) with the same layouts and the same
entrances. A **recipe** is a whole clip with its own scene list, its own spoken words, its own layout,
movement, colours and typeface, built from the same `QuoteVideoFacts`.

Success: the three recipes, side by side with a navy Motion clip of the same quote, read as four
different clips; every figure on screen and in the voice equals the quote's; no existing clip, theme,
price or stored row changes.

## Scope

In: วิดีโอนำเสนอ, style `motion`, product `LIFEPROTECT`, size portrait, language Thai.

Out (round one): other products, square and landscape, other languages, Life Protect quoted with
riders, a clip begun from a budget, โจทย์การเล่า (brief, written lines, loop), the length picker,
น้องโล่, ตัวเลขลอยต่อ, ธีมเทศกาล, สีของฉัน, the piggy jar and life road scenes. A recipe clip takes
none of these; where the form has them set, they are ignored for the recipe and said so on the form
(see Form).

## The three recipes

Each is one fixed length, set by its voice. Figures below are the mockup's example (ชาย 35, ทุน
1,000,000, ชำระ 19 ปี); in the build each comes from the named fact.

### `ask` · เปิดด้วยคำถาม

Yellow ground, black heavy type (Kanit 800/900), blocks that slam, wipe and slide in.

| # | Block | On screen | From |
|---|---|---|---|
| 1 | question | "ถามจริง" tag · "ถ้าพรุ่งนี้ไม่มีคุณ ที่บ้านอยู่ได้กี่เดือน?" | fixed words |
| 2 | big figure | "มีแผนนี้ ครอบครัวได้รับ" · 2,000,000 counted up · "บาท หากจากไปก่อนอายุ 60" | `lead.baht`, first cover row's age |
| 3 | three rows | 79 บาทต่อวัน / ปีละ 28,700 · 19 ปี จ่ายจบตอนอายุ 53 · คุ้มครองยาวถึงอายุ 99 | `perDayAmount`, yearly price row, `payYears`, `lastPayAge`, `coverToAge` |
| 4 | contact | "ขอตัวเลขของคุณเอง" · the agent's contact | `contact` |

### `life` · เส้นชีวิต

Deep green ground, cream serif type (Trirong), a gold rail down the left that keeps filling as the ages pass.

| # | On screen | From |
|---|---|---|
| 1 | "วันนี้ · อายุ" 35 · "เริ่มออมปีละ 28,700 บาท" | `age`, yearly price row |
| 2 | "อีก 19 ปี · อายุ" 53 · "จ่ายครบ หยุดจ่าย ความคุ้มครองยังอยู่" | `payYears`, `lastPayAge` |
| 3 | "ตลอดช่วงก่อนอายุ" 60 · "หากจากไป ครอบครัวได้รับ 2,000,000" | cover rows (`coverAt`) |
| 4 | "จาก 60 ยาวถึงอายุ" 99 · "ยังคุ้มครองต่อ 1,000,000" | cover rows, `coverToAge` |
| 5 | "วางเส้นชีวิตของคุณ" · contact | `contact` |

### `versus` · เทียบให้เห็น

Off-white sheet, navy and blue with one orange pill (IBM Plex Sans Thai), two halves and two bars.

| # | On screen | From |
|---|---|---|
| 1 | two halves: "จ่ายรวม 19 ปี 545,300" · "อายุ 64 เวนคืนได้ 553,000" | `totalPaid`, `breakEven` |
| 2 | "จ่ายไป กับ ได้คืน" · two bars drawn to true scale with their figures | same |
| 3 | "ได้คืนมากกว่าที่จ่าย +7,700" · "และระหว่างทาง มีความคุ้มครอง 2,000,000 ก่อนอายุ 60" | `breakEven.cash − totalPaid`, `lead`, cover rows |
| 4 | "ดูตัวเลขของคุณ" · contact | `contact` |

Every recipe carries the foot line "ตัวอย่างประกอบ · เงื่อนไขตามกรมธรรม์" on every scene, and the
quote's `footNote` where it has one.

### Spoken words

Each scene's voice is a fixed template filled from the same facts as its screen, figures said with
`spokenBaht`, ending through `spokenBy` for a male narrator. No AI writes them. Drafts (final wording
is checked with the owner in the first real clips):

- ask: "ถามจริงนะคะ ถ้าพรุ่งนี้ไม่มีคุณ ที่บ้านจะอยู่ได้กี่เดือน" · "มีแผนนี้ ครอบครัวได้รับ {lead} หากจากไปก่อนอายุ {n}" · "แลกกับวันละ {day} บาท จ่าย {years} ปี จบตอนอายุ {lastPay} แล้วคุ้มครองยาวถึงอายุ {to}" · "อยากรู้ตัวเลขของคุณเอง ทักมาได้เลยค่ะ"
- life: "วันนี้อายุ {age} เริ่มออมปีละ {year}" · "อีก {years} ปี อายุ {lastPay} จ่ายครบ หยุดจ่าย แต่ความคุ้มครองยังอยู่" · "ตลอดช่วงก่อนอายุ {n} หากจากไป ครอบครัวได้รับ {early}" · "จากนั้นยาวถึงอายุ {to} ยังคุ้มครองต่อ {late}" · "อยากวางเส้นชีวิตของคุณเอง ทักมาได้เลยค่ะ"
- versus: "จ่ายรวม {years} ปี {paid} พออายุ {beAge} เวนคืนได้ {cash}" · "จ่ายไปกับได้คืน ต่างกันแค่นี้ค่ะ" · "ได้คืนมากกว่าที่จ่าย {diff} และระหว่างทางมีความคุ้มครอง {early} ก่อนอายุ {n}" · "อยากดูตัวเลขของคุณ ทักมาได้เลยค่ะ"

## When a recipe fits

One function a recipe, `fits(facts)`; a recipe that does not fit is never offered and never drawn.

- all three: product Life Protect, Thai, no riders, no budget, `coverStyle === "bars"` with two cover
  rows that name an age, and a yearly price row.
- all three: not `payToEnd` (final review, 2026-11-12: a plan paid to 99 is told by none).
- `ask`, `life`: also `perDayAmount` (ask), `payYears`, `lastPayAge`.
- `life`: also `lastPayAge` below the first cover row's age, so its ages run in order (a woman of 58
  paying to 76 past the step at 60 is not told as a life line).
- `versus`: also `totalPaid`, `breakEven`, and `breakEven.cash` greater than `totalPaid`.

## Parts

New, each with one job:

- `src/lib/quote-video/recipes.ts` — `RecipeKey = "ask" | "life" | "versus"`, the names shown,
  `recipeFits(key, facts)`, `recipesFor(facts)`, `recipeScript(key, facts, narrator)` returning
  `{ key, voice }[]`, `readRecipe(v)`. No drawing; pure, so the form and the server share it.
- `src/lib/quote-video/recipe-blocks.tsx` — the shared pieces: entrances (slam, wipe, slide, pop,
  grow) as functions of time, the counted-up figure, the foot line, the contact block.
- `recipe-ask.tsx`, `recipe-life.tsx`, `recipe-versus.tsx` — each `xFrame(clip, sceneIndex, t, w, h)`,
  its palette and face its own. `recipe-life` draws its rail from the clip's whole time, not the scene's.
- `recipeFrame(key, …)` in `recipes-draw.tsx` picks among them.

Changed:

- `script.ts` `VideoInput`: `recipe?: RecipeKey`, read only with style `motion`.
- `make.ts`: when the row has a recipe that fits, the script is `recipeScript` and the scene plan is
  laid from its voices as today's is; `brief`, `length`, mascot, carry, jar, road and theme are left
  out of the props. A recipe that no longer fits (rates changed since) falls back to the standing
  Motion clip in navy.
- `remotion.ts` `ClipProps`: `recipe?: RecipeKey`; a recipe clip's scene keys are the recipe's own.
- `remotion/src/Clip.tsx`: with `p.recipe`, each scene is `recipeFrame`, over the recipe's own flat
  ground; cross-scene joins are a hard cut for `ask`, the rail's travel for `life`, a slide for
  `versus`. Music and whoosh cues as kinetic has them.
- Remotion fonts: Kanit and Trirong added the way Sriracha is.
- `actions.ts`: `createVideo` keeps `recipe` only where `recipeFits`; the clip's name in lists and
  the admin ledger says the recipe ("Motion · เปิดด้วยคำถาม").
- `QuoteVideoBoard.tsx`: see Form.
- `REMOTION_DRAWING` changes, so the push builds a new Remotion job (ship.sh); one recipe clip joins
  its smoke set.

Unchanged: prices (a recipe clip is priced as Motion), wallet, voice engines, progress kinds, the
callback, stored rows, every existing theme and style. No migration: `recipe` lives in the row's
`input` JSON.

## Form

Under รูปแบบ = Motion, where the quote is Life Protect, portrait, Thai, without riders, a new row
**"การเล่า"** stands above the theme row:

- chips with a small still of each: **สุ่มให้** (default) · เปิดด้วยคำถาม · เส้นชีวิต · เทียบให้เห็น · แบบเดิม.
  A recipe that does not fit this quote is not shown.
- **สุ่มให้** picks, at the press of สร้าง, one of the recipes that fit, never the one this browser made
  last (kept in `localStorage`, key `quote-video-last-recipe`). The pool is the recipes only; แบบเดิม is
  made only when chosen, or when no recipe fits.
- with a recipe chosen or สุ่มให้, the rows a recipe does not use (ธีม, ความยาว, โจทย์การเล่า, น้องโล่,
  ตัวเลขลอยต่อ) fold away under one line: "สูตรนี้มีสี ความยาว และบทของตัวเอง". Choosing แบบเดิม shows
  them again as today.
- everywhere the row does not stand (other products, sizes, languages, riders), the form is exactly
  today's.

The finished clip's card names what was made, so an agent who got a recipe by chance can ask for it again.

## Errors

- A recipe sent for a quote it does not fit: dropped at `createVideo`, the standing Motion clip is made.
- Props of another drawing version: refused by the image as today, the clip fails, no charge.
- A font that fails to load in the render: the render fails (no silent fallback face), as today.

## Testing

- `recipes.test.ts`: `recipeFits` for each excluding case above; `recipeScript` figures equal the
  facts' for three real Life Protect quotes (both sexes, a paying-to-99 plan excluded, a quote whose
  cash value never passes the premiums excluded from `versus`).
- Each `xFrame` rendered at the start, middle and end of every scene without throwing, and at 1080×1920
  no text box wider than the frame (the longest plan line and the largest sum the page allows).
- `remotion-drawing.test.ts` fingerprint updated.
- Stills of every scene of the three recipes checked by eye before the push; then the ship.sh smoke
  render on Cloud Run; then one real clip of each recipe by the owner.

## Later, not now

Other products one by one (each needs its own `fits` and often its own scenes), square and landscape,
more recipes ("ตัวเลขเดียวจบ"), recipes under the existing themes, and an AI that chooses the recipe
from the brief.
