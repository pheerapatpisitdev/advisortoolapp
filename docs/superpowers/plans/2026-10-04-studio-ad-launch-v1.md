# ยิงแอด Facebook จาก Studio (รอบแรก) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าของเปิด `/studio/ads` เลือกชิ้นชนิด "ad" แล้วสร้างแอดรูปเดียว (ทราฟฟิก, ปุ่มเข้าเว็บ) เป็น PAUSED บนบัญชีโฆษณาจริง พร้อมปุ่มเปิดใช้แยก

**Architecture:** ล็อกอิน config ตัวที่สาม (`ads-manage`) เก็บโทเค็นใน `ins_channel_auth` ใต้ prefix ใหม่ แกนสร้างแอด `src/lib/ads/launch.ts` ทำสี่ขั้นเรียงกัน บันทึกไอดีทุกขั้นใน `ins_ad_launch` และทำต่อจากขั้นที่พังได้ server action ของ Studio เป็นประตูเดียว จำกัดเฉพาะ `owner`

**Tech Stack:** Next.js 15 App Router, server actions, Supabase (service role + RPC เข้ารหัสเดิม), Graph API `v23.0`, vitest

**Spec:** [docs/superpowers/specs/2026-10-04-studio-ad-launch-v1-design.md](../specs/2026-10-04-studio-ad-launch-v1-design.md) (แผนใหญ่: [studio-ad-creation-plan.md](../../studio-ad-creation-plan.md))

## Global Constraints

- Graph `v23.0` เหมือน `src/lib/ads/sync.ts` โทเค็นส่งใน header `authorization: Bearer` ไม่ใส่ใน URL
- ทุกขั้นสร้างด้วยสถานะ `PAUSED` ปุ่มบันทึกไม่ยิงเงิน การเปิดใช้เป็นการกดแยก
- วัตถุประสงค์ `OUTCOME_TRAFFIC` ปุ่ม Click-to-Website พื้นที่ค่าเริ่มต้นประเทศไทย ไม่ส่งตำแหน่งแสดง (Advantage+ placements)
- เพดานงบต่อวันค่าเริ่มต้น 500 บาท ปรับด้วย env `ADS_MAX_DAILY_BUDGET_THB` ฟอร์มรับค่าเกินเพดานไม่ได้
- ลิงก์ว่างบันทึกไม่ได้ ขั้นพังต้องหยุดและบอกขั้น ห้ามสร้างขั้นถัดไปทับ
- ใช้ `owner` เท่านั้น (`requireStaff("owner")`, `gatePage(..., "owner")`) ทั้งเชื่อมและสร้างแอด
- แถวโทเค็นใหม่ใช้ prefix `facebook_ads_manage:` ต้องไม่โผล่เป็นเพจหรือบัญชีโฆษณา `ads_read` ไม่แตะ config เพจ (`FB_LOGIN_CONFIG_ID`) หรือ config อ่านผล (`FB_ADS_LOGIN_CONFIG_ID`) และไม่แตะกิ่งของทั้งสองใน callback
- ทุกการเชื่อม สร้าง และเปิดใช้เรียก `audit(...)`
- ข้อความในหน้าเป็นภาษาไทย ตามคำที่โปรเจกต์ใช้อยู่
- งานทำบน branch `feat/studio-ad-launch` ในโฟลเดอร์หลัก ไฟล์ที่แก้ค้างอยู่ก่อนแล้ว (`.env.example`, `src/app/Chat.tsx`, `src/app/layout.tsx`, `src/lib/chat/record.ts`, `src/app/api/meta/`, `src/components/meta/`, `src/lib/meta/`, `docs/*`) เป็นงานอื่น ห้าม `git add` รวมมา ใช้ `git add <ไฟล์>` เป็นรายไฟล์ และ `git add -p .env.example`
- เทสต์ทุกตัวต้องไม่แตะฐานข้อมูลหรือ Meta จริง (`.env.local` ชี้ฐานโปรดักชัน)

## Review Focus

อินพุตที่ spec ไม่ได้พูดถึงแต่คนใช้จะเจอ (แต่ละบรรทัดมีเทสต์ใน task ที่ระบุ)

