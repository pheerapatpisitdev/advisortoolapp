# Lead-Form Objective on Send — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Ads Studio's "ส่งขึ้น Facebook" dialog the owner picks ทราฟฟิก (today's behaviour) or ฟอร์มลีด; a lead send makes an `OUTCOME_LEADS` campaign whose ads open a Page Instant Form the owner chose.

**Architecture:** The objective, form id and CTA are stored on `ins_ad_send`, so a resume rebuilds the same objects. `graph.ts` builders take an `AdGoal` and emit traffic or lead fields; traffic output is byte-for-byte unchanged. A new `lead-forms.ts` reads a Page's ACTIVE forms and lead-ads TOS state; the server re-checks the chosen form before sending.

**Tech Stack:** Next.js server actions, Supabase (service_role tables), Meta Marketing API v23.0, vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-ads-lead-form-objective-design.md`

## Global Constraints

- Every Meta object is created `PAUSED`; nothing here switches anything on.
- Traffic sends must send exactly the params they send today (existing `send.test.ts` / `launch.test.ts` assertions stay untouched and green).
- Objectives: `"traffic" | "leads"`. CTAs: `GET_QUOTE` (default, "รับใบเสนอราคา"), `SIGN_UP` ("ลงทะเบียน"), `LEARN_MORE` ("ดูเพิ่มเติม").
- Lead creative link: `LEAD_LINK = "http://fb.me/"`; stored in `ins_ad_send.link` for lead sends.
- Any id put in a Graph path must match `/^\d+$/` (Page, form) or `/^act_\d+$/` (account).
- Owner-only: every new server action starts with `requireStaff("owner")`.
- `.env.local` points at the PRODUCTION database: never press send / connect in a local browser check.
- Copy is Thai; code comments English, matching surrounding density.

## Review Focus

1. A resume of a lead send whose ad set broke must rebuild the ad set and creatives as leads with the same form — not fall back to traffic (Task 3 test).
2. A form id posted to `sendApproved` that is not an ACTIVE form of the campaign's Page (stale dialog, tampered request) must be refused before Meta is asked (Task 5 test).
3. Switching the dialog from ฟอร์มลีด back to ทราฟฟิก must require a link again; switching to ฟอร์มลีด must not need one (Task 6 `formReady` test).
4. A Page the connected ads login does not manage (no `access_token` in Meta's answer) must give a readable Thai error, not a crash (Task 4 test).
5. Old send rows (no new columns set) must read and resume as traffic (Task 1 store test).

---

### Task 1: Store the objective on a send

**Files:**
- Create: `supabase/migrations/20261006_ad_send_objective.sql`
- Modify: `src/lib/ads/send-store.ts` (types `AdSend`, `NewSend`, `SendDb`, `sendFromDb`, `createSend`)
- Test: `tests/ads/send-store.test.ts`

**Interfaces:**
- Produces (in `send-store.ts`):
  - `export type SendObjective = "traffic" | "leads";`
  - `export type LeadCta = "GET_QUOTE" | "SIGN_UP" | "LEARN_MORE";`
  - `AdSend` gains `objective: SendObjective; leadFormId: string | null; cta: LeadCta | null;`
  - `NewSend` gains `objective?: SendObjective; leadFormId?: string | null; cta?: LeadCta | null;` (omitted → traffic / null)

- [ ] **Step 1: Write failing tests** in `send-store.test.ts`
  - `createSend` with `{ objective: "leads", leadFormId: "777", cta: "GET_QUOTE" }` → insert payload contains `objective: "leads", lead_form_id: "777", cta: "GET_QUOTE"`; and with none of them → `objective: "traffic", lead_form_id: null, cta: null`.
  - `sendFromDb` via `getSend`: a row with `objective: "leads", lead_form_id: "777", cta: "SIGN_UP"` → `{ objective: "leads", leadFormId: "777", cta: "SIGN_UP" }`; a row without those keys (old shape) → `{ objective: "traffic", leadFormId: null, cta: null }`.
  - Migration text (`readFileSync("supabase/migrations/20261006_ad_send_objective.sql")`) contains `objective in ('traffic', 'leads')`, `'GET_QUOTE', 'SIGN_UP', 'LEARN_MORE'`, and `objective <> 'leads' or (lead_form_id is not null and cta is not null)`.
- [ ] **Step 2:** `npx vitest run tests/ads/send-store.test.ts` → FAIL (missing fields / file).
- [ ] **Step 3: Write the migration** — exactly the SQL in spec §4 (three `add column if not exists`, then the named check constraint `ins_ad_send_leads_form`), plus `comment on column` lines in Thai for the three columns, matching `20261005_ad_studio_flow.sql` style.
- [ ] **Step 4: Update `send-store.ts`** — add the columns to `SendDb` as optional (`objective?: SendObjective; lead_form_id?: string | null; cta?: LeadCta | null`), map with `?? "traffic"` / `?? null`, insert them in `createSend`.
- [ ] **Step 5:** `npx vitest run tests/ads/send-store.test.ts` → PASS. Fix the memory store in `tests/ads/send.test.ts` (`createSend` builds an `AdSend`) to fill `objective: s.objective ?? "traffic", leadFormId: s.leadFormId ?? null, cta: s.cta ?? null` so `npx tsc --noEmit` stays clean.
- [ ] **Step 6: Commit** `feat(ads): a send remembers its objective, lead form and button`

### Task 2: Goal-aware Graph builders

**Files:**
- Modify: `src/lib/ads/graph.ts` (`campaignParams`, `adsetParams`, `creativeParams`; new `AdGoal`, `LEAD_LINK`, `LEAD_CTAS`)
- Modify: `src/lib/ads/launch.ts:201-245` (callers pass a traffic goal)
- Test: `tests/ads/graph.test.ts` (new)

**Interfaces:**
- Consumes: `LeadCta` from Task 1.
- Produces (in `graph.ts`):
  - `export const LEAD_LINK = "http://fb.me/";`
  - `export const LEAD_CTAS: readonly LeadCta[] = ["GET_QUOTE", "SIGN_UP", "LEARN_MORE"];`
  - `export type AdGoal = { objective: "traffic"; link: string } | { objective: "leads"; leadFormId: string; cta: LeadCta };`
  - `campaignParams(name: string, objective: AdGoal["objective"] = "traffic")`
  - `adsetParams(a: { name; campaignId; dailyBudgetMinor; identity; goal: AdGoal; pageId: string })`
  - `creativeParams(c: { name; pageId; imageHash; goal: AdGoal; primaryText; headline; description })` — the old `link` field is removed; traffic link comes from `goal.link`.

- [ ] **Step 1: Write failing tests** in `tests/ads/graph.test.ts`:
  - `campaignParams("n")` and `campaignParams("n", "traffic")` → `objective: "OUTCOME_TRAFFIC"`; `campaignParams("n", "leads")` → `objective: "OUTCOME_LEADS"`; both keep `status: "PAUSED"`, `special_ad_categories: "[]"`, `is_adset_budget_sharing_enabled: "false"`.
  - `adsetParams({... goal: { objective: "traffic", link: "https://x" }, pageId: "111" })` → `optimization_goal: "LINK_CLICKS"`, `destination_type: "WEBSITE"`, and **no** `promoted_object` key.
  - `adsetParams({... goal: { objective: "leads", leadFormId: "777", cta: "GET_QUOTE" }, pageId: "111" })` → `optimization_goal: "LEAD_GENERATION"`, `destination_type: "ON_AD"`, `JSON.parse(promoted_object)` equals `{ page_id: "111" }`; `billing_event`, `bid_strategy`, `targeting`, `regional_*`, `status`, `daily_budget` equal the traffic ones.
  - `creativeParams` traffic → `link_data.link === "https://x"`, `call_to_action` `{ type: "LEARN_MORE", value: { link: "https://x" } }`.
  - `creativeParams` leads with `cta: "SIGN_UP"` → `link_data.link === LEAD_LINK`, `call_to_action` `{ type: "SIGN_UP", value: { lead_gen_form_id: "777" } }`, message/name/description unchanged.
- [ ] **Step 2:** `npx vitest run tests/ads/graph.test.ts` → FAIL.
- [ ] **Step 3: Implement** the signatures above in `graph.ts`; update the comment on each builder. In `launch.ts` pass `goal: { objective: "traffic", link: row.link }` and `pageId` to `adsetParams`, and `goal` instead of `link` to `creativeParams`.
- [ ] **Step 4:** `npx vitest run tests/ads/graph.test.ts tests/ads/launch.test.ts` → PASS (launch tests unchanged).
- [ ] **Step 5: Commit** `feat(ads): graph builders make traffic or lead-form objects`

### Task 3: The send engine sends leads

**Files:**
- Modify: `src/lib/ads/send.ts` (`SendInput`, `runSend`, `drive`, `makeAd`; new `goalOf`)
- Test: `tests/ads/send.test.ts`

**Interfaces:**
- Consumes: Task 1 `AdSend.objective/leadFormId/cta`, `NewSend` fields; Task 2 `AdGoal`, `LEAD_LINK`, `LEAD_CTAS`, builders.
- Produces:
  - `SendInput` gains `objective?: SendObjective; leadFormId?: string; cta?: string;` (`link` stays; ignored for leads).
  - `export function goalOf(send: AdSend): AdGoal` — traffic → `{ objective: "traffic", link: send.link }`; leads → `{ objective: "leads", leadFormId: send.leadFormId!, cta: send.cta! }`.

- [ ] **Step 1: Write failing tests** in `send.test.ts` (`const leads = { ...input, objective: "leads" as const, leadFormId: "777", cta: "GET_QUOTE" }`):
  - "sends a lead batch": `replies = [...FULL]`, `runSend(leads)` → campaign `objective` `OUTCOME_LEADS`; ad set `optimization_goal` `LEAD_GENERATION`, `destination_type` `ON_AD`, `promoted_object` `{"page_id":"111"}`; both creatives' `call_to_action` `{ type: "GET_QUOTE", value: { lead_gen_form_id: "777" } }` and `link` `"http://fb.me/"`; `sends[0]` has `objective: "leads", leadFormId: "777", cta: "GET_QUOTE", link: "http://fb.me/"`; every object PAUSED.
  - "a lead send needs no link": `runSend({ ...leads, link: "" })` → ok.
  - Refusals (add to the `it.each` table in "refusing before Meta is asked"): leads with no `leadFormId` → error contains `"ฟอร์ม"`; `leadFormId: "7/x"` → `"ฟอร์ม"`; `cta: "BUY_NOW"` → `"ปุ่ม"`. Each: `sent` length 0, `sends` length 0.
  - "resumes a lead send at the ad set with the same form": replies `[ok({id:"C1"}), fail(100)]` → stops at adset; then `replies = [ok({id:"AS1"}), ...PIECE1, ...PIECE2]`, `resumeSend(sends[0].id)` → the ad set and both creatives carry the lead fields with form `777`.
- [ ] **Step 2:** `npx vitest run tests/ads/send.test.ts` → new tests FAIL, old PASS.
- [ ] **Step 3: Implement.** In `runSend`, after the budget check: if `objective === "leads"` require `/^\d+$/.test(leadFormId)` (error `"ยังไม่ได้เลือกฟอร์มลีด หรือฟอร์มไม่ถูกต้อง"`) and `LEAD_CTAS.includes(cta)` (error `"ปุ่มบนแอดไม่ถูกต้อง"`), store `link: LEAD_LINK`; otherwise run `checkLink` as today. Pass `objective/leadFormId/cta` to `createSend`. In `drive`: `campaignParams(batchName, send.objective)`, `adsetParams({..., goal: goalOf(send), pageId: send.pageId })`; batch name `Studio · ลีด · N แอด · day` for leads. In `makeAd`: `creativeParams({..., goal: goalOf(send) })`.
- [ ] **Step 4:** `npx vitest run tests/ads/send.test.ts` → all PASS.
- [ ] **Step 5: Commit** `feat(ads): a send can go up as a lead-form campaign`

### Task 4: Read a Page's lead forms

**Files:**
- Create: `src/lib/ads/lead-forms.ts`
- Test: `tests/ads/lead-forms.test.ts`

**Interfaces:**
- Consumes: `graph()` from `graph.ts`.
- Produces:
  - `export interface LeadForm { id: string; name: string }`
  - `export type LeadForms = { ok: true; tosAccepted: boolean; forms: LeadForm[] } | { ok: false; error: string };`
  - `export async function listLeadForms(pageId: string, userToken: string, fetchFn: typeof fetch = fetch): Promise<LeadForms>`
  - `export const tosUrl = (pageId: string) => \`https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}\`;`

