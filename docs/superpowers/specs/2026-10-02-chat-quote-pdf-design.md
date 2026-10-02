# บอทส่งไฟล์ PDF ใบเสนอเบี้ย — design

วันที่: 2026-10-02 · เจ้าของอนุมัติในแชททีละส่วน (ส่วนที่ 1–3 และการถามกลับ: "ok")

## เป้าหมาย

ลูกค้าขอไฟล์ PDF ในแชท แต่บอทส่งไม่ได้ — ระบบไม่มีไฟล์ PDF เก็บไว้เลย PDF ที่ตัวแทนส่งให้ลูกค้าทุกวันนี้
มาจากปุ่มบนหน้าเว็บ ("บันทึกเป็น PDF" / "พิมพ์ หรือบันทึก PDF") ซึ่งให้ Chrome ของคนกดพิมพ์หน้านั้นเอง

งานนี้ทำให้บอทส่ง **ไฟล์เดียวกับที่ได้จากปุ่มนั้น** ให้ลูกค้าได้ ทั้งหน้าเว็บ Messenger และ LINE

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| PDF คืออะไร | ไฟล์ที่ได้จากปุ่มบนหน้าเว็บของแบบนั้นเป๊ะ — ไม่วาดใหม่ ไม่เอารูปการ์ดมาต่อกัน |
| แบบที่ทำ | ทุกแบบที่มีปุ่ม: iHealthy Ultra, Life Protect, Easy Protect, iShield, Life Treasure, PLB |
| ไม่ทำรอบนี้ | `/fhc` (ไปพร้อมตัววางแผนในแชท), ประกันกลุ่ม (บอทไม่ได้ให้เบี้ย), CI123 / มะเร็ง / Legacy (ไม่มีหน้าที่มีปุ่ม) |
| ช่องทาง | หน้าเว็บ + Messenger + LINE |
| ส่งตอนไหน | เมื่อลูกค้าขอ — กดปุ่ม หรือพิมพ์เอง; หลังให้เบี้ยครั้งแรกของแบบนั้น บอทถามกลับว่าอยากได้ไฟล์ไหม |
| ทำไฟล์ที่ไหน | Vercel function เดียว (`puppeteer-core` + `@sparticuz/chromium`) — ไม่ตั้งเซิร์ฟเวอร์ใหม่ ไม่มีตารางใหม่ |
| ทางสำรองถ้า Vercel ไม่พอ | Cloud Run (project advisortool-video) — ต้องบอกเจ้าของก่อนเปลี่ยน |

## สิ่งที่ลูกค้าเห็น

### 1. หลังให้เบี้ย

เมื่อบอทให้เบี้ยของ 6 แบบข้างบน (การ์ดเบี้ยเหมือนเดิม) และเป็น **ครั้งแรกของแบบนั้นในบทสนทนา**
บอทต่อท้ายคำตอบด้วย:

> อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?
> **[ขอไฟล์ PDF]** [ไม่เป็นไร]

- ปุ่ม: Messenger / LINE = quick reply; หน้าเว็บ = ชิปใต้คำตอบ (`guide`) — "ขอไฟล์ PDF" อยู่หน้าสุด ตามด้วยปุ่มถามต่อเดิม (`PRICED_FOLLOW_UPS` ฯลฯ)
- ให้เบี้ยแบบเดิมซ้ำ (เช่น เปลี่ยนทุน): มีปุ่ม "ขอไฟล์ PDF" อย่างเดียว ไม่มีประโยคถาม
- ลูกค้าเคยตอบ "ไม่เป็นไร" ในบทสนทนานี้: ไม่ถามอีก (ปุ่มยังมี)

### 2. ลูกค้าขอ

ถือว่าขอ PDF เมื่อ:

- กดปุ่ม "ขอไฟล์ PDF" หรือพิมพ์คำที่ตรง `PDF_ASKED` — `pdf|ไฟล์|ใบเสนอ` (เช่น "ขอ PDF", "ขอไฟล์", "ขอใบเสนอ", "ส่งไฟล์ให้หน่อย")
- หรือ **ข้อความล่าสุดของบอทคือคำถาม PDF** และลูกค้าตอบรับ ("เอาครับ", "ได้", "ขอด้วย", "ส่งมาเลย")