1. บัญชีโฆษณาที่ไม่ใช่สกุลบาท: เพดานเป็นบาท จึงต้องปฏิเสธพร้อมบอกเหตุผล ไม่เทียบตัวเลขข้ามสกุล (Task 3)
2. งบเป็นทศนิยม ศูนย์ ติดลบ หรือ NaN: รับเฉพาะบาทเต็มจำนวนตั้งแต่ 1 ถึงเพดาน (Task 3)
3. ลิงก์ไม่ใช่ `http(s)` เช่น `javascript:` หรือไม่มีโดเมน: ปฏิเสธ (Task 3)
4. กดสั่งซ้ำ/สองแท็บพร้อมกัน: ต้องไม่เกิด campaign ซ้ำ (Task 4, 5)
5. ชิ้นที่ไม่มีโปสเตอร์ ถูกลบ หรือไม่ใช่ชนิด "ad": ปฏิเสธก่อนเรียก Meta ไม่ตกไปใช้โปสเตอร์ค่าเริ่มต้นแล้วเสียเงิน (Task 5, 6)

---

### Task 1: คีย์และที่เก็บโทเค็นของ `ads_management`

**Files:**
- Modify: `src/lib/facebook/keys.ts`
- Modify: `src/lib/facebook/ads-connection.ts` (export ตัวอ่านที่ใช้ร่วม)
- Create: `src/lib/facebook/ads-manage-connection.ts`
- Test: `tests/ads/keys.test.ts` (ต่อท้าย), `tests/ads/ads-manage-connection.test.ts`

**Interfaces:**
- Produces ใน `keys.ts`: `ADS_MANAGE_PENDING_KEY = "facebook_ads_manage_pending"`, `adsManageKeyFor(actId: string): string` (`facebook_ads_manage:${actId}`), `isAdsManageKey(key: string): boolean`, `adsManageAccountIdInKey(key: string): string | undefined`
- แก้ `isAdsKey` ให้คืน true กับคีย์ใหม่ทั้งสองแบบด้วย (ตัวกรองรายการเพจใน `connection.ts:131` ใช้ตัวนี้ ถ้าไม่แก้ บัญชี manage จะโผล่เป็นเพจ)
- Produces ใน `ads-connection.ts`: export `readChannelAuth(key: string): Promise<Row | null>` (เปลี่ยนชื่อจาก `read` ที่เป็น private ให้ export ได้ พร้อม export `channelPassphrase()`) พฤติกรรมเดิมไม่เปลี่ยน
- Produces ใน `ads-manage-connection.ts`: `adManageAccounts(): Promise<AdAccount[]>`, `adManageToken(actId: string): Promise<string | null>`, `saveAdManageAccount(a: { id; name; currency: string | null; token: string; scopes: string[] }): Promise<void>`, `savePendingAdsManage(token: string, scopes: string[]): Promise<void>`, `readPendingAdsManage()`, `clearPendingAdsManage()` — รูปเหมือนฝั่ง `ads_read` ทุกตัว แค่คนละคีย์ ใช้ RPC `ins_set_channel_auth` / `ins_get_channel_auth` / `ins_clear_channel_auth` เดิม

- [ ] **Step 1: เทสต์ล้ม** ใน `tests/ads/keys.test.ts` เพิ่ม
  - `adsManageKeyFor("act_1")` เท่ากับ `"facebook_ads_manage:act_1"`
  - `isAdsKey("facebook_ads_manage:act_1")` และ `isAdsKey(ADS_MANAGE_PENDING_KEY)` เป็น true
  - `adAccountIdInKey("facebook_ads_manage:act_1")` เป็น `undefined` (ไม่ปนกับ `ads_read`), `adsManageAccountIdInKey("facebook_ads:act_1")` เป็น `undefined`, `pageIdInKey("facebook_ads_manage:act_1")` เป็น `undefined`
  - รายการเพจใน `connection.ts` ไม่แสดงแถวคีย์ใหม่ (ตามแบบเทสต์ "does not list an ad account as a Page" ที่มีอยู่ในไฟล์เดียวกัน)
- [ ] **Step 2: รัน** `npx vitest run tests/ads/keys.test.ts` ต้องล้ม
- [ ] **Step 3: เขียน** ฟังก์ชันใน `keys.ts` ตามลายเซ็นข้างบน แล้วแก้ `isAdsKey`
- [ ] **Step 4: เทสต์ล้มของที่เก็บ** `tests/ads/ads-manage-connection.test.ts` mock `@/lib/supabase/admin` ตามแบบ `tests/ads/sync.test.ts` ตรวจว่า `saveAdManageAccount` เรียก RPC `ins_set_channel_auth` ด้วย `p_key: "facebook_ads_manage:act_1"`, `p_page_id: "act_1"`, `p_fields: ["THB"]` และ `adManageAccounts` คืนเฉพาะแถวคีย์ใหม่ ไม่มีโทเค็นในรายการ
- [ ] **Step 5: เขียน** `ads-manage-connection.ts` โดย export `readChannelAuth` จาก `ads-connection.ts` ไปใช้ ห้ามคัดลอกตัวเข้ารหัสมาซ้ำ
- [ ] **Step 6: รัน** `npx vitest run tests/ads` ต้องผ่านทั้งโฟลเดอร์ (เทสต์เดิมของ `ads_read` ต้องยังผ่าน)
- [ ] **Step 7: Commit** `git add src/lib/facebook/keys.ts src/lib/facebook/ads-connection.ts src/lib/facebook/ads-manage-connection.ts tests/ads/keys.test.ts tests/ads/ads-manage-connection.test.ts` ข้อความ `feat(ads): a key and a store for the ads_management token`

