# คลิปที่ตัวแทนถ่ายเอง → Reel บนเพจ (เฟส A) — design

วันที่: 2026-10-02 · เจ้าของอนุมัติในแชท (ส่วนที่ 1–4: "ตรงแล้ว" / "ok"; ส่วนที่ 5 รอดูใน spec นี้)

## เป้าหมาย

Organic Studio ตอนนี้ทำคลิปได้แค่ตัวหนังสือ (สคริปต์แบบ `script`) และลงเพจได้แค่รูปเดียว ([publish.ts](../../../src/lib/facebook/publish.ts) `postPhoto`)
ตัวแทนที่ถ่ายคลิปเองต้องออกไปใช้แอปอื่นตัด ใส่แคปชัน และโพสต์ เฟสนี้ให้ตัวแทน **อัปโหลดคลิปที่ถ่ายแล้ว → ได้แคปชัน + ตรวจคำ → โพสต์/ตั้งเวลาเป็น Reel** ได้ใน Studio

ถือว่าสำเร็จเมื่อ: ตัวแทนที่ถ่ายเองลง Reel ได้จาก Studio โดยไม่ต้องใช้แอปตัดต่ออื่น และคลิปลากลงปฏิทินได้เหมือนโพสต์รูป

ภาพรวมทั้งงานวิดีโอ (เจ้าของตกลง 2026-10-02):
- **A (spec นี้)** อัปโหลด → Reel
- **B** ตัดต่อด้วย AI (spec แยก): ตัดช่วงเงียบ/เอ่อ/พูดซ้ำแบบแก้ผ่านข้อความ, ซับไทยฝัง, hook ต้นคลิป, ซูม, เพลงจากคลังที่เจ้าของคัด — render ด้วย ffmpeg บน AWS Lambda; ต่อมาคลิป motion poster + เสียงพากย์สำหรับคนไม่ถ่ายและเพจทีม
- **C** ตัดไฮไลต์จากฟุตเทจยาว

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| ถ่ายยังไง | อัปโหลดอย่างเดียว — ไม่มีกล้อง/teleprompter ในเบราว์เซอร์ ตัวแทนเปิดสคริปต์จาก Studio ไว้อีกจอได้ |
| คลิปผูกกับอะไร | ได้ทั้งสองแบบ: แนบเข้าชิ้นสคริปต์ หรืออัปโหลดลอยๆ เป็นชิ้นใหม่ `format = 'clip'` |
| เกณฑ์ไฟล์ | mp4/mov · 3–90 วินาที · แนวตั้ง · ≤ 300MB |
| ทางของไฟล์ | เบราว์เซอร์ → Supabase Storage ตรง (signed upload URL) → Facebook ดึงเองจาก signed URL; ไฟล์ไม่ผ่าน Vercel |
| ถอดเสียง + แคปชัน | Gemini Flash รอบเดียว ได้ข้อความพูดแบ่งช่วงพร้อมเวลา + แคปชันร่าง |
| ตรวจเสียงพูด | **เตือนเท่านั้น** บอกวินาที ไม่บล็อก |
| ตรวจแคปชัน | กติกาเดียวกับโพสต์ (คำต้องห้าม, ตัวเลขเบี้ยขอยืนยัน, กฎโฆษณา block) |
| คิดเงิน | รอบใหม่ `ai-clip` hold ฿3 ผ่าน `payRound` เดิม; อัปโหลด/โพสต์ไม่คิด; ทีมงานไม่จ่าย |
| อายุไฟล์ | เก็บจนโพสต์ขึ้นจริง + 48 ชม. (เพราะย้ายเวลา = ส่งไฟล์ใหม่); ร่างไม่เคยตั้งเวลา ค้างเกิน 60 วัน ลบไฟล์ |
| ไม่ทำในเฟสนี้ | ตัดต่อ, ซับฝัง, เพลง, ภาพปกเลือกเอง, คลิปที่ระบบสร้าง, TikTok/YouTube |

