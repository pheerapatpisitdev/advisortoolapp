# Ads Studio รีวิวเคลม Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth ad kind, รีวิวเคลม. It is written from real claim papers into a campaign. The
stickered papers go on the poster, the plan's premium table is optional, and the ad is in English on
Expat Pages.

**Architecture:**
- The pure claim-ad copy lives in a new `src/lib/content/claim-ad.ts`.
- The server round lives in a new `src/lib/ads/claim-ad-run.ts`. It reuses `claim-run.ts`'s reader
  and paper filing.
- Requests come through the existing `/api/content-claim`: POST reads unchanged; PUT gains a
  campaign branch.
- Claim ads are saved with `planHref: CLAIM_HREF` and a `campaign_id`. That way the existing
  `claimPaper`/`checkPaper`, edit re-checks (`output.fact`/`output.figures`) and bin/delete paths
  work unchanged.

**Tech Stack:** Next.js App Router, route handlers, React client components, Tailwind `--ct-*`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-ads-studio-claim-review-design.md`

## Global Constraints
- No migration. `.env.local` is production: no dev-server reads, creates or sends. Browser checks
  are look-only.
- Claim ad paths are owner-only (`requireStaff("owner")`), as all of Ads Studio is.
- Consent: the server refuses both requests without `consent=on`, using the existing `NO_CONSENT` text.
- The writer never sees images. Every number in the copy must come from the facts, the table, or the
  contacts.
- The claim story names no plan, hospital, doctor, date or person.
- Headline and description: at most 27 characters (`AD_LIMITS`). An overlong one is replaced with
  the kind's fallback.
- `PRIMARY_MAX` is 2,200. Trim the story's lines from the end, never the table, contacts or caution.
- Count is 1–3 (`MAX_CLAIM_PIECES`). Each run takes two `ai-claim` rounds, as Organic.
- Thai copy for UI. Controls are at least `min-h-11`. Commit per task; each message ends with a
  blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Organic's own `ADS_MOVED` paths stay: a PUT with `format=ad` and **no** `campaign` is still refused.

## Review Focus
1. **Expat campaign, papers in Thai:** the ad is English. Money is "25,000 THB" and never "THB
   25,000" or "บาท". Thai illness words are translated, not left in Thai.
2. **Table off:** no age/sex/row is sent or required. No premium figure appears anywhere, and the
   premium flags don't run.
3. **Facts with paid = "" (amount unreadable):** the poster has no "ประกันจ่ายให้" line, and the copy
   claims no amount.
4. **A claim ad sent while unchecked:** it is left out with the reason. A send of only unchecked ads
   is refused without calling the engine.
5. **Owner adds stickers in the editor after create:** ตรวจแล้ว works on a campaign piece
   (`planHref === CLAIM_HREF`). It is refused once the ad is in a send.

---

### Task 1: Kind and claim-ad copy (pure)
**Files:**
- Modify: `src/lib/ads/ad-kind.ts`, `src/lib/content/output.ts:75-78`
- Create: `src/lib/content/claim-ad.ts`
- Test: `tests/content/claim-ad.test.ts`, `tests/ads/ad-kind.test.ts` (extend)

**Interfaces:**
- **Produces, in `ad-kind.ts`:**
  - `AD_KINDS = ["long","numbers","knowledge","story","claim"]`
  - `KIND_LABEL.claim = "รีวิวเคลม"`
  - `kindChip` returns `"รีวิวเคลม"` for claim
- **Produces, in `output.ts`:** `ad.kind` union gains `"claim"`, and `ad.claimTable?: boolean`.
- **Produces, in `claim-ad.ts`:**
  - `interface ClaimAd { headline: string; story: string[]; cta: string; description: string; imagePrompt: string; poster: unknown }`
  - `claimAdMessages(facts: ClaimFacts, angle: { say: string }, reader: string, withTable: boolean, lang: Lang): ChatMessage[]`
    - Thai system: Organic's claim rules (`WRITE_RULES`/claim rules from `claim.ts`), with the JSON
      shape `{"headline","story":[…],"cta","description","imagePrompt","poster"}`.
    - English system: the same rules in English plus `ENGLISH_RULES` and `AD_MONEY_EN`, and "the
      facts are in Thai; write them in English".
    - With the table: one line saying the system adds the plan's premium table after the story, so
      the writer must not write premiums or name the plan.
  - `parseClaimAd(reply: string, lang: Lang): ClaimAd | null`
    - Returns null without a headline or story.
    - A headline over 27 chars becomes `CLAIM_HEADLINE` / `CLAIM_HEADLINE_EN`.
    - A description over 27 becomes `CLAIM_DESCRIPTION` / `CLAIM_DESCRIPTION_EN`.
    - English text passes through `thbAfter`.
  - Constants:
    - `CLAIM_HEADLINE = "รีวิวเคลมจริง"`
    - `CLAIM_HEADLINE_EN = "A real claim, paid"`
    - `CLAIM_DESCRIPTION = "ทักแชทถามเรื่องเคลม"`
    - `CLAIM_DESCRIPTION_EN = "Ask us about claims"`
    - `CLAIM_CAUTION_EN = "Claim results depend on policy terms."`
  - `assembleClaimAd(ad: ClaimAd, parts: { table: string | null; contact: string }, lang: Lang): string`
    - Joins these blocks with `"\n.\n"`: the story lines, the cta, the table (if any), the contact,
      and the caution (`DISCLAIMER` or `CLAIM_CAUTION_EN`).
    - Over 2,200 code points, it drops story lines from the last.
  - `claimAdPoster(ad: ClaimAd, facts: ClaimFacts, lang: Lang): PosterSpec`
    - Thai: `claimPoster(ad.poster, facts, ad.headline)`.
    - English: badge "Real claim review", and sub line `Insurer paid ${paid} THB` when `paid` is set.

- [ ] **Step 1: Write failing tests**, covering:
  - `adKind("claim") === "claim"` and `kindChip({kind:"claim"}) === "รีวิวเคลม"`.
  - `parseClaimAd` falls back on a 28-char headline/description, keeps a 27-char one, returns null
    without a story, and turns `"THB 25,000"` into `"25,000 THB"` in English.
  - `assembleClaimAd` with a table puts the table after the cta and before the contact.
  - `assembleClaimAd` without a table contains no "บาท/ปี".
  - `assembleClaimAd` ends with `DISCLAIMER` (th) or `CLAIM_CAUTION_EN` (en).
  - A 2,300-char story is trimmed to ≤2,200 with the table, contact and caution intact.
  - `claimAdPoster` with `paid: ""` has no sub block, in both languages.
  - `claimAdMessages(...)` with `withTable` true mentions the table line; with false it doesn't. The
    English system contains `AD_MONEY_EN`.
- [ ] **Step 2:** Run `npx vitest run tests/content/claim-ad.test.ts tests/ads/ad-kind.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement as the interfaces above.
- [ ] **Step 4:** Rerun. Expected: PASS. Then run `npx tsc --noEmit`, which must be clean. Every
  switch on `AdKind` must handle `"claim"`, e.g. `toDraw`, `picturePending` and `WriteForm`'s
  `KIND_NOTE`. Give `KIND_NOTE.claim = "เล่าเคสเคลมจริงจากเอกสารของลูกค้า (ปิดชื่อ/เลขให้อัตโนมัติ)"`.