---

### Task 2: ล็อกอินวัตถุประสงค์ `ads-manage`

**Files:**
- Modify: `src/lib/facebook/oauth.ts`
- Modify: `src/app/api/facebook/connect/route.ts`
- Modify: `src/app/api/facebook/connect/callback/route.ts`
- Test: `tests/ads/oauth-state.test.ts` (ต่อท้าย), `tests/ads/oauth-connect-routes.test.ts` (ต่อท้าย)

**Interfaces:**
- Consumes: Task 1 (`saveAdManageAccount`, `savePendingAdsManage`, `clearPendingAdsManage`)
- Produces ใน `oauth.ts`: `LoginPurpose` เพิ่ม `"ads-manage"`; `ADS_MANAGE_SCOPES = ["ads_management","pages_show_list","pages_read_engagement","pages_manage_ads"]`; `adsManageConfigId(): string | undefined` (อ่าน `FB_ADS_MANAGE_CONFIG_ID` ไม่มี fallback); `adsManageOauthIsConfigured(): boolean`; `parseState` ยอมรับ purpose ใหม่; `authorizeUrl(..., "ads-manage")` ใช้ config ใหม่ (ไม่มี config ให้ใช้ `ADS_MANAGE_SCOPES` เหมือนที่กิ่งอื่นทำ)
- Produces ที่ route: `GET /api/facebook/connect?for=ads-manage` ใช้ได้เฉพาะ `owner` กลับมาที่ `/studio/ads` ส่วน callback กิ่งใหม่คืนผลทาง `?fb=` เหมือนกิ่งอื่น ค่าที่ใช้: `connected`, `choose`, `noscope`, `noaccounts`, `cancelled`, `state`, `failed`, `unconfigured`

- [ ] **Step 1: เทสต์ล้มใน `oauth-state.test.ts`** state ที่ทำด้วย `makeState("ads-manage", nonce)` ผ่าน `statePurpose` ได้ `"ads-manage"`; purpose ที่แกะเป็น `"pages"`/`"ads"` ต้องไม่สลับเป็น `"ads-manage"` (ลายเซ็นรวม purpose อยู่แล้ว ตรวจให้ชัด); `authorizeUrl` ของ `ads-manage` มี `config_id` = ค่า env ใหม่ และไม่มี `config_id` ของเพจ; env ว่าง → `adsManageOauthIsConfigured()` เป็น false
- [ ] **Step 2: เทสต์ล้มใน `oauth-connect-routes.test.ts`** (เพิ่ม mock ของ `ads-manage-connection` และ `listAdAccounts`)
  - เริ่มล็อกอินด้วย `?for=ads-manage` เมื่อ viewer ไม่ใช่ owner → redirect `/studio`; env ไม่ตั้ง → `/studio/ads?fb=unconfigured`
  - callback ที่ได้ scopes ไม่มี `ads_management` → `?fb=noscope` ไม่เรียก `saveAdManageAccount`
  - callback ได้ `ads_management` และมีบัญชีเดียว → เรียก `saveAdManageAccount` ครั้งเดียว และ `saveAdAccount` / `saveConnection` (ของ `ads_read` และเพจ) **ต้องไม่ถูกเรียก**
  - มีหลายบัญชี → `savePendingAdsManage` แล้ว `?fb=choose`
- [ ] **Step 3: รัน** `npx vitest run tests/ads/oauth-state.test.ts tests/ads/oauth-connect-routes.test.ts` ต้องล้ม
- [ ] **Step 4: เขียน** ตาม Interfaces กิ่งใหม่ใน callback อยู่ก่อนกิ่งเพจ (แบบเดียวกับกิ่ง `ads`) ตรวจ `can(viewer, "owner")` เรียก `audit("connect-ads-manage", act.id, { name })` ห้ามแก้บรรทัดของกิ่งเดิม
- [ ] **Step 5: รัน** `npx vitest run tests/ads` ผ่านทั้งหมด
- [ ] **Step 6: Commit** `feat(ads): the ads_management login, owner only, apart from the Page and ads_read ones`

