# Chat Quote PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat bot (web, Messenger, LINE) sends the same PDF the sales pages' "บันทึกเป็น PDF" / "พิมพ์ หรือบันทึก PDF" buttons make, for the quote it just gave.

**Architecture:** The five plan pages learn to open pre-filled from a query string (iHealthy already does). `/api/quote-pdf` validates the query, opens our own page in headless Chrome, runs the same preparation the button runs, and prints. The dispatcher remembers the last quote's PDF path in the session slots, offers the file after the first quote of a plan, and answers PDF requests; each channel delivers it its own way.

**Tech Stack:** Next.js 15 (app router), `puppeteer-core` + `@sparticuz/chromium` (Vercel, Node 24), vitest (node env, model and network mocked).

**Spec:** `docs/superpowers/specs/2026-10-02-chat-quote-pdf-design.md`

## Global Constraints

- Pages in scope (the `page` key): `lifeprotect | easyprotect | ishield | lifetreasure | plb | ihealthy-ultra`. Plan codes: LIFEPROTECT, EASYPROTECT, ISHIELD, LIFETREASURE, PLB → the page of the same name. Not in scope: ISMART, CI123, cancer, Legacy, `/fhc`, group insurance.
- Copy, verbatim:
  - offer: `อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?`
  - buttons: `ขอไฟล์ PDF`, `ไม่เป็นไร`
  - Messenger before the file: `กำลังทำไฟล์ให้ครับ`
  - decline: `ได้เลยครับ มีอะไรอยากถามต่อ พิมพ์มาได้เลย`
  - no quote yet: `ทำไฟล์ PDF ให้ได้ครับ ขอแบบประกัน อายุ และเพศก่อน เดี๋ยวคิดเบี้ยให้แล้วส่งไฟล์ให้เลย`
  - no PDF for this quote: `เบี้ยนี้ยังทำเป็นไฟล์ PDF ไม่ได้ครับ ส่งรูปใบเสนอให้แทนนะครับ`
  - fallback link: `ส่งไฟล์ไม่สำเร็จครับ เปิดหน้านี้แล้วกดปุ่มบันทึก PDF ได้เลยครับ`
  - too many: `รอสักครู่แล้วขอใหม่นะครับ`
