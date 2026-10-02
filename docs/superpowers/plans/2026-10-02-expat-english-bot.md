# Expat English Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the two Expat Facebook Pages, the Messenger bot sells iHealthy Ultra in English (Thai when the customer writes Thai), while every other Page behaves exactly as today.

**Architecture:** A separate English health brain (`src/lib/assistant/ihealthy-en/`) mirrors the order of checks in the Thai brain (`src/lib/assistant/ihealthy/answer.ts`) but owns its own words and English routing; all figures come from the same engine calls (`iHealthyTable`, `iHealthyPricing`, `plansFor`, `cardPath`, `cardQuery`, `iHealthyQuoteText(…, WORDS.en)`, `translateFacts(…, "en")`). `answerAny` gains a `pageId`; an Expat Page short-circuits to a door that picks English or Thai per message. The Thai brain is not edited except to export `merge` from its router.

**Tech Stack:** Next.js (App Router), TypeScript, vitest, `@/lib/ai/client` `chat()` (mocked in tests).

**Spec:** `docs/superpowers/specs/2026-10-02-expat-english-bot-design.md`

## Global Constraints

- Expat Pages: `112079600278201` (Expat Influencer Insurance), `112110731809903` (Expat Insurance Thailand by Phet). No other Page changes behaviour.
- Language: Thai script in the message → `th`; Latin letters forming a word → `en`; otherwise the conversation's previous language; no previous → `en`. Any other script (Chinese, Russian…) → `en`.
- Product on an Expat Page is always iHealthy Ultra — never the three-plan undecided menu.
- No English reply may contain a Thai character (`/[฀-๿]/`). Card URLs may (they carry Thai territory values only via the query builder — assert on `text` only).
- "Apply" in English never sends `APPLICATION_FORM` (ktaxaform) or `APPLY_STEPS`; it hands over to an agent and sets `formSent: true`.
- Visa: speak broadly, never name a visa type, never say "guarantee"/"guaranteed".
- Abroad: emergency only within 90 days of a trip. The word "worldwide" appears only in a quote whose territory is ทั่วโลก (from `WORDS.en.territory`).
- Health conditions: never say a condition is or will be covered/accepted; the insurer decides; do not send medical details in chat.
- Model never words a premium: every model reply passes `keepGivenFigures`.
- Quick-reply titles ≤ 20 characters.
- No DB migration: language lives in `HealthSlots.lang` (`"en"` or absent = Thai).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A customer writes "I'm 35, male" then just "Gold" — the plan turn has no age/sex, must carry slots and quote (merge). Pinned in Task 3.
2. A customer writes Thai mid-conversation after an English quote, then English again — age/sex must survive both switches. Pinned in Task 6.
3. An agent-facing failure path (model throws / budget) on an Expat Page must apologise in English, not Thai. Pinned in Task 6.
4. Age outside the table range ("I'm 80") in English must not be quoted and must hand over in English. Pinned in Task 4.
5. A woman-voiced Page rewrite (`spokenBy` ครับ→ค่ะ) must leave English text byte-identical. Pinned in Task 1.

---

### Task 1: Expat Pages and the language rule

**Files:**
- Create: `src/lib/assistant/expat.ts`
- Test: `tests/chat/expat-lang.test.ts`

**Interfaces:**
- Produces: `EXPAT_PAGES: Set<string>`, `isExpatPage(pageId?: string): boolean`, `type ChatLang = "en" | "th"`, `languageOf(text: string, previous?: ChatLang): ChatLang`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isExpatPage, languageOf } from "@/lib/assistant/expat";
import { spokenBy } from "@/lib/assistant/voice";

describe("expat pages", () => {
  it("knows the two Expat Pages and nothing else", () => {
    expect(isExpatPage("112079600278201")).toBe(true);
    expect(isExpatPage("112110731809903")).toBe(true);
    expect(isExpatPage("103716981993581")).toBe(false);
    expect(isExpatPage(undefined)).toBe(false);
  });
});

describe("languageOf", () => {
  it.each([
    ["For more information", undefined, "en"],
    ["สนใจครับ", undefined, "th"],
    ["35", "th", "th"],
    ["35", "en", "en"],
    ["35", undefined, "en"],
    ["👍", "th", "th"],
    ["我想了解保险", undefined, "en"],
    ["Gold แผนนี้", "en", "th"],
  ] as const)("%s (was %s) → %s", (text, prev, want) => {
    expect(languageOf(text, prev)).toBe(want);
  });
});