---

### Task 3: ตรวจงบและลิงก์

**Files:**
- Create: `src/lib/ads/launch-limits.ts`
- Test: `tests/ads/launch-limits.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_MAX_DAILY_BUDGET_THB = 500`
  - `maxDailyBudgetThb(env?: Record<string, string | undefined>): number` — อ่าน `ADS_MAX_DAILY_BUDGET_THB` ถ้าไม่ใช่จำนวนเต็มบวกให้คืนค่าเริ่มต้น
  - `checkDailyBudget(baht: number, currency: string | null, max?: number): { ok: true; minor: number } | { ok: false; error: string }` — รอบนี้รับเฉพาะ `currency === "THB"` บาทเต็มจำนวน 1..max คืน `minor` = บาท × 100 (หน่วยย่อยของ THB ที่ Meta ใช้)
  - `checkLink(raw: string): { ok: true; url: string } | { ok: false; error: string }` — trim แล้วต้องเป็น `http:` หรือ `https:` และมี hostname; คืน `url` ที่ normalize ผ่าน `new URL(raw).toString()`

- [ ] **Step 1: เทสต์ล้ม** `checkDailyBudget(100, "THB")` → `{ ok: true, minor: 10000 }`; `500` ผ่าน `501` ไม่ผ่าน; `0`, `-5`, `99.5`, `NaN`, `Infinity` ไม่ผ่าน; `checkDailyBudget(100, "USD")` ไม่ผ่านและ error บอกว่ารองรับเฉพาะบัญชีสกุลบาท; `currency` เป็น `null` ไม่ผ่าน; `maxDailyBudgetThb({ ADS_MAX_DAILY_BUDGET_THB: "800" })` เป็น 800 ค่าขยะ/ว่าง/`"-1"`/`"1.5"` เป็น 500; `checkLink("https://x.test/lifeprotect")` ผ่าน `""`, `"  "`, `"javascript:alert(1)"`, `"ftp://x.test"`, `"https://"`, `"x.test"` ไม่ผ่าน
- [ ] **Step 2: รัน** `npx vitest run tests/ads/launch-limits.test.ts` ต้องล้ม
- [ ] **Step 3: เขียน** ตามลายเซ็น ข้อความ error เป็นภาษาไทยสั้น ๆ บอกสิ่งที่ต้องแก้
- [ ] **Step 4: รัน** เทสต์ผ่าน
- [ ] **Step 5: Commit** `feat(ads): daily budget cap and link checks for the ad launch`

---

### Task 4: ตาราง `ins_ad_launch` และที่เก็บ

**Files:**
- Create: `supabase/migrations/20261004_ad_launch.sql`
- Create: `src/lib/ads/launch-store.ts`
- Test: `tests/ads/launch-store.test.ts`

**Interfaces:**
- ตาราง `public.ins_ad_launch`: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `piece_id uuid not null references public.ins_content(id)`, `act_id text not null`, `page_id text not null`, `link text not null`, `currency text not null`, `daily_budget_minor integer not null`, `headline text`, `primary_text text`, `description text`, `campaign_id text`, `adset_id text`, `image_hash text`, `creative_id text`, `ad_id text`, `step text not null default 'none' check (step in ('none','campaign','adset','creative','ad'))`, `error text`, `activated_at timestamptz`, `superseded boolean not null default false`, `created_by uuid` ; unique index บน `(piece_id, act_id) where not superseded`; `enable row level security` (เหมือนตารางอื่น เข้าได้เฉพาะ service role); `comment on table` เป็นภาษาไทย
- Produces ใน `launch-store.ts`: `type LaunchRow` (ชื่อฟิลด์ camelCase ตามคอลัมน์ข้างบน), `findLaunch(pieceId: string, actId: string): Promise<LaunchRow | null>` (เฉพาะแถวที่ไม่ superseded), `getLaunch(id: string)`, `createLaunch(input: NewLaunch): Promise<{ row: LaunchRow; created: boolean }>` (ชน unique index = คืนแถวเดิม `created:false` ไม่ throw), `saveStep(id: string, patch: Partial<Pick<LaunchRow, "campaignId"|"adsetId"|"imageHash"|"creativeId"|"adId"|"step">>): Promise<void>` (ล้าง `error` ด้วย), `saveError(id: string, error: string): Promise<void>`, `markActivated(id: string, at: string): Promise<void>`, `supersede(id: string): Promise<void>`

