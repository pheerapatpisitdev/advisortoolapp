# ส่งแอดแบบฟอร์มลีด — เลือกวัตถุประสงค์ตอนส่งขึ้น Facebook

สถานะ: spec รอเจ้าของตรวจ ยังไม่เขียนโค้ด
ต่อจาก [2026-10-04-ads-studio-monoko-flow-design.md](2026-10-04-ads-studio-monoko-flow-design.md) ซึ่งขึ้นโปรดักชันแล้ว (a0018e8)

## เป้าหมาย

ตอนนี้ทุกรอบส่งจาก Ads Studio เป็นแอดแบบทราฟฟิก (`OUTCOME_TRAFFIC` ปุ่ม "ดูเพิ่มเติม" พาไปเว็บ) อย่างเดียว เพราะค่านี้เขียนตายไว้ใน `src/lib/ads/graph.ts`
เจ้าของอยากยิงแอดให้คนกรอกฟอร์มลีดใน Facebook (Instant Form) ได้จาก Studio โดยใช้ฟอร์มที่สร้างไว้ใน Meta Business Suite

สำเร็จเมื่อ:
- ในหน้า "ส่งขึ้น Facebook" เลือกได้ว่าจะส่งเป็น **ทราฟฟิก** หรือ **ฟอร์มลีด**
- เลือกฟอร์มลีดแล้วได้ฟอร์มของเพจมาให้เลือก กดส่งแล้วได้ 1 แคมเปญลีด + 1 ชุดโฆษณา + แอดต่อชิ้น บน Meta เป็น PAUSED
- ปุ่มบนแอดเปิดฟอร์มที่เลือก และกดลองใหม่หลังพังแล้วยังใช้ฟอร์มเดิม
- รอบส่งแบบทราฟฟิกทำงานเหมือนเดิมทุกอย่าง

## ขอบเขต

มี
- ปุ่มเลือกวัตถุประสงค์ในหน้าส่ง: ทราฟฟิก (ค่าเริ่มต้น) / ฟอร์มลีด
- ดึงรายชื่อฟอร์มที่เปิดใช้อยู่ของเพจ และเช็กว่าเพจยอมรับเงื่อนไขแอดลีดแล้วหรือยัง
- ข้อความบนปุ่มแอด 3 แบบ: รับใบเสนอราคา (ค่าเริ่มต้น) / ลงทะเบียน / ดูเพิ่มเติม
- เก็บวัตถุประสงค์ ฟอร์ม และปุ่มไว้กับรอบส่ง ป้ายในแท็บ "ส่งแล้ว"

ไม่มี (เจ้าของตัดออกเมื่อ 2026-10-04)
- ดึงลีดเข้าแอป — ลีดอยู่ใน Meta Business Suite ดูและดาวน์โหลดที่นั่น
- ฟอร์มบนเว็บ Pixel / Conversions API และแอดคอนเวอร์ชันบนเว็บ
- สร้างหรือแก้ฟอร์มจาก Studio
- ให้ AI เขียนข้อความแอดตามวัตถุประสงค์
- การยิงทีละชิ้นแบบเก่า (`launch.ts`) ยังเป็นทราฟฟิกอย่างเดียว

## 1. หน้า "ส่งขึ้น Facebook" (`SendDialog.tsx`)

- บนสุดของฟอร์มมีปุ่มสลับสองปุ่ม: `ทราฟฟิก · พาไปเว็บ` และ `ฟอร์มลีด · กรอกใน Facebook` ค่าเริ่มต้นทราฟฟิก หน้าตาเดิมจึงไม่เปลี่ยนสำหรับคนที่ไม่กด
- **ทราฟฟิก**: เหมือนเดิมทุกช่อง (บัญชี ลิงก์ งบ ชิ้นที่ส่ง)
- **ฟอร์มลีด**:
  - ช่องลิงก์ซ่อน ช่อง **ฟอร์ม** ขึ้นแทน โหลดรายชื่อเมื่อกดเลือกฟอร์มลีดครั้งแรก (server action `leadForms(campaignId)`)
  - ระหว่างโหลดขึ้น "กำลังโหลดฟอร์ม…"
  - เพจยังไม่ยอมรับเงื่อนไข: ข้อความ "เพจนี้ยังไม่ได้ยอมรับเงื่อนไขแอดลีดของ Facebook" + ลิงก์ `https://www.facebook.com/ads/leadgen/tos?page_id={pageId}` (เปิดแท็บใหม่) + ปุ่ม "โหลดใหม่"
  - ไม่มีฟอร์มที่เปิดใช้: ข้อความ "ยังไม่มีฟอร์มบนเพจนี้" + ลิงก์ไปสร้างฟอร์มใน Business Suite + ปุ่ม "โหลดใหม่"
  - Facebook ตอบผิดพลาด: แสดงเหตุผลจาก Facebook + ปุ่ม "โหลดใหม่"
  - มีฟอร์ม: `<select>` ชื่อฟอร์ม เลือกตัวแรกให้ก่อน
  - ช่อง **ปุ่มบนแอด**: `<select>` รับใบเสนอราคา (`GET_QUOTE`, ค่าเริ่มต้น) / ลงทะเบียน (`SIGN_UP`) / ดูเพิ่มเติม (`LEARN_MORE`)