describe("the woman-voice rewrite", () => {
  it("leaves English untouched", () => {
    const text = "Hi! Could you share your age and gender? I'll work out your premium.";
    expect(spokenBy("female", text)).toBe(text);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/chat/expat-lang.test.ts` — Expected: FAIL (module not found)
- [ ] **Step 3: Implement `src/lib/assistant/expat.ts`** — a `Set` like `SPEAKS_AS_A_MAN` in `voice.ts` (with the Page name in a comment beside each id); `languageOf`: Thai range `/[฀-๿]/` → `th`, else `/[A-Za-z]{2,}/` → `en`, else `previous ?? "en"`.
- [ ] **Step 4: Run** the test — Expected: PASS
- [ ] **Step 5: Commit** `feat(chat): the two Expat Pages and how a message picks its language`

---

### Task 2: The comparison card in English

**Files:**
- Modify: `src/lib/ihealthy-card.ts` (`iHealthyTableCard`, the `headLine`)
- Test: `tests/calc/ihealthy-table-card.test.ts` (append)

**Interfaces:**
- Produces: `/api/ihealthy-card/table?…&l=en` draws an English card (`iHealthyCard` already reads `l`; only the heading is hard-coded Thai).

- [ ] **Step 1: Write the failing test** (append to the existing file, reusing its `query` helper)

```ts
describe("the comparison table in English", () => {
  it("is headed, and says who it is for, in English", () => {
    const card = iHealthyTableCard(query({ l: "en" }));
    expect(card.headLine).toBe("iHealthy Ultra · Compare plans");
    expect(card.insuredWho).not.toMatch(/[฀-๿]/);
    expect(card.insuredLine).not.toMatch(/[฀-๿]/);
  });

  it("is still Thai without l", () => {
    expect(iHealthyTableCard(query()).headLine).toBe("iHealthy Ultra · เปรียบเทียบแผน");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/calc/ihealthy-table-card.test.ts` — Expected: the English case FAILS
- [ ] **Step 3: Implement** — `headLine: card.lang === "en" ? "iHealthy Ultra · Compare plans" : "iHealthy Ultra · เปรียบเทียบแผน"`. If `insuredWho`/`insuredLine` still contain Thai, fix them at their source in `iHealthyCard` using `WORDS[lang]` (the quote card already does this for its own lines).
- [ ] **Step 4: Run** the test — Expected: PASS
- [ ] **Step 5: Commit** `feat(card): the iHealthy comparison card can be drawn in English`

---

### Task 3: English words and English routing

**Files:**
- Create: `src/lib/assistant/ihealthy-en/words.ts`, `src/lib/assistant/ihealthy-en/route.ts`
- Modify: `src/lib/assistant/ihealthy/route.ts` — add `lang?: "en"` to `HealthSlots`; `export` the existing `merge`; make `merge` carry `lang` from `current` (current wins, so the caller sets it).
- Test: `tests/chat/ihealthy-en-route.test.ts`

**Interfaces:**
- Consumes: `planNamedIn` (already reads English plan names and "10 ล้าน"), `merge`, `HealthSlots` from `../ihealthy/route`
- Produces (`route.ts`): `personInEn(text: string): { age?: number; sex?: "M" | "F" }`, `territoryNamedInEn(text: string): string | undefined` (returns the table's Thai label: `"ทั่วโลก" | "เอเชีย" | "ประเทศไทย"`), `planNamedInEn(text: string): string | undefined` (`planNamedIn` plus `/(\d+)\s*(?:million|m)\b/i` by ceiling from `iHealthyFacts().plans`), `routeHealthEn(history: ChatMessage[], previous: HealthSlots | null): Promise<HealthSlots>` (always returns `lang: "en"`)
- Produces (`words.ts`): every fixed English string and button title used by Tasks 4–6, as named exports. Button titles: `SEE_OTHER_PLANS_EN = "See other plans"`, `PLAN_BENEFITS_EN = "Plan benefits"`, `WANTS_IN_EN = "I want to apply"`.

- [ ] **Step 1: Write the failing test** (mock `@/lib/ai/client` `chat` as in `tests/calc/ihealthy-assistant-answer.test.ts`; task name `route_health_en`)

```ts
it.each([
  ["I'm 35, male", { age: 35, sex: "M" }],
  ["35 years old female", { age: 35, sex: "F" }],
  ["F 42", { age: 42, sex: "F" }],
  ["my age is 50 and I'm a woman", { age: 50, sex: "F" }],
  ["male", { sex: "M" }],
])("personInEn(%s)", (text, want) => expect(personInEn(text)).toEqual(want));

it("does not read a plan ceiling or a year as an age", () => {
  expect(personInEn("10 million plan").age).toBeUndefined();
  expect(personInEn("since 2019").age).toBeUndefined();
});

it("reads territories into the table's labels", () => {
  expect(territoryNamedInEn("Asia please")).toBe("เอเชีย");
  expect(territoryNamedInEn("worldwide cover")).toBe("ทั่วโลก");
  expect(territoryNamedInEn("Thailand only")).toBe("ประเทศไทย");
});

it("carries age and sex into the turn that only names a plan", async () => {
  routed = { intent: "other" };
  const first = await routeHealthEn(said("I'm 35, male"), null);
  const second = await routeHealthEn(said("Gold"), first);
  expect(second).toMatchObject({ age: 35, sex: "M", plan: "GOLD", intent: "quote", lang: "en" });
});

it("never takes the plan from the model", async () => {
  routed = { intent: "quote", plan: "PLATINUM" };
  const s = await routeHealthEn(said("how much is it"), { product: "ihealthy", intent: "quote", plan: "GOLD" });
  expect(s.plan).toBe("GOLD");
});

it("does not call the model when the message is read by pattern alone", async () => {
  await routeHealthEn(said("35 male"), null);
  expect(chat).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/chat/ihealthy-en-route.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** — `routeHealthEn`: read age/sex/plan/territory by pattern; if the message yields an age, sex or plan and is ≤ 6 words, set `intent: "quote"` and skip the model; otherwise call `chat({ tier: "small", task: "route_health_en", json: true, maxTokens: 250 })` with an English twin of the Thai `SYSTEM` prompt (same three intents, same fields). Model may supply `intent`, `age` (0–99), `sex`, `question`; plan and territory come only from the message (same rule as the Thai `clean`). Pattern values beat model values. Then `merge(previous, cleaned)` and set `lang: "en"`. Age pattern: a 1–2 digit number not followed by `million|m|k|,000` and not part of a 4-digit number.
- [ ] **Step 4: Run** the test — Expected: PASS; also run `npx vitest run tests/calc/ihealthy-assistant-route.test.ts` — Expected: PASS (Thai router unchanged)
- [ ] **Step 5: Commit** `feat(chat): English words and routing for the iHealthy brain`

---

### Task 4: English quote, menu and plan answers

**Files:**
- Create: `src/lib/assistant/ihealthy-en/quote.ts`
- Test: `tests/chat/ihealthy-en-quote.test.ts`

**Interfaces:**
- Consumes: `arrangementFor` from `../ihealthy/quote`, engine calls listed in Architecture, `words.ts`
- Produces: `healthQuoteEn(slots: HealthSlots & { age: number; sex: Sex; plan: string }, today?: Date): Reply`, `healthMenuEn(age: number, sex: Sex, today?: Date): Reply`, `otherPlansEn(age: number, sex: Sex, today?: Date): Reply`, `cheaperEn(age: number, sex: Sex, plan?: string): Reply`, `territoryAnswerEn(slots: HealthSlots & { age: number; sex: Sex; plan: string }, wanted: string): Reply & { slots: HealthSlots }`, `fullTableLinkEn(slots): Reply`, `HAND_OVER_EN: string`

Each is the Thai function of the same name in `ihealthy/quote.ts` / `ihealthy/menu.ts` / `ihealthy/answer.ts` with the same branches, English words, `cardPath(table, v, "en")`, table card URL with `&l=en`, plan names via `planLabel` (already English), territory names via `WORDS.en.territory`, quote text via `iHealthyQuoteText(facts, WORDS.en)`, full-table link `siteUrl("/ihealthy-ultra?" + query)` as-is — the page picks its language from the `ihu-lang` cookie only, so the message says: `"The full benefit table is on this page, with your age and plan filled in — tap English at the top to read it in English."`

Copy fixed by this plan:
- `HAND_OVER_EN = "An agent will continue with you right here in this chat. Meanwhile, feel free to ask anything about iHealthy Ultra."`
- Menu heading: `` `${Male|Female}, age ${age} — yearly premium 🏥` `` then one line per plan `` `${name} ${amount} THB` ``, then `(Includes the base life policy ${base} sum ${sa} and daily cash benefit · treatment costs paid as charged on every plan)`

- [ ] **Step 1: Write the failing test**

```ts
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const, lang: "en" as const };
const THAI = /[฀-๿]/;

it("quotes Gold with the engine's own figures, in English", () => {
  const en = healthQuoteEn({ ...KNOWN, plan: "GOLD" });
  const th = healthQuote({ ...KNOWN, plan: "GOLD" });
  expect(en.messages[0].text).not.toMatch(THAI);
  expect(en.messages[0].card).toContain("l=en");
  expect(en.quote).toEqual(th.quote);
  expect(en.replies).toEqual(["See other plans", "Plan benefits", "I want to apply"]);
});

it("menu: three plans, English, English card", () => {
  const m = healthMenuEn(35, "F");
  expect(m.replies).toEqual(["Bronze", "Silver", "Gold"]);
  expect(m.messages[0].text).not.toMatch(THAI);
  expect(m.messages[0].card).toMatch(/\/api\/ihealthy-card\/table\?.*l=en/);
});

it("an age out of range is handed over, in English, unpriced", () => {
  const r = healthMenuEn(80, "M");
  expect(r.messages[0].text).toContain(HAND_OVER_EN);
  expect(r.messages[0].card).toBeUndefined();
  expect(healthQuoteEn({ ...KNOWN, age: 80, plan: "GOLD" }).priced).toBeFalsy();
});

it("other plans, cheaper, territory and full table speak English", () => {
  for (const r of [
    otherPlansEn(35, "F"), cheaperEn(35, "F", "SILVER"), cheaperEn(35, "F", "BRONZE"),
    territoryAnswerEn({ ...KNOWN, plan: "BRONZE" }, "ทั่วโลก"), fullTableLinkEn({ ...KNOWN }),
  ]) for (const m of r.messages) expect(m.text).not.toMatch(THAI);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/chat/ihealthy-en-quote.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** `src/lib/assistant/ihealthy-en/quote.ts` per the Interfaces block.
- [ ] **Step 4: Run** the test — Expected: PASS
- [ ] **Step 5: Commit** `feat(chat): iHealthy quotes, menu and plan answers in English`

---

### Task 5: English FAQ and model prompts

**Files:**
- Create: `src/lib/assistant/ihealthy-en/faq.ts`, `src/lib/assistant/ihealthy-en/prompts.ts`
- Test: `tests/chat/ihealthy-en-faq.test.ts`

**Interfaces:**
- Produces: `healthFaqAnswerEn(text: string): string | undefined`; `HEALTH_PLAN_INFO_SYSTEM_EN: string`, `HEALTH_SMALL_TALK_SYSTEM_EN: string`, `healthFactsForEn(slots: HealthSlots, today?: Date): string` (the Thai `healthFactsFor` built from `translateFacts(iHealthyFacts(), "en")` and English labels).

FAQ entries, in this order (first match wins; keys for the test):
1. `health` — `/pre-?existing|condition|diabetes|blood pressure|hypertension|cancer|heart|surgery|asthma|thyroid|medication|sick/i` → may apply; must declare health truthfully; insurer decides case by case (standard, extra premium or exclusion); we cannot answer for the insurer; an agent will reply here; please don't send medical details in chat.
2. `visa` — `/visa|immigration|retirement extension|non-?o|\bO-?A\b|\bO-?X\b|LTR/i` → many expats use this policy as proof of health insurance for their stay; requirements differ by visa type and change, so an agent will check what your application needs. Must not contain a visa name or `guarantee`.
3. `abroad` — `/abroad|overseas|travel|outside thailand|home country/i` → cover abroad is for emergencies only, within 90 days of each trip; your main cover is in the territory you choose.
4. `waiting` — `/waiting|when does (?:it|cover) start|start(?:s)? cover/i` → from `iHealthyFacts().terms` (`waitingDays`, `specialWaitingDays`, `specialWaitingDiseases` translated with `translateLine(…, "en")`); accidents covered immediately.
5. `rises` — `/premium (?:go|goes|increase|rise)|every year|fixed premium|price change/i` → treatment part rises with age each year; the figure quoted is the first year; base policy premium is level.
6. `monthly` — `/monthly|instal?ment|pay (?:by|with) card|how (?:do|can) i pay/i` → monthly OK, first payment covers 2 months, auto-charged again from month 3; semi-annual and annual too.
7. `tax` — `/\btax\b/i` → health premiums can reduce Thai personal income tax for people who file tax in Thailand; an agent can explain your case.

Prompts: English twins of `HEALTH_RULES`, `HEALTH_PLAN_INFO_SYSTEM`, `HEALTH_SMALL_TALK_SYSTEM` in `ihealthy/prompts.ts`, plus: "Reply in English only." · the visa rule · the abroad rule · "Never say 'worldwide' unless the quoted territory is worldwide." · "Never write a premium or any figure that is not in the facts below." · small talk ≤ 2 lines, on a first greeting ask for age and gender.

- [ ] **Step 1: Write the failing test**

```ts
it.each([
  ["Can I join if I have diabetes?", "health"],
  ["Can I use this for my retirement visa?", "visa"],
  ["Am I covered when I travel home?", "abroad"],
  ["How long is the waiting period?", "waiting"],
  ["Does the premium go up every year?", "rises"],
  ["Can I pay monthly?", "monthly"],
  ["Can I use it for tax?", "tax"],
])("%s → %s", (q, key) => expect(FAQ_EN.find((e) => e.match.test(q))?.key).toBe(key));

it("never names a visa or promises one", () => {
  const a = healthFaqAnswerEn("is this ok for my visa?")!;
  expect(a).not.toMatch(/guarant|non-?o|O-?A|O-?X|LTR|retirement visa/i);
});

it("every answer is English", () => {
  for (const e of FAQ_EN) expect(e.answer()).not.toMatch(/[฀-๿]/);
});

it("the facts the model reads are English", () => {
  expect(healthFactsForEn({ product: "ihealthy", intent: "plan_info", age: 35, sex: "F" })).not.toMatch(/[฀-๿]/);
});
```

(`FAQ_EN` is exported alongside `healthFaqAnswerEn`, shaped like the Thai `FAQ`.)

- [ ] **Step 2: Run** `npx vitest run tests/chat/ihealthy-en-faq.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** both files per the Interfaces block. If `healthFactsForEn` still leaks Thai, the missing line belongs in `data/riders/ihealthy-ultra.i18n.json` (the existing i18n test will say so) — add the English there, not a fallback.
- [ ] **Step 4: Run** the test — Expected: PASS; and `npx vitest run tests/calc/ihealthy-i18n.test.ts` — Expected: PASS
- [ ] **Step 5: Commit** `feat(chat): English FAQ and prompts for the iHealthy brain, with the expat rules`

---

### Task 6: The English brain, the Expat door, and wiring

**Files:**
- Create: `src/lib/assistant/ihealthy-en/answer.ts`, `src/lib/assistant/ihealthy-en/door.ts`
- Modify: `src/lib/assistant/dispatch.ts` (`answerAny` gains a 5th parameter `pageId?: string`; first statement: `if (isExpatPage(pageId)) return answerExpat(history, stored, channel);`)
- Modify: `src/lib/facebook/conversation.ts` (pass `pageId` through `answered` into `answerAny`; English twins of `BUSY`, `BROKEN`, `OUT_OF_BUDGET`, `CARD_UNSENT` chosen by `isExpatPage(pageId) && languageOf(text, previousLang) === "en"`, where `previousLang` is `session.slots?.lang === "en" ? "en" : "th"` on an Expat Page with a stored session, else undefined)
- Test: `tests/chat/ihealthy-en-answer.test.ts`, `tests/chat/expat-door.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5; `answerHealth` from `../ihealthy/answer`; `stalls`, `affirms`, `wantsToBuy`, `saysFormDone`, `asksCheaper`, `recentTurns`, `keepGivenFigures`, `spoken`, `one` from `../common`; `asksForPicture`, `asksShareOfBill` from `../ihealthy/route` (both already match English words)
- Produces: `answerHealthEn(history: ChatMessage[], previous: HealthSlots | null): Promise<HealthAnswer>`; `answerExpat(history: ChatMessage[], stored: AnySlots | null, channel: Channel): Promise<AnyAnswer>`

`answerHealthEn` order (mirrors `answerHealth`): English stall (`/think about it|later|not now|maybe|no thanks/i` or `stalls`) → short English line, no question · `formSent` + `/done|filled|sent|submitted/i` → thanks, agent will contact here · wants to buy (`/apply|sign up|buy|purchase|proceed|i(?:'| a)m in/i` or title `WANTS_IN_EN`) → `APPLY_HAND_OVER_EN`, `formSent: true` · company/group (`/company|employees|staff|group insurance|for my team/i`) → `HAND_OVER_EN` · FAQ · share-of-bill → English description + `HAND_OVER_EN` · greeting or the ad's button (`/^(hi|hello|hey|good (morning|afternoon|evening))\b|more information|learn more|get quote|interested/i`) → `GREETING_EN` (no model) when age/sex unknown, else menu · with age+sex: picture → quote/menu, full table, `SEE_OTHER_PLANS_EN`/`/other plans|what else/i`, cheaper, territory · `routeHealthEn` · `PLAN_BENEFITS_EN` or plan_info → model (`task: "plan_info_health_en"`) · missing age/sex → ask for what is missing · plan → quote when asked (same rule as Thai) · quote intent → menu · else small talk (`task: "small_talk_health_en"`).

Copy fixed by this plan:
- `GREETING_EN = "Hi, thanks for reaching out! 🙏 We help expats in Thailand get iHealthy Ultra health insurance — inpatient cover paid as charged, up to the plan's yearly limit.\nTo show you the premiums, could you tell me your age and gender? (e.g. \"35 male\")"`
- `APPLY_HAND_OVER_EN = "Great! 🙌 An agent will take you through the application right here in this chat and let you know which documents you'll need."`
- `ASK_DETAILS_EN = "Could you tell me your age and gender? I'll work out your premium right away (e.g. \"35 male\")."` and the one-missing variants `"Could you tell me your age? (e.g. \"35\")"` / `"Could you tell me your gender? (male or female)"`
- `BROKEN_EN = "Sorry, something went wrong on our side — an agent will reply here shortly 🙏"`, `BUSY_EN = "We're getting a lot of messages right now — please try again in a moment."`, `OUT_OF_BUDGET_EN = "Our assistant is paused for now — an agent will reply to you here."`, `CARD_UNSENT_EN = "Your quote is a picture — you can open it here:"`

`answerExpat`: `const last` = last user message; `prev` = `stored` is health slots ? (`stored.lang === "en" ? "en" : "th"`) : undefined; `lang = languageOf(last, prev)`; health slots to carry = `stored` if `product === "ihealthy"`, else `{ product: "ihealthy", intent: "quote", ...person }` (age/sex only). `en` → `answerHealthEn(history, carried)`. `th` → `answerHealth(history, { ...carried, lang: undefined })` and strip `lang` from the returned slots.

- [ ] **Step 1: Write the failing tests**

`tests/chat/ihealthy-en-answer.test.ts` (mock `chat` like the Thai answer test; `worded = "Happy to help!"`):

```ts
const THAI = /[฀-๿]/;
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "M" as const, lang: "en" as const };

it("greets the ad's button in English and asks for age and gender, without a model", async () => {
  const a = await answerHealthEn(said("For more information"), null);
  expect(a.messages[0].text).toBe(GREETING_EN);
  expect(chat).not.toHaveBeenCalled();
});

it("35 male → English menu", async () => {
  const a = await answerHealthEn(said("35 male"), null);
  expect(a.replies).toEqual(["Bronze", "Silver", "Gold"]);
  expect(a.slots).toMatchObject({ age: 35, sex: "M", lang: "en" });
});

it("Gold → English quote", async () => {
  const a = await answerHealthEn(said("Gold"), KNOWN);
  expect(a.priced).toBe(true);
  expect(a.messages[0].card).toContain("l=en");
});

it("apply → hand over, no Thai form", async () => {
  const a = await answerHealthEn(said("I want to apply"), { ...KNOWN, plan: "GOLD" });
  expect(a.messages.map((m) => m.text).join("\n")).not.toContain("ktaxaform");
  expect(a.slots.formSent).toBe(true);
});

it("a model reply with an invented figure loses that line", async () => {
  worded = "Gold costs 99,999 THB a year.\nIt covers inpatient care.";
  const a = await answerHealthEn(said("what does gold cover?"), { ...KNOWN, plan: "GOLD", intent: "plan_info" });
  expect(a.messages[0].text).not.toContain("99,999");
});

it.each([
  "For more information", "35 male", "Gold", "See other plans", "too expensive", "Asia",
  "I want to apply", "do I need to declare diabetes?", "can I use it for my visa?", "thanks, I'll think about it",
])("no Thai in the reply to %s", async (q) => {
  const a = await answerHealthEn(said(q), { ...KNOWN, plan: "GOLD" });
  for (const m of a.messages) expect(m.text).not.toMatch(THAI);
});
```

`tests/chat/expat-door.test.ts` (mock `chat`; call `answerAny(history, stored, "facebook", undefined, pageId)`):

```ts
const EXPAT = "112079600278201";

it("an English opener on an Expat Page is the English greeting, not the three-plan menu", async () => {
  const a = await answerAny(said("For more information"), null, "facebook", undefined, EXPAT);
  expect(a.messages[0].text).toBe(GREETING_EN);
  expect(a.slots).toMatchObject({ product: "ihealthy", lang: "en" });
});

it("Thai on an Expat Page goes to the Thai health brain", async () => {
  const a = await answerAny(said("สนใจประกันสุขภาพค่ะ"), null, "facebook", undefined, EXPAT);
  expect(a.messages[0].text).toMatch(/[฀-๿]/);
  expect((a.slots as { product: string }).product).toBe("ihealthy");
  expect((a.slots as { lang?: string }).lang).toBeUndefined();
});

it("age and sex survive English → Thai → English", async () => {
  const one = await answerAny(said("35 male"), null, "facebook", undefined, EXPAT);
  const two = await answerAny(said("แพงไหม"), one.slots, "facebook", undefined, EXPAT);
  const three = await answerAny(said("Gold"), two.slots, "facebook", undefined, EXPAT);
  expect(three.priced).toBe(true);
  expect(three.messages[0].text).not.toMatch(/[฀-๿]/);
});

it("a number alone keeps the conversation's language", async () => {
  const a = await answerAny(said("35"), { product: "ihealthy", intent: "quote", sex: "M", lang: "en" }, "facebook", undefined, EXPAT);
  expect(a.messages[0].text).not.toMatch(/[฀-๿]/);
});

it("a Thai Page is untouched by any of this", async () => {
  const a = await answerAny(said("For more information"), null, "facebook", undefined, "103716981993581");
  expect(a.messages[0].text).toMatch(/[฀-๿]/);
});
```

Plus in `tests/calc/facebook.test.ts` (follow its existing mocks of `sendMessage`/`answerAny`): when `answerAny` throws on Expat Page `112079600278201` for message `"hello"`, the apology sent is `BROKEN_EN`; on a Thai Page it is the Thai `BROKEN`.

- [ ] **Step 2: Run** `npx vitest run tests/chat/ihealthy-en-answer.test.ts tests/chat/expat-door.test.ts tests/calc/facebook.test.ts` — Expected: FAIL
- [ ] **Step 3: Implement** `answer.ts` and `door.ts`, then the `dispatch.ts` and `conversation.ts` edits per the Interfaces block.
- [ ] **Step 4: Run** the three files — Expected: PASS
- [ ] **Step 5: Run the whole suite** `npx vitest run` and `npx tsc --noEmit` — Expected: PASS except the known clock failure in `tests/chat/session-turn.test.ts` (unrelated, pre-existing); report any other failure.
- [ ] **Step 6: Commit** `feat(chat): the Expat Pages answer in English, and in Thai to Thai`

---

### Task 7: Hand-off check

- [ ] **Step 1:** `npm run build` — Expected: success.
- [ ] **Step 2:** Update the memory note `expat-english-bot.md` with the branch head and what is left (owner's live test on the Page after deploy; the foreigner application steps).
- [ ] **Step 3:** Tell the owner: production rollout follows `production-rollout` memory (push main → Vercel prod; no migration needed). Do not push without the owner's go-ahead.