- [ ] **Step 1: เขียน migration** ตามโครงด้านบน หัวไฟล์อธิบายสั้น ๆ ตามธรรมเนียมไฟล์ migration อื่น (วันที่ เจ้าของ เหตุผล)
- [ ] **Step 2: เทสต์ล้ม** mock `@/lib/supabase/admin` ตรวจ: `createLaunch` เมื่อ insert ชน unique (error code `23505`) คืน `{ created: false }` พร้อมแถวเดิมที่ `findLaunch` เจอ; `saveStep` ส่งเฉพาะฟิลด์ที่ให้และตั้ง `error: null`; `supersede` ตั้ง `superseded: true`
- [ ] **Step 3: รัน** ต้องล้ม แล้วเขียน `launch-store.ts` (แปลงชื่อคอลัมน์ snake_case ↔ camelCase ในไฟล์นี้ที่เดียว)
- [ ] **Step 4: รัน** `npx vitest run tests/ads/launch-store.test.ts` ผ่าน
- [ ] **Step 5: Commit** `feat(ads): ins_ad_launch, one row per ad launch attempt` (migration ยังไม่รันบนฐานโปรดักชัน ดู Task 7)

---

### Task 5: แกนสร้างและเปิดใช้แอด

**Files:**
- Create: `src/lib/ads/launch.ts`
- Test: `tests/ads/launch.test.ts`

**Interfaces:**
- Consumes: `LaunchRow` และฟังก์ชันของ `launch-store.ts` (Task 4); `checkDailyBudget`, `checkLink`, `maxDailyBudgetThb` (Task 3); `EXPIRED` จาก `src/lib/ads/sync.ts`
- Produces:
  - `type LaunchStep = "campaign" | "adset" | "creative" | "ad"`
  - `interface LaunchInput { pieceId: string; actId: string; currency: string | null; pageId: string; link: string; dailyBudgetBaht: number; headline: string; primaryText: string; description: string; createdBy: string; recreate?: boolean }`
  - `interface LaunchDeps { store: typeof import("./launch-store"); token(actId: string): Promise<string | null>; poster(pieceId: string): Promise<Buffer | null>; fetchFn?: typeof fetch; now?: () => Date }`
  - `type LaunchResult = { ok: true; launch: LaunchRow } | { ok: false; step: LaunchStep | "check"; error: string; launch?: LaunchRow }`
  - `runLaunch(input: LaunchInput, deps: LaunchDeps): Promise<LaunchResult>`
  - `activateLaunch(launchId: string, deps: Pick<LaunchDeps, "store" | "token" | "fetchFn" | "now">): Promise<{ ok: true } | { ok: false; error: string }>`
  - `adEffectiveStatus(adId: string, token: string, fetchFn?: typeof fetch): Promise<string | null>` อ่าน `effective_status` ของแอด

ลำดับใน `runLaunch`: ตรวจงบ/ลิงก์ (ล้มคืน `step:"check"` ก่อนแตะ Meta) → ถ้า `recreate` ให้ `supersede` แถวเดิม → `createLaunch` (ได้แถวเดิม `created:false` ที่ไปไม่ถึง `ad` = ทำต่อด้วยค่าที่เก็บไว้ ไม่ใช้ค่าจาก input; ถึง `ad` แล้ว = คืน `ok:true` ทันทีโดยไม่เรียก Meta) → ข้ามขั้นที่ `step` บันทึกว่าเสร็จแล้ว → ขั้นที่ขาด:
1. `POST /{act}/campaigns`: `name`, `objective=OUTCOME_TRAFFIC`, `status=PAUSED`, `special_ad_categories=[]`
2. `POST /{act}/adsets`: `name`, `campaign_id`, `daily_budget` (minor), `billing_event=IMPRESSIONS`, `optimization_goal=LINK_CLICKS`, `bid_strategy=LOWEST_COST_WITHOUT_CAP`, `destination_type=WEBSITE`, `targeting={"geo_locations":{"countries":["TH"]}}`, `status=PAUSED`
3. `POST /{act}/adimages` ส่งโปสเตอร์เป็น base64 ในฟิลด์ `bytes` เก็บ `hash` ลง `imageHash` (ข้ามถ้ามีแล้ว) แล้ว `POST /{act}/adcreatives`: `object_story_spec={page_id, link_data:{image_hash, link, message: primaryText, name: headline, description, call_to_action:{type:"LEARN_MORE", value:{link}}}}`
4. `POST /{act}/ads`: `name`, `adset_id`, `creative={"creative_id":…}`, `status=PAUSED`

