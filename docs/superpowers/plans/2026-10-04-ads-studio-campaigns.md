# Ads Studio (แคมเปญ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยกแอดออกจาก Organic Studio เป็น Ads Studio ของเจ้าของ จัดเป็นแคมเปญ (หนึ่งแบบประกันต่อเพจ) เขียนคำโฆษณา แก้โปสเตอร์ และยิงแอดได้ในห้องเดียว

**Architecture:** ตาราง `ins_ad_campaign` บางๆ บนของเดิม ชิ้นแอดใน `ins_content` ชี้ด้วย `campaign_id` การเขียนใช้ `generateContent`/`writeAds` เดิมโดยส่ง `campaignId` การยิงใช้ `runLaunch`/`activateLaunch` เดิม หน้าใหม่ `/studio/ads` (รายการแคมเปญ) และ `/studio/ads/[id]` (ห้องทำงาน) แทน `AdsLaunch.tsx`

**Tech Stack:** Next.js 15 App Router + server actions, Supabase (service role), vitest

**Spec:** [docs/superpowers/specs/2026-10-04-ads-studio-campaigns-design.md](../specs/2026-10-04-ads-studio-campaigns-design.md)

## Global Constraints

- Ads Studio เป็นของ `owner` คนเดียว (รหัส 015495): หน้าใช้ `gatePage(..., "owner")` ทุก action ของ Ads Studio เรียก `requireStaff("owner")` ช่องหน้ารวมและเมนูโผล่เฉพาะเจ้าของ
- เจ้าของยิงได้ทุกเพจที่ `myPages()` คืน (เจ้าของได้ทุกเพจ) เพจของแอดคือเพจของแคมเปญ ไม่มีช่องเลือกเพจตอนยิง
- พฤติกรรมยิงแอดเดิมห้ามเปลี่ยน: PAUSED ทุกขั้น, เพดาน `ADS_MAX_DAILY_BUDGET_THB` (500), ยืนยันก่อนเปิดใช้และสร้างใหม่, บัญชีสกุลบาทเท่านั้น
- Organic Studio (เขียน, หาทีม, เกลาร่าง, รีวิวเคลม) ไม่สร้างและไม่แสดงชิ้น `format = "ad"` อีก
- โปสเตอร์ 1:1 ใช้ `PosterPanel` และ `drawPicture`/`drawBackground` เดิม ไม่เขียนตัวแก้ใหม่
- ไม่มี: มิติแบบ Monoko, carousel, อัตราส่วนอื่น, หน้าคุมผลแบบ AD Pilot, ลบแคมเปญ
- ข้อความในหน้าเป็นภาษาไทย ตามคำของ Studio ที่ใช้อยู่ ชื่อห้องคือ "Ads Studio"
- เทสต์ห้ามแตะฐานข้อมูลหรือ Meta จริง (`.env.local` ชี้โปรดักชัน) mock แบบ `tests/ads/*.test.ts`
- ไฟล์ค้างจากงานอื่นห้าม stage: `.env.example`, `src/app/Chat.tsx`, `src/app/layout.tsx`, `src/lib/chat/record.ts`, `src/app/api/meta/`, `src/components/meta/`, `src/lib/meta/`, `docs/pixel-capi-plan.md`, `docs/workflow-flowchart.md` — `git add` ทีละไฟล์
- ทำบน branch `feat/ads-studio-campaigns` ในโฟลเดอร์หลัก; migration ต้องรันบนโปรดักชันก่อน push (Task 7)

## Review Focus