- [ ] **Step 1: Write failing tests** (fetch stub recording URL + auth header, as in `send.test.ts`):
  - happy: replies `{ access_token: "PT", leadgen_tos_accepted: true }` then `{ data: [{id:"1",name:"A",status:"ACTIVE"},{id:"2",name:"B",status:"ARCHIVED"}] }` → `{ ok: true, tosAccepted: true, forms: [{ id: "1", name: "A" }] }`; first request path `/v23.0/111` with `fields=access_token,leadgen_tos_accepted`, auth `Bearer USER`; second path `/v23.0/111/leadgen_forms` with `fields=id,name,status` and `limit=100`, auth `Bearer PT`.
  - TOS not accepted (`leadgen_tos_accepted: false` or missing) → `{ ok: true, tosAccepted: false, forms: [] }` and only one request.
  - no `access_token` in the first answer → `{ ok: false }` with error containing `"เพจ"`.
  - Meta error on either request → `{ ok: false, error }` with `error` starting `"Facebook ไม่รับ"`.
  - `pageId: "1?x"` → `{ ok: false }`, zero requests.
- [ ] **Step 2:** `npx vitest run tests/ads/lead-forms.test.ts` → FAIL.
- [ ] **Step 3: Implement** with two GET `graph()` calls (query string in the path; no params object so it stays a GET). Error for a missing page token: `"บัญชีที่เชื่อมไว้สำหรับสร้างแอดไม่ได้ดูแลเพจนี้ เชื่อมบัญชีใหม่แล้วติ๊กเพจนี้"`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(ads): read a Page's active lead forms and lead-ads terms`

