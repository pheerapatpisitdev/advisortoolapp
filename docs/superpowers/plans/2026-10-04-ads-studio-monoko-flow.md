# Ads Studio แบบ Monoko Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ads Studio เดินแบบ Monoko: วิซาร์ดสร้างแคมเปญ → AI ออกแบบ 4 มิติ → คิวสร้าง 1/2/4 ชิ้นพร้อมรูป → อนุมัติ/ทิ้งบนการ์ด → ส่งทุกชิ้นที่อนุมัติขึ้น Facebook เป็นชุดเดียว

**Architecture:** ต่อยอดของเดิม: `ins_ad_campaign` ได้ `dimensions`/`queue_pos`/`brand_voice`; ตรรกะคิวเป็นฟังก์ชันบริสุทธิ์ใน `src/lib/ads/dimensions.ts`; ตัวเขียน `writeAds` รับ "แบบ" (ฮุก+กลุ่มคน+มุม+สไตล์); รูปวาดด้วย `/api/content-draw` เดิมจากฝั่ง browser หลังเขียนเสร็จ; การส่งเป็นชุดใช้ตาราง `ins_ad_send` / `ins_ad_send_item` และเครื่องยนต์ใหม่ `src/lib/ads/send.ts` ที่ใช้ตัวเรียก Graph ร่วมกับ `launch.ts`

**Tech Stack:** Next.js 15 App Router + server actions, Supabase (service role), Meta Marketing API v23, vitest

**Spec:** [docs/superpowers/specs/2026-10-04-ads-studio-monoko-flow-design.md](../specs/2026-10-04-ads-studio-monoko-flow-design.md)

## Global Constraints

- Ads Studio เป็นของ `owner` คนเดียว: ทุกหน้า `gatePage(..., "owner")`, ทุก action `requireStaff("owner")` ก่อนอ่านอะไร
- ข้อมูลสินค้ามาจากแบบประกันในระบบเท่านั้น (`briefFor`/`contentProduct`) ตัวเลขจากตารางอัตรา; ไม่มีช่องวางข้อความสินค้าหรือ URL
- 4 มิติ: `hooks`, `personas`, `angles`, `styles` แต่ละรายการ `{ text: string; note: string }`; AI เสนอ ฮุก 8–12, กลุ่มคน 3–5, มุม 3–5, สไตล์ 3–5; แต่ละมิติต้องเหลือ ≥1
- ชื่อ ≤60, สิ่งที่อยากเน้น ≤120, น้ำเสียงแบรนด์ ≤120 (trim, ว่าง = null)
- สร้างครั้งละ 1 / 2 / 4 ชิ้นเท่านั้น; ทุกชิ้นวาดรูปอัตโนมัติด้วยตัววาด `standard` โดยใช้สไตล์ภาพเป็นคำสั่งวาด
- อนุมัติ = `status 'used'`, ร่าง = `draft`, ทิ้ง = `trashed`; แท็บ ทั้งหมด / ร่าง / อนุมัติแล้ว / ส่งแล้ว / ถังขยะ
- ส่งหนึ่งรอบ = แคมเปญ 1 + ชุดโฆษณา 1 + แอดต่อชิ้น บน Meta, ทุกอย่าง `PAUSED`; ชุดโฆษณา: `geo_locations TH`, `age_min 20`, `targeting_automation.advantage_audience 1`, `THAILAND_UNIVERSAL` + `META_TH_VERIFIED_IDENTITY_ID`; เพดาน `ADS_MAX_DAILY_BUDGET_THB` (500) ต่อรอบ; บัญชีสกุลบาทเท่านั้น
- เปิดใช้ / หยุด ทั้งชุด ต้องยืนยันในหน้า (บัญชี เพจ งบต่อวัน); ไม่มีอะไรเปิดใช้เองตอนส่ง
- ค่า AI ผ่าน `holdContentBudget` / เพดานเดือนเดิม; เพดานเต็มต้องบอกก่อน ไม่สร้างครึ่งๆ เงียบๆ
- เทสต์ห้ามแตะฐานข้อมูลหรือ Meta จริง (`.env.local` = โปรดักชัน); ข้อความในหน้าเป็นภาษาไทย ใช้คลาส `--ct-*` เดิม ไม่เพิ่ม dependency
- ไฟล์ค้างจากงานอื่นห้าม stage (`.env.example`, `src/app/Chat.tsx`, `src/app/layout.tsx`, `src/lib/chat/record.ts`, `src/app/api/meta/`, `src/components/meta/`, `src/lib/meta/`, `docs/pixel-capi-plan.md`, `docs/workflow-flowchart.md`); branch `feat/ads-studio-monoko` ในโฟลเดอร์หลัก; migration ก่อน push