ลำดับสำคัญ: เมื่อข้อความล่าสุดของบอทคือคำถาม PDF คำตอบรับทั่วไปนับเป็นการขอ PDF **ก่อน** `tookUpTheOffer`
(ซึ่งตอนนี้อ่าน "เอา/สนใจ" หลังข้อเสนอเป็นการสมัคร) — แต่คำที่ตรง `BUYS` ชัดๆ เช่น "สมัคร" ยังได้ฟอร์มสมัครเหมือนเดิม

"ขอตาราง" / "ขอดูตารางมูลค่า" ไม่ใช่การขอ PDF — ยังได้รูปตารางเหมือนเดิม

"ไม่เป็นไร" ตอบคำถาม PDF → บอทตอบสั้นๆ ว่ามีอะไรถามต่อได้เลย และจดว่าไม่ต้องถามอีก

### 3. บอทส่ง

ทำ PDF ของ **เบี้ยล่าสุดที่บอทเพิ่งคิดให้** (อายุ เพศ ทุน แผน ตรงกับการ์ด):

| ช่องทาง | ส่งอย่างไร |
|---|---|
| Messenger | "กำลังทำไฟล์ให้ครับ" แล้วแนบไฟล์ PDF เข้าแชท (attachment `file`) |
| หน้าเว็บ | ปุ่ม "ดาวน์โหลด PDF" ใต้คำตอบ ลิงก์ไป `/api/quote-pdf?...` |
| LINE | ข้อความพร้อมลิงก์ `/api/quote-pdf?...` (LINE ไม่ให้บอทแนบไฟล์) |

### 4. กรณีพิเศษ

- ขอ PDF ทั้งที่ยังไม่มีเบี้ยในบทสนทนา → บอทถามแบบประกัน อายุ เพศ ตามทางปกติ คิดเบี้ยก่อน แล้วถามเรื่อง PDF ตามข้อ 1
- เบี้ยล่าสุดเป็นแบบที่ไม่มี PDF (CI123, มะเร็ง, Legacy) → บอกว่าแบบนี้ยังไม่มีไฟล์ PDF แล้วส่งการ์ดรูปเดิมให้แทน

## ส่วนเทคนิค

### หน้าเว็บ 5 หน้าเปิดจากลิงก์แล้วกรอกค่าให้

Life Protect, Easy Protect, iShield, Life Treasure, PLB (`src/app/<plan>/page.tsx` + `src/components/<Plan>Calculator.tsx`)
อ่าน `searchParams` แล้วส่ง `initial` เข้า calculator — แบบเดียวกับที่ `/ihealthy-ultra` ทำอยู่ (`initialFrom` / `queryFrom` ใน `src/lib/ihealthy-link.ts`)

- ต่อแบบ: ฟังก์ชันคู่ `queryFor(input) → string` และ `initialFrom(query) → initial | undefined` ค่าที่ผิด/เกินช่วง = ไม่กรอก (หน้าเปิดค่าตั้งต้นเหมือนเดิม)
- ลิงก์ที่ไม่มี query = หน้าเหมือนวันนี้ทุกอย่าง
- ได้ผลพลอยได้: บอทส่งลิงก์ "เปิดดูในหน้าเว็บ" ที่ตรงกับเบี้ยได้

### ปุ่มกับเซิร์ฟเวอร์เตรียมหน้าด้วยโค้ดเดียวกัน

`PrintButton` (`src/components/sales/PrintButton.tsx`) ตอนนี้ประทับวันที่ ซ่อน sibling ของ `.print-table` แล้ว `window.print()`
แยกส่วนเตรียมออกเป็น `preparePrint(target): () => void` (คืนตัว restore) ใช้ทั้งในปุ่มและเปิดให้เซิร์ฟเวอร์เรียกผ่าน `window.__quotePdf.prepare()`
บนหน้าที่มี `.print-table` — PDF จึงออกมาเหมือนตัวแทนกดเอง

iHealthy (`IHealthyCalculator.tsx:623`) พิมพ์ทั้งหน้าด้วย print CSS (`@page ihu`) — ไม่มีขั้นเตรียม เซิร์ฟเวอร์พิมพ์ตรงๆ

