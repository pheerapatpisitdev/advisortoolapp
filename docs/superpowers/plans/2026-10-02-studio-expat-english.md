# iHealthy Ultra Expat Posts in English — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "คอนเทนต์สำหรับ Expat" tick on Organic Studio's แบบประกัน form (iHealthy Ultra + โพสต์ only) writes the piece in English, with six expat angles, English footer/poster lines, and pattern checks that understand English.

**Architecture:** The piece carries its language in its own JSON (`output.lang`, `poster.lang`; absent = Thai). Prompts stay Thai and gain one English-rules paragraph. Pattern checks (policy, numbers) run both languages on every piece. Copy that the code writes (footer, insurer line, default poster, numbers lines, proofread, picture prompts) picks by `lang`.

**Tech Stack:** Next.js 15 server actions, TypeScript, vitest (`tests/**/*.test.ts`, node env), satori poster rendering, Supabase (no migration).

**Spec:** `docs/superpowers/specs/2026-10-02-studio-expat-english-design.md`

## Global Constraints

- Only `href === "/ihealthy-ultra"` with `format === "post"` may produce an English piece; anything else sent with `expat` is written in Thai.
- A Thai piece's prompts, footer, poster, numbers lines and checks are byte-for-byte what they are today (every existing test passes unchanged).
- No migration: `lang` lives in `ins_content.output` (jsonb) and in `output.poster`.
- Staff-facing text (buttons, menus, flag messages, proofread `why`) stays Thai; only the post itself is English.
- `DISCLAIMER_EN` = `Please make sure you understand the coverage details and conditions before deciding to buy insurance.`
- `INSURER_LINE_EN` = `Underwritten by Krungthai-AXA Life Insurance PCL`
- Default-poster footer in English: `Message us to ask`
- Visa: never a visa type name, never a promise of approval — invite a message instead.
- Out of territory: emergency treatment only, within 90 days from the date of travel (`iHealthyFacts().terms.outOfTerritoryDays`), never "worldwide".
- `.env.local` points at the production database: a real round in the browser spends AI money and writes a real `ins_content` row (ask the owner first).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. An English piece whose poster is edited and saved in the editor: the browser sends a poster through `parsePoster`, which whitelists fields — `lang` must survive (server-owned, taken from the stored piece), or the reposted poster gains the Thai insurer line. Test in Task 7.
2. A stale page or forged request sending `expat: true` for another product, a script, or an ad, or an expat angle without the tick, or `tax` with the tick — must settle to Thai / "ให้ AI เลือก". Test in Task 3 (`settleExpat`).
3. An English piece whose writer returned no readable poster: every later caller falls back to `defaultPoster(..., "th")` with a Thai footer — so English pieces must always be saved with a poster. Test in Task 1 (`englishOutput`).
4. Ordinary English copy tripping a block rule and stopping the publish: "if you get sick", "when you change jobs", "message us to check your visa", "renewable up to age 98". Test in Task 2.
5. An English figure that equals the brief's Thai figure being flagged as stray ("THB 100 million" vs "100,000,000 บาท"), or a bare count like "3 reasons" being treated as a claim. Test in Task 2.

---

### Task 1: Language on the piece — output, poster, footer

**Files:**
- Modify: `src/lib/content/output.ts` (constants at :15-18, `footer` at :25-31, `ContentOutput` at :33)
- Modify: `src/lib/content/poster.ts` (`PosterSpec` :40-64, `parsePoster` :194-216, `defaultPoster` :219-225)
- Create: `src/lib/content/lang.ts`
- Test: `tests/content/output.test.ts`, `tests/content/poster.test.ts`, `tests/content/lang.test.ts` (new)

**Interfaces:**
- Produces (output.ts, browser-safe): `type Lang = "th" | "en"`; `langOf(o: { lang?: Lang } | undefined): Lang`; `DISCLAIMER_EN`, `INSURER_LINE_EN`; `insurerLine(lang: Lang): string`; `ContentOutput.lang?: "en"`; `footer(out)` reads `out.lang` (add `"lang"` to its `Pick`).
- Produces (poster.ts): `PosterSpec.lang?: "en"`; `parsePoster` keeps `lang` only when it is exactly `"en"`; `defaultPoster(hook: string, productName: string, lang: Lang = "th"): PosterSpec` (EN: footer `Message us to ask`, `lang: "en"` on the spec).
- Produces (lang.ts, server and browser): `englishOutput(o: ContentOutput, productName: string): ContentOutput` → `{ ...o, lang: "en", disclaimer: DISCLAIMER_EN, poster: { ...(o.poster ?? defaultPoster(o.hooks[0] ?? "", productName, "en")), lang: "en" } }`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/output.test.ts
it("an English piece ends on the English disclaimer and insurer, with no tax line", () => {
  const out = { hooks: ["Tax time"], body: "about tax", closing: "", hashtags: [], imagePrompt: "", disclaimer: DISCLAIMER_EN, lang: "en" as const };
  expect(footer(out)).toBe(`${DISCLAIMER_EN}\n${INSURER_LINE_EN}`);
  expect(fullText(out)).not.toMatch(/[฀-๿]/);
});
it("a Thai piece's footer is as before", () => { /* existing footer cases unchanged; add: no lang → INSURER_LINE */ });