ชื่อวัตถุ `Studio · {headline} · {YYYY-MM-DD}`. ทุกขั้น: ใช้ผลที่ HTTP ไม่ ok หรือมี `error` ในตัว หรือ**ไม่มีไอดี**ถือว่าพัง → `saveError` แล้วคืน `{ ok:false, step }` และไม่รันขั้นต่อไป error code 190 แปลงเป็นข้อความ `EXPIRED` ที่ใช้ซ้ำจาก `sync.ts` ไม่มีโทเค็น → คืนข้อความให้เชื่อมบัญชีก่อน ไม่มีโปสเตอร์ (`poster` คืน null) → `step:"check"` ก่อนแตะ Meta

`activateLaunch`: แถวต้องไปถึง `step:"ad"` และยังไม่ `activatedAt`; `POST /{id}` ด้วย `status=ACTIVE` ให้ campaign, adset, ad ตามลำดับนั้น ครบทั้งสามจึง `markActivated` ถ้าพังกลางทางคืน error ไม่ mark (เรียกซ้ำได้ ไม่มีผลข้างเคียง)

- [ ] **Step 1: เทสต์ล้ม** ด้วย `fetchFn` ปลอมที่บันทึกคำขอและตอบตามคิว กับ store ปลอมในหน่วยความจำ
  - ทางปกติ: เรียกครบ 5 ครั้ง (campaign, adset, adimages, adcreatives, ads) ตามลำดับนั้น ทุกวัตถุส่ง `status=PAUSED` `daily_budget` เท่ากับ minor จาก Task 3 (100 บาท → `"10000"`) ผลสุดท้ายแถวมี `step:"ad"` และไอดีครบ
  - ขั้น adset ตอบ error: คืน `{ ok:false, step:"adset" }` แถวเก็บ `campaignId` ไว้ ไม่มีคำขอ adimages/adcreatives/ads; เรียก `runLaunch` ใหม่ด้วย input เดียวกัน → ไม่มีคำขอ campaigns ซ้ำ ทำต่อจาก adset แล้วสำเร็จ
  - ตอบ HTTP 200 แต่ไม่มี `id` → ถือว่าพังที่ขั้นนั้น
  - error code 190 ที่ขั้น creative → `error` เท่ากับ `EXPIRED` และแถวเก็บ `campaignId`, `adsetId`, `imageHash`
  - เรียก `runLaunch` สองครั้งซ้อน (`Promise.all`) กับ store ที่บังคับ unique → campaign ถูกสร้างครั้งเดียว (Review Focus 4)
  - แถวไปถึง `ad` แล้วเรียกซ้ำ → `ok:true` ไม่มีคำขอไป Meta; `recreate:true` → supersede แล้วสร้างชุดใหม่
  - `poster` คืน null → `step:"check"` ไม่มีคำขอไป Meta (Review Focus 5); งบ 501 บาท/สกุล USD/ลิงก์ `javascript:` → `step:"check"` ไม่มีคำขอไป Meta
  - `activateLaunch`: ส่ง `status=ACTIVE` ให้ campaign, adset, ad ตามลำดับ แล้ว `markActivated`; ขั้นกลางพัง → ไม่ mark; แถวที่ยังไม่ถึง `ad` → ปฏิเสธ; แถวที่ activated แล้ว → ไม่เรียก Meta ซ้ำ
  - `adEffectiveStatus` คืนค่า `effective_status` ที่ Meta ตอบ และคืน null เมื่อ Meta ตอบผิดพลาด
- [ ] **Step 2: รัน** `npx vitest run tests/ads/launch.test.ts` ต้องล้ม
- [ ] **Step 3: เขียน** ตาม Interfaces ตัวเรียก Graph เป็นฟังก์ชันภายในไฟล์เดียว (`POST` แบบ form-encoded, `authorization: Bearer`, parse error จาก body) ก่อนเขียน ให้เทียบชุดฟิลด์ของแต่ละขั้นกับเอกสาร Marketing API v23 ของ campaign / adset / adimages / adcreative / ad (โดยเฉพาะฟิลด์ที่ v23 บังคับเพิ่ม เช่นเรื่องงบของ adset) แล้วแก้ชุดฟิลด์ด้านบนให้ตรงถ้าต่าง บันทึกสิ่งที่แก้ไว้ในคอมเมนต์หัวไฟล์
- [ ] **Step 4: รัน** เทสต์ผ่าน และ `npx tsc --noEmit` สะอาด
- [ ] **Step 5: Commit** `feat(ads): create a paused image ad in four steps, resumable, with a separate activation`