หน้าบอกว่าพร้อมพิมพ์ด้วย attribute `data-pdf-ready` บน calculator เมื่อคิดเบี้ยจากค่า `initial` เสร็จ

### `/api/quote-pdf`

`GET /api/quote-pdf?page=<plan>&<ช่องของแบบนั้น>&v=<รุ่นตาราง>`

1. ตรวจ: `page` ∈ `lifeprotect | easyprotect | ishield | lifetreasure | plb | ihealthy-ultra`; รับเฉพาะ key ที่อนุญาตของแบบนั้น
   (แนวเดียวกับ `src/app/api/card/canonical.ts` — key แปลก/ซ้ำ = redirect ไป canonical); คิดเบี้ยด้วย engine ก่อน —
   คิดไม่ได้ (อายุเกิน ทุนต่ำกว่าขั้นต่ำ) = 400 ไม่เปิด Chrome
2. สร้าง URL **จาก `siteOrigin()` ของเราเท่านั้น** + path ของแบบ + query ที่ตรวจแล้ว — ไม่รับ URL จากผู้เรียก (กัน SSRF)
3. เปิด Chrome (`@sparticuz/chromium` + `puppeteer-core`), `emulateMediaType("print")`, รอ `[data-pdf-ready]` (timeout 45 วินาทีรวมทั้งงาน),
   เรียก `prepare()` ถ้ามี, `page.pdf({ printBackground: true, preferCSSPageSize: true })`