### Task 5: Server actions

**Files:**
- Modify: `src/app/studio/ads/actions.ts` (new `leadForms`; `SendApprovedInput`, `sendApproved`; `SendView` + its builder ~line 570)
- Test: `tests/ads/studio-flow-actions.test.ts`

**Interfaces:**
- Consumes: Task 3 `SendInput` fields; Task 4 `listLeadForms`, `LeadForms`.
- Produces:
  - `export async function leadForms(campaignId: string, actId: string): Promise<LeadForms>` — owner only; refuses (as `{ ok: false, error }`) unknown campaign, account not connected, Page not in `myPages()`, no token.
  - `SendApprovedInput` gains `objective?: SendObjective; leadFormId?: string; cta?: string;`
  - `SendView` gains `objective: SendObjective`.

- [ ] **Step 1: Write failing tests** (mock `@/lib/ads/lead-forms` with `vi.hoisted({ listLeadForms: vi.fn() })`):
  - existing "hands runSend…" expectation: add `objective: "traffic"` to the expected `runSend` argument.
  - leads go: `listLeadForms` → `{ ok: true, tosAccepted: true, forms: [{ id: "777", name: "F" }] }`; `go({ objective: "leads", leadFormId: "777", cta: "GET_QUOTE" })` → `runSend` called with `objective: "leads", leadFormId: "777", cta: "GET_QUOTE"`; `listLeadForms` called with `(PAGE, SECRET)`.
  - form not in the list → `{ ok: false, step: "check" }`, error contains `"ฟอร์มนี้ไม่อยู่ในเพจหรือถูกปิดแล้ว"`, `runSend` not called.
  - `tosAccepted: false` → error contains `"ยังไม่ได้ยอมรับเงื่อนไขแอดลีด"`, `runSend` not called.
  - `leadForms` rejects a non-owner (`"ไม่มีสิทธิ์"`, as the existing owner test does) and returns `listLeadForms`'s answer for the owner.
  - `adCampaignRoom` maps a send row's `objective: "leads"` to `SendView.objective`.