1. เพจของแคมเปญถูกถอดการเชื่อมต่อไปแล้ว: หน้ารายการและห้องทำงานยังเปิดได้ ห้องบอก "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" และปุ่มยิงกดไม่ได้ (Task 4)
2. id แคมเปญใน URL ไม่มีอยู่หรือไม่ใช่ uuid: พากลับหน้ารายการ ไม่ 500 (Task 4)
3. แก้คำโฆษณาของชิ้นที่ยิงไปแล้ว: แอดบน Meta ไม่เปลี่ยน หน้าแก้ต้องบอกว่า "แก้ตรงนี้ไม่เปลี่ยนแอดที่ยิงไปแล้ว ใช้สร้างใหม่" (Task 5)
4. ชิ้นแอดเกิดขึ้นช่วงระหว่างรัน migration กับ deploy (ไม่มีแคมเปญ): รัน migration ซ้ำแล้วถูกเก็บเข้าแคมเปญ ไม่สร้างแคมเปญซ้ำ (Task 1)
5. กด "เขียนแอดเพิ่ม" ซ้ำระหว่างที่รอบก่อนยังเขียนอยู่: ปุ่มถูกปิดจนรอบแรกจบ (Task 5)

---

### Task 1: ตารางแคมเปญ ที่เก็บ และการย้ายชิ้นเก่า

**Files:**
- Create: `supabase/migrations/20261004_ad_campaigns.sql`
- Create: `src/lib/ads/campaign-store.ts`
- Modify: `src/lib/content/store.ts` (`COLUMNS`, `toItem`, `saveContent`, `ContentItem`)
- Test: `tests/ads/campaign-store.test.ts`, `tests/content/` (ไฟล์เทสต์ store ที่มีอยู่ ถ้ามี ไม่มีก็เพิ่มใน campaign-store test)

**Interfaces:**
- ตาราง `public.ins_ad_campaign`: `id uuid pk default gen_random_uuid()`, `created_at timestamptz not null default now()`, `page_id text not null`, `plan_href text not null`, `name text`, `angles int not null default 2`, `tones int not null default 2`, `theme text`, `hint text`, `agent_id uuid`; RLS เปิด, `revoke all ... from public, anon, authenticated; grant all ... to service_role;` แบบ `20260930_wallet.sql`; comment ไทย
- `alter table public.ins_content add column if not exists campaign_id uuid references public.ins_ad_campaign(id) on delete set null;` + index บน `campaign_id`
- Backfill (รันซ้ำได้): สร้างแคมเปญหนึ่งตัวต่อ `(page_id, plan_href)` ของชิ้น `format='ad' and page_id is not null and campaign_id is null` ที่ยังไม่มีแคมเปญคู่นั้น (`agent_id` = ของชิ้นที่เก่าที่สุดในกลุ่ม) แล้ว `update ins_content set campaign_id` จากแคมเปญที่ `page_id, plan_href` ตรงกัน (เลือกแคมเปญที่เก่าที่สุดถ้ามีหลายตัว) ชิ้นที่ไม่มีเพจไม่แตะ
- `campaign-store.ts` produces: `interface AdCampaign { id; createdAt; pageId; planHref; name: string | null; angles: number; tones: number; theme: string | null; hint: string | null; agentId: string | null }`, `listCampaigns(pageId: string): Promise<AdCampaign[]>` (ใหม่สุดก่อน), `getCampaign(id: string): Promise<AdCampaign | null>` (id ที่ไม่ใช่ uuid คืน null โดยไม่ถามฐานข้อมูล), `createCampaign(c: { pageId; planHref; name?: string | null; angles; tones; theme?: string | null; hint?: string | null; agentId: string | null }): Promise<AdCampaign>`, `updateCampaign(id, patch: Partial<Pick<AdCampaign, "name" | "angles" | "tones" | "theme" | "hint">>): Promise<void>`, `listCampaignPieces(campaignId: string): Promise<ContentItem[]>` (ทุกสถานะ ใหม่สุดก่อน ใช้ `COLUMNS` ของ store.ts ที่ export ออกมา)
- `store.ts`: `ContentItem.campaignId: string | null`; `COLUMNS` เพิ่ม `campaign_id`; `saveContent` row รับ `campaignId?: string | null` เขียน `campaign_id`
- `angles` ถูกบีบเป็น 1..`MAX_ANGLES` และ `tones` 1..`MAX_TONES` (จาก `src/lib/content/ads.ts`) ใน `createCampaign`/`updateCampaign`