## สิ่งที่ผู้ใช้เห็น

- **การ์ดสคริปต์** มีปุ่ม "แนบคลิปที่ถ่ายแล้ว" → ชิ้นเดิมกลายเป็นชิ้นที่ลงเป็น Reel ได้ (ไม่สร้างชิ้นซ้ำ)
- **ฟอร์มใหม่ "คลิป"** ข้างฟอร์มเดิม 5 แบบ: เลือกไฟล์ + พิมพ์สั้นๆ ว่าคลิปพูดเรื่องอะไร (ไม่บังคับ) → ชิ้นใหม่ของเพจที่เปิดอยู่ (ตาม `projectPage()`)
- **ตรวจไฟล์ก่อนเริ่ม** ในเบราว์เซอร์ (อ่าน `duration`, `videoWidth`, `videoHeight` จาก `<video>`): ไม่ผ่าน → บอกเหตุผลภาษาไทย ไม่มีอะไรไปถึง server
- **ระหว่างอัปโหลด** แถบความคืบหน้า; หลุด → ต่อได้ถ้า resumable ใช้ได้ (ดู "ต้องเช็กก่อน") ไม่งั้นปุ่มลองใหม่
- **หลังอัปโหลด** การ์ดมี: ตัวเล่นคลิป · แคปชันแก้ได้ · คำเตือน (เสียงพูดบอกวินาที กดแล้วเล่นจากตรงนั้น + หมายเหตุ "ระบบถอดเสียงอาจได้ยินผิด") · ข้อความที่ถอดได้ (พับไว้)
- **ลงเพจ** `PublishPanel` เดิม: ลงเลย / ตั้งเวลา; ปฏิทินลากวางเหมือนโพสต์ การ์ดมีไอคอน ▶; "ดูบนเพจ" ชี้ `facebook.com/reel/{video_id}`
- **ไฟล์หมดอายุ** การ์ดบอก "ไฟล์คลิปหมดอายุ — แนบใหม่ได้" ปุ่มลงเพจปิด; แคปชันและข้อความที่ถอดได้ยังอยู่

## การทำงาน

### ข้อมูล — `supabase/migrations/20261002_content_video.sql`

```sql
alter table public.ins_content drop constraint ins_content_format_check;
alter table public.ins_content add constraint ins_content_format_check
  check (format in ('post', 'script', 'ad', 'clip'));

-- Private: the browser uploads with a signed upload URL the server hands out; Facebook and
-- Gemini read through short signed URLs. Files are "<piece id>/<file id>.<ext>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-video', 'content-video', false, 314572800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
```

ไม่มีตารางใหม่ — คลิปอยู่ใน `ins_content.output.video` ([output.ts](../../../src/lib/content/output.ts) `ContentOutput`):

```ts
video?: {
  path: string;            // "<piece id>/<file id>.<ext>" in content-video
  expired?: boolean;       // the sweep removed the file; the rest stays
  durationSec: number; width: number; height: number; sizeBytes: number;
  uploadedAt: string;
  brief?: string;          // what the agent typed for a standalone clip
  transcript?: { start: number; end: number; text: string }[];  // absent = not transcribed (yet / failed)
  caption: string;         // the Reel's description; the agent edits it
  spokenFlags?: SpokenFlag[];  // warnings from the transcript, each with its second
}
```

`Format` ([prompt.ts:16](../../../src/lib/content/prompt.ts)) เพิ่ม `"clip"` · ชิ้นไหน "ลงเป็น Reel" = มี `output.video` (ไม่ว่า format อะไร)
ชิ้น `clip` ใส่ช่องบังคับของ `ContentOutput` เป็นค่าว่าง (`hooks: []`, `body: ""`, …) ยกเว้น `disclaimer` ตามแบบประกันของชิ้น (ถ้ามี)
คำบรรยาย Reel = `video.caption` + `footer({ hooks: [], body: video.caption, closing: "", disclaimer })` — footer เดิม ([output.ts:24](../../../src/lib/content/output.ts)) จึงเติมบรรทัดภาษี/บริษัทประกันตามแคปชันเหมือนโพสต์