- `PDF_ASKED = /pdf|ไฟล์|ใบเสนอ/i`; "ขอตาราง" / "ขอดูตารางมูลค่า" stay on their current path.
- Chrome opens only `siteOrigin()` + one of the six paths; never a URL from the caller.
- Whole render ≤ 45 s; route `maxDuration = 60`, memory 2048 MB; cache `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`; `v` = `cardVersionFor()`.
- Per-IP limit `limiter(6, 60_000)` on `/api/quote-pdf`; a request carrying `authorization: Bearer ${CRON_SECRET}` (the bot's own fetch) skips it.
- Local dev reads the prod Supabase (`.env.local`): do not send chat messages through the local bot; the PDF route touches no database.

## Review Focus

1. **Bot sum not on the page's slider** (e.g. Life Protect 2.3 ล้าน, Life Protect 150,000) — the page cannot show it, so no PDF path is made; the customer gets the "no PDF" line and the card. Test in Task 1 (`quotePdfPath` returns undefined) and Task 5 (offer not shown).
2. **iShield variant the age cannot have** — the page would silently fall back to another term and the PDF would not match the card. `planInitialFrom` rejects anything the engine does not price as eligible. Test in Task 1.
3. **"เอา" after the PDF question while a form invitation is also in history** — must be a PDF, not the application form; "สมัคร" must still be the form. Test in Task 5.
4. **Couple quote** ("ผญ 32 ผช 33" → two Life Protect cards) — the remembered PDF is the last card's; the offer is asked once. Test in Task 5.
5. **Messenger file upload refused / route 429 / route 5xx** — fallback link or wait line, never silence. Test in Task 6.

---

### Task 1: PDF links and page queries

**Files:**
- Create: `src/lib/quote-pdf/pages.ts`, `src/lib/quote-pdf/link.ts`
- Modify: the five `src/components/<Plan>Calculator.tsx` — move each `const SUMS` into `pages.ts` and import it back (no behaviour change)
- Test: `tests/quote-pdf/link.test.ts`

**Interfaces:**
- Produces (`pages.ts`):
  - `type PlanPage = "lifeprotect" | "easyprotect" | "ishield" | "lifetreasure" | "plb"`; `type PdfPage = PlanPage | "ihealthy-ultra"`
  - `PLAN_PAGES: Record<PlanPage, { planCode: string; path: string; sums: readonly number[] }>` (sums = the calculators' current `SUMS`, exported as `LIFEPROTECT_SUMS` etc. for the components)
  - `pageForPlan(planCode: string): PlanPage | undefined`
- Produces (`link.ts`):
  - `interface PlanInitial { age: number; sex: "M" | "F"; sumAssured: number; variant: string }`
  - `planQueryFor(i: PlanInitial): string` → `age=…&sex=…&sum=…&variant=…` (same key names as `/api/card`)
  - `planInitialFrom(page: PlanPage, query: Record<string, string | string[] | undefined>, today?: Date): PlanInitial | undefined` — undefined unless every key is present once, `sum ∈ PLAN_PAGES[page].sums`, and `quote({ planCode, variant, age, sex, mode: "annual", sumAssured, riders: [] }, today)` has no `error` warning, every item eligible, `totalAnnual > 0`
  - `quotePdfPath(input: { kind: "plan"; planCode: string; variant: string; age: number; sex: "M" | "F"; sumAssured: number } | { kind: "ihealthy"; query: string }): string | undefined` → `/api/quote-pdf?page=<page>&<query>&v=<cardVersionFor()>`; plan inputs go through `planInitialFrom` (undefined when it fails or `pageForPlan` is undefined); iHealthy `query` is `queryFrom(table, v)` from `src/lib/ihealthy-link.ts`
  - `pagePathFor(pdfPath: string): string | undefined` → the page URL path with the same query minus `page` and `v` (e.g. `/lifeprotect?age=35&…`)

- [ ] **Step 1: Write the failing tests**

```ts
it("makes a path for a Life Protect quote on the slider", () => {
  expect(quotePdfPath({ kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000 }))
    .toMatch(/^\/api\/quote-pdf\?page=lifeprotect&age=35&sex=M&sum=1000000&variant=WLF99H&v=.+$/);
});
it("makes none for a sum the page cannot show", () => {
  expect(quotePdfPath({ kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 2_300_000 })).toBeUndefined();
});
it("makes none for ISMART", () => { /* planCode ISMART → undefined */ });
it("rejects an iShield term the age cannot have", () => { /* pick a variant/age the engine marks ineligible → planInitialFrom undefined */ });
it("reads back what it wrote", () => { /* planInitialFrom("plb", parse(planQueryFor(x))) deep-equals x, for one valid input per page */ });
it("rejects repeated or missing keys", () => { /* sum: ["1000000","2000000"] → undefined; no sex → undefined */ });
it("turns a pdf path into the page link", () => {
  expect(pagePathFor("/api/quote-pdf?page=plb&age=35&sex=F&sum=1000000&variant=PLB12&v=x")).toBe("/plb?age=35&sex=F&sum=1000000&variant=PLB12");
});
```

- [ ] **Step 2: Run** `npx vitest run tests/quote-pdf/link.test.ts` — expect FAIL (module not found)
- [ ] **Step 3: Implement `pages.ts` and `link.ts`; move the five `SUMS` lists into `pages.ts` unchanged**
- [ ] **Step 4: Run** `npx vitest run tests/quote-pdf/link.test.ts && npx tsc --noEmit` — expect PASS, no type errors
- [ ] **Step 5: Commit** `feat(pdf): links from a quote to its PDF and its pre-filled page`

---

### Task 2: The five plan pages open pre-filled

**Files:**
- Modify: `src/app/{lifeprotect,easyprotect,ishield,lifetreasure,plb}/page.tsx`; `src/components/{LifeProtect,EasyProtect,IShield,LifeTreasure,Plb}Calculator.tsx`

**Interfaces:**
- Consumes: `planInitialFrom`, `PlanInitial` (Task 1)
- Produces: each calculator takes `initial?: PlanInitial`; each page takes `{ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }` and passes `initial={planInitialFrom("<page>", await searchParams)}`. Copy iHealthy's `?constructor=` guard (`src/app/ihealthy-ultra/page.tsx:83-89`).

- [ ] **Step 1: Seed state from `initial`** — `sumIndex` = `SUMS.indexOf(initial.sumAssured)`, `variant` (iShield: `wanted`), `age`, `sex`; EasyProtect has no variant state, so its `planInitialFrom` accepts only `table.terms[0].variant`. No `initial` → today's start values exactly.
- [ ] **Step 2: Verify** `npx tsc --noEmit && npx vitest run` — PASS
- [ ] **Step 3: Verify in the browser** — `preview_start` the dev server; open `/plb?age=40&sex=F&sum=2000000&variant=PLB12` and `/lifeprotect?age=50&sex=M&sum=3000000&variant=WLF19H`; `read_page` shows those values and a premium; `/plb` with no query still opens at 35 / ชาย / 1 ล้าน; `/plb?sum=123` opens at the defaults.
- [ ] **Step 4: Commit** `feat(pages): the plan pages open on the figures in their link`

---

### Task 3: The button's preparation, shared with the server

**Files:**
- Create: `src/lib/quote-pdf/prepare.ts` (client)
- Modify: `src/components/sales/PrintButton.tsx`, `src/components/lifeprotect/CashValueTable.tsx`, `src/components/plb/CoverTable.tsx`, `src/components/IHealthyCalculator.tsx`

**Interfaces:**
- Produces:
  - `preparePrint(target: Element): () => void` — exactly PrintButton's current stamp + sibling-marking, returning `restore`. `PrintButton` calls it, then `window.print()`, restoring as today.
  - `exposePdfHook(prepare: () => void): void` — sets `window.__quotePdf = { prepare }` and `document.documentElement.dataset.pdfReady = "1"`. Declare the `Window` field in this file.
  - `CashValueTable` / `CoverTable`: `useEffect` on mount → `exposePdfHook(() => preparePrint(sectionRef.current!))`
  - `IHealthyCalculator`: when `answered` (`:123`) becomes true → `exposePdfHook(() => window.dispatchEvent(new Event("beforeprint")))` so the date stamp (`:212-223`) is written as the button would.

- [ ] **Step 1: Move the logic into `preparePrint`, rewire `PrintButton`, add the hooks**
- [ ] **Step 2: Verify** `npx tsc --noEmit && npx vitest run` — PASS
- [ ] **Step 3: Verify in the browser** — on `/lifeprotect` the button still prints only the table (javascript_tool: click it with `window.print` stubbed, check `[data-print-hide]` count > 0 during and 0 after); `document.documentElement.dataset.pdfReady === "1"` on `/lifeprotect`, `/plb` and `/ihealthy-ultra`.
- [ ] **Step 4: Commit** `refactor(print): the PDF button's preparation, callable by the server`

---

### Task 4: `/api/quote-pdf`

**Files:**
- Create: `src/lib/quote-pdf/render.ts`, `src/app/api/quote-pdf/route.ts`
- Modify: `package.json` (`puppeteer-core`, `@sparticuz/chromium`), `next.config.ts` (add both to `serverExternalPackages`; `outputFileTracingIncludes["/api/quote-pdf"] = ["./node_modules/@sparticuz/chromium/bin/**"]`), `vercel.json` (`"functions": { "src/app/api/quote-pdf/route.ts": { "memory": 2048, "maxDuration": 60 } }`)
- Test: `tests/quote-pdf/route.test.ts`

**Interfaces:**
- Consumes: `planInitialFrom`, `planQueryFor`, `PLAN_PAGES` (Task 1); `initialFrom`, `queryFrom`, `iHealthyTable` for the iHealthy page; `siteOrigin()`; `limiter`, `clientIp`.
- Produces:
  - `renderQuotePdf(url: string, opts?: { timeoutMs?: number }): Promise<Buffer>` — launch (`executablePath: process.env.CHROME_PATH ?? await chromium.executablePath()`, `args: chromium.args`, headless), `emulateMediaType("print")`, `goto(url, { waitUntil: "networkidle0" })`, wait for `html[data-pdf-ready="1"]`, `evaluate(() => window.__quotePdf?.prepare())`, `pdf({ printBackground: true, preferCSSPageSize: true })`; always closes the browser; whole call bounded by `timeoutMs` (default 45_000).
  - `GET(req)` responses: 200 `application/pdf` + `Content-Disposition: inline; filename="<page>-<sex><age>.pdf"` + cache header; 400 invalid; 429 limited (HTML with the "too many" copy); 503 render failed (HTML with the fallback copy and a link to `pagePathFor`). Errors are small Thai HTML pages, `Cache-Control: no-store`.
  - The page URL is `siteOrigin() + PLAN_PAGES[page].path + "?" + planQueryFor(initial)` (iHealthy: `/ihealthy-ultra?` + `queryFrom(table, initialFrom(table, query))`, rejected with 400 unless that round-trips to the query given, ignoring `page` and `v`).

- [ ] **Step 1: Write the failing tests** (mock `@/lib/quote-pdf/render`)

```ts
it("prints our own page with the figures asked for", async () => {
  const res = await GET(req("/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB12&v=x"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/pdf");
  expect(renderQuotePdf).toHaveBeenCalledWith(`${siteOrigin()}/plb?age=35&sex=M&sum=1000000&variant=PLB12`, expect.anything());
});
it("refuses a page outside the six", /* page=fhc → 400, render not called */);
it("refuses figures the engine cannot price", /* age=99 → 400, render not called */);
it("refuses a key it does not know", /* page=plb&…&next=https://evil → 400, render not called */);
it("answers 503 with the page link when Chrome fails", /* render rejects → 503, body contains "/plb?age=35" */);
it("limits a caller, but not the bot", /* 7th call same x-real-ip → 429; with Bearer CRON_SECRET → 200 */);
it("prints the iHealthy proposal", /* query from queryFrom(table, IHEALTHY_OPENING-based initial) → 200, URL starts with siteOrigin()+"/ihealthy-ultra?" */);
```

- [ ] **Step 2: Run** `npx vitest run tests/quote-pdf/route.test.ts` — FAIL
- [ ] **Step 3: `npm i puppeteer-core @sparticuz/chromium`; implement `render.ts`, the route, the config**
- [ ] **Step 4: Run** `npx vitest run tests/quote-pdf && npx tsc --noEmit` — PASS
- [ ] **Step 5: Verify for real, locally** — dev server running; `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" NEXT_PUBLIC_SITE_URL=http://localhost:3000` in the dev env; fetch one PDF per page into the scratchpad; open each and compare with the file from pressing the page's own button in the browser pane (same content, pages, date line). `SendUserFile` the six PDFs.
- [ ] **Step 6: Verify the build** `npm run verify` — PASS; check `.next-build` output lists `/api/quote-pdf` and its traced size is under 250 MB (`du -sh` on the function's `.nft.json` file set, or the build log). Over → stop and tell the owner (Cloud Run fallback in the spec).
- [ ] **Step 7: Commit** `feat(pdf): /api/quote-pdf prints a plan page as the button does`

---

### Task 5: The bot remembers, offers and answers

**Files:**
- Create: `src/lib/assistant/pdf.ts`
- Modify: `src/lib/assistant/common.ts` (`Said.pdf?: string`), `src/lib/assistant/slots.ts`, `src/lib/assistant/dispatch.ts`, `src/lib/assistant/lifeprotect/answer.ts` (`quoteFor` :207), `src/lib/assistant/ishield/answer.ts` (`quoted` :391), `src/lib/copilot/price.ts` (`priceNamedPlan` :268-274), `src/lib/assistant/ihealthy/quote.ts` (`healthQuote` :115)
- Test: `tests/calc/assistant-pdf.test.ts`; extend `tests/calc/assistant-answer.test.ts` "sends a card of the same arrangement", `tests/calc/copilot-price-plans.test.ts`, `tests/calc/ishield-assistant.test.ts`

**Interfaces:**
- Consumes: `quotePdfPath` (Task 1)
- Produces:
  - `Said = { text: string; card?: string; pdf?: string }` — `pdf` sits on the same message as the quote card it belongs to. `PriceReply` gains `pdf?: string`; dispatch's priceNamedPlan branch (:235) puts it on the first message.
  - `interface PdfMemory { path?: string; card?: string; asked: PdfPage[]; declined?: true }`; `AnySlots` members are read and written as `AnySlots & { pdf?: PdfMemory }` (export `type WithPdf<T> = T & { pdf?: PdfMemory }` from `slots.ts`).
  - `pdf.ts`:
    - `PDF_ASKED`, `PDF_OFFER`, `PDF_YES = "ขอไฟล์ PDF"`, `PDF_NO = "ไม่เป็นไร"`
    - `pdfTurn(asked: string, lastSaid: string | undefined, memory: PdfMemory | undefined, channel: Channel): { reply: Reply; memory: PdfMemory } | undefined` — the request (`PDF_ASKED`, or `lastSaid` ends with `PDF_OFFER` and `affirms(asked)` and not `BUYS`), or the decline (`PDF_NO`, or after the offer a "ไม่" reply); undefined otherwise. Request with `memory.path` → one message `{ text, pdf: memory.path }` (text: Messenger `กำลังทำไฟล์ให้ครับ`; LINE/web a short line, the link/button is the channel's job); request with only `memory.card` → no-PDF copy + `{ card }`; no memory → no-quote copy.
    - `withPdfOffer(answer: AnyAnswer, memory: PdfMemory | undefined): AnyAnswer` — if any message has `pdf`/`card`: remember the last one's `pdf` and `card`; when that has a `pdf` whose page is not in `memory.asked` and not `declined` → append `{ text: PDF_OFFER }`, add the page to `asked`, `replies = [PDF_YES, PDF_NO, ...replies]`; else when it has a `pdf` → `replies = [PDF_YES, ...replies]`. Mirror into `guide` when present (`{ label, ask: label }` first). Returns the answer with `slots.pdf` set.
  - `answerAny`: first statement after reading `asked`/`lastSaid` → `pdfTurn(...)`; when it answers, return it with `slots: { ...(stored ?? undecided), pdf: memory }`. Every other return goes through `withPdfOffer(result, stored?.pdf)` (wrap the existing body as `routeAny` and call it from `answerAny`).

- [ ] **Step 1: Write the failing tests** (model mocked as in `tests/calc/assistant-dispatch.test.ts:4-14`)

```ts
it("offers the file after the first Life Protect quote", async () => {
  const a = await answerAny([{ role: "user", content: "Life Protect ชาย 35 ทุน 1 ล้าน" }], null, "facebook");
  expect(a.messages.at(-1)!.text).toBe("อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?");
  expect(a.replies!.slice(0, 2)).toEqual(["ขอไฟล์ PDF", "ไม่เป็นไร"]);
  expect((a.slots as WithPdf<AnySlots>).pdf!.path).toMatch(/page=lifeprotect&age=35&sex=M&sum=1000000/);
});
it("asks once per plan, then only shows the button", /* second quote same plan: no PDF_OFFER message, replies[0] === "ขอไฟล์ PDF" */);
it("sends the last quote's file when asked in words", /* "ขอไฟล์ PDF หน่อย" → messages[0].pdf === memory.path */);
it("reads เอาครับ after the offer as the file, not the form", /* history ends with offer + a form invitation earlier → pdf message, no APPLICATION_FORM text */);
it("still sends the form for สมัคร after the offer", /* "สมัคร" → handOverForm text */);
it("stops asking after ไม่เป็นไร", /* decline → decline copy, memory.declined; next quote of another plan: no offer */);
it("leaves ขอดูตารางมูลค่า alone", /* → value table card, no pdf turn */);
it("answers a PDF request with no quote yet", /* → no-quote copy */);
it("sends the card when the quote has no PDF", /* CI123 quote, then "ขอ PDF" → no-PDF copy + same card */);
it("remembers the second of a couple", /* "ผญ 32 ผช 33 Life Protect ทุน 1 ล้าน" → memory.path has age=33, offer once */);
```

  Plus, in the three existing card tests: `expect(said.pdf).toBe(quotePdfPath({ kind: "plan", … same fields as the card }))`; in `healthQuote`'s test: `pdf` has `page=ihealthy-ultra`.

- [ ] **Step 2: Run** `npx vitest run tests/calc/assistant-pdf.test.ts` — FAIL
- [ ] **Step 3: Set `pdf` beside each card (4 brains), add `pdf.ts`, wire `answerAny`**
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` — all PASS (existing dispatch/webhook tests too)
- [ ] **Step 5: Commit** `feat(bot): remember the quote's PDF, offer it once, send it when asked`

---

### Task 6: Each channel delivers it

**Files:**
- Modify: `src/lib/facebook/client.ts`, `src/lib/facebook/conversation.ts` (:243-255), `src/lib/line/conversation.ts` (:128-135), `src/lib/copilot/answer.ts` (:173-222), `src/app/Chat.tsx` (:63-65, :302-318)
- Test: `tests/calc/messenger-webhook.test.ts`, `tests/calc/line-webhook.test.ts`, `tests/calc/copilot-pdf.test.ts`

**Interfaces:**
- Consumes: `Said.pdf` (Task 5), `pagePathFor` (Task 1), `siteUrl`
- Produces:
  - `postForm(path: string, form: FormData, pageId?: string): Promise<void>` (private, beside `post`) and `sendFile(psid: string, bytes: Uint8Array, filename: string, replies?: string[], pageId?: string): Promise<void>` — `recipient`, `message: { attachment: { type: "file", payload: { is_reusable: false } }, quick_replies }` as JSON strings in the form, `filedata` = `new Blob([bytes], { type: "application/pdf" })`.
  - Messenger loop: after a message's text, when `said.pdf`: `fetch(siteUrl(said.pdf), { headers: { authorization: \`Bearer ${process.env.CRON_SECRET}\` } })`; 200 → `sendFile(psid, bytes, filename from Content-Disposition, last ? replies : undefined, pageId)`; 429 → text `รอสักครู่แล้วขอใหม่นะครับ`; anything else or `sendFile` throws → text fallback copy + `\n` + `siteUrl(pagePathFor(said.pdf)!)`.
  - LINE: `said.pdf` → a text bubble `siteUrl(said.pdf)` after the message text.
  - Web routing: `forTheEngine` (`src/lib/copilot/answer.ts:56`) also returns true for `PDF_ASKED.test(text)`, so a PDF request reaches `answerAny` (answers after the offer already do: a quote leaves `slots` set).
  - Web: `CopilotAnswer.pdf?: string` (first message's `pdf`); `Turn.pdf`; under the bubble a link styled like the retry button, `href={pdf}`, label `ดาวน์โหลด PDF`, `target="_blank"`.

- [ ] **Step 1: Write the failing tests**
  - Messenger: answer with `{ text: "กำลังทำไฟล์ให้ครับ", pdf }` → `sendFile` called with bytes from the mocked fetch and `"plb-M35.pdf"`; fetch 503 → `sendMessage` with the fallback copy and `/plb?age=35`; `sendFile` throws → same fallback; fetch 429 → the wait line.
  - LINE: the pushed messages contain a text equal to `siteUrl(pdf)`.
  - Web: `answerFromKnowledge("ขอไฟล์ PDF", history, slotsWithPdf)` → `pdf` equals the remembered path.
- [ ] **Step 2: Run them** — FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` — PASS
- [ ] **Step 5: Verify** `npm run verify` — PASS. The chat itself is not driven locally (it would spend the AI budget and write prod rows); the owner checks the web button after deploy (Task 7).
- [ ] **Step 6: Commit** `feat(chat): the PDF reaches Messenger as a file, LINE and the web as a link`

---

### Task 7: Hand over

- [ ] **Step 1:** Whole-branch review against the spec (spec coverage, Review Focus items each have a test).
- [ ] **Step 2:** Tell the owner what to check after deploy: on Messenger and LINE, ask for a quote of each kind, press "ขอไฟล์ PDF", open the file; on the web, the download button. Push / deploy only when the owner says so (production rollout: migrate-free here; `CRON_SECRET` already set in Vercel — confirm with `filter_project_envs`, values not decrypted).