---

### Task 6: server action, หน้า `/studio/ads` และเมนู

**Files:**
- Create: `src/app/studio/ads/actions.ts`, `src/app/studio/ads/page.tsx`, `src/app/studio/ads/AdsLaunch.tsx`
- Modify: `src/lib/shell/menu.ts` (`studioMenu`)
- Modify: `.env.example` (เพิ่ม `ADS_MAX_DAILY_BUDGET_THB` แบบ `git add -p` ห้ามรวมการแก้ค้างเดิม)
- Test: `tests/ads/launch-actions.test.ts`, ต่อท้าย `tests/calc/shell-menu.test.ts`

**Interfaces:**
- Consumes: Task 1–5; `getContent` (`src/lib/content/store.ts`), `drawPoster(spec, "square")` (`src/lib/content/poster-draw.tsx`), `myPages()` (`src/lib/auth/pages.ts`), `tokenExpiry` (`oauth.ts`), `AD_LIMITS` (`src/lib/content/ads.ts`)
- Produces ใน `actions.ts` (`"use server"`, ทุกตัวขึ้นต้นด้วย `await requireStaff("owner")`):
  - `adsLaunchSetup(): Promise<{ configured: boolean; accounts: { id; name; currency: string | null; expiresAt: string | null }[]; choices: { id; name }[]; pages: { pageId; pageName }[]; pieces: { id; headline; primaryText; description; hasPoster: boolean; launch: { id; step; adId: string | null; error: string | null; activatedAt: string | null; effectiveStatus: string | null } | null }[]; maxDailyBudgetThb: number }>` — `pieces` คือชิ้นชนิด "ad" ที่ไม่ถูกลบ ไม่มีโทเค็นอยู่ในผล
  - `launchAd(input: { pieceId; actId; pageId; link; dailyBudgetBaht; headline; primaryText; description; recreate?: boolean }): Promise<LaunchResult>` — โหลดชิ้นด้วย `getContent` ปฏิเสธถ้าไม่มี/`status === "trashed"`/`format !== "ad"`/ไม่มีโปสเตอร์ก่อนเรียก `runLaunch`; ตรวจว่า `actId` และ `pageId` อยู่ในรายการที่ owner เชื่อมไว้; `audit("launch-ad", adId ?? pieceId, {...})`
  - `chooseAdManageAccount(actId: string)` ใช้โทเค็นที่พักไว้ (`readPendingAdsManage`) บันทึกบัญชีที่เลือก เหมือนที่ `src/app/admin/ads/actions.ts:130` ทำกับ `ads_read`
  - `activateAd(launchId: string): Promise<{ ok: true } | { ok: false; error: string }>` — `audit("activate-ad", ...)`
- หน้า: server component `gatePage("/studio/ads", "owner")` โหลด `adsLaunchSetup()` ส่งต่อให้ `AdsLaunch.tsx` (client) ปุ่มเชื่อมเป็นลิงก์ไป `/api/facebook/connect?for=ads-manage` (ปิดและบอกว่าขาด `FB_ADS_MANAGE_CONFIG_ID` เมื่อ `configured` เป็น false) ฟอร์มเลือกชิ้น (ช่องคำโฆษณาแก้ได้ นับตัวอักษรแดงเมื่อเกิน `AD_LIMITS` แต่ไม่ตัด) บัญชี เพจ ลิงก์ งบ (แสดงเพดาน) ปุ่ม "บันทึกเป็นแอดหยุดไว้" แสดงผลทีละขั้น ขั้นพังแสดงชื่อขั้นกับข้อความและปุ่มลองใหม่ ปุ่ม "เปิดใช้" เปิดกล่องยืนยันที่แสดงบัญชี เพจ และงบต่อวันก่อนยิงจริง แสดงวันหมดอายุโทเค็นและเตือนเมื่อเหลือไม่ถึง 7 วัน และแสดง `effectiveStatus` ของแอด หน้าตาให้ตามแผงอื่นใน `src/app/studio/` (ดู `PublishPanel.tsx`) ไม่คิดสไตล์ใหม่
- เมนู: เพิ่มลิงก์ `{ href: "/studio/ads", label: "ยิงแอด", icon: "megaphone", hue: "#352f80" }` ใน `studioMenu` และใส่ `/studio/ads` ใน `hidden` เมื่อ `!who?.owner`

