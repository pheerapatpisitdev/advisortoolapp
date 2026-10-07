# Protection Life (PLB) brain — design

2026-10-07 · owner's request: "ใส่สมอง PLB เข้าไปใน ai bot ทุกตัว"

## Goal

A customer who names Protection Life in any of the bots — Messenger, LINE, the website chat —
is taken through a quotation across several messages (who, how much, how long), is answered
the usual questions in the agency's own sentences, and is never sent the quotation again for
nothing. PLB today can only be priced from **one** message that holds everything; ask for the
rest in a second message and the first is forgotten.

## Decisions already made by the owner

- **Reached by name only.** PLB is not a fourth door in the greeting menu, the welcome editor,
  the LINE rich menu or the ads. A customer gets it by typing "Protection Life", "PLB",
  "โพรเทคชั่น ไลฟ์" or "พีแอลบี".
- **No intro picture** for PLB (the owner chose Life Protect and iShield for that).
- **Riders (AP, ECARE, MEB) are not offered in chat.** Nobody has asked; the page has them.

## What exists and is reused

| Piece | Where | Reuse |
|---|---|---|
| Rate table, discount, monthly floor, age range | `src/lib/plb-table.ts`, `plb-quote.ts`, engine `quote()` | unchanged — every figure still comes from here |
| One-message pricer, with the "what is missing" reply and its buttons | `priceNamedPlan` in `src/lib/copilot/price.ts` | **split** (below), same output for every plan that uses it today |
| Follow-up buttons | `priceFollowUps` in `src/lib/copilot/guide.ts` | unchanged |
| Card, value table, PDF | `cardPath`, `valueTablePath`, `quotePdfPath` (PLB page `plb` exists) | unchanged |
| Shared rules | `common.ts`: `wantsToBuy`, `handOverForm`, `saysFormDone`, `stalls`, `thanksOnly`, `saysUnwell`, `asksAboutCompany`, `HEALTH_DECLARATION` | called by the new brain, not copied |

PLB, iSmart, Life Treasure and Easy Protect are today the "plans with no brain", priced
statelessly by `priceNamedPlan` inside the dispatcher. **Only PLB gets a brain here.** The other
three keep their present path unchanged.

## Design

### 1. The pricer is split in two (`copilot/price.ts`)

`priceNamedPlan(text, code, label)` currently (a) reads people, sum and term out of the text and
(b) prices or says what is missing. It becomes:

- `readPlanAsk(text, code)` → `{ people, sum, variant }` — the reading, unchanged logic (it is
  the existing code moved, including `variantAskedFor`, which is exported for the brain).
- `pricePlan(code, label, { people, sum, variant })` → `PriceReply` — everything after the
  reading, including the missing-gap reply and `priceFollowUps`.
- `priceNamedPlan` = `pricePlan(code, label, readPlanAsk(text, code))`.

This is a pure move. The existing tests for iSmart, Life Treasure, Easy Protect and PLB, the
guide-button tests and the PDF tests must pass untouched — that is the proof the move changed
nothing. The brain calls `pricePlan` directly, so the chat, the website's inbox and the page
share one pricing path; a figure cannot differ between them.

### 2. The brain (`src/lib/assistant/plb/answer.ts`, rule-only, no model)

Shaped like `answerIShield` / `answerLegacy`: `answerPlb(asked, previous, channel, today?)`,
synchronous, one message in, one answer out.

Slots:

```ts
interface PlbSlots {
  product: "plb";
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;       // what the family receives; PLB has no booster
  variant?: string;          // "PLB05" | "PLB10" | "PLB12" | "PLB15"
  formSent?: true;
}
```

Order of checks in a turn (earlier wins; each returns without touching the slots, except as
noted):

1. condition or health-check question → `HEALTH_DECLARATION` (`saysUnwell`)
2. who stands behind it → `aboutCompany` (`asksAboutCompany`)
3. wants to buy → `handOverForm`, sets `formSent`
4. says the form is filled → `FORM_RECEIVED`, `formDone`
5. bare thank-you → `THANKS_REPLY` (`thanksOnly`)
6. leaving to think → `stallReply` (`stalls`)
7. a written answer from the PLB FAQ (below). **If the customer already holds a quotation and
   the message names no figure or money word, the written answer stands alone** — the guard
   Life Protect has had since 2026-10-07, so "สอบถามเงื่อนไข…" never re-sends the card.
8. otherwise: merge what this message says (`readPlanAsk`) into the slots — what is said now
   wins; a new sum or term re-prices with everything else kept — then `pricePlan`. Complete →
   the quotation (message, card, table, PDF, `priced: true`). Incomplete → the one gap, with
   its buttons as `replies`.

A message that names two people prices the first and says the other can be sent next. (Life
Protect prices couples; PLB does not, until someone asks.)