- [ ] **Step 2:** `npx vitest run tests/ads/studio-flow-actions.test.ts` → new FAIL.
- [ ] **Step 3: Implement.** In `sendApproved`, after the account/page checks and only for `objective === "leads"`: `adManageToken(account.id)` → `listLeadForms(campaign.pageId, token)`; refuse with Meta's error, the TOS message, or the not-in-list message. Always pass `objective` (default `"traffic"`) to `runSend`, plus `leadFormId`/`cta` for leads. Add `objective` to the audit detail.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(ads): sending checks the chosen lead form on the Page`

### Task 6: Dialog and sent tab

**Files:**
- Modify: `src/app/studio/ads/form-ready.ts`, `src/app/studio/ads/SendDialog.tsx`, `src/app/studio/ads/SentSend.tsx`, `src/lib/ads/sent-view.ts`
- Test: `tests/ads/form-ready.test.ts`, `tests/ads/sent-view.test.ts`

**Interfaces:**
- Consumes: Task 5 `leadForms`, `SendView.objective`; Task 4 `tosUrl`, `LeadForm`; Task 2 `LEAD_CTAS`.
- Produces:
  - `FormState` gains `objective: SendObjective; leadFormId: string;`
  - `sent-view.ts`: `export const OBJECTIVE_LABEL: Record<SendObjective, string> = { traffic: "ทราฟฟิก", leads: "ฟอร์มลีด" };`
  - `sent-view.ts`: `export const CTA_LABEL: Record<LeadCta, string> = { GET_QUOTE: "รับใบเสนอราคา", SIGN_UP: "ลงทะเบียน", LEARN_MORE: "ดูเพิ่มเติม" };`