4. ตอบ `application/pdf`, `Content-Disposition: inline; filename="<แบบ>-<เพศ><อายุ>.pdf"`,
   cache แบบการ์ด (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`) — `v` ใน URL ทำให้เปลี่ยนรุ่นตารางแล้วไม่ได้ไฟล์เก่า
5. จำกัดต่อ IP ด้วย `limiter` (`src/lib/assistant/rate-limit.ts`) — เกิน = 429
6. `runtime = "nodejs"`, `maxDuration = 60`, หน่วยความจำพอสำหรับ Chrome (ตั้งใน `vercel.json` functions) —
   **ตรวจก่อนเขียนแผน**: ขนาด bundle ของ chromium ใต้เพดาน function ของ Vercel และ `outputFileTracingIncludes` ใน `next.config.ts`

ขั้น 3–4 อยู่ใน `src/lib/quote-pdf/render.ts` (`renderQuotePdf(url): Promise<Buffer>`) แยกจาก route เพื่อทดสอบด้วย Chrome ปลอมได้

### บอทจำว่าเบี้ยล่าสุดคืออะไร

- `Said` / `Reply` (`src/lib/assistant/common.ts`) ได้ช่อง `pdf?: string` — path `/api/quote-pdf?...` ของเบี้ยที่คำตอบนี้ให้
- ที่ตั้งค่า: ทุกที่ที่สร้างการ์ดของ 6 แบบ — `lifeprotect/answer.ts`, `ishield/answer.ts`, `copilot/price.ts` (`priceNamedPlan`: Easy Protect, Life Treasure, PLB),
  `ihealthy/quote.ts` — สร้างจาก input ตัวเดียวกับการ์ดด้วย `quotePdfPath(...)` ใน `src/lib/quote-pdf/link.ts`
- slots ทุกแบบได้ช่องร่วม `pdf?: { path: string; asked: string[]; declined?: true }` —
  `path` = เบี้ยล่าสุด, `asked` = แบบที่ถามเรื่อง PDF ไปแล้ว, `declined` = ตอบ "ไม่เป็นไร" แล้ว
- ทาง PDF ใน `answerAny` (`src/lib/assistant/dispatch.ts`) อยู่ก่อนทาง "สนใจสมัคร" (`wantsToBuy` / `tookUpTheOffer`)
  และก่อนทางที่ส่งต่อให้ brain ของแบบ — คำขอ PDF ไม่ต้องไปถึง brain
- หน้าเว็บ: `forTheEngine` (`src/lib/copilot/answer.ts`) รู้จัก `PDF_ASKED` ด้วย; `CopilotAnswer` ได้ `pdf?: string`; `Chat.tsx` แสดงปุ่ม "ดาวน์โหลด PDF"

### ส่งตามช่องทาง

- **Messenger** (`src/lib/facebook/client.ts`): ฟังก์ชันใหม่ `sendFile(psid, bytes, filename, replies?, pageId?)` —
  อัปโหลดตรงด้วย multipart (`message.attachment.type = "file"` + `filedata`) ไม่ส่ง URL ให้ Facebook มาดึงเอง
  (Chrome ครั้งแรกช้า Facebook อาจหมดเวลา) — `conversation.ts` ดึง bytes จาก `siteUrl(pdf)` (route ที่มี Chrome) แล้วส่ง;
  ไม่สำเร็จ → ส่งลิงก์หน้าเว็บที่กรอกค่าแล้ว แบบเดียวกับ `sendCard` / `CARD_UNSENT`
- **LINE** (`src/lib/line/conversation.ts`): ข้อความ + `siteUrl(pdf)`
- **หน้าเว็บ**: ลิงก์ตรง

## กรณีที่ผิดพลาด

| เหตุ | ผล |
|---|---|
| Chrome เปิดไม่ขึ้น / เกิน 45 วินาที | Messenger: ส่งลิงก์หน้าเว็บที่กรอกค่าแล้ว + "เปิดหน้านี้แล้วกด บันทึกเป็น PDF ได้เลยครับ"; เว็บ/LINE: หน้าแจ้งว่าทำไฟล์ไม่สำเร็จ พร้อมลิงก์เดียวกัน |
| ไม่มีเบี้ยในบทสนทนา / แบบที่ไม่มี PDF | ตามข้อ 4 ของ "สิ่งที่ลูกค้าเห็น" |
| รุ่นตารางเบี้ยเปลี่ยน | `v` ใน path เปลี่ยน → cache ไม่ค้าง (`cardVersionFor()` ตัวเดียวกับการ์ด) |
| ขอถี่เกิน | 429 → บอท: "รอสักครู่แล้วขอใหม่นะครับ" |
| ค่าที่ส่งมาคิดเบี้ยไม่ได้ | 400 ไม่เปิด Chrome |

## การทดสอบ

**vitest** (`tests/`) — Chrome และ Facebook ปลอมทั้งหมด, เบี้ยคิดจากตารางจริง

- `PDF_ASKED` จับ "ขอ PDF / ขอไฟล์ / ขอใบเสนอ / ส่งไฟล์ให้หน่อย"; ไม่จับ "ขอตาราง", "ขอดูตารางมูลค่า"
- ให้เบี้ยครั้งแรกของแบบ → มีคำถาม PDF + ปุ่ม; ครั้งที่สอง → ปุ่มอย่างเดียว; หลัง "ไม่เป็นไร" → ไม่ถาม
- หลังคำถาม PDF: "เอาครับ" → PDF ไม่ใช่ฟอร์มสมัคร; "สมัคร" → ฟอร์มสมัคร
- คำตอบที่ให้เบี้ยทั้ง 6 แบบมี `pdf` และค่าในนั้นตรงกับการ์ด
- `queryFor` ↔ `initialFrom` ไปกลับได้ครบทุกแบบ; ค่าผิดได้ `undefined`
- `/api/quote-pdf` ปฏิเสธ `page` อื่น, key แปลก, ค่าที่คิดเบี้ยไม่ได้; URL ที่เปิดขึ้นต้นด้วย `siteOrigin()` เสมอ
- Messenger: `sendFile` พัง → ส่งลิงก์แทน
- Messenger / LINE / เว็บ ได้ไฟล์ / ลิงก์ ตามตาราง

**ลองจริงในเครื่อง** — ทำ PDF ทั้ง 6 แบบจาก dev server แล้วเทียบกับไฟล์จากการกดปุ่มในเบราว์เซอร์เอง ต้องเหมือนกัน; ส่งไฟล์ให้เจ้าของดู

**หลัง deploy** — เจ้าของทักบอทใน Messenger และ LINE ด้วยบัญชีตัวเอง ขอเบี้ย แล้วกด "ขอไฟล์ PDF"