**ต้องทำเองที่ Dashboard (เจ้าของ):** Storage → Settings → global file size limit ≥ 300MB (ค่าเริ่มต้น 50MB จำกัดทุก bucket — แก้ผ่าน SQL ไม่ได้)

### อัปโหลด — `src/app/studio/clip.ts` (server actions) + `src/lib/content/clip-store.ts`

1. `startClipUpload({ pieceId?, pageId?, name, sizeBytes, durationSec, width, height, mime })`
   - ตรวจเกณฑ์ไฟล์อีกรอบฝั่ง server (ไม่เชื่อเบราว์เซอร์อย่างเดียว)
   - แนบเข้าชิ้น: `getContent` (ผ่าน scope เดิม) · ต้องเป็น `script` หรือ `clip` · ต้องไม่ `scheduled`/`posting`/`published`
   - อัปโหลดลอยๆ: สร้างชิ้น `clip` ของเพจจาก `projectPage()`
   - คืน `{ pieceId, path, signedUploadUrl }` จาก `createSignedUploadUrl` (อายุ 2 ชม.)
2. เบราว์เซอร์อัปโหลดตรงไป Supabase
3. `finishClipUpload({ pieceId, path })`
   - ตรวจว่าไฟล์อยู่จริงและขนาดตรง (`storage.list` / `info`) — ไม่ตรง → ไม่บันทึก บอกให้อัปโหลดใหม่
   - เขียน `output.video` (ผ่าน `saveOutput` + `rev` เดิม); มีไฟล์เก่า → ลบไฟล์เก่า
   - เริ่มรอบถอดเสียง (ข้างล่าง)

### ถอดเสียง + แคปชัน — `src/lib/content/clip-transcribe.ts`

- รอบ `ai-clip`: เพิ่มใน `AI_ROUNDS` ([quota.ts:27](../../../src/lib/auth/quota.ts)) และ `ROUND_HOLD_THB` ([money.ts:39](../../../src/lib/wallet/money.ts)) = 3
- เรียก Gemini Flash ครั้งเดียว `media_resolution` ต่ำ (ต้องการเสียงเป็นหลัก) ขอ JSON `{ segments: [{start,end,text}], caption }`
  - context: แนบเข้าสคริปต์ → บทของสคริปต์ + แบบประกันของชิ้น (`planHref`); ลอยๆ → `brief`
  - กติกาแคปชันใช้ของ prompt โพสต์เดิม (น้ำเสียง, ห้ามคำต้องห้าม, disclaimer ผ่าน `footer`)
- ส่งคลิปให้ Gemini: signed URL ถ้า Gemini รับได้ ไม่งั้น Files API สตรีมจาก Supabase (ไม่โหลดทั้งไฟล์ลงหน่วยความจำ)
- ตัวแปลงผล: JSON เสีย / ช่วงไม่เรียง / เวลาเกินความยาวคลิป → ทิ้งช่วงที่เสีย ถ้าไม่เหลือเลย = ล้มเหลว
- ต้นทุนวัดผ่าน `meterCost` เดิม — คลิป 90 วินาทีราว ฿0.3–0.6

### การตรวจ — ใช้ตัวตรวจเดิม

| ข้อความ | `findWords` (คำต้องห้าม) | ตัวเลขเบี้ย (`claimedNumbers`/`strayNumbers`) | `checkPolicy` |
|---|---|---|---|
| แคปชัน (`video.caption`) | เหมือนโพสต์ | ขอยืนยันก่อนลง เหมือนโพสต์ | severity block = บล็อก |
| เสียงพูด (`transcript`) | เตือน | เตือน | เตือน |

