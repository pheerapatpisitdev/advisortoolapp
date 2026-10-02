# ตัดต่อคลิปด้วย AI — ซับไทย, hook, ตัดช่วงเงียบ (เฟส B1) — design

วันที่: 2026-10-02 · เจ้าของอนุมัติในแชท (ส่วนที่ 1–4: "ok")

## เป้าหมาย

เฟส A ([2026-10-02-studio-reels-upload-design.md](2026-10-02-studio-reels-upload-design.md)) ให้ตัวแทนอัปโหลดคลิปที่ถ่ายเองแล้วลงเป็น Reel ได้ แต่คลิปขึ้นไปตามที่ถ่ายมา
เฟสนี้ให้ตัวแทน **ใส่ซับไทยและ hook บนคลิป และตัดช่วงเงียบ/ประโยคที่ไม่ต้องการออก** โดยแก้ผ่านข้อความ ดูพรีวิวสด แล้วกด "สร้างคลิป" ครั้งเดียว — ได้ไฟล์ Reel ที่ตัดต่อแล้ว

ถือว่าสำเร็จเมื่อ: คลิป `C1369.MP4` ของเจ้าของ (35 วิ, 256MB, Sony, ภาพเก็บแนวนอน rotation 90, เสียง LPCM) ผ่านหน้าตัดต่อแล้วได้ผลเทียบเท่าตัวอย่างที่ทำมือ 2026-10-02 (31.7 วิ, 1080×1920, ซับตรงปาก, hook 2.6 วิแรก, H.264/AAC) — render บนบริการภายนอก ไม่ใช่บนเครื่อง

สิ่งที่ได้จากตัวอย่างทำมือ (2026-10-02) และกำหนดดีไซน์นี้:
- คนพูดลื่นแทบไม่มีคำเติม/พูดผิดให้ตัด — สิ่งที่ตัดได้จริงคือ **ช่วงเงียบ** ซึ่งต้องวัดจากเสียง (ffmpeg `silencedetect` -24 dB, ≥0.25 วิ)
- เวลาที่ Gemini ให้คลาด ≥1 วิ — ต้องใช้ช่วงพูดจริงจากเสียงเป็นหลัก แล้วให้ข้อความตามช่วง
- ซับไทย: แบ่งตามเว้นวรรคของผู้พูดก่อน, ตัดคำด้วย `Intl.Segmenter` เฉพาะวลีที่ยาวเกิน, ห้ามขึ้นบรรทัดด้วย คะ/ค่ะ, รวมบรรทัดสั้นที่ขึ้นแวบเดียว
- satori + resvg (ตัววาดโปสเตอร์ของแอป) วาดภาษาไทยถูกต้อง → ซับและ hook เป็น PNG วางทับด้วย ffmpeg `overlay`

ภาพรวมเฟส B: **B1 (spec นี้)** ซับ + hook + ตัด · B2 ซูมเน้น · B3 คลังเพลง

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| ตัว render | สองตัว **สลับได้**: Rendi (FFmpeg ผ่าน API, ใส่ API key) และ AWS Lambda (ffmpeg ในบัญชี AWS ของเจ้าของ) — เจ้าของเลือกตัวหลัก, เปิด/ปิดการสำรองอีกตัว |
| ทำไมไม่ render บน Vercel | แพลน Hobby: function ละ ≤300 วิ และไม่มี ffmpeg; cron วันละครั้ง |
| วิธีแก้ | AI ขีดฆ่าประโยคที่ควรตัดไว้ก่อน ตัวแทนติ๊กคืน/ตัดเพิ่ม และแก้ข้อความซับได้ ตัดช่วงเงียบอัตโนมัติ (สวิตช์) |
| หน้าตาข้อความ | สไตล์สำเร็จ 4 แบบ (แก้ได้แค่ข้อความ ไม่จัดตำแหน่ง/ฟอนต์เอง) |
| ดูผลก่อน render | พรีวิวสดในเบราว์เซอร์ (ข้ามช่วงตัด + วางซับ/hook ด้วย HTML) — render จริงครั้งเดียวตอนกด "สร้างคลิป" |
| คิดเงิน | รอบ `ai-edit` 1 รอบตอนกดสร้างคลิป hold ฿3 คิดตามต้นทุนจริง × multiplier; ล้ม = ไม่คิด; ทีมงานไม่จ่าย; ค่าเตรียมคลิปเจ้าของรับ |
| ข้อเสนอของ AI | ไม่เรียก AI เพิ่ม — ขยายรอบถอดเสียง `ai-clip` ของเฟส A ให้คืน "ควรตัด" ต่อประโยค + hook ที่เสนอ |
| ลงเพจ | มีคลิปที่ตัดต่อแล้ว → Reel ใช้ไฟล์นั้น; แก้ใบสั่งหลังสร้าง → ถามก่อนลงว่าจะลงคลิปล่าสุดหรือสร้างใหม่ |
| Reel ที่ตั้งเวลา/ลงแล้ว | หน้าตัดต่อล็อก (เหมือนกติกาแคปชันเฟส A) |
| ไม่ทำในรอบนี้ | ซูม (B2), เพลง (B3), ไทม์ไลน์ลากเอง, ตำแหน่ง/ฟอนต์อิสระ, ภาพปก, คลิป motion poster |