// tests/content/poster.test.ts
it("keeps lang en through parsePoster and drops any other value", () => {
  const base = { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "Hi" }] };
  expect(parsePoster({ ...base, lang: "en" })?.lang).toBe("en");
  expect(parsePoster({ ...base, lang: "fr" })).not.toHaveProperty("lang");
  expect(decodePoster(encodePoster(parsePoster({ ...base, lang: "en" })!))?.lang).toBe("en");
});
it("draws an English default poster", () => {
  const p = defaultPoster("Cover that stays", "iHealthy Ultra", "en");
  expect(p.lang).toBe("en");
  expect(p.blocks.at(-1)).toEqual({ kind: "footer", text: "Message us to ask" });
  expect(defaultPoster("x", "y")).not.toHaveProperty("lang");
});

// tests/content/lang.test.ts
it("englishOutput stamps lang, the English disclaimer, and always a poster", () => {
  const o = englishOutput({ hooks: ["Hook"], body: "b", closing: "c", hashtags: [], imagePrompt: "", disclaimer: DISCLAIMER }, "iHealthy Ultra");
  expect(o).toMatchObject({ lang: "en", disclaimer: DISCLAIMER_EN, poster: { lang: "en" } });
  expect(o.poster!.blocks.some((b) => b.text === "Message us to ask")).toBe(true);
});
it("englishOutput keeps the writer's own poster and marks it", () => { /* poster with theme "rose" → same blocks, lang "en" */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/output.test.ts tests/content/poster.test.ts tests/content/lang.test.ts`
Expected: FAIL — `DISCLAIMER_EN` / `englishOutput` not exported, `lang` dropped.

- [ ] **Step 3: Implement** the Interfaces above. `footer`: when `langOf(out) === "en"` return disclaimer lines + `INSURER_LINE_EN` with no tax check; otherwise unchanged.

- [ ] **Step 4: Run to verify they pass**, then the whole content suite: `npx vitest run tests/content` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/output.ts src/lib/content/poster.ts src/lib/content/lang.ts tests/content/output.test.ts tests/content/poster.test.ts tests/content/lang.test.ts
git commit -m "feat(studio): a piece can carry English — footer, default poster, englishOutput"
```

---

### Task 2: Pattern checks that read English

**Files:**
- Modify: `src/lib/content/policy.ts` (rules :24-74, `checkPolicy` :150-162)
- Modify: `src/lib/content/check.ts` (`UNIT`/`AMOUNT` :19-26, `amounts` :48-57)
- Modify: `src/lib/content/poster-text.ts` (`squeeze` :28)
- Test: `tests/content/policy.test.ts`, `tests/content/check.test.ts`, `tests/content/poster-text.test.ts`

**Interfaces:**
- Produces: `POLICY_RULES_EN: PolicyRule[]` (exported); `checkPolicy` checks `[...POLICY_RULES, ...POLICY_RULES_EN, ...(recruit ? RECRUIT_POLICY_RULES : [])]`. Codes and severities exactly as the spec table: `health_you_en`, `debt_you_en`, `age_you_en`, `job_you_en`, `guarantee_en`, `pii_request_en` (block); `superlative_en` (warn); `visa_type_en`, `visa_promise_en` (block). Patterns are case-insensitive and match only assertions ("are you", "you are/you're", "you have", "your debts") — no look-back for if/when. `message`/`fix` in Thai; examples in `fix` in English.
- Produces: `numbersIn`/`claimedNumbers`/`strayNumbers` also read `THB 1,000`, `฿1,000`, `1,000 baht`, `1.5 million`, `100M`, `50k` (currency → `priced: true`; million = 1e6, M = 1e6, k/thousand = 1e3).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/policy.test.ts
const codes = (t: string) => checkPolicy(t).map((f) => f.code);
it.each([
  ["Are you sick of waiting rooms? Are you sick?", "health_you_en"],
  ["You have diabetes, so…", "health_you_en"],
  ["Are you in debt from hospital bills?", "debt_you_en"],
  ["Now that you're over 50, cover gets harder.", "age_you_en"],
  ["Lost your job last month?", "job_you_en"],
  ["100% approved, guaranteed acceptance.", "guarantee_en"],
  ["Send us your passport number to start.", "pii_request_en"],
  ["The best in Thailand.", "superlative_en"],
  ["Perfect for your O-A visa.", "visa_type_en"],
  ["Use it for a retirement visa.", "visa_type_en"],
  ["Your visa approved, guaranteed.", "visa_promise_en"],
])("catches %s", (text, code) => expect(codes(text)).toContain(code));
it.each([
  "If you get sick, the bill is covered up to the plan's limit.",
  "When you change jobs, your company plan ends.",
  "Message us to check your visa.",
  "Renewable up to age 98.",
  "Bring your passport when you visit us.",
])("lets %s through", (text) => expect(checkPolicy(text).filter((f) => f.code.endsWith("_en"))).toEqual([]));

// tests/content/check.test.ts
it("reads English amounts as the Thai ones", () => {
  expect(numbersIn("THB 100 million")).toEqual(numbersIn("100 ล้านบาท"));
  expect(numbersIn("฿1,029 a month")).toEqual([1029]);
  expect(numbersIn("1,000 baht")).toEqual([1000]);
  expect(numbersIn("100M a year")).toEqual([100_000_000]);
  expect(numbersIn("50k")).toEqual([50_000]);
  expect(strayNumbers("Up to THB 100 million a year", "- วงเงินค่ารักษาต่อปี ตั้งแต่ 1,000,000 ถึง 100,000,000 บาท")).toEqual([]);
  expect(claimedNumbers("3 reasons to look again")).toEqual([]);
  expect(claimedNumbers("THB 30")).toEqual([30]);
});

// tests/content/poster-text.test.ts
it("compares English read-back regardless of letter case", () => {
  expect(comparePosterRead("COVER THAT STAYS", { blocks: [{ kind: "headline", text: "Cover that stays" }] })).toEqual([]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/policy.test.ts tests/content/check.test.ts tests/content/poster-text.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `check.ts` extend `AMOUNT` so a currency may come before the digits (`THB`/`฿`) or after (`บาท`/`baht`/`THB`/`%`), and a unit after the digits may be Thai or `million|thousand|M|k` (word-bounded, case-insensitive for the words; `M`/`k` only directly after digits or one space). Keep the Thai groups' behaviour identical. In `poster-text.ts` lowercase inside `squeeze`.

- [ ] **Step 4: Run to verify they pass**, then `npx vitest run tests/content` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/policy.ts src/lib/content/check.ts src/lib/content/poster-text.ts tests/content/policy.test.ts tests/content/check.test.ts tests/content/poster-text.test.ts
git commit -m "feat(studio): the policy and number checks read English too"
```

---

### Task 3: Expat angles, the English brief and the English prompts

**Files:**
- Modify: `src/lib/content/prompt.ts` (`ANGLES` :32-58, `anglesFor` :78-80, `Steer` :132-141, `buildMessages` :281-291)
- Modify: `src/lib/content/plan.ts` (`planMessages` :56-86)
- Modify: `src/lib/content/brief.ts` (`briefFor` :34-57)
- Test: `tests/content/expat-prompt.test.ts` (new), `tests/content/brief.test.ts`

**Interfaces:**
- Produces (prompt.ts, browser-safe):
  - `EXPAT_HREF = "/ihealthy-ultra"`
  - `EXPAT_ANGLES` — `{ id, label, say }[]` with ids `expat_hospital`, `expat_visa`, `expat_job`, `expat_travel`, `expat_longstay`, `expat_english`; labels and `say` as the spec's table (Thai). `AngleId` includes these ids.
  - `anglesFor(format: Format, href: string, expat = false)` — `expat` true: `EXPAT_ANGLES` then `anglesFor(format, href)` without `tax` and `child`; false: unchanged.
  - `settleExpat(i: { href: string; format: string; expat?: boolean; angle: string }): { expat: boolean; angle: AngleId }` — `expat` only when `i.expat === true && href === EXPAT_HREF && format === "post"`; `angle` kept when it is `"custom"` or in `anglesFor(format, href, expat)`, else `""`.
  - `angleText` finds ids in `EXPAT_ANGLES` too.
  - `ENGLISH_RULES: string` — the spec's five bullets (English text), headed so the model sees it overrides the Thai-particle and Thai-word rules and the `imagePrompt` "คนไทย" line.
  - `Steer.lang?: Lang`; `buildMessages` and `planMessages` append `"\n\n" + ENGLISH_RULES` to the system content when `lang === "en"`.
- Produces (brief.ts): `briefFor(href: string, today?: Date, opts: { expat?: boolean } = {})` — with `expat` and `href === EXPAT_HREF`, appends the spec's "ข้อมูลสำหรับลูกค้าชาวต่างชาติ" block, its 90 taken from `iHealthyFacts().terms.outOfTerritoryDays`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/expat-prompt.test.ts
it("offers the expat angles only with the tick, without tax and child", () => {
  const ids = (e: boolean) => anglesFor("post", "/ihealthy-ultra", e).map((a) => a.id);
  expect(ids(true).slice(0, 6)).toEqual(["expat_hospital", "expat_visa", "expat_job", "expat_travel", "expat_longstay", "expat_english"]);
  expect(ids(true)).not.toContain("tax");
  expect(ids(true)).not.toContain("child");
  expect(ids(true)).toContain("numbers");
  expect(ids(false)).toEqual(anglesFor("post", "/ihealthy-ultra").map((a) => a.id));
  expect(ids(false).some((id) => id.startsWith("expat_"))).toBe(false);
});
it.each([
  [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "expat_visa" }, { expat: true, angle: "expat_visa" }],
  [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "tax" }, { expat: true, angle: "" }],
  [{ href: "/ihealthy-ultra", format: "post", angle: "expat_visa" }, { expat: false, angle: "" }],
  [{ href: "/ihealthy-ultra", format: "script", expat: true, angle: "expat_visa" }, { expat: false, angle: "" }],
  [{ href: "/ihealthy-ultra", format: "ad", expat: true, angle: "" }, { expat: false, angle: "" }],
  [{ href: "/lifeprotect", format: "post", expat: true, angle: "family" }, { expat: false, angle: "family" }],
  [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "custom" }, { expat: true, angle: "custom" }],
])("settles %o", (input, want) => expect(settleExpat(input)).toEqual(want));
it("adds the English rules to the planner and writer only for an English piece", () => {
  const ask = { brief: "b", format: "post" as const, angle: "" as const, custom: "", length: null, plans: [{ angle: "a", hook: "h" }] };
  expect(buildMessages({ ...ask, lang: "en" })[0].content).toContain(ENGLISH_RULES);
  expect(buildMessages(ask)[0].content).not.toContain(ENGLISH_RULES);
  const plan = { brief: "b", count: 1, angle: "", avoid: [], template: null };
  expect(planMessages({ ...plan, lang: "en" })[0].content).toContain(ENGLISH_RULES);
  expect(planMessages(plan)[0].content).toBe(planMessages({ ...plan, lang: "th" })[0].content);
});

// tests/content/brief.test.ts
it("gives an expat iHealthy brief the foreign-customer facts, the 90 days from the sheet", () => {
  const t = briefFor("/ihealthy-ultra", new Date("2026-10-02"), { expat: true })!.text;
  expect(t).toContain("ข้อมูลสำหรับลูกค้าชาวต่างชาติ");
  expect(t).toContain(`ภายใน ${iHealthyFacts().terms.outOfTerritoryDays} วัน`);
  expect(t).toMatch(/ห้ามระบุชื่อหรือประเภทวีซ่า/);
  expect(briefFor("/ihealthy-ultra", new Date("2026-10-02"))!.text).not.toContain("ชาวต่างชาติ");
  expect(briefFor("/lifeprotect", new Date("2026-10-02"), { expat: true })!.text).not.toContain("ชาวต่างชาติ");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/expat-prompt.test.ts tests/content/brief.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces. `briefFor` keeps its existing callers working (third param optional). The expat block goes after the cautions, inside the `lifelong(...)` join.

- [ ] **Step 4: Run to verify they pass**, then `npx vitest run tests/content` — Expected: PASS (existing `plan.test.ts`/`write.test.ts` unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/prompt.ts src/lib/content/plan.ts src/lib/content/brief.ts tests/content/expat-prompt.test.ts tests/content/brief.test.ts
git commit -m "feat(studio): expat angles, the foreign-customer brief, and the English rules for the writers"
```

---

### Task 4: ตัวเลขชัดๆ in English for iHealthy Ultra

**Files:**
- Modify: `src/lib/content/numbers-cases/price-lines.ts` (`priceLines` :27-43)
- Modify: `src/lib/content/numbers-cases/ihealthy.ts`
- Modify: `src/lib/content/numbers.ts` (`sexWord` :54, `NUMBERS_CLOSING` :58, `numbersPoster` :69-81, `FALLBACK_HEADLINES` :92-96, `headlineMessages` :100-117, `parseHeadlines`)
- Modify: `src/lib/content/numbers-plans.ts` (`numberSheets` :42-48)
- Test: `tests/content/numbers.test.ts`, `tests/content/numbers-plans.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 1), `ENGLISH_RULES` (Task 3).
- Produces:
  - `priceLines(modes, expired, firstYear = false, lang: Lang = "th")` — EN copy: premium `First-year premium THB {total}/month` (or `Premium THB {total}/month`), per day `About THB {day} a day in the first year` (or `About THB {day} a day`), big `THB {total}/month` (or the per-day line). Same numbers as Thai.
  - `iHealthyNumbersEn: PricedPlan` in `ihealthy.ts`, sharing the cases and pricing with `iHealthyNumbers` through one private helper; claims `Lump-sum medical cover each year` / `Renewable up to age {renew}` / `{ncd}% premium discount after 3 years with no claims`; `sumLine` `Medical cover up to THB {annualMax} a year`; `sumNote` `A package with life cover of THB {sum}{ and daily cash}`; `who` `{Female|Male}, {age}`; `poster.small` `Up to THB {annualMax} a year · about THB {day} a day in year one`.
  - `sexWordEn(s)`, `NUMBERS_CLOSING_EN = "Message us for the premium at your age"`, `FALLBACK_HEADLINES_EN = ["Real numbers, no guessing", "Big medical cover, a premium you can plan for", "Check the numbers before you decide"]`.
  - `headlineMessages(sheets, lang: Lang = "th")` appends `ENGLISH_RULES` to its system content for EN; `parseHeadlines(reply, count, lang = "th")` uses `FALLBACK_HEADLINES_EN` for EN.
  - `numbersPoster(s, theme, lang = "th")` — EN strips the trailing day part with `/\s*·\s*about THB [\d,]+ a day.*$/` when `s.poster.big` contains `a day`.
  - `numberSheets(href, count, today = new Date(), lang: Lang = "th")` — EN reads `EXPAT_NUMBERS_PLANS = { "/ihealthy-ultra": iHealthyNumbersEn }` (others give `[]`) and skips `lifelongSheet`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/numbers-plans.test.ts
it("prices iHealthy Ultra in English with the same figures", () => {
  const th = numberSheets("/ihealthy-ultra", 3, TODAY);
  const en = numberSheets("/ihealthy-ultra", 3, TODAY, "en");
  expect(en).toHaveLength(th.length);
  for (const [i, s] of en.entries()) {
    expect(numbersIn(numbersBody(s))).toEqual(expect.arrayContaining(numbersIn(numbersBody(th[i])).filter((n) => n >= 100)));
    expect(`${numbersBody(s)}\n${s.poster.big}\n${s.poster.small}`).not.toMatch(/[฀-๿]/);
  }
  expect(numberSheets("/lifeprotect", 1, TODAY, "en")).toEqual([]);
});

// tests/content/numbers.test.ts
it("falls back to English headlines and closes in English", () => {
  expect(parseHeadlines("not json", 2, "en").map((h) => h.headline)).toEqual(FALLBACK_HEADLINES_EN.slice(0, 2));
  expect(headlineMessages([], "en")[0].content).toContain(ENGLISH_RULES);
  expect(headlineMessages([])[0].content).not.toContain(ENGLISH_RULES);
});
```

(`TODAY` = the date the existing iHealthy case in `numbers-plans.test.ts` uses.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/numbers.test.ts tests/content/numbers-plans.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces. The NUMBERS_HREFS/NUMBERS_PLANS test that holds the two lists together is untouched.

- [ ] **Step 4: Run to verify they pass**, then `npx vitest run tests/content` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/numbers.ts src/lib/content/numbers-plans.ts src/lib/content/numbers-cases/ihealthy.ts src/lib/content/numbers-cases/price-lines.ts tests/content/numbers.test.ts tests/content/numbers-plans.test.ts
git commit -m "feat(studio): ตัวเลขชัดๆ for iHealthy Ultra in English"
```

---

### Task 5: English on the poster and in the picture prompts

**Files:**
- Modify: `src/lib/content/poster-draw.tsx` (`InsurerLine` :77-96)
- Modify: `src/lib/content/background.ts` (`backgroundPrompt` :99-190, `posterPrompt` :203-226)
- Test: `tests/content/background.test.ts`, `tests/content/poster-png.test.ts` (or a new `insurerLine` assertion in `output.test.ts` if drawing is too heavy)

**Interfaces:**
- Consumes: `insurerLine(lang)`, `langOf` (Task 1).
- Produces: `InsurerLine` renders `insurerLine(langOf(spec))`. `backgroundPrompt({ ..., lang?: Lang })` and `posterPrompt({ ..., lang?: Lang })`: for `"en"` every `Thai headline text` reads `English headline text`; `Thai people in a Thai setting` reads `Foreign residents of mixed nationalities, living in Thailand, in a Thai setting`; the default scene reads `A believable everyday moment of an expat living in Thailand, warm and unposed.`; `posterPrompt` says `the English lettering`, `The words on the image, in English — … clearly legible typeface`, and `Keep every word whole and correctly spelled`. Absent/`"th"` = today's strings.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/background.test.ts
it("asks for English lettering and expat people on an English piece", () => {
  const bg = backgroundPrompt({ scene: "", layout: "bottom", theme: "navy", lang: "en" });
  expect(bg).toContain("English headline text");
  expect(bg).not.toContain("Thai headline text");
  expect(bg).toContain("expat");
  const p = posterPrompt({ direction: "clean", poster: { blocks: [{ kind: "headline", text: "Cover that stays" }] }, layout: "bottom", lang: "en" });
  expect(p).toContain("in English");
  expect(p).not.toMatch(/Thai lettering|Thai typeface/);
  expect(backgroundPrompt({ scene: "", layout: "bottom", theme: "navy" })).toContain("Thai headline text");
});
```

Cover each `backgroundPrompt` branch (plain, `look`, `request`) that today says "Thai headline text".

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/content/background.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces.

- [ ] **Step 4: Run to verify it passes**, then `npx vitest run tests/content` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/poster-draw.tsx src/lib/content/background.ts tests/content/background.test.ts
git commit -m "feat(studio): English posters say who insures them in English; pictures are asked for English lettering"
```

---

### Task 6: สูตรอ่าน-ดูจนจบ and the proofreader in English

**Files:**
- Modify: `src/lib/content/finish-check.ts` (`PREAMBLE`/`WEAK_OPENERS` :30-31, `COUNT` :129, checks :202-210)
- Modify: `src/lib/content/proofread.ts` (`SYSTEM` :17-24, `proofread` :40)
- Test: `tests/content/finish-check.test.ts`, `tests/content/proofread.test.ts`

**Interfaces:**
- Produces: `PREAMBLE` adds `Hello`, `Hi everyone`, `Today we`, `Today I`, `Let's talk about`, `Did you know`; `WEAK_OPENERS` adds `We recommend`, `Which`, `However`, `Moreover`, `Therefore`, `And`, `Also`, `Actually`; both compared case-insensitively. `COUNT` also matches `(\d+)\s*(?:reasons?|things?|tips?|ways?|mistakes?|questions?|steps?)\b` (case-insensitive).
- Produces: `proofread(post: string, lang: Lang = "th")` — EN uses an English system prompt (spelling, grammar, unnatural phrasing for a non-native reader; never change numbers, the plan name, hashtags or meaning; `find` copied exactly; `why` written in Thai; same JSON shape and limit of 8).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/content/finish-check.test.ts
it("flags an English preamble hook and holds an English count to its list", () => {
  const out = { hooks: ["Today we want to talk about cover"], body: "1. a\n2. b", closing: "", hashtags: [], imagePrompt: "", disclaimer: "", lang: "en" as const, formula: "finish" as const };
  expect(finishChecks(out, "post").find((c) => c.id === "no-preamble")?.ok).toBe(false);
  expect(finishChecks({ ...out, hooks: ["today we…"] }, "post").find((c) => c.id === "no-preamble")?.ok).toBe(false);
  // the hook promises 3, the body lists 2
  expect(finishChecks({ ...out, hooks: ["3 reasons to look again"] }, "post").find((c) => c.id === "list-count")?.ok).toBe(false);
  expect(finishChecks({ ...out, hooks: ["Cover that stays"], body: "However, it renews." }, "post").find((c) => c.id === "lead-words")?.ok).toBe(false);
});

// tests/content/proofread.test.ts
it("asks an English editor for an English post", async () => {
  ai.chat.mockResolvedValue({ text: '{"fixes":[]}', costThb: 0 });
  await proofread("Cover that stay with you", "en");
  expect(ai.chat.mock.calls[0][0].messages[0].content).toMatch(/English/);
  await proofread("โพสต์");
  expect(ai.chat.mock.calls[1][0].messages[0].content).toMatch(/บรรณาธิการภาษาไทย/);
});
```

`finishChecks` returns `{ id, label, ok, where }[]`; follow `proofread.test.ts`'s existing mock of `@/lib/ai/client`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/finish-check.test.ts tests/content/proofread.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces.

- [ ] **Step 4: Run to verify they pass**, then `npx vitest run tests/content` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/finish-check.ts src/lib/content/proofread.ts tests/content/finish-check.test.ts tests/content/proofread.test.ts
git commit -m "feat(studio): the finish checklist and the proofreader read English"
```

---

### Task 7: The server writes, edits, proofreads and draws English pieces

**Files:**
- Modify: `src/app/studio/actions.ts` — `GenerateInput` (:106-135), `generateContent` (:179-316), `proofreadPiece` (:382-401), `learnFormula` (:419-433), `saveContentEdits` (:563-640), `drawBackground` (:833-850)
- Test: `tests/content/actions-page.test.ts`

**Interfaces:**
- Consumes: `settleExpat`, `EXPAT_HREF` (Task 3); `briefFor(href, today, { expat })` (Task 3); `englishOutput`, `langOf` (Task 1); `numberSheets(..., lang)`, `NUMBERS_CLOSING_EN`, `headlines(sheets, { budgetMs, lang })` (Task 4 — add `lang` to `headlines` in `write.ts`, passed to `headlineMessages`/`parseHeadlines`); `proofread(text, lang)` (Task 6); `backgroundPrompt`/`posterPrompt` `lang` (Task 5).
- Produces: `GenerateInput.expat?: boolean`.
- Behaviour:
  - `generateContent`: `const { expat, angle } = settleExpat(input)` replaces the current angle line; `lang = expat ? "en" : "th"`; `briefFor(input.href, undefined, { expat })`; `reader` defaults to `ชาวต่างชาติที่อาศัยอยู่ในไทย (expat)` when `expat` and empty; `lang` passed to `plan(...)` and `write(...)` (via `Steer`); every saved output of an English round goes through `englishOutput(dressed(o), brief.product.name)` (the numbers path too: English sheets, `NUMBERS_CLOSING_EN`, `numbersPoster(s, theme, "en")`, headlines in English). Thai rounds are untouched.
  - `learnFormula`: returns at once when `langOf(item.output) === "en"`.
  - `saveContentEdits`: `lang` on the poster is server-owned like `aiText` — delete the browser's, then set `output.poster.lang = "en"` when `langOf(item.output) === "en"`.
  - `proofreadPiece`: `proofread(text, langOf(item.output))`.
  - `drawBackground`: fallback `defaultPoster(..., langOf(item.output))`; `lang: langOf(item.output)` to `backgroundPrompt`/`posterPrompt`.

- [ ] **Step 1: Write the failing tests** (in `actions-page.test.ts`, with its existing store/ai mocks)

```ts
it("writes an expat numbers round on iHealthy Ultra in English", async () => {
  ai.chat.mockResolvedValue({ text: "{}", model: "m", costThb: 0 }); // headlines fall back
  const r = await generateContent({ href: "/ihealthy-ultra", format: "post", angle: "numbers", custom: "", length: null, count: 1, hookTemplateId: null, expat: true });
  expect(r.ok).toBe(true);
  const o = (r as { items: ContentItem[] }).items[0].output;
  expect(o).toMatchObject({ lang: "en", disclaimer: DISCLAIMER_EN, closing: NUMBERS_CLOSING_EN, poster: { lang: "en" } });
  expect(fullText(o)).not.toMatch(/[฀-๿]/);
});
it("writes the same request for another plan in Thai", async () => { /* href = a NUMBERS_PLANS key other than /ihealthy-ultra, expat: true → output.lang undefined */ });
it("keeps an English poster English through an edit from the browser", async () => {
  row = make(null, { ...output, lang: "en", poster: { ...output.poster!, lang: "en" } });
  const { lang: _, ...sent } = row.output.poster!;
  const r = await saveContentEdits("p1", edits({ poster: sent }));
  expect(r.ok && r.item.output.poster?.lang).toBe("en");
});
it("does not take a browser's word that a Thai poster is English", async () => {
  const r = await saveContentEdits("p1", edits({ poster: { ...output.poster!, lang: "en" } }));
  expect(r.ok && r.item.output.poster).not.toHaveProperty("lang");
});
it("proofreads an English piece with the English editor", async () => { /* row lang en; ai.chat reply {"fixes":[]}; system content matches /English/ */ });
it("learns no hook formula from an English piece", async () => { /* setContentStatus("p1","used") on an EN row → no chat call with task "content-hook-template" */ });
```

The numbers round needs a live iHealthy rate table: first assert `numberSheets("/ihealthy-ultra", 1, new Date()).length > 0` in the test, and `expect(store.saveContent)` (mock it the way the existing numbers test at :335 does).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/content/actions-page.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the behaviour above.

- [ ] **Step 4: Run to verify they pass**, then `npx vitest run` and `npx tsc --noEmit` — Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/actions.ts src/lib/content/write.ts tests/content/actions-page.test.ts
git commit -m "feat(studio): a round ticked for expats is written, edited, proofread and drawn in English"
```

---

### Task 8: The tick on the form, and EN on the piece

**Files:**
- Modify: `src/app/studio/ContentStudio.tsx` (state :251-300, `generate` :597-614, เรื่องที่เล่า :1135-1165)
- Modify: `src/app/studio/PieceCard.tsx` (meta line :105), `src/app/studio/PieceEditor.tsx` (header)

**Interfaces:**
- Consumes: `anglesFor(format, href, expat)`, `EXPAT_HREF` (Task 3); `langOf` (Task 1); `GenerateInput.expat` (Task 7).

- [ ] **Step 1: Implement the form.**
  - `const [expat, setExpatState] = useState(false)`, kept in localStorage under a new `EXPAT_KEY` the same way `READER_KEY` is.
  - `const expatOn = expat && href === EXPAT_HREF && format === "post"`.
  - In เรื่องที่เล่า, above มุมที่อยากเล่า, when `href === EXPAT_HREF && format === "post"`: a checkbox labelled `คอนเทนต์สำหรับ Expat (เขียนเป็นภาษาอังกฤษ)`.
  - The angle `<select>` and the cleanup effect at :291 use `anglesFor(format, href, expatOn)`.
  - When `expatOn`: hide the ทุกคน/`NICHES` chips; the reader input's placeholder reads `เช่น retirees, expat families — ไม่ใส่ = ชาวต่างชาติที่อยู่ไทย`.
  - `generate()` sends `expat: expatOn`.
- [ ] **Step 2: Implement the badge.** `PieceCard` meta line appends ` · EN` when `langOf(item.output) === "en"`; `PieceEditor` shows the same `EN` beside its title.
- [ ] **Step 3: Check types and lint**

Run: `npx tsc --noEmit && npx eslint src/app/studio`
Expected: no errors.

- [ ] **Step 4: Check it in the browser** (preview the dev server per `.claude/launch.json`, sign in as the test user, open `/studio/write`):
  - แบบประกัน → iHealthy Ultra → โพสต์: the tick shows; ticked → the six expat angles lead the menu, ลดหย่อนภาษี and ซื้อให้ลูก are gone, the reader chips are hidden; unticked → the form as before.
  - Pick `expat_visa`, then change to another plan → the tick disappears and the angle returns to ให้ AI เลือก; back to iHealthy → the tick is remembered, the angle stays ให้ AI เลือก.
  - Script or โฆษณา → no tick.
  - Do **not** press สร้าง (it writes to the production database) unless the owner said yes in this session.
- [ ] **Step 5: Commit**

```bash
git add src/app/studio/ContentStudio.tsx src/app/studio/PieceCard.tsx src/app/studio/PieceEditor.tsx
git commit -m "feat(studio): the คอนเทนต์สำหรับ Expat tick, and EN on English pieces"
```

---

### Task 9: Whole-branch verification

- [ ] **Step 1:** `npm run verify` — Expected: tsc, lint, every test and the production build pass.
- [ ] **Step 2:** With the owner's yes only: one real expat round (1 piece) on a test Page; read the post and poster (English footer, English insurer line, no Thai); open it in the editor, change one poster word, save, and confirm the poster still reads `Underwritten by …`; move the piece to the bin.
- [ ] **Step 3:** Report the results to the owner; production rollout follows the project's usual path (merge to main → Vercel), no migration to run first.