## Review Focus

1. แก้มิติระหว่างที่คิวเดินไปแล้ว: แบบที่สร้างแล้วไม่ถูกสร้างซ้ำ และคิวยังครอบคลุมแบบใหม่ (Task 2)
2. คิวหมด (สร้างครบทุกแบบ): ปุ่มสร้างบอก "ครบทุกแบบแล้ว" และ server ปฏิเสธโดยไม่เสียเงิน (Task 4)
3. ส่งชิ้นที่อนุมัติแล้วแต่รูปยังวาดไม่เสร็จหรือไม่มีโปสเตอร์: ชิ้นนั้นถูกกันออกพร้อมเหตุผล ชิ้นอื่นส่งได้ (Task 6)
4. ชิ้นที่ส่งแล้วถูกกดยกเลิกอนุมัติหรือทิ้ง: ปฏิเสธ — ชิ้นที่อยู่ในรอบส่งที่ยังไม่ถูกเลิกแก้สถานะไม่ได้ (Task 5)
5. เพดานค่า AI เต็มกลางรอบ 4 ชิ้น: ชิ้นที่เขียนได้ถูกบันทึก และหน้าแจ้งว่าได้กี่ชิ้นและทำไมหยุด (Task 4)

---

### Task 1: ข้อมูล — มิติบนแคมเปญ และตารางรอบส่ง

**Files:**
- Create: `supabase/migrations/20261005_ad_studio_flow.sql`
- Modify: `src/lib/ads/campaign-store.ts`
- Create: `src/lib/ads/send-store.ts`
- Test: `tests/ads/campaign-store.test.ts`, `tests/ads/send-store.test.ts`

**Interfaces:**
- Migration: `alter table ins_ad_campaign add column if not exists dimensions jsonb, add column if not exists queue_pos int not null default 0, add column if not exists brand_voice text;` ตาราง `ins_ad_send` (`id uuid pk`, `created_at`, `campaign_id uuid references ins_ad_campaign(id) on delete set null`, `act_id text not null`, `page_id text not null`, `link text not null`, `currency text not null`, `daily_budget_minor int not null`, `meta_campaign_id text`, `adset_id text`, `step text not null default 'none' check (step in ('none','campaign','adset','ads'))`, `error text`, `claimed_at timestamptz`, `activated_at timestamptz`, `paused_at timestamptz`, `superseded boolean not null default false`, `created_by uuid`) และ `ins_ad_send_item` (`id uuid pk`, `send_id uuid not null references ins_ad_send(id) on delete cascade`, `piece_id uuid references ins_content(id) on delete set null`, `image_hash text`, `creative_id text`, `ad_id text`, `error text`, unique `(send_id, piece_id)`); RLS + revoke/grant แบบ `20260930_wallet.sql`; comment ไทย
- `campaign-store.ts`: `type Dimension = { text: string; note: string }`, `interface Dimensions { hooks: Dimension[]; personas: Dimension[]; angles: Dimension[]; styles: Dimension[] }`; `AdCampaign` เพิ่ม `dimensions: Dimensions | null`, `queuePos: number`, `brandVoice: string | null`; `createCampaign` รับ `dimensions?`, `brandVoice?`; `updateCampaign` patch รับ `dimensions`, `brandVoice`, `queuePos`; ค่า jsonb ที่อ่านมาเพี้ยน → `null`
- `send-store.ts`: `interface AdSend { id; createdAt; campaignId: string | null; actId; pageId; link; currency; dailyBudgetMinor; metaCampaignId: string | null; adsetId: string | null; step: "none"|"campaign"|"adset"|"ads"; error: string | null; claimedAt: string | null; activatedAt: string | null; pausedAt: string | null; superseded: boolean; createdBy: string | null }`, `interface AdSendItem { id; sendId; pieceId: string | null; imageHash: string | null; creativeId: string | null; adId: string | null; error: string | null }`; ฟังก์ชัน `createSend(s, pieceIds: string[]): Promise<{ send: AdSend; items: AdSendItem[] }>`, `getSend(id)`, `listSends(campaignId): Promise<(AdSend & { items: AdSendItem[] })[]>` (ใหม่สุดก่อน, ไม่รวม superseded), `saveSendStep(id, patch)` (ล้าง error), `saveSendError(id, error)`, `saveItem(id, patch)` (ล้าง error), `saveItemError(id, error)`, `claimSend(id, staleMs = CLAIM_STALE_MS, now?)`, `releaseSend(id)`, `markSendActivated(id, at)`, `markSendPaused(id, at)`, `sentPieceIds(campaignId): Promise<Set<string>>` (ชิ้นในรอบที่ไม่ superseded); `CLAIM_STALE_MS` import จาก `launch-store.ts`