- [ ] **Step 5:** Commit `feat(ads): รีวิวเคลม kind and its copy`.

### Task 2: The server round
**Files:**
- Create: `src/lib/ads/claim-ad-run.ts`
- Modify: `src/lib/content/claim-run.ts` (export `withPapers` as `attachPapers`; make `claimPaper`
  accept campaign claim pieces, which already pass because `planHref === CLAIM_HREF`),
  `src/app/api/content-claim/route.ts` (PUT campaign branch)
- Test: `tests/ads/claim-ad-run.test.ts`

**Interfaces:**
- **Consumes:** Task 1's `claimAdMessages`, `parseClaimAd`, `assembleClaimAd`, `claimAdPoster`.
- **Consumes, from `claim-run.ts`:** `tooThin`, `cleanFacts`, `factsBlock`, `claimAngleLines`, `attachPapers`.
- **Consumes, from `actions.ts` helpers** (import or move to a shared module if not exported):
  `flagsFor`, `inTongue`, `dressed`, `contactBlock`, `getPageContact`.
- **Produces:**
  - `interface ClaimAdInput { campaignId: string; facts: unknown; count: number; angle: string; custom: string; reader: string; withTable: boolean; age?: number; sex?: "F" | "M"; rung?: number; papers: Paper[] }`
  - `writeClaimAds(input: ClaimAdInput): Promise<GenerateResult>`, which:
    - refuses unless it's the owner, the campaign exists, and its Page is in `myPages()`;
    - sets `lang = campaignLang(...)`;
    - when `withTable`:
      - builds `premiumTable(planHref, adAge(age), undefined, lang)`;
      - refuses with "อายุ N ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น" when null;
      - takes `pick = adPick(sex, rung)` and `owner = headlineOwner(table, pick)` for `ad.age`/`ad.sex`;
    - stops with Organic's thin-facts message when `tooThin`;
    - writes one chat call per angle line (writer = the campaign's writer or the default, as
      `writeClaim` does, under the same content budget hold);
    - saves each ad with:
      - `planHref: CLAIM_HREF, format: "ad", campaignId`;
      - `output = inTongue(dressed({ hooks:[headline], body: assembleClaimAd(...), closing: description, hashtags: [], imagePrompt, poster: claimAdPoster(...), disclaimer, fact: factsBlock(facts), figures, ad: { angle: label, tone: "", reader, kind: "claim", claimTable: withTable, ...(withTable ? { age, sex: owner.sex } : {}) } }))`;
      - `figures = [tableText(table) if any, contact].join("\n")`;
      - flags = `flagsFor(output, lang, `${factsBlock}\n${figures}`, words, null)`, plus, when
        `withTable`, `restatedFigures(modelText, factsBlock, table)` merged into `numbers`;
    - attaches the papers to each saved ad (`attachPapers`), so every ad has its own copy and
      `paperChecked: false`;
    - returns `roundResult`-shaped `{ok, items (forClient), costThb, missing}`.
  - Route PUT: when `form.get("campaign")` is set:
    1. consent;
    2. papers/ratios as now;
    3. rate limit;
    4. `requireStaff("owner")` (403 on failure);
    5. ceiling;
    6. `takeRound(viewer,"ai-claim")`;
    7. `payRound(pass, () => writeClaimAds({...}))`, where `withTable = form.get("table") === "on"`
       and age/sex/rung come from the form only when the table is on.

  Without `campaign`, the old path (`format=ad` stays `ADS_MOVED`).