- [ ] **Step 1: Write failing tests**
  - `form-ready.test.ts`: traffic with empty link → false (as today); leads with empty link and `leadFormId: "777"` → true; leads with `leadFormId: ""` → false; leads still enforces budget/cap/account/page.
  - `sent-view.test.ts`: `OBJECTIVE_LABEL.leads === "ฟอร์มลีด"`, `CTA_LABEL.GET_QUOTE === "รับใบเสนอราคา"`.
- [ ] **Step 2:** `npx vitest run tests/ads/form-ready.test.ts tests/ads/sent-view.test.ts` → FAIL.
- [ ] **Step 3: Implement `formReady`**: link required only when `objective === "traffic"`; `leadFormId !== ""` required when `"leads"`. Update the existing call site.
- [ ] **Step 4: Implement the dialog** per spec §1: two toggle buttons (`aria-pressed`) at the top of the fieldset; on first switch to leads call `leadForms(campaign.id, actId)` (re-call when `actId` changes or "โหลดใหม่" is pressed); states loading / TOS link (`tosUrl`, `target="_blank" rel="noreferrer"`) / no forms (link `https://business.facebook.com/latest/instant_forms` + โหลดใหม่) / error + โหลดใหม่ / `<select>` of forms (first preselected) and `<select>` of `LEAD_CTAS` labelled by `CTA_LABEL` (default `GET_QUOTE`). Hide the link input in leads mode. Header line reads `1 แคมเปญลีด + 1 ชุดโฆษณา…` in leads mode. `sendApproved` gets `objective`, and `leadFormId`/`cta` for leads.
- [ ] **Step 5: Implement the sent tab**: in `SentSend` facts line prefix `OBJECTIVE_LABEL[send.objective] · `.
- [ ] **Step 6:** `npx vitest run tests/ads` → PASS.
- [ ] **Step 7: Commit** `feat(ads): choose traffic or a lead form when sending`

### Task 7: Verify and hand over for rollout

- [ ] **Step 1:** `npx tsc --noEmit && npx eslint src/lib/ads src/app/studio/ads tests/ads && npx vitest run` → no type or lint errors; the only failing test is the known `tests/chat/session-turn.test.ts`.
- [ ] **Step 2: Browser check (look only).** Start the dev server, open a campaign room in `/studio/ads/[id]`, open ส่งขึ้น Facebook: toggle shows; ฟอร์มลีด hides the link and shows the form states; phone width (375px) has no horizontal scroll. Do NOT press the send button (local env writes to production).
- [ ] **Step 3: Report to the owner** and ask before rollout: apply `20261006_ad_send_objective.sql` to prod Supabase `cenysylrzbwfrtuqoeqk`, verify the columns, then merge to `main` and push (Vercel prod). Live test per spec §7 is the owner's.