## สิ่งที่ผู้ใช้เห็น

- **ClipEditor** มีปุ่ม **"ตัดต่อ"** เมื่อถอดเสียงแล้ว (และไฟล์ไม่หมดอายุ, ยังไม่ได้ตั้งเวลา/ลงเพจ)
- เปิดครั้งแรก: "กำลังเตรียมคลิป…" (~30–60 วิ) — ทำไฟล์พรีวิว 720p + หาช่วงเงียบ
- **หน้าตัดต่อ** (มือถือเรียงลง, จอใหญ่สองคอลัมน์):
  1. **พรีวิว 9:16** — เล่นไฟล์พรีวิว ข้ามช่วงตัด ซับ/hook ตามสไตล์
  2. **สไตล์** 4 แบบให้แตะ: กล่องดำ · ตัวขาวขอบดำ · เน้นเหลือง · สีของ Page
  3. **hook** — ข้อความที่ AI เสนอ แก้ได้ ≤28 ตัวอักษร + บรรทัดเล็กด้านบน (ไม่บังคับ, ≤24) · ขึ้น 2.6 วิแรก
  4. **รายการประโยค** — ช่องเก็บ/ตัด (ที่ AI แนะนำตัดขีดฆ่าไว้พร้อมเหตุผล) · ซับแก้คำผิดได้ · กดเวลาแล้วพรีวิวกระโดดไป
  5. **สวิตช์ "ตัดช่วงเงียบอัตโนมัติ"** (เปิดไว้)
  6. **"สร้างคลิป"** — ความคืบหน้า → พรีวิวเปลี่ยนเป็นไฟล์จริง · ปุ่ม "กลับไปใช้คลิปต้นฉบับ"
- ป้าย "ยังไม่ได้สร้างใหม่" เมื่อใบสั่งเปลี่ยนหลัง render
- ปิดหน้าระหว่าง render ได้ — งานทำต่อ เปิดกลับมาเห็นผล

## การทำงาน

### ข้อมูล — `ins_content.output.video.edit` (ไม่มีตารางใหม่)

```ts
edit?: {
  proxyPath?: string;                 // 720p, rotation applied, AAC — for the preview only
  silences?: [number, number][];      // from the prepare job
  cut: number[];                      // transcript segment indexes left out (AI suggestion, then the agent)
  trimSilence: boolean;
  subs: { start: number; end: number; text: string }[];   // source-clip seconds; text editable
  hook: { top?: string; main: string };
  style: "box" | "outline" | "yellow" | "page";
  rev: string;                        // bumped on every change; renderedRev says which edit a file is
  job?: { kind: "prepare" | "render"; engine: "rendi" | "lambda"; id: string; startedAt: string; token: string } | null;
  renderedPath?: string; renderedAt?: string; renderedRev?: string;
  error?: string;
}
```

`Segment` ของเฟส A เพิ่ม `cut?: boolean; why?: string` (จากรอบถอดเสียง) และ `ClipVideo` เพิ่ม `hookSuggestion?: { top?: string; main: string }`
ไฟล์พรีวิว/ไฟล์ตัดต่อ/PNG อยู่ใน bucket `content-video` โฟลเดอร์ชิ้นงานเดียวกัน (`<piece>/<uuid>.<ext>`; PNG ภายใต้ `<piece>/overlays/<rev>/…`) — bucket ต้องรับ `image/png` และ `text/plain` เพิ่ม

### ตัว render — `src/lib/video/engines/`