- [ ] **Step 1: เทสต์ล้ม** (mock supabase แบบ `tests/ads/launch-store.test.ts`): `createCampaign` เขียน `dimensions`/`brand_voice`; `getCampaign` แปลง `dimensions`, `queue_pos`, `brand_voice` และคืน `dimensions: null` เมื่อ jsonb ไม่ใช่รูปที่ถูก; `createSend` insert แถวรอบส่งแล้ว insert item หนึ่งแถวต่อ piece; `claimSend` true เมื่อ update คืนหนึ่งแถว false เมื่อไม่มี; `saveSendStep`/`saveItem` ตั้ง `error: null`; `sentPieceIds` กรอง `superseded = false`; migration text มี `ins_ad_send_item`, `on delete cascade`, `revoke all on public.ins_ad_send from public, anon, authenticated`
- [ ] **Step 2: รัน** `npx vitest run tests/ads/campaign-store.test.ts tests/ads/send-store.test.ts` ต้องล้ม
- [ ] **Step 3: เขียน** migration, `campaign-store.ts`, `send-store.ts`
- [ ] **Step 4: รัน** `npx vitest run tests/ads` และ `npx tsc --noEmit` ผ่าน
- [ ] **Step 5: Commit** `feat(ads): campaign dimensions and a queue, and batch sends`

---

### Task 2: มิติและคิว (ฟังก์ชันบริสุทธิ์)

**Files:**
- Create: `src/lib/ads/dimensions.ts`
- Test: `tests/ads/dimensions.test.ts`

**Interfaces:**
- Consumes: `Dimensions`, `Dimension` จาก Task 1
- Produces:
  - `type Variant = { hook: string; persona: string; angle: string; style: string; combo: string }` — `combo` คือคีย์คงที่ของแบบ `"<hookText>|<personaText>|<angleText>|<styleText>"` ใช้กันซ้ำแม้มิติถูกเรียงใหม่
  - `totalCombos(d: Dimensions): number`
  - `orderedVariants(d: Dimensions): Variant[]` — ทุกแบบครบไม่ซ้ำ เรียงให้ชิ้นที่ติดกันต่างกันหลายมิติที่สุด (เช่น เดินดัชนีแบบ mixed-radix ด้วย stride ที่เป็นจำนวนเฉพาะสัมพัทธ์กับ total หรือ diagonal) และคงที่ (input เดิม → ลำดับเดิม)
  - `nextVariants(d: Dimensions, made: Set<string>, n: 1 | 2 | 4): Variant[]` — n แบบแรกใน `orderedVariants` ที่ `combo` ไม่อยู่ใน `made` (น้อยกว่า n ได้เมื่อใกล้หมด, ว่างเมื่อครบ)
  - `cleanDimensions(raw: unknown): Dimensions | null` — trim, ตัดซ้ำ, ตัดความยาว (text ≤80, note ≤120), จำกัดจำนวน (hooks ≤12, ที่เหลือ ≤5), มิติใดว่าง → null
  - `FALLBACK_DIMENSIONS(productName: string): Dimensions` — ฮุกตั้งต้น 8 ข้อ, กลุ่มคน 3 (พ่อแม่มือใหม่ / คนทำงานอายุ 30 / คนใกล้เกษียณ), มุมจาก `ANGLE_BANK` 4 ข้อแรก, สไตล์ 3 (ภาพถ่ายครอบครัว / ตัวเลขเด่นบนพื้นสี / Before & After)