- บรรทัดอธิบายใต้หัวเปลี่ยนตามวัตถุประสงค์ ("…แคมเปญลีด…" แทน "…1 แคมเปญ…")
- `formReady` รับ `objective` และ `leadFormId`: แบบฟอร์มลีดไม่ต้องมีลิงก์ แต่ต้องมีฟอร์ม แบบทราฟฟิกเช็กเหมือนเดิม

## 2. ดึงฟอร์มของเพจ (`src/lib/ads/lead-forms.ts` ใหม่)

`listLeadForms(pageId, deps)` คืน
`{ ok: true; tosAccepted: boolean; forms: { id; name }[] } | { ok: false; error }`

- ใช้โทเค็นเพจ: ขอจากโทเค็นผู้ใช้ของบัญชีสร้างแอด (`GET /{pageId}?fields=access_token,leadgen_tos_accepted`) โทเค็นนี้ได้สิทธิ์ `pages_manage_ads` จากการล็อกอินสร้างแอด ไม่ต้องขอสิทธิ์เพิ่ม
- `GET /{pageId}/leadgen_forms?fields=id,name,status&limit=100` เก็บเฉพาะ `status === "ACTIVE"`
- `pageId` ต้องเป็นตัวเลขล้วนก่อนใส่ใน path (เหมือนการเช็ก id อื่นใน `send.ts`)
- ใช้ `graph()` และ timeout เดิมจาก `graph.ts`
- server action `leadForms(campaignId)` ใน `actions.ts`: `requireStaff("owner")` หาแคมเปญ เช็กว่าเพจยังอยู่ในเพจที่เชื่อม แล้วเรียก `listLeadForms`

## 3. ตัวสร้างบน Meta (`graph.ts`, `send.ts`)

| ชั้น | ทราฟฟิก (เดิม ไม่แก้ค่า) | ฟอร์มลีด |
|---|---|---|
| แคมเปญ | `objective: OUTCOME_TRAFFIC` | `objective: OUTCOME_LEADS` |
| ชุดโฆษณา | `optimization_goal: LINK_CLICKS`, `destination_type: WEBSITE` | `optimization_goal: LEAD_GENERATION`, `destination_type: ON_AD`, `promoted_object: {"page_id": pageId}` |
| ครีเอทีฟ | `link` = ลิงก์ที่กรอก, CTA `LEARN_MORE` → `{link}` | `link: "http://fb.me/"`, CTA ตามที่เลือก → `{lead_gen_form_id}` |
| ร่วมกัน | ไทย อายุ 20+, Advantage+ audience, `THAILAND_UNIVERSAL` + ผู้ลงโฆษณาที่ยืนยันตัวตน, `billing_event: IMPRESSIONS`, `LOWEST_COST_WITHOUT_CAP`, งบที่ชุดโฆษณา, ทุกชั้น PAUSED | เหมือนกัน |

- `campaignParams`, `adsetParams`, `creativeParams` รับ `goal: AdGoal` เพิ่ม
  ```ts
  type AdGoal =
    | { objective: "traffic"; link: string }
    | { objective: "leads"; leadFormId: string; cta: "GET_QUOTE" | "SIGN_UP" | "LEARN_MORE"; pageId: string };
  ```
  `launch.ts` ส่ง `{ objective: "traffic", link }` ค่าที่ส่งออกจึงเหมือนเดิมทุกตัว
- `SendInput` ได้ `objective`, `leadFormId?`, `cta?`
- `runSend` เช็กก่อนบันทึก: แบบลีดต้องมี `leadFormId` เป็นตัวเลขล้วนและ `cta` อยู่ในสามค่า แบบทราฟฟิกเช็กลิงก์เหมือนเดิม
- `sendApproved` (server) เรียก `listLeadForms` อีกรอบ ฟอร์มที่เลือกต้องอยู่ในรายชื่อ ACTIVE ของเพจแคมเปญ และเพจต้องยอมรับเงื่อนไขแล้ว ไม่งั้นปฏิเสธก่อนแตะ Meta ("ฟอร์มนี้ไม่อยู่ในเพจหรือถูกปิดแล้ว" / "เพจยังไม่ได้ยอมรับเงื่อนไขแอดลีด")
- `drive` / `makeAd` อ่านวัตถุประสงค์ ฟอร์ม และปุ่มจาก `AdSend` ที่บันทึกไว้ กดลองใหม่จึงใช้ค่าเดิม
- ชื่อแคมเปญบน Meta: `Studio · ลีด · N แอด · วันที่` สำหรับแบบลีด แบบทราฟฟิกชื่อเดิม