`replies` are the labels `priceFollowUps` already produces ("ชาย 35 ปี", "ทุน 1 ล้าน",
"ชำระเบี้ย 10 ปี", "ถ้าจ่าย 5 ปีล่ะ"). In an inbox a pressed button arrives as its label text,
so **every label must be read back by the brain** — the rule the guide file is built on ("a
button must lead somewhere"), enforced by a test that presses each one.

### 3. PLB FAQ (`plb/faq.ts`), fixed sentences, no model

- **No money back** — cover lasts exactly as long as the premium is paid, then the contract
  ends; no surrender value, no maturity payment. (The sentence already at the foot of
  `plbQuoteText`.)
- **How long it covers** — the term, and the age the cover ends at, said from the table.
- **Tax relief** — the same sentence Life Protect uses. It is inline in `lifeprotect/faq.ts` today, so it moves to `common.ts` as a constant and both read it (a one-line extraction; Life Protect's wording does not change).
- **Waiting period / health check** — the owner has said Life Protect covers from the moment
  the policy is approved; he has **not** said the same of PLB. The bot says it has no confirmed
  answer for PLB and that the admin will check, and does not guess. One line to change once the
  owner confirms.

### 4. Wiring (`choose.ts`, `dispatch.ts`, `slots.ts`, `chat/public-input.ts`)

- `Product` gains `"plb"`. `NAMES` gains `["plb", /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์|พีแอลบี/i]`.
  `productNamedIn` today returns a plan only when **exactly one** matches, so
  "Protection Life ประกันชีวิต" (PLB and Life Protect both) is unplaceable. The PLB name wins
  when present: a customer who wrote the plan's name chose it.
- `settled()` already reads `slots.product`; the `now === …` list and `run()` gain `plb`;
  `startPlb(person)` carries age and sex only, as `startIShield` does, because a sum chosen on
  another plan decides nothing here.
- The stateless PLB branch in `routeAny` (`other && other.code !== "ISHIELD" && asksAboutMoney`)
  stops taking PLB — it goes to the brain. iSmart, Life Treasure and Easy Protect stay on it.
- `AnySlots` gains `PlbSlots`; `public-input.ts` adds `"plb"` to the products the website will
  accept back from a browser (without it a PLB conversation on the site resets every turn).
- Nothing in the database changes. The product name is a free string in the transcript;
  `page_welcome.product` has a CHECK constraint but PLB is not a Page mode, so it is untouched.
  **No migration.**

### 5. Switching plans

Carried as today: naming another plan moves the conversation to it with only the person
(`run(named, personIn(stored), fresh)`). Life Protect → PLB brings the age and sex, not the
sum; PLB → Life Protect likewise. The PDF memory and the intro-picture flag live outside the
slots and survive the switch, as before.

## Data flow, one turn

`answerAny` → (PDF turn? no) → `routeAny` → settled on `plb`, or `productNamedIn` = `plb` →
`run("plb")` → `answerPlb(asked, previous)` → checks 1–7, else `readPlanAsk` → merge → `pricePlan`
→ `Reply` + new slots → back through `withPdfOffer` and `withIntroPicture` (which ignores PLB:
the brain is not marked `introFor`).

## Failure handling

- Rate table lapsed → `pricePlan` already says so on the quotation (existing behaviour).
- Age outside the plan's range, or a sum the engine refuses → the engine's own sentence, as
  today; the slots keep the person so the customer can change one thing.
- No model is involved, so a provider outage cannot touch a PLB conversation.

## Testing

1. **The split changes nothing:** all existing price, guide, PDF and dispatcher tests pass
   unmodified.
2. **Golden figures:** for several people × the four terms × several sums, the brain's quoted
   premium equals `plbModes` on the same input.
3. **Multi-turn:** name → "ชาย 35" → "ทุน 1 ล้าน" → "ชำระ 10 ปี" quotes once, with the card,
   the table and the PDF; then "ทุน 2 ล้านล่ะ" and "ถ้าจ่าย 5 ปีล่ะ" re-price with the rest kept.
4. **Every button is read back** (item in §2).
5. **No re-quote:** thanks, a conditions question, a health-check question and a "think about
   it" after a quotation send one short answer and no card.
6. **Routing:** "Protection Life ประกันชีวิต" → PLB; "PLB" typed mid-Life-Protect moves to PLB
   carrying age and sex only; "ประกันชีวิต" alone still goes to Life Protect; iSmart, Life
   Treasure and Easy Protect questions still take the stateless path.
7. **Website round-trip:** slots with `product: "plb"` pass `public-input` and come back.
8. Typecheck clean.

## Known limits (not blocking)

- One person per quotation; no couples.
- No riders in chat.
- The waiting-period/health-check line for PLB is a handover until the owner confirms the fact.
- Only PLB is given a brain; iSmart, Life Treasure and Easy Protect remain stateless.

## Rollout

One branch (`feat/plb-brain`), merged to `main` and pushed on the owner's word. No migration, no
configuration. Watch the first real PLB conversations in `ins_transcripts` (role `bot`) for a
quotation followed by a repeat.