- [ ] **Step 1: เทสต์ล้ม** (mock `@/lib/supabase/admin`): `getCampaign("not-a-uuid")` คืน null และไม่เรียก `from`; `createCampaign({ angles: 9, tones: 0, ... })` insert `angles: MAX_ANGLES, tones: 1`; `listCampaigns("p1")` กรอง `page_id = p1` เรียง `created_at` desc; `listCampaignPieces("c1")` กรอง `campaign_id = c1`; `saveContent({..., campaignId: "c1"})` insert มี `campaign_id: "c1"` และ `toItem` แปลง `campaign_id` เป็น `campaignId`; ข้อความ migration มี `on delete set null`, `revoke all on public.ins_ad_campaign from public, anon, authenticated`, `campaign_id is null` (การ backfill รันซ้ำได้)
- [ ] **Step 2: รัน** `npx vitest run tests/ads/campaign-store.test.ts` ต้องล้ม
- [ ] **Step 3: เขียน** migration, `campaign-store.ts`, และแก้ `store.ts` ตาม Interfaces
- [ ] **Step 4: รัน** `npx vitest run tests/ads tests/content` ผ่าน และ `npx tsc --noEmit` สะอาด
- [ ] **Step 5: Commit** `feat(ads): ad campaigns — a table, a store, and old ad pieces filed into them`

---

### Task 2: Organic Studio ไม่มีแอดอีก

**Files:**
- Modify: `src/app/studio/ui/form-parts.tsx` (`FORMATS` = `["post", "script"]`)
- Modify: `src/lib/content/store.ts` (`listContent`, `countByStatus`, `countDraftsByPage` ไม่นับ `format = 'ad'` เว้นแต่ขอ)
- Modify: `src/app/studio/actions.ts` (`generateRecruit`, `generateDraft` ปฏิเสธ `"ad"`), `src/app/api/content-claim/route.ts` (ปฏิเสธ `"ad"`)
- Modify: `src/app/studio/ContentStudio.tsx`, `src/app/studio/recruit/RecruitTools.tsx`, `src/app/studio/draft/DraftTools.tsx`, `src/app/studio/claim/ClaimTools.tsx` เฉพาะส่วนที่ค่าเริ่มต้นหรือ state จำ `"ad"` ไว้ (เช่น localStorage) ให้ตกกลับเป็น `"post"`
- Test: เทสต์ของ store / actions ที่มีอยู่ใน `tests/content/`

**Interfaces:**
- `listContent(filter: { status?; planHref?; pageId?; includeAds?: boolean } = {}, limit, offset)` — ไม่ส่ง `includeAds` = เพิ่ม `.neq("format", "ad")`; `countByStatus(planHref?, pageId?)` และ `countDraftsByPage()` ไม่นับแอดเสมอ
- ข้อความปฏิเสธเดียวกันทุกที่: `"โฆษณาย้ายไปทำใน Ads Studio แล้ว"`
- ผู้เรียก `listContent` ที่ต้องการแอด (ตอนนี้มีแค่ `src/app/studio/ads/actions.ts` ซึ่ง Task 4 เปลี่ยนไปใช้ `listCampaignPieces`) ส่ง `includeAds: true` ไว้ก่อนจนถึง Task 4