- [ ] **Step 1: เทสต์ล้ม**: `totalCombos` ของ 10×4×4×4 = 640; `orderedVariants` ยาวเท่า total ไม่มี combo ซ้ำ; ในแบบ 3×3×3×3 สองชิ้นติดกันใน 9 ชิ้นแรกต่างกันอย่างน้อย 2 มิติ; ลำดับคงที่เมื่อเรียกซ้ำ; `nextVariants` ข้าม combo ที่อยู่ใน `made` และคืน `[]` เมื่อครบ (Review Focus 2); เปลี่ยนมิติ (เพิ่มฮุกหนึ่งข้อ) แล้ว `nextVariants` ไม่คืน combo ที่ทำแล้ว และคืนแบบที่มีฮุกใหม่ได้ (Review Focus 1); `cleanDimensions` ตัดซ้ำ ตัดยาว คืน null เมื่อมิติใดว่าง; `FALLBACK_DIMENSIONS` ผ่าน `cleanDimensions`
- [ ] **Step 2: รัน** ต้องล้ม → **Step 3: เขียน** → **Step 4: รัน** `npx vitest run tests/ads/dimensions.test.ts` ผ่าน
- [ ] **Step 5: Commit** `feat(ads): four ad dimensions and a queue that never repeats a combination`

---

### Task 3: AI วิเคราะห์มิติ

**Files:**
- Create: `src/lib/ads/analyze.ts`
- Test: `tests/ads/analyze.test.ts`

**Interfaces:**
- Consumes: Task 2 `cleanDimensions`, `FALLBACK_DIMENSIONS`; `chat` (tier `"small"`, task `"content-plan"`, `json: true`) และ `parseJsonReply` ที่ `src/lib/content/write.ts` ใช้
- Produces: `dimensionMessages(brief: string, focus: string, voice: string): ChatMessage[]` (ระบบภาษาไทย: ให้ JSON `{hooks:[{text,note}],personas:[…],angles:[…],styles:[…]}` จำนวนตาม Global Constraints, สไตล์ภาพต้องเป็นสิ่งที่วาดเป็นพื้นหลังโปสเตอร์ได้ ไม่มีตัวหนังสือในภาพ, ห้ามตัวเลขที่ไม่อยู่ใน brief); `analyzeDimensions(opts: { brief: string; productName: string; focus: string; voice: string }): Promise<{ dimensions: Dimensions; costThb: number; fallback: boolean }>` — คำตอบอ่านไม่ได้หรือ error → `FALLBACK_DIMENSIONS`, `fallback: true`

- [ ] **Step 1: เทสต์ล้ม** (mock `chat`): คำตอบดีได้มิติที่ผ่าน `cleanDimensions`; คำตอบเพี้ยน/throw ได้ fallback และ `fallback: true`; messages มี brief, focus, voice
- [ ] **Step 2–4:** รันล้ม → เขียน → รันผ่าน `npx vitest run tests/ads/analyze.test.ts`
- [ ] **Step 5: Commit** `feat(ads): AI proposes a campaign's hooks, people, angles and picture styles`

---

### Task 4: เขียนแอดตามแบบจากคิว

**Files:**
- Modify: `src/lib/content/ads.ts` (`variantAdMessages`), `src/lib/content/write.ts` (`writeAdVariants`), `src/app/studio/actions.ts` (ทางแอดของ `generateContent`)
- Test: `tests/ads/campaign-write.test.ts`, `tests/content/` เทสต์ write ถ้ามี