- คำเตือนจากเสียงพูดเก็บใน `video.spokenFlags` พร้อมวินาทีของช่วงที่เจอ
- `clear()` ([publish-flow.ts:72](../../../src/lib/content/publish-flow.ts)) สำหรับชิ้นที่มี video: ตรวจแคปชันตามกติกาโพสต์; ถ้ามี `spokenFlags` หรือยังไม่ได้ถอดเสียง → คืน `confirmSpoken` ให้ปุ่มขอกดยืนยัน (แบบเดียวกับ `confirmNumbers`) แต่ไม่บล็อก
- ถอดเสียงไม่สำเร็จ: ไม่คิดเงิน · ปุ่ม "ถอดเสียงอีกครั้ง" · เขียนแคปชันเองได้ · ลงได้ด้วยการยืนยัน "ยังไม่ได้ตรวจเสียงพูด"

### ลงเพจ — Reels API

`postReel()` ใน [publish.ts](../../../src/lib/facebook/publish.ts) — 3 ขั้น:
1. `POST /{page}/video_reels` `upload_phase=start` → `video_id`
2. `POST https://rupload.facebook.com/video-upload/v23.0/{video_id}` header `Authorization: OAuth <page token>`, `file_url: <signed URL อายุ 1 ชม.>`
3. `POST /{page}/video_reels` `upload_phase=finish`, `video_id`, `description`, `video_state=PUBLISHED` หรือ `SCHEDULED` + `scheduled_publish_time`

คืน `Posted` แบบเดียวกับ `postPhoto` (id = `video_id`) · ข้อผิดพลาดผ่าน `explain()` / `PublishError.unsure` เดิม

`clear()`: เปลี่ยน `item.format !== "post"` เป็น "ไม่ใช่ post และไม่มี `output.video`" · มี video แต่ `expired` → "ไฟล์คลิปหมดอายุ — แนบใหม่ก่อนลง"

`send()` จุดเดียวที่เปลี่ยน: ชิ้นที่มี `output.video` ข้ามการวาดโปสเตอร์และเรียก `postReel` (คำบรรยายตามข้างบน) แทน `postPhoto`
ที่เหลือ (claim, `recordPublishIf`, `POSSIBLY_POSTED`, audit, ย้ายไปใช้จริง) ไม่เปลี่ยน

- **ย้ายเวลา** `move()` เดิม = ส่งใหม่แล้วลบของเก่า → ส่งไฟล์ซ้ำจาก bucket (ไฟล์ยังอยู่ตามกติกาอายุไฟล์)
- **ถอน** `deletePost(video_id)` เดิม
- **ปฏิทิน** `scheduleOnDay` / `scheduleNextOpen` / `scheduleAt` ผ่าน `publish()` อยู่แล้ว ไม่ต้องแก้ เพิ่มแค่ไอคอน ▶ ใน `CalendarBoard`/`PlanBoard`
- **ตรวจหลังลง** `postState()` เพิ่มทางวิดีโอ: `GET /{video_id}?fields=status,published` — `status.video_status = "error"` → `failed` "Facebook ประมวลผลคลิปไม่ผ่าน — ลองแนบไฟล์ใหม่"
- **สิทธิ์** `pages_manage_posts` เดิม (ยืนยันกับเพจจริงตอนทดสอบ)

### เก็บกวาด — `src/app/api/content-video/sweep/route.ts` + cron รายวันใน `vercel.json`

ลบไฟล์ใน `content-video` เมื่อ:
1. ชิ้นลงแล้ว (`published`) และพ้น `VERIFY_WINDOW_MS` (48 ชม.) จาก `publish.at`
2. ชิ้นถูกลบถาวร (ไม่มีแถวแล้ว)
3. ไม่มีชิ้นไหนอ้างถึง และเก่ากว่า 24 ชม. (อัปโหลดค้าง/ไฟล์ที่ถูกแทน)
4. ชิ้นยังไม่เคยตั้งเวลา (`publish` null / `failed` / `cancelled`) และ `uploadedAt` เก่ากว่า 60 วัน → ตั้ง `video.expired = true`