```ts
interface FfmpegJob {
  inputs: { name: string; url: string }[];       // signed URLs
  args: string[];                                 // ffmpeg args with {in:name} / {out:name} placeholders
  outputs: { name: string; ext: string; contentType: string }[];
}
interface RenderEngine {
  name: "rendi" | "lambda";
  submit(job: FfmpegJob, callbackUrl: string): Promise<{ id: string }>;
  status(id: string): Promise<{ state: "queued" | "running" | "done" | "failed"; outputs?: Record<string, string>; error?: string }>;
}
```

- **Rendi** — API ของ Rendi (submit + poll; ไฟล์ผลอยู่บน Rendi) → server ดึงมาเก็บใน bucket ของเรา
- **Lambda** — function container ที่มี ffmpeg ในบัญชี AWS ของเจ้าของ; เรียกแบบ async; Lambda อัปผลตรงเข้า Supabase ผ่าน signed upload URL แล้ว POST webhook
- **คีย์**: ที่เก็บคีย์เข้ารหัสเดิม (`ins_api_keys`, `ins_get_api_keys`) — provider `rendi`, `aws` (ต้องขยาย constraint ของรายชื่อ provider ถ้ามี) · การตั้งค่าเครื่องยนต์หลัก/สำรองในหน้า admin
- **สำรอง**: submit ตัวหลักไม่ได้ → submit อีกตัวทันที; งานล้ม → "ลองอีกครั้ง" ใช้อีกตัว
- **เก็บผล**: webhook `/api/content-video/job` (token ลงลายเซ็นต่องาน) + หน้าตัดต่อถามสถานะทุก 3 วิ — ใครเห็นเสร็จก่อนเก็บ; เก็บครั้งเดียว (guard ด้วย job id + `edit.rev`); ค้างเกิน 15 นาที = ล้ม

### งาน prepare

จากไฟล์ต้นฉบับ: ไฟล์พรีวิว 720p (`scale=-2:1280`, หมุนตาม rotation, H.264 + AAC) และ `silencedetect=noise=-24dB:d=0.25` เขียนลงไฟล์ข้อความ (`ametadata=mode=print:file=…`) → server อ่านแล้วเก็บ `edit.silences`
สร้าง `edit` เริ่มต้น: `cut` จาก `segment.cut`, `subs` จากไทม์ไลน์ (ข้างล่าง), `hook` จาก `hookSuggestion` (ไม่มี → บรรทัดแรกของแคปชัน ตัดที่ 28), `style: "box"`, `trimSilence: true`

### ไทม์ไลน์ — `src/lib/video/timeline.ts` (ฟังก์ชันล้วน)

- **ช่วงพูด** = ส่วนกลับของ `silences` · ขอบประโยคจาก Gemini ขยับไปขอบเงียบที่ใกล้สุดภายใน 1.2 วิ
- **ช่วงเก็บ** = ทั้งคลิป − ประโยคใน `cut` − ช่วงเงียบ ≥0.25 วิ (ถ้า `trimSilence`) โดยเว้นขอบ 0.1 วิ · ช่วงชิดกันรวมกัน
- **ซับ** = ข้อความต่อช่วงพูด → แบ่งบรรทัดตามกติกาภาษาไทยข้างบน (≤22 ตัวอักษร) → แบ่งเวลาตามสัดส่วนตัวอักษร → แปลงเป็นเวลาในคลิปที่ตัด (`mapTime`)

### สไตล์ — `src/lib/video/styles.ts`

นิยามครั้งเดียว ใช้ทั้งพรีวิว (CSS) และ render (element ของ satori): ฟอนต์ IBM Plex Sans Thai (ไฟล์เดิมใน `src/app/api/card/`)
"สีของ Page" = สีหลักของธีมโปสเตอร์ที่ Page ใช้ล่าสุด (`recentLooks`) ไม่มี → navy

### render

1. ตรวจ hook ด้วย `captionFlags` — policy severity block → ไม่ render; ซับที่แก้ → `findWords` เตือน
2. วาด PNG ซับ + hook (satori/resvg ฝั่ง server) → เก็บใน bucket → signed URL
3. คำสั่ง ffmpeg (ฟังก์ชันล้วน `src/lib/video/command.ts`): ต้นฉบับคุณภาพเต็ม → `split/asplit` → `trim/atrim` ตามช่วงเก็บ, `afade` 15–20 ms ที่รอยต่อ → `concat` → `scale=1080:1920,fps=30,setsar=1` → `overlay` ตาม `enable='between(t,a,b)'` (hook y≈230, ซับ y≈1450) → libx264 crf 20 high + AAC 160k 48 kHz + faststart
4. submit → เก็บผลเป็น `renderedPath` + `renderedRev = edit.rev`
5. รอบ `ai-edit` (hold ฿3) — ต้นทุนประเมิน: Rendi ตาม GB (เข้า+ออก), Lambda ตาม GB-วินาที — `meterCost` แล้ว `payRound` เดิม · รอบ render ทั้งหมด (วาด PNG + submit) อยู่ใน function เดียว ≤300 วิ; การรอผลไม่อยู่ใน function