**Interfaces:**
- Consumes: Task 1 `getCampaign`, `updateCampaign`; Task 2 `nextVariants`, `Variant`; `sentPieceIds` ไม่ใช้ที่นี่; ชิ้นที่ทำแล้ว = `combo` จาก `output.ad.combo` ของทุกชิ้นในแคมเปญ (`listCampaignPieces`, รวมถังขยะ)
- `variantAdMessages(brief: string, v: Variant, extras: { focus: string; voice: string }): ChatMessage[]` — ระบบเหมือน `adCopyMessages`; user ระบุ ฮุก (ใช้เป็นแนวประโยคเปิด), กลุ่มคนที่พูดด้วย, มุมขาย, น้ำเสียง, สิ่งที่อยากเน้น; ขอ `imagePrompt` ที่ตรงกับสไตล์ภาพ
- `writeAdVariants(opts: { brief; variants: Variant[]; focus; voice; prefer?; clock?; saveMs? }): Promise<Round>` — เขียนแต่ละแบบขนานกัน; `output.ad = { angle: v.angle, tone: v.persona, hook: v.hook, persona: v.persona, style: v.style, combo: v.combo }`; `output.angle = "<angle> · <persona>"`
- `ContentOutput.ad` ขยายเป็น `{ angle: string; tone: string; hook?: string; persona?: string; style?: string; combo?: string }` (ของเก่าอ่านได้)
- `GenerateInput` สำหรับแอด: `{ format: "ad"; campaignId: string; count: 1 | 2 | 4 }` (ค่าอื่นไม่ใช้) — ตรวจเจ้าของและเพจ (ของเดิม Task 3 รอบก่อน), แคมเปญต้องมี `dimensions` (ไม่มี → `"ให้ AI วิเคราะห์มิติก่อน"`), `nextVariants` ว่าง → `{ ok:false, error:"สร้างครบทุกแบบแล้ว" }` ก่อนกันงบ (Review Focus 2); ประมาณงบ = `n × (writer.thb + OVERHEAD_THB)`; เขียนด้วย `writeAdVariants`; บันทึกทุกชิ้นด้วย `campaignId`; `updateCampaign(id, { queuePos: queuePos + saved })`; ผลบอกจำนวนที่ได้จริง และถ้าน้อยกว่าที่ขอ บอกเหตุผล (Review Focus 5); `GenerateResult` เดิมพอ — ใส่ `error` เมื่อได้ไม่ครบ
- รูปวาดฝั่ง browser (Task 8) ไม่ใช่ที่นี่

- [ ] **Step 1: เทสต์ล้ม**: count 2 → `writeAdVariants` ได้ 2 แบบจาก `nextVariants` ที่ข้าม combo ของชิ้นเดิม; `saveContent` ได้ `output.ad.combo`; `queuePos` ขยับตามจำนวนที่บันทึก; แคมเปญไม่มีมิติ → ปฏิเสธก่อน `takeRound`; คิวหมด → `"สร้างครบทุกแบบแล้ว"` ก่อน `takeRound`; count อื่นนอก 1/2/4 → ปัดเป็น 1; ได้ 1 จาก 2 → ผลมี items 1 ชิ้นและ error บอกเหตุ
- [ ] **Step 2–4:** รันล้ม → เขียน → รันผ่าน `npx vitest run tests/ads tests/content`, `npx tsc --noEmit`
- [ ] **Step 5: Commit** `feat(ads): write ads one combination at a time from the campaign's queue`

---

### Task 5: อนุมัติ / ทิ้ง และแท็บใหม่

**Files:**
- Modify: `src/lib/ads/campaign-view.ts`, `src/app/studio/ads/actions.ts` (`setAdStatus`)
- Test: `tests/ads/campaign-view.test.ts`, `tests/ads/launch-actions.test.ts`

**Interfaces:**
- `type AdTab = "draft" | "approved" | "sent" | "trash"`; `adTab(piece: { status }, sent: boolean): AdTab` — sent ก่อน (ชิ้นใน `sentPieceIds` หรือมีแถว `ins_ad_launch` ที่ไม่ superseded), trashed → trash, used → approved, อื่น → draft; `tabCounts(rows)` คืน `{ all, draft, approved, sent, trash }` (all ไม่นับ trash)
- `setAdStatus(pieceId, status: "draft" | "used" | "trashed")` — ชิ้นที่ sent → `{ ok:false, error:"ชิ้นนี้ส่งขึ้น Facebook แล้ว แก้สถานะไม่ได้" }` (Review Focus 4); กฎเดิมเรื่องแอดที่เปิดใช้อยู่ยังอยู่

