# Ads Studio: English ads for iHealthy Ultra on Expat Pages

Date: 2026-10-06 · Owner: "iHealthy Ultra กับเพจ expat ทั้งหมด", approved design in chat ("ทำเลย").

## Rule
A campaign is English when its plan is `/ihealthy-ultra` AND its Page `isExpatPage` (src/lib/assistant/expat.ts). Everything else stays Thai. No setting, no migration: the language is derived (`campaignLang(planHref, pageId)` pure helper, used by the round, the preview, the drawer and the UI).

## What changes for an English campaign
- **Figures (code):** an English ladder for iHealthy (same rungs SMART/BRONZE/SILVER/GOLD, same engine call — `iHealthyNumbersEn`), English table/headline text: heading = the English sumLine, note = English sumNote, cells `🙆‍♀️ Female = 19,415 THB/yr (about 1,618 a month)` / `🕵️‍♂️ Male = …`, term line `First-year premium · renewable … (age 30)` (from the English sheet wording; first-year prefix "First-year premium"), headline `💁‍♀️ <heading> (<note>)` / `💰 First-year premium N THB/yr (about M a month) (Female, 30)`. Figures must equal the Thai table's for every row, sex and age (test).
- **Contacts:** `👉 <agent>` · `📲 Line: @id` · `👉 Inbox: url`; none → `Message us`.
- **Writer & planner:** the expat brief (`briefFor(href, undefined, { expat: true })`, premium/sample-people stripping applied as for Thai), lang "en" (ENGLISH_RULES), English long-ad system rules (opening ≤125 chars standalone, 5–8 🥇 bullets, a free-quote CTA asking sex and age, 6–12 hashtags, no premiums in words, no superlatives: "best", "cheapest", "No.1", "number one", "best-selling"), English owner line ("This ad is for: Female, 30 · <heading>. Mention only this sex, age and cover…").
- **Flags (write time):** English premium phrases (`THB` / `baht` / `฿` amounts next to premium, per month, a month, monthly, per year, a year, yearly, a day, per day, /mo, /month, /yr, /year, /day) and other-person phrases (`male|female|man|woman`, `aged N`, `N-year-old`, `N years old`, ranges and "men and women"/children excluded) — same structure as the Thai ones; table cells still flagged.
- **Output:** `output.lang = "en"` (existing field) so the editor's checks use the expat brief; `englishOutput` disclaimer as Organic does.
- **UI (Thai chrome):** an "EN" chip on the campaign row and ad rows, preview CTA "Send message", drawer preview shows the English figures; the reader chips use EXPAT_NICHES for English campaigns; the angle list uses `anglesFor("ad", href, true)`.

## Testing
English table equals Thai figures (all rungs × sexes × ages 6–80 sample); text golden for one case; flags EN; round writes en (planner/writer get lang en + expat brief + owner line EN); campaignLang truth table.