- [ ] **Step 1: เทสต์ล้ม**: `listContent()` ส่ง filter `format neq ad`; `listContent({ includeAds: true })` ไม่ส่ง; `countByStatus` และ `countDraftsByPage` ส่ง `neq ad`; `generateRecruit({ format: "ad", ... })` และ `generateDraft({ format: "ad", ... })` คืน `{ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" }` โดยไม่เรียกตัวเขียน; route `content-claim` กับ `format=ad` ตอบข้อความเดียวกัน
- [ ] **Step 2: รัน** เทสต์ที่แก้ ต้องล้ม
- [ ] **Step 3: เขียน** ตาม Interfaces หาผู้เรียก `listContent` ทุกที่ด้วย grep ให้ครบ ถ้าผู้เรียกใดต้องการเห็นแอด (ไม่ใช่ Organic) ให้ส่ง `includeAds: true` และจดไว้ในรายงาน
- [ ] **Step 4: รัน** `npx vitest run` ทั้งชุด ผ่าน ยกเว้น `tests/chat/session-turn.test.ts` ที่ล้มอยู่ก่อนแล้วบน main; `npx tsc --noEmit` สะอาด
- [ ] **Step 5: Commit** `change(studio): Organic Studio writes and lists posts and scripts only — ads moved to Ads Studio`

---

### Task 3: เขียนแอดเข้าแคมเปญ

**Files:**
- Modify: `src/app/studio/actions.ts` (`GenerateInput`, `generateContent`, `saveAll`)
- Test: `tests/content/` เทสต์ของ `generateContent` ที่มีอยู่ (หรือไฟล์ใหม่ `tests/ads/campaign-write.test.ts`)

**Interfaces:**
- Consumes: Task 1 `getCampaign`, `saveContent(... campaignId)`
- `GenerateInput.campaignId?: string`
- `generateContent` เมื่อ `format === "ad"`:
  - ไม่มี `campaignId` → `{ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" }`
  - มี → `requireStaff("owner")` (ไม่ใช่เจ้าของ → `{ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" }`), `getCampaign` (ไม่พบ → `{ ok: false, error: "ไม่พบแคมเปญนี้" }`), แล้วใช้ `href = campaign.planHref`, `page = campaign.pageId`, `adAngles = campaign.angles`, `adTones = campaign.tones`, `theme = campaign.theme ?? input.theme`, `custom = campaign.hint ?? ""` แทนค่าที่ส่งมา และบันทึกทุกชิ้นด้วย `campaignId`
- ทางเดิน post/script ไม่เปลี่ยน

- [ ] **Step 1: เทสต์ล้ม** (mock ตัวเขียน `writeAds`, store, viewer แบบ `tests/helpers/signed-in`): `format: "ad"` ไม่มี `campaignId` ถูกปฏิเสธและไม่เรียก `writeAds`; viewer ที่ไม่ใช่เจ้าของถูกปฏิเสธ; campaign `{ planHref: "/lifeprotect", pageId: "P1", angles: 3, tones: 1, hint: "เน้นครอบครัว" }` → `writeAds` ถูกเรียกด้วย `angles: 3, tones: 1` และ hint ที่มี "เน้นครอบครัว", `saveContent` ได้ `campaignId` และ `pageId: "P1"` ถึงแม้ input ส่ง `href`/`page` อื่นมา
- [ ] **Step 2: รัน** ต้องล้ม
- [ ] **Step 3: เขียน** ตาม Interfaces; ตรวจว่า `/api/content-generate` route ส่ง `campaignId` ผ่านถึง `generateContent`
- [ ] **Step 4: รัน** `npx vitest run tests/content tests/ads` ผ่าน; `npx tsc --noEmit` สะอาด
- [ ] **Step 5: Commit** `feat(ads): ads are written into a campaign, with its product, Page and settings`

---

### Task 4: server actions ของ Ads Studio