- [ ] **Step 1: เทสต์ล้ม**: `adTab` สี่กรณีและ sent ชนะทุกสถานะ; `tabCounts`; `setAdStatus(…, "used")` อนุมัติชิ้นร่าง; ชิ้นที่อยู่ในรอบส่ง → ปฏิเสธทั้ง used/draft/trashed; ไม่ใช่เจ้าของ → ปฏิเสธก่อนอ่าน
- [ ] **Step 2–4:** รันล้ม → เขียน → รันผ่าน `npx vitest run tests/ads`
- [ ] **Step 5: Commit** `feat(ads): approve or bin an ad from its card; tabs all, draft, approved, sent, bin`

---

### Task 6: เครื่องยนต์ส่งเป็นชุด

**Files:**
- Create: `src/lib/ads/graph.ts` (ย้าย `graph`, `idOf`, ตัวอ่าน hash รูป, `REQUEST_TIMEOUT_MS`, ข้อความ error 190/timeout จาก `launch.ts`), `src/lib/ads/send.ts`
- Modify: `src/lib/ads/launch.ts` (import จาก `graph.ts`; พฤติกรรมเดิมห้ามเปลี่ยน — เทสต์เดิมต้องผ่านไม่แก้)
- Test: `tests/ads/send.test.ts`

**Interfaces:**
- Consumes: Task 1 send-store; `thVerifiedIdentity`, `checkDailyBudget`, `checkLink`
- `interface SendInput { campaignId: string; actId: string; currency: string | null; pageId: string; link: string; dailyBudgetBaht: number; pieces: { id: string; headline: string; primaryText: string; description: string }[]; createdBy: string }`
- `interface SendDeps { store: typeof import("./send-store"); token(actId): Promise<string | null>; poster(pieceId): Promise<Buffer | null>; thIdentity?: () => string | null; fetchFn?; now? }`
- `runSend(input: SendInput, deps: SendDeps): Promise<{ ok: true; send: AdSend; items: AdSendItem[] } | { ok: false; step: "check" | "campaign" | "adset"; error: string; send?: AdSend }>` — ตรวจก่อนถาม Meta: งบ/สกุล/ลิงก์/ตัวตน/โทเค็น, ชิ้นว่าง → "ยังไม่ได้เลือกแอด"; ชิ้นที่ `poster` คืน null ถูกตัดออกพร้อมเหตุผลในผล (ไม่ทำให้ทั้งรอบล้ม — Review Focus 3); ถ้าไม่เหลือชิ้น → check error; สร้างรอบด้วย `createSend`; `claimSend` (ไม่ได้ → BUSY); campaign → adset (ฟิลด์เดียวกับ `launch.ts` ทุกตัว) → ต่อชิ้นที่ยังไม่มี `adId`: adimages → adcreatives → ads (PAUSED) แต่ละชิ้นพังบันทึก `saveItemError` แล้วไปชิ้นต่อไป; ครบแล้ว `step: "ads"`; `releaseSend` ใน finally; เรียกซ้ำด้วย sendId เดิม (`resumeSend(sendId, deps)`) ทำเฉพาะที่ขาด
- `activateSend(sendId, deps)` / `pauseSend(sendId, deps)` — claim; activate: campaign → adset → ทุก ad ที่มี `adId` เป็น ACTIVE แล้ว `markSendActivated`; pause: campaign PAUSED แล้ว `markSendPaused`

- [ ] **Step 1: เทสต์ล้ม** (fetch ปลอม + store ในหน่วยความจำแบบ `tests/ads/launch.test.ts`): ทางปกติ 2 ชิ้น = campaigns, adsets, (adimages, adcreatives, ads)×2 ตามลำดับ ทุกอย่าง PAUSED และชุดโฆษณามีฟิลด์ไทยครบ; ชิ้นที่ 1 พังที่ครีเอทีฟ ชิ้นที่ 2 ยังได้ ad และรอบจบที่ `step: "ads"` พร้อม error ของชิ้นที่ 1; `resumeSend` ทำเฉพาะชิ้นที่ 1 ไม่สร้าง campaign/adset ซ้ำ; ชิ้นไม่มีโปสเตอร์ถูกตัดออก ชิ้นอื่นส่ง; สองการเรียกพร้อมกันได้ campaign เดียว; ไม่มีตัวตน/งบเกิน/ลิงก์ผิด → ไม่ถาม Meta; `activateSend` ส่ง ACTIVE ให้ campaign, adset, ทุก ad; `pauseSend` ส่ง PAUSED ให้ campaign; เทสต์ `tests/ads/launch.test.ts` เดิมผ่านโดยไม่แก้
- [ ] **Step 2–4:** รันล้ม → เขียน → รันผ่าน `npx vitest run tests/ads`, `npx tsc --noEmit`
- [ ] **Step 5: Commit** `feat(ads): send every approved ad as one paused campaign and ad set, resumable`