ไม่แตะไฟล์ของชิ้นที่ `scheduled` หรือ `posting` เด็ดขาด · ป้องกันด้วย [cron-auth.ts](../../../src/lib/cron-auth.ts) แบบ cron เดิม

## ข้อผิดพลาด

| เกิดอะไร | ระบบทำอะไร |
|---|---|
| ไฟล์ไม่ผ่านเกณฑ์ | บอกเหตุผลก่อนอัปโหลด |
| อัปโหลดหลุด | resumable ต่อได้ / ไม่งั้นลองใหม่; ไฟล์ค้างให้ sweep ลบ |
| `finishClipUpload` หาไฟล์ไม่เจอ/ขนาดไม่ตรง | ไม่บันทึก บอกให้อัปโหลดใหม่ |
| ถอดเสียงล้มเหลว | ไม่คิดเงิน ชิ้นยังใช้ได้ ปุ่มลองใหม่ |
| Facebook ปฏิเสธพร้อมเหตุผล | `failed` + `explain()` กดใหม่ได้ |
| timeout / ไม่แน่ใจว่าขึ้นไปแล้ว | `POSSIBLY_POSTED` เดิม |
| Facebook ประมวลผลคลิปไม่ผ่าน | ตอนตรวจหลังลง → `failed` แนบไฟล์ใหม่ |
| ไฟล์หมดอายุ | ปุ่มลงเพจปิด แนบใหม่ได้ |

## ทดสอบ

vitest ใน `tests/content`, `tests/facebook` (mock แบบเทสต์เดิม):
- `postReel`: ลงเลย · ตั้งเวลา · Graph ปฏิเสธ · timeout แบบไม่แน่ใจ
- `clear()`: `clip` และสคริปต์ที่มี video ผ่าน · สคริปต์ไม่มี video ถูกปฏิเสธ · `expired` ถูกปฏิเสธ · `spokenFlags` ขอยืนยันไม่บล็อก · แคปชันผิดกฎ block บล็อก
- `send()`: ชิ้นคลิปไม่วาดโปสเตอร์และเรียก `postReel`; ชิ้นโพสต์เหมือนเดิม
- ตัวแปลงผล Gemini: JSON เสีย · ช่วงไม่เรียง · เวลาเกินคลิป
- `startClipUpload` / `finishClipUpload`: scope/เพจ · เกณฑ์ไฟล์ฝั่ง server · แนบทับชิ้นที่ตั้งเวลาแล้วถูกปฏิเสธ · ไฟล์ไม่มีจริง
- sweep: แต่ละเงื่อนไขลบเฉพาะที่ควรลบ · ไม่แตะ `scheduled`/`posting`
- รอบ `ai-clip`: คิดตามต้นทุน · ล้มเหลวไม่คิด

ทดสอบกับของจริงบนเพจทดสอบก่อนปล่อย: คลิป mp4 จาก iPhone และ Android ~60 วินาที → ลงเลย (Reel ขึ้นจริง) · ตั้งเวลา · ลากย้ายวัน · ถอน · คลิปที่พูด "การันตี" → เตือนถูกวินาที

## ต้องเช็กก่อน (ขั้นแรกของ plan)

1. Supabase resumable upload (TUS) ใช้กับ signed upload URL ได้ไหม — ไม่ได้ → อัปโหลดธรรมดา + ลองใหม่
2. Gemini รับวิดีโอทาง signed URL ได้ไหม — ไม่ได้ → Files API
3. แก้ `scheduled_publish_time` ของ Reel ที่ตั้งไว้ได้ตรงๆ ไหม — ได้ → `move()` ของคลิปไม่ต้องส่งไฟล์ซ้ำ
4. ช่วงตั้งเวลาของ Reels เท่ากับโพสต์รูป (15 นาที – 30 วัน) ไหม
5. Vercel function ที่เรียก `postReel` (ขั้น rupload รอ Facebook ดึงไฟล์ 300MB) อยู่ใน `maxDuration` ไหม