**Files:**
- Create: `src/lib/ads/campaign-view.ts` (ฟังก์ชันบริสุทธิ์)
- Modify: `src/app/studio/ads/actions.ts` (แทน `adsLaunchSetup` ด้วยชุดใหม่ เก็บ `launchAd`, `activateAd`, `chooseAdManageAccount`)
- Test: `tests/ads/campaign-view.test.ts`, แก้ `tests/ads/launch-actions.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 3; ของเดิม `runLaunch`, `activateLaunch`, `adEffectiveStatus`, `launchStore.findLaunch`, `adManageAccounts`, `adManageToken`, `readPendingAdsManage`, `listAdAccounts`, `tokenExpiry`, `adsManageMissingEnv`, `adsManageOauthIsConfigured`, `myPages`, `listCampaignPieces`
- `campaign-view.ts`: `type AdTab = "draft" | "launched" | "live" | "trash"`; `adTab(piece: { status: ContentStatus }, launch: { activatedAt: string | null } | null): AdTab` (trashed → trash; มี launch และ activatedAt → live; มี launch → launched; อื่นๆ → draft); `tabCounts(rows: AdTab[]): Record<AdTab, number>`
- `actions.ts` (ทุกตัวเริ่มด้วย `requireStaff("owner")` และจับ throw เป็นข้อความไทยแบบเดิม):
  - `adsStudioHome(pageId?: string): Promise<{ pages: { pageId; pageName }[]; pageId: string | null; campaigns: { id; name: string; planHref; cover: string | null /* piece id ของโปสเตอร์ล่าสุด */; counts: Record<AdTab, number> }[]; connection: Connection }>` — `pageId` ที่ไม่อยู่ใน `myPages()` หรือไม่ส่ง → เพจแรก; ชื่อแคมเปญว่าง → ชื่อแบบประกัน
  - `type Connection` = ส่วนบัญชีโฆษณาจาก `AdsLaunchSetup` เดิม (`configured`, `missing`, `accounts`, `choices`, `maxDailyBudgetThb`) ไม่มีโทเค็น
  - `createAdCampaign(input: { pageId; planHref; name?; angles; tones; theme? }): Promise<{ ok: true; id: string } | { ok: false; error: string }>` — `pageId` ต้องอยู่ใน `myPages()`, `planHref` ต้องเป็นแบบประกันที่ `briefFor` รู้จัก
  - `adCampaignRoom(id: string): Promise<{ ok: true; campaign: AdCampaign & { pageName: string | null; pageConnected: boolean }; pieces: (LaunchPiece & { tab: AdTab })[]; counts: Record<AdTab, number>; connection: Connection } | { ok: false }>` — `LaunchPiece` คือรูปชิ้นใน `AdsLaunchSetup.pieces` เดิม (หัวข้อ ข้อความ คำอธิบาย hasPoster launch launches) บวก `poster` และ `flags.policy`; ไม่พบ → `{ ok: false }`
  - `updateAdCampaign(id, patch)` และ `saveAdCopy(pieceId, edits)` (ตรวจว่าชิ้นมี `campaignId` แล้วเรียก `saveContentEdits`)
  - `launchAd(input)` ไม่รับ `pageId` อีก: อ่านชิ้น → `campaignId` → `getCampaign` → `pageId`; ชิ้นที่ไม่มีแคมเปญ → `{ ok:false, step:"check", error:"ชิ้นนี้ไม่ได้อยู่ในแคมเปญ" }`; เพจของแคมเปญไม่อยู่ใน `myPages()` → `"เพจนี้ไม่ได้เชื่อมกับระบบแล้ว"` (Review Focus 1)
- ลบ `adsLaunchSetup` และ type `AdsLaunchSetup` เมื่อ Task 5 ไม่ใช้แล้ว (ทำใน Task 5)

- [ ] **Step 1: เทสต์ล้ม**: `adTab` ครบสี่กรณี; ทุก action ใหม่ปฏิเสธคนที่ไม่ใช่เจ้าของก่อนอ่านอะไร; `adsStudioHome("ไม่มีเพจนี้")` ได้เพจแรก; `adCampaignRoom("not-a-uuid")` และ id ที่ไม่มี → `{ ok: false }` (Review Focus 2); แคมเปญที่เพจหลุดแล้ว → `pageConnected: false` (Review Focus 1); `launchAd` ใช้ `pageId` ของแคมเปญ (ส่งถึง `runLaunch`) และปฏิเสธชิ้นที่ไม่มีแคมเปญ; ผลของ `adsStudioHome` และ `adCampaignRoom` เมื่อ stringify ไม่มีโทเค็นที่ mock ไว้
- [ ] **Step 2: รัน** ต้องล้ม
- [ ] **Step 3: เขียน** ตาม Interfaces ย้ายส่วนบัญชีโฆษณาและวันหมดอายุจาก `adsLaunchSetup` มาเป็นฟังก์ชันภายใน `connection()` ใช้ซ้ำในสองหน้า
- [ ] **Step 4: รัน** `npx vitest run tests/ads` ผ่าน; `npx tsc --noEmit` อาจล้มที่ `AdsLaunch.tsx` ที่ยังใช้ของเก่า — ถ้าล้มเฉพาะตรงนั้นให้คง `adsLaunchSetup` ไว้ชั่วคราว ไม่ปิด tsc
- [ ] **Step 5: Commit** `feat(ads): Ads Studio actions — campaigns per Page, a campaign's room, launch from the campaign's Page`

---

### Task 5: หน้า Ads Studio

**Files:**
- Modify: `src/app/studio/ads/page.tsx` (รายการแคมเปญ)
- Create: `src/app/studio/ads/[id]/page.tsx`, `src/app/studio/ads/CampaignList.tsx`, `src/app/studio/ads/NewCampaign.tsx`, `src/app/studio/ads/CampaignRoom.tsx`, `src/app/studio/ads/AdEditor.tsx`, `src/app/studio/ads/FeedPreview.tsx`, `src/app/studio/ads/ConnectBar.tsx`, `src/app/studio/ads/LaunchPanel.tsx`
- Delete: `src/app/studio/ads/AdsLaunch.tsx` (ย้ายส่วนที่ใช้ได้ไป `ConnectBar`/`LaunchPanel`), `adsLaunchSetup` ใน actions
- Keep: `src/app/studio/ads/form-ready.ts` (ใช้ใน `LaunchPanel`)
- Test: `tests/ads/form-ready.test.ts` คงเดิม; เทสต์ฟังก์ชันบริสุทธิ์ใหม่ถ้ามี (เช่นตัดข้อความ 125 ตัวสำหรับการ์ด)

**Interfaces:**
- Consumes: Task 4 ทั้งหมด, `generateRound` จาก `src/app/studio/draw.ts` (ส่ง `{ format: "ad", campaignId, count: 1, ... }` ที่เหลือใช้ค่าว่างตาม `GenerateInput`), `PosterPanel`, `drawPicture`, `AD_LIMITS`, `ThemeSwatches`
- หน้า: `/studio/ads?page=…` และ `/studio/ads/[id]` ใช้ `gatePage("/studio/ads", "owner")` และ `maxDuration = 300` (เหมือน `page.tsx` เดิม); `[id]` ที่ได้ `{ ok: false }` → `redirect("/studio/ads")`
- รายการ: หัวชื่อเพจ + ตัวเลือกเพจ, `ConnectBar` (แถบเล็ก: บัญชีที่เชื่อม, ปุ่มเชื่อมใหม่, รายการบัญชีที่รอเลือก, คำเตือน `warn=pages`, ข้อความ `?fb=` เดิมทั้งหมด, `missing`), การ์ดแคมเปญ (โปสเตอร์ล่าสุดจาก `/api/content-poster?id=<cover>`, ชื่อ, ตัวนับ ร่าง/ยิงแล้ว/เปิดใช้), ไม่มีแคมเปญ = ขั้นตอน 1-2-3 กับปุ่มเริ่ม, ปุ่ม **สร้างแคมเปญ** เปิด `NewCampaign` (แบบประกัน, ชื่อไม่บังคับ, มุมขาย 1..`MAX_ANGLES`, โทน 1..`MAX_TONES`, โทนสี) กดแล้ว `createAdCampaign` → `router.push("/studio/ads/<id>?write=1")`
- ห้อง: ซ้ายแผงตั้งค่าพับได้ (แบบประกันอ่านอย่างเดียว, มุมขาย, โทน, โทนสี, สิ่งที่อยากเน้น → `updateAdCampaign`, ปุ่ม **เขียนแอดเพิ่ม N แบบ** N = angles × tones ปิดระหว่างเขียน — Review Focus 5); `?write=1` เริ่มเขียนรอบแรกอัตโนมัติครั้งเดียว; ขวาแท็บ ร่าง / ยิงแล้ว / เปิดใช้ / ถังขยะ พร้อมตัวนับ, การ์ด (โปสเตอร์ 1:1, หัวข้อ, ข้อความหลัก 125 ตัวแรก, ป้ายมุมขาย · โทน, ป้ายเตือนกฎถ้ามี `flags.policy`, ป้ายแดงขั้นที่พังถ้า launch มี error)
- `AdEditor` (เต็มจอเมื่อกดการ์ด): ซ้าย `PosterPanel` (`onDraw` ใช้ `drawPicture`), ขวาช่องหัวข้อ / ข้อความหลัก / คำอธิบาย นับตาม `AD_LIMITS` (แดงเมื่อเกิน ไม่ตัด), `FeedPreview` (ชื่อเพจ, ข้อความหลักตัดที่ 125 พร้อม "ดูเพิ่มเติม", โปสเตอร์, แถบล่างมีคำอธิบาย หัวข้อ และปุ่ม "ดูเพิ่มเติม"), ปุ่มบันทึก (`saveAdCopy`); ชิ้นที่มี launch แล้วแสดง "แก้ตรงนี้ไม่เปลี่ยนแอดที่ยิงไปแล้ว ใช้สร้างใหม่" (Review Focus 3); `LaunchPanel` ล่างขวา = ส่วนยิงจาก `AdsLaunch.tsx` เดิม (บัญชี, ลิงก์, งบ, บันทึกเป็นแอดหยุดไว้, เปิดใช้พร้อมยืนยัน, สร้างใหม่พร้อมยืนยัน) ไม่มีช่องเลือกเพจ ปิดทั้งแผงพร้อมเหตุผลเมื่อ `pageConnected` เป็น false
- เลย์เอาต์ใช้คลาส/ตัวแปรสีของ Studio เดิม (`--ct-*`, `card`, `solid` ตามที่ `AdsLaunch.tsx` ใช้) ไม่มี dependency ใหม่; มือถือเรียงบนลงล่าง ไม่มี scroll แนวนอน

- [ ] **Step 1: เขียนหน้าและคอมโพเนนต์** ตาม Interfaces (ทีละไฟล์ แต่ละไฟล์หนึ่งหน้าที่)
- [ ] **Step 2: ลบ** `AdsLaunch.tsx` และ `adsLaunchSetup` แล้วแก้เทสต์ที่อ้างถึง
- [ ] **Step 3: รัน** `npm run verify` — ผ่าน ยกเว้น `tests/chat/session-turn.test.ts` เดิม (ถ้าล้มที่นั่นจุดเดียวให้รัน `npx tsc --noEmit`, `npx eslint src/app/studio src/lib/ads`, และ `NEXT_DIST_DIR=.next-build npx next build` แยก)
- [ ] **Step 4: Commit** `feat(studio): Ads Studio pages — campaign list, campaign room, ad editor with feed preview`

---

### Task 6: ทางเข้า (หน้ารวม และเมนู)

**Files:**
- Modify: `src/lib/content/studio-home.ts` (`HomeTileKey` เพิ่ม `"ads"`, `HomeInput` เพิ่ม `owner: boolean` และ `adCampaigns: Map<string, { campaigns: number; launched: number }> | null`)
- Modify: `src/app/studio/page.tsx` (อ่านตัวนับแคมเปญต่อเพจเมื่อเป็นเจ้าของ)
- Modify: `src/lib/ads/campaign-store.ts` (`campaignCountsByPage(): Promise<Map<string, { campaigns: number; launched: number }>>` — launched = ชิ้นในแคมเปญของเพจที่มีแถว `ins_ad_launch` ที่ยังไม่ superseded)
- Modify: `src/lib/shell/menu.ts` (ป้าย "ยิงแอด" → "Ads Studio" ยังซ่อนเมื่อ `!who.owner`)
- Test: เทสต์ studio-home ที่มีอยู่ใน `tests/` (grep `homeCards`), `tests/calc/shell-menu.test.ts`

**Interfaces:**
- ช่อง `{ key: "ads", href: "/studio/ads?page=<pageId>", label: "Ads Studio", status }` อยู่ถัดจาก `write` ในการ์ดเพจ เฉพาะเมื่อ `input.owner`
- status: `null` → "เปิดดู"; ไม่มีแคมเปญ → "ยังไม่มีแคมเปญ"; มี → `"<n> แคมเปญ · ยิงแล้ว <m>"` (m = 0 แสดง `"<n> แคมเปญ"`)

- [ ] **Step 1: เทสต์ล้ม**: `homeCards({ owner: true, adCampaigns: new Map([["P1", { campaigns: 2, launched: 3 }]]), ... })` การ์ด P1 มีช่อง ads ลำดับที่สองพร้อม status "2 แคมเปญ · ยิงแล้ว 3"; เพจที่ไม่มีใน map → "ยังไม่มีแคมเปญ"; `adCampaigns: null` → "เปิดดู"; `owner: false` ไม่มีช่อง ads; เมนูเจ้าของมีป้าย "Ads Studio" ที่ `/studio/ads` คนอื่นไม่มี
- [ ] **Step 2: รัน** ต้องล้ม
- [ ] **Step 3: เขียน** ตาม Interfaces (`page.tsx` อ่าน `campaignCountsByPage()` แบบ `.catch(() => null)` เฉพาะเจ้าของ)
- [ ] **Step 4: รัน** `npx vitest run tests/calc/shell-menu.test.ts` และเทสต์ studio-home ผ่าน; `npx tsc --noEmit` สะอาด
- [ ] **Step 5: Commit** `feat(studio): an Ads Studio tile on each Page's card, for the owner`