---

### Task 7: server actions ของวิซาร์ด ห้อง และการส่ง

**Files:**
- Modify: `src/app/studio/ads/actions.ts`
- Test: `tests/ads/launch-actions.test.ts` (หรือแยก `tests/ads/studio-flow-actions.test.ts`)

**Interfaces:** (ทุกตัว `requireStaff("owner")` ก่อน, throw → ข้อความไทย)
- `analyzeCampaignDraft(input: { pageId; planHref; focus?; voice? }): Promise<{ ok: true; dimensions: Dimensions; fallback: boolean } | { ok:false; error }>` — กันงบด้วย `holdContentBudget` เท่าค่าประมาณหนึ่งรอบ small; ใช้ `analyzeDimensions`
- `createAdCampaign` รับเพิ่ม `dimensions: Dimensions`, `brandVoice?`, `hint?` (ผ่าน `cleanDimensions`; null → ปฏิเสธ "มิติไม่ครบ")
- `analyzeCampaign(campaignId)` สำหรับแคมเปญเก่าที่ไม่มีมิติ → บันทึกผลลง `dimensions`
- `updateAdCampaign` patch รับ `dimensions`, `brandVoice`
- `adCampaignRoom` เพิ่ม: `campaign.dimensions`, `queue: { next: Variant[] (สูงสุด 1 แบบสำหรับแถบ), made: number, total: number }`, ชิ้นมี `variant` (hook/persona/angle/style), `tab` ใหม่, `counts` ใหม่, `sends: (AdSend & { items })[]`, `legacy: LaunchView[]` (แอดที่ยิงด้วยระบบเดิม), `connection.thIdentity`
- `sendApproved(input: { campaignId; actId; link; dailyBudgetBaht; pieceIds: string[] })` → `runSend` (เพจจากแคมเปญ, ชิ้นต้องอนุมัติแล้ว อยู่ในแคมเปญ ยังไม่ส่ง); `retrySend(sendId)`; `activateSendAction(sendId)` / `pauseSendAction(sendId)`; audit ทุกตัว (`ads-send`, `ads-send-activate`, `ads-send-pause`)
- ปุ่มยิงทีละชิ้นเดิม (`launchAd`) เลิกใช้จากหน้า แต่ `activateAd` ยังใช้กับแอดเก่า

- [ ] **Step 1: เทสต์ล้ม**: ทุก action ใหม่ปฏิเสธคนที่ไม่ใช่เจ้าของก่อนอ่าน; `sendApproved` ปฏิเสธชิ้นที่ไม่อนุมัติ/ไม่อยู่ในแคมเปญ/ส่งแล้ว และส่งเพจของแคมเปญถึง `runSend`; ห้องแสดง queue, sends และ legacy; ผลไม่มีสตริงโทเค็น
- [ ] **Step 2–4:** รันล้ม → เขียน → รันผ่าน `npx vitest run tests/ads`, `npx tsc --noEmit`
- [ ] **Step 5: Commit** `feat(ads): actions for the campaign wizard, the queue and batch sends`

---

### Task 8: หน้า (วิซาร์ด, ห้อง, การส่ง)