- [ ] **Step 1: Write failing tests** (mock chat, store, campaign store, myPages, requireStaff; follow
  the mocking style of the existing `tests/studio/*actions*.test.ts`):
  - A non-owner gets an error and no chat call.
  - An unknown campaign → "ไม่พบแคมเปญนี้".
  - A Page no longer connected → "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว".
  - Thin facts → refused before any chat call.
  - `withTable` at an unpriced age → refused before chat.
  - A Thai round saves `planHref "claim-review"`, `campaignId`, `ad.kind "claim"`,
    `ad.claimTable true`, a body containing `tableText(table)`, and `paperChecked false` after attach.
  - `withTable: false` → the body has no "บาท/ปี", and `ad.age` is undefined.
  - A model story that restates a table premium → that number is in `flags.numbers`.
  - An Expat campaign (iHealthy Ultra on an Expat Page) → `claimAdMessages` was called with
    `lang "en"`, and the body ends with `CLAIM_CAUTION_EN`.
- [ ] **Step 2:** Run `npx vitest run tests/ads/claim-ad-run.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement, including the route branch.
- [ ] **Step 4:** Rerun, plus `npx vitest run tests/content` and `npx tsc --noEmit`. Expected: PASS
  and clean.
- [ ] **Step 5:** Commit `feat(ads): write รีวิวเคลม ads into a campaign`.

### Task 3: Send gate and paper check on campaign ads
**Files:**
- Modify: `src/lib/ads/room-view.ts`, `src/app/studio/ads/actions.ts` (`sendApproved`),
  `src/app/studio/ads/SendDialog.tsx`, `src/app/studio/ads/AdsList.tsx`,
  `src/app/studio/ads/AdEditor.tsx`
- Test: `tests/ads/room-view.test.ts` (extend), `tests/ads/send-approved*.test.ts` (extend the
  existing sendApproved test file)

**Interfaces:**
- **Produces:** `paperPending(o: { poster?: { documents?: unknown[] } | null; paperChecked?: boolean }): boolean`
  in `room-view.ts`, true when there are documents and `paperChecked === false`.
- `sendApproved`:
  - a piece with `paperPending(p.output)` is skipped with reason `PAPER_UNCHECKED` (imported from
    `publish-flow.ts`), checked after `PICTURE_PENDING`;
  - with every piece skipped, the existing refusal (engine not called).
- `SendDialog`:
  - the ticked ads that are `paperPending` are not sent;
  - a line reads "ข้ามแอดรีวิวเคลมที่ยังไม่ตรวจใบเคลม N ชิ้น".
- `AdsList`: a warning chip "ยังไม่ตรวจใบเคลม" on such rows.
- `AdEditor`:
  - for a claim ad with documents, render `ClaimPaperCheck` (from `../claim/ClaimPaperCheck`) above
    the fields;
  - `onChecked` updates the item as the editor's save does; pending stickers block leaving, as in
    `PieceEditor`.

- [ ] **Step 1: Write failing tests:**
  - `paperPending` is true for `{poster:{documents:[{}]}, paperChecked:false}`.
  - It is false when `paperChecked` is true, absent, or there are no documents.
  - `sendApproved` with one unchecked claim piece and one ordinary piece sends only the ordinary
    one and lists the claim piece with `PAPER_UNCHECKED`.
  - With only the claim piece, it is refused and `runSend` is not called.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun, plus `npx tsc --noEmit` and `npx eslint src/app/studio/ads src/lib/ads`.
  Expected: PASS and clean.
- [ ] **Step 5:** Commit `feat(ads): claim papers checked before a send`.

### Task 4: The drawer form
**Files:**
- Create: `src/app/studio/ads/ClaimFields.tsx`
- Modify: `src/app/studio/ads/WriteForm.tsx`, `src/app/studio/ads/CampaignRoom.tsx` (`write`)
- Test: `tests/ads/claim-form.test.ts` (pure helpers only)

**Interfaces:**
- **Produces, as pure functions in a new `src/lib/ads/claim-form.ts`:**
  - `claimReady(s: { files: number; consent: boolean; read: boolean }): boolean`, true only for
    1–6 files, consent, and a done read.
  - `claimPutForm(...)`: builds the PUT `FormData` fields
    `consent, campaign, facts, count, angle, custom, reader, table, age?, sex?, rung?, paper*, ratio*`.
    It is tested on its key/value list.
- **`ClaimFields`** (client):
  - photo input (1–6, accept jpeg/png/webp), the consent tick, the **ใส่ตารางเบี้ย** switch
    (default on), the angle select from `CLAIM_ANGLES` plus a custom text, and the count 1–3;
  - **อ่านใบเคลม**:
    - `shrink` each file, then POST `/api/content-claim` (consent, docs);
    - shows the facts as a short list (ยอดบิล, ประกันจ่าย, จ่ายเอง, กี่คืน, โรค, เพศ/ช่วงอายุ) and
      each paper burnt with its AI stickers (`burn`) as a thumbnail;
    - changing the photos clears the read;
    - the note under it: "เพิ่มสติ๊กเกอร์ได้ตอนกด ตรวจแล้ว ในหน้าแก้ไขแอด ก่อนส่ง".
- **`WriteForm`:**
  - when `kind === "claim"`, render `ClaimFields` in place of the angle/sex/row fields;
  - the age/sex/row pickers and the headline preview show only when the table switch is on;
  - the press needs `claimReady`.
- **`CampaignRoom.write`:**
  - for a claim kind, PUT the `claimPutForm` (papers: approval letters first, at most `MAX_PAPERS`,
    burnt, as `ClaimTools` does);
  - then the same round note, selection and `draw(toDraw(items))` as other kinds.

- [ ] **Step 1: Write failing tests** for `claimReady`:
  - 0 files → false; 7 files → false; no consent → false; not read → false; 1–6 files with consent
    and read → true.
  - For `claimPutForm`: with `table:false` it omits age/sex/rung and has `table` absent; with
    `table:true` it has `table=on, age, sex, rung`; it always has `consent=on` and `campaign`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers and the components.
- [ ] **Step 4:** Rerun, plus `npx tsc --noEmit` and `npx eslint src/app/studio/ads`. Expected: PASS
  and clean.
- [ ] **Step 5:** Commit `feat(ads): รีวิวเคลม in the create drawer`.

### Task 5: Verify
- [ ] Run the full `npx vitest run`. The known failure is `tests/chat/session-turn.test.ts`; nothing else
  may fail.
- [ ] Run `NEXT_DIST_DIR=.next-build npx next build`.
- [ ] Controller: a browser look only, at 1440px and 375px, of the drawer with รีวิวเคลม picked. No
  read, create or send is pressed.
- [ ] Update `docs/superpowers/specs/2026-10-06-ads-studio-claim-review-design.md` step 2 ("the owner
  may add stickers"): adding stickers happens at ตรวจแล้ว in the editor, which every claim ad must
  pass before a send. Commit `docs(ads): stickers added at the paper check`.