---

### Task 7: ตรวจในเบราว์เซอร์ และขึ้นโปรดักชัน (controller ทำ ไม่ใช่ subagent)

localhost อ่านเขียนฐานโปรดักชัน และตารางใหม่ยังไม่มีจนกว่าจะรัน migration จึงต้องรัน migration ก่อนดูหน้า (ตารางเพิ่มอย่างเดียว โค้ดบนโปรดักชันตอนนี้ไม่อ่านมัน)

- [ ] **Step 1:** ขอ "ได้" จากเจ้าของ แล้วรัน `20261004_ad_campaigns.sql` บน Supabase `cenysylrzbwfrtuqoeqk`
- [ ] **Step 2:** ตรวจ: `select count(*) from ins_content where format='ad' and page_id is not null and campaign_id is null` = 0 และจำนวนแคมเปญ = จำนวนกลุ่ม (ก่อนรันมีชิ้นแอด 1 ชิ้น 1 กลุ่ม)
- [ ] **Step 3:** localhost ด้วยบัญชีเจ้าของ: หน้ารวมมีช่อง Ads Studio, Organic Studio ไม่มี "โฆษณา", เปิดแคมเปญที่ได้จากการย้ายชิ้นเก่า ดูการ์ด หน้าแก้ และตัวอย่างฟีด **ไม่กดเขียนแอด ไม่สร้างแคมเปญ ไม่ยิง** (ทุกอย่างเขียนโปรดักชันจริง); ด้วยบัญชี Nit: ไม่มีช่อง ไม่มีเมนู เปิด `/studio/ads` แล้วถูกพาออก; ย่อจอเป็นมือถือแล้วไม่มี scroll แนวนอน
- [ ] **Step 4:** ขอ "ได้" แล้ว push `main` ตรวจ Vercel READY