### ลงเพจ (แก้ publish-flow ของเฟส A)

`send()` ใช้ `edit.renderedPath` ถ้ามี แทน `video.path` · `clear()` คืน `confirmStale` เมื่อ `edit.rev !== renderedRev` (ยืนยันก่อนลง) · ล็อกการแก้ `edit` เมื่อ `onPage`

### เก็บกวาด (แก้ `clip-sweep.ts`)

ไฟล์ที่ชิ้นงานอ้างถึง = `video.path`, `edit.proxyPath`, `edit.renderedPath`, PNG ของ `edit.rev` ล่าสุด — ที่เหลือในโฟลเดอร์ชิ้นงานเก่ากว่า 24 ชม. = กำพร้า · หมดอายุพร้อมกันทั้งชุดตามกติกาเดิม

## ข้อผิดพลาด

| เกิดอะไร | ระบบทำอะไร |
|---|---|
| prepare ล้ม | "ลองอีกครั้ง" (อีกตัว); ระหว่างนั้นลงเพจด้วยต้นฉบับได้ |
| submit ตัวหลักไม่ได้ | ส่งอีกตัว; ไม่ได้ทั้งคู่ → "ระบบตัดต่อขัดข้อง ลองใหม่ภายหลัง" ไม่คิดเงิน |
| render ล้ม / ค้าง >15 นาที | คืน hold; ใบสั่งอยู่; "ลองอีกครั้ง" |
| ปิดหน้าระหว่าง render | webhook เก็บผล |
| hook ผิดกฎ block | ไม่ render บอกคำที่ผิด |
| แก้ใบสั่งหลัง render | ป้าย "ยังไม่ได้สร้างใหม่" + ถามก่อนลงเพจ |
| ตั้งเวลา/ลงเพจแล้ว | หน้าตัดต่อล็อก |
| ไฟล์หมดอายุ | ไฟล์พรีวิว/ตัดต่อหมดพร้อมต้นฉบับ |

## ทดสอบ

vitest: ไทม์ไลน์ (ขยับขอบ, ช่วงเก็บ, mapTime, แบ่งบรรทัดซับไทย — ใช้ข้อความ/ช่วงเงียบจริงของ `C1369.MP4` เป็น fixture) · ตัวสร้างคำสั่ง ffmpeg (เทียบกับคำสั่งที่ใช้ได้จริงในตัวอย่าง) · engine adapters (API จำลอง, สลับตัวสำรอง, ลายเซ็น webhook, เก็บผลครั้งเดียว) · sweep ไม่ลบไฟล์ที่ edit อ้างถึง · รอบ `ai-edit` คิด/ไม่คิดเงิน · publish-flow ใช้ไฟล์ตัดต่อและ `confirmStale`

ทดสอบของจริง: `C1369.MP4` ผ่าน Rendi แพลนฟรี — เทียบผลกับตัวอย่างทำมือ; ยืนยันว่ารับไฟล์ 256MB และ render ทัน 1 นาทีของแพลนฟรี (ไม่ทัน → เจ้าของตัดสินใจแพลน Pro $25/เดือน)

## ต้องเช็กก่อน (ขั้นแรกของ plan)

1. Rendi API: endpoint/รูปแบบคำสั่ง (`filter_complex` + `overlay=enable=between`), เพดานขนาดไฟล์เข้า, เวลารันแพลนฟรี, อายุไฟล์ผล, webhook
2. ffmpeg ของ Rendi รองรับ `silencedetect` + `ametadata=print:file` และ autorotate
3. รายชื่อ provider ของ `ins_api_keys` มี constraint ไหม (เพิ่ม `rendi`, `aws`)
4. Lambda: ขนาด container/ffmpeg build, `/tmp` 10GB พอไฟล์ 300MB, เวลารันสูงสุด 15 นาที

## สิ่งที่เจ้าของต้องทำ

- สมัคร Rendi แล้วใส่ API key ในหน้า admin
- Lambda (ทำทีหลังได้): บัญชี AWS + เชื่อม AWS connector — จนกว่าจะพร้อม ระบบใช้ Rendi ตัวเดียว