- [ ] **Step 1: เทสต์ล้มของ action** `tests/ads/launch-actions.test.ts` (mock viewer แบบ `asOwner` และ mock ที่เก็บ/`runLaunch`): viewer ที่ไม่ใช่ owner ถูกปฏิเสธทุก action; `launchAd` กับชิ้นที่ถูกลบ, ชนิด `post`, หรือไม่มี `output.poster` ไม่เรียก `runLaunch` (Review Focus 5); `actId`/`pageId` ที่ไม่ได้เชื่อมไว้ถูกปฏิเสธ; ผลสำเร็จมี `audit("launch-ad", ...)`; ผลของ `adsLaunchSetup` เมื่อ stringify ไม่มีสตริงโทเค็นที่ mock ไว้
- [ ] **Step 2: เทสต์ล้มของเมนู** ใน `shell-menu.test.ts` ตามแบบเคส `studioMenu(who)` ที่มี (บรรทัด ~179-190): owner เห็น `/studio/ads` ส่วน admin ที่ไม่ใช่ owner, ผู้ช่วย และสมาชิกไม่เห็น
- [ ] **Step 3: รัน** สองไฟล์ต้องล้ม แล้วเขียน `actions.ts` กับเมนู
- [ ] **Step 4: เขียนหน้า** `page.tsx` และ `AdsLaunch.tsx` ตามรายละเอียดข้างบน
- [ ] **Step 5: ตรวจในเบราว์เซอร์** `preview_start` แล้วเปิด `/studio/ads` ด้วยบัญชี owner: เห็นปุ่มเชื่อม (ปิดอยู่ถ้ายังไม่มี config ID) ฟอร์ม และเมนู; resize เป็นมือถือแล้วไม่มี scroll แนวนอน **ห้ามกดสร้างหรือเปิดใช้** (`.env.local` ชี้ฐานโปรดักชัน)
- [ ] **Step 6: รัน** `npm run verify` (tsc, lint, vitest, build) ผ่าน
- [ ] **Step 7: Commit** `feat(studio): /studio/ads, launch a paused image ad from an ad piece (owner only)`

---

### Task 7: เอกสาร การรัน migration และการยิงจริงครั้งแรก

**Files:**
- Modify: `docs/studio-ad-creation-plan.md` (บรรทัดสถานะ: รอบแรกทำแล้วส่วนไหน)
- Modify: `docs/ads-manage-permission.md` (ลบประโยค "ยังไม่มีโค้ดที่อ่านค่านี้" และ "อย่ากดเชื่อมด้วย config นี้จนกว่า…")

- [ ] **Step 1: อัปเดตเอกสารสองไฟล์** ให้ตรงกับของที่ทำแล้ว และระบุในเอกสารแผนใหญ่ว่ารอบแรกจำกัดที่บัญชีสกุลบาทและรูปเดียว
- [ ] **Step 2: ขออนุญาตเจ้าของ** ก่อนรัน `20261004_ad_launch.sql` บนฐานโปรดักชัน (Supabase `cenysylrzbwfrtuqoeqk`) migrate ก่อน push ตามขั้นตอนที่ใช้อยู่ ห้ามรันเองโดยไม่ได้รับ "ได้" ชัดเจน
- [ ] **Step 3: เจ้าของทำ** สร้าง config ตัวที่สามตาม `ads-manage-permission.md` ใส่ `FB_ADS_MANAGE_CONFIG_ID` (และ `ADS_MAX_DAILY_BUDGET_THB` ถ้าไม่ใช้ 500) ใน Vercel
- [ ] **Step 4: เจ้าของทดสอบเองบนโปรดักชัน** กดเชื่อมบัญชี ตรวจ `scopes` ของแถว `facebook_ads_manage:…` ว่ามี `ads_management` แล้วสร้างแอดจากชิ้นทดสอบหนึ่งชิ้นด้วยงบต่ำสุด ตรวจใน Ads Manager ว่ามี campaign / adset / ad เป็น PAUSED ครบ และ `ad_id` อยู่ในแถว `ins_ad_launch` ผมไม่กดเปิดใช้ให้
- [ ] **Step 5: ตรวจว่าของเดิมไม่กระทบ** หน้า `/admin/ads` (ads_read) ยังอ่านผลได้ รายการเพจใน `/admin/messenger` ไม่มีบัญชีโฆษณาโผล่ และกล่องข้อความเพจยังรับ-ตอบได้ (การล็อกอินธุรกิจเคยทับสิทธิ์เพจ)
- [ ] **Step 6: Commit** `docs(ads): the first round of ad launch is built, notes updated`