## 4. ข้อมูล

migration `20261006_ad_send_objective.sql`:
```sql
alter table public.ins_ad_send
  add column if not exists objective text not null default 'traffic'
    check (objective in ('traffic', 'leads')),
  add column if not exists lead_form_id text,
  add column if not exists cta text
    check (cta is null or cta in ('GET_QUOTE', 'SIGN_UP', 'LEARN_MORE')),
  add constraint ins_ad_send_leads_form
    check (objective <> 'leads' or (lead_form_id is not null and cta is not null));
```
- รอบส่งเก่าทั้งหมดได้ `traffic` จากค่าเริ่มต้น
- รอบส่งแบบลีดเก็บ `link = 'http://fb.me/'` (คอลัมน์ `link` เป็น not null และครีเอทีฟต้องมีลิงก์)
- `send-store.ts` แปลงสามคอลัมน์เป็น `objective`, `leadFormId`, `cta`
- สิทธิ์ตารางไม่เปลี่ยน (service_role อย่างเดียว)

## 5. แท็บ "ส่งแล้ว"

- แต่ละรอบส่งมีป้าย: `ทราฟฟิก` หรือ `ฟอร์มลีด` (ไม่เก็บชื่อฟอร์ม เพราะชื่อแก้ได้ใน Meta ป้ายบอกแค่ชนิด)
- รอบส่งแบบลีดไม่แสดงลิงก์ปลายทาง

## 6. ข้อผิดพลาด

- Meta ปฏิเสธขั้นไหน บันทึกเหตุผลที่ขั้นนั้นแล้วกดลองใหม่ได้ เหมือนเดิม
- ฟอร์มถูกปิดหรือลบหลังแอดถูกสร้าง: Meta จัดการแอดเอง ระบบไม่ติดตาม
- ค่าที่ต้องยืนยันกับ Meta ตอนส่งจริงครั้งแรก: `link: "http://fb.me/"` ในครีเอทีฟลีด, `promoted_object` ต้องการแค่ `page_id`, field `leadgen_tos_accepted` บนเพจ ถ้า Meta ไม่รับ ให้แก้ใน `graph.ts` / `lead-forms.ts` จุดเดียว

## 7. การทดสอบ

เขียนเทสต์ก่อนแก้ทุกจุด (vitest, `tests/ads/`)
- `graph.test.ts` (ใหม่): ทั้งสามชั้นของแต่ละวัตถุประสงค์ได้ค่าตามตารางข้อ 3 และแบบทราฟฟิกได้ค่าเดิมทุกตัว
- `send.test.ts`: ส่งแบบลีดได้ครบสี่ขั้นพร้อมค่าลีด, แบบลีดที่ไม่มีฟอร์มหรือปุ่มผิดถูกปฏิเสธที่ `check` โดยไม่เรียก fetch, พังที่ชุดโฆษณาแล้ว `resumeSend` ใช้ฟอร์มและปุ่มเดิม
- `send-store.test.ts`: สามคอลัมน์ใหม่เขียนและอ่านกลับได้ แถวที่ไม่มีคอลัมน์ใหม่อ่านเป็น `traffic`
- `lead-forms.test.ts` (ใหม่): ยังไม่ยอมรับเงื่อนไข, ไม่มีฟอร์ม, ฟอร์มที่ไม่ใช่ ACTIVE ถูกกรองออก, Meta ตอบ error, pageId ไม่ใช่ตัวเลข
- `form-ready.test.ts`: แบบลีดไม่ต้องมีลิงก์แต่ต้องมีฟอร์ม, แบบทราฟฟิกเหมือนเดิม
- `studio-flow-actions.test.ts`: `sendApproved` ปฏิเสธฟอร์มที่ไม่อยู่ในเพจ

ทดสอบของจริงหลังขึ้นโปรดักชัน
1. apply migration บน prod (Supabase cenysylrzbwfrtuqoeqk) ก่อน push main
2. เจ้าของสร้างฟอร์มหนึ่งอันบนเพจ LuckyPlanner และยอมรับเงื่อนไขแอดลีด
3. ส่งหนึ่งชิ้นแบบฟอร์มลีด ดูใน Ads Manager ว่าเป็นแคมเปญลีด ปุ่มเปิดฟอร์มที่เลือก และยัง PAUSED
4. กรอกฟอร์มผ่าน "ดูตัวอย่าง" ของแอด ไม่ต้องเปิดแอด