**Files:**
- Create: `src/app/studio/ads/new/page.tsx`, `src/app/studio/ads/NewCampaignWizard.tsx`, `src/app/studio/ads/DimensionsEditor.tsx`, `src/app/studio/ads/QueueBar.tsx`, `src/app/studio/ads/SendDialog.tsx`, `src/app/studio/ads/SentTab.tsx`
- Modify: `CampaignRoom.tsx`, `CampaignSettings.tsx`, `AdCard.tsx`, `AdEditor.tsx` (เอา `LaunchPanel` ออก), `CampaignList.tsx` (ปุ่มสร้างไปวิซาร์ด)
- Delete: `NewCampaign.tsx`, `LaunchPanel.tsx` เมื่อไม่มีใครใช้ (เก็บ `form-ready.ts` ถ้า `SendDialog` ใช้)
- Test: ฟังก์ชันบริสุทธิ์ใหม่ถ้ามี

**Interfaces:**
- Consumes: Task 7 ทั้งหมด, `generateRound` (`{ format: "ad", campaignId, count }`), `drawPicture(id, style.text + " — " + style.note, "standard")`
- วิซาร์ด: 3 ขั้นตาม spec ส่วนที่ 1, ขั้น 2 เรียก `analyzeCampaignDraft` แสดงความคืบหน้าและบอกเมื่อใช้รายการตั้งต้น, ขั้น 3 `DimensionsEditor` + จำนวนรวม + เลือก 1/2/4 → `createAdCampaign` → `/studio/ads/<id>?write=<n>`
- ห้อง: ซ้าย `CampaignSettings` + `DimensionsEditor` + ปุ่ม "สร้าง N โฆษณา" (1/2/4, ปิดระหว่างสร้าง, "สร้างครบทุกแบบแล้ว" เมื่อคิวหมด); แคมเปญไม่มีมิติ → ปุ่ม "ให้ AI วิเคราะห์มิติ"; ขวา `QueueBar` + แท็บ ทั้งหมด/ร่าง/อนุมัติแล้ว/ส่งแล้ว/ถังขยะ; หลังรอบเขียนเสร็จ วาดรูปทีละชิ้นอัตโนมัติด้วย `drawPicture` (การ์ดแสดง "กำลังวาดรูป…"; พังแสดงปุ่มวาดใหม่)
- การ์ด: ป้าย 4 มิติ, ✓ อนุมัติ / ✕ ทิ้ง (ไม่มีบนชิ้นที่ส่งแล้ว), กดเปิด `AdEditor`
- หัวห้อง: "ส่งขึ้น Facebook (N)" ตามกติกา spec ส่วนที่ 3 → `SendDialog` (บัญชี THB, ลิงก์ตั้งต้น `https://advisortool.app<planHref>`, งบ, รูปย่อเอาออกได้, ยืนยัน) → แสดงผลต่อชิ้น
- `SentTab`: รอบส่งแต่ละรอบ (บัญชี งบ สถานะ แต่ละแอด, ลองใหม่, เปิดใช้ทั้งชุดพร้อมยืนยัน, หยุดทั้งชุด) + แอดเก่าจาก `legacy`

- [ ] **Step 1: เขียน** หน้าและคอมโพเนนต์ (หนึ่งไฟล์หนึ่งหน้าที่ ไม่เกิน ~350 บรรทัด)
- [ ] **Step 2: รัน** `npx tsc --noEmit`, `npx eslint src/app/studio/ads src/lib/ads`, `npx vitest run tests/ads tests/content`, `NEXT_DIST_DIR=.next-build npx next build`
- [ ] **Step 3: Commit** `feat(studio): Ads Studio in Monoko's steps — wizard, queue, approve, send as one`

---

### Task 9: ตรวจ และขึ้นโปรดักชัน (controller)

- [ ] **Step 1:** ขอ "ได้" แล้วรัน `20261005_ad_studio_flow.sql` บน `cenysylrzbwfrtuqoeqk`; ตรวจคอลัมน์และตารางใหม่ RLS/สิทธิ์
- [ ] **Step 2:** localhost ด้วยบัญชีเจ้าของ: เดินวิซาร์ดถึงขั้น 1 และดูห้องแคมเปญเดิม (ไม่มีมิติ → ปุ่มวิเคราะห์), แท็บส่งแล้วแสดงแอดเก่า; **ไม่กดวิเคราะห์ สร้าง หรือส่ง** ถ้าเจ้าของยังไม่อนุญาต
- [ ] **Step 3:** ขอ "ได้" แล้ว merge + push, ตรวจ Vercel READY
