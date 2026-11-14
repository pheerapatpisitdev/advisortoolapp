# คลังแอนิเมชัน — phase 3: uploads and the file queue

Owner, 2026-11-14 ("ก ทุกข้อ" on mockup https://claude.ai/artifact/5YukzCZyi5A2VpEWAk1sVx). Phase 2 (the menu) is
live at 37da465b. Answers: 1ก two picture kinds and a request sent as words, a link and screenshots, no video
files; 2ก approved files are used in คลิปตามโจทย์, which stays the owner's alone; 3ก the owner alone reviews;
4ก 20 uploads a person, 5 MB a file; 5ก a card says "จากสมาชิก", the sender's name is the owner's to see in the
queue; 6ก no AI summary.

## What a member sends

Three kinds, one table row each (`ins_library_uploads`):

| kind | Thai | files | after sending |
|---|---|---|---|
| `part` | ชิ้นส่วนภาพ | exactly 1 PNG | `wait` → the owner: `ok` or `no` |
| `style` | ภาพสไตล์ | exactly 1 JPEG or PNG | `wait` → `ok` or `no` |
| `ask` | คำขอชิ้นใหม่ | 0–3 JPEG or PNG screenshots | `wait` → `queue` or `closed` |

- Name (shown in the library; for `ask`, what is wanted): 1–60 characters. Note: 0–300 characters.
- A file is at most 5 MB. No SVG, no video. The page re-encodes what the member picked (PNG, JPEG or WebP) on a
  canvas, longest side at most 1600 px: `part` to PNG (transparency kept), the others to JPEG. This also drops
  the photo's metadata. The server takes only PNG for `part` and JPEG or PNG for the others, and checks the
  file's first bytes, not its declared type.
- `part` and `style` need the rights box ticked: "เป็นไฟล์ของฉันหรือได้รับอนุญาตให้ใช้ ไม่มีชื่อ หน้า หรือเอกสารของ
  ลูกค้า และไม่มีโลโก้บริษัทประกันที่ไม่ได้รับอนุญาต".
- 20 rows a person at a time, every kind and state counted; deleting one frees its place. The owner has no cap.
- The owner's own `part` and `style` are `ok` at once. The demo account cannot upload ("บัญชีทดลองอัปโหลดไม่ได้").
- Files live in the private `content-media` bucket under `library/`. They are read through a signed-in route:
  an `ok` file by anyone signed in, any other by its sender and the owner.

## The page (`/studio/library`)

Tabs: เลือกดู · **อัปโหลด** (new) · ของฉัน · **คิวตรวจ** (new, owner) · อยากได้มากสุด (owner, unchanged).

- **อัปโหลด** — the three kinds as cards to pick, the file box with the kind's hint, name, note, the rights box,
  "ส่งเข้าคลัง" ("ส่งคำขอ" for `ask`). Above: "คุณส่งแล้ว N จาก 20 ไฟล์ ไฟล์ใช้ร่วมได้หลังเจ้าของอนุมัติ"; for the
  owner "ไฟล์ของเจ้าของเข้าคลังทันที ไม่ต้องรอตรวจ". After sending, the member lands on ของฉัน.
- **ของฉัน** — gains "ไฟล์ที่ฉันส่ง (N)": thumbnail, name, kind, note, state, the reason when `no`, and ลบ.
  States in words: รออนุมัติ (`wait`, picture) · รอเจ้าของดู (`wait`, ask) · ใช้ร่วมแล้ว (`ok`) · ไม่ผ่าน (`no`) ·
  อยู่ในคิวทำ (`queue`) · ปิดคำขอ (`closed`).
- **คิวตรวจ** — "ไฟล์รออนุมัติ (N)": each with อนุมัติ and ไม่ผ่าน; ไม่ผ่าน opens the reasons, one picked, then
  "ยืนยันไม่ผ่าน". Reasons: อาจติดลิขสิทธิ์ · มีข้อมูลหรือหน้าลูกค้า · ภาพไม่ชัดหรือเล็กเกินไป · ไม่เกี่ยวกับงานประกัน.
  "คำขอชิ้นใหม่ (N)": รับเข้าคิวทำ or ปิดคำขอ. The sender's name is shown here only. The tab carries the count
  of rows waiting.
- **เลือกดู** — a type chip "ไฟล์จากสมาชิก"; `ok` parts and styles are cards (the picture, the name, tags for
  the kind and "จากสมาชิก") after the catalogue's cards and found by the search. "ใช้แบบนี้" opens
  คลิปตามโจทย์ with the file chosen; a viewer who cannot open that form sees "ยังไม่เปิดให้ใช้".
- Deleting is the sender's, in any state; the file leaves Storage. A clip already made keeps its own copy.
- When the uploads table cannot be read (trouble, or not migrated yet) the page still opens: the two new tabs
  and the new parts are left out and the page says so, as it does for the marks.

## Use in คลิปตามโจทย์

- **ภาพจากคลัง.** A scene's picture comes from one of three: ภาพ AI, อุปกรณ์, ภาพจากคลัง. `PromptScene` gains
  `asset?: string` (an upload id). The script editor's third chip opens the `ok` parts to pick from. An asset
  scene needs no picture words, is not painted and not charged (the price line counts it out, as a device).
  When the clip is made the part is laid in the middle of the frame on the ground of the clip's look and filed
  as that scene's picture, so it is pushed in like any picture and keeps its own colours. A scene carries a
  device or an asset, never both (the device wins). An asset that is no longer `ok` when the clip is made
  refuses the clip before anything is held: "ภาพจากคลังของฉากที่ N ใช้ไม่ได้แล้ว เลือกภาพใหม่". An asset scene has
  no "วาดใหม่".
- **ภาพสไตล์.** `PromptStoryInput` gains `styleRef?: string` (an `ok` style's id). The form shows, under the four
  picture styles, "ภาพอ้างอิงสไตล์จากคลัง (ไม่บังคับ)": none, or one of the `ok` styles. With one chosen the
  painter is sent that picture and told to follow its palette and line and not to copy its subject; the clip's
  words, subtitles and cards are still dressed by the picture style chosen above it. (The mockup drew it as a
  fifth chip in the style row; it is its own row because every clip still needs one of the four looks.)
- Links: `/studio/prompt-story?asset=<id>` (the editor's picker opens with that part first and says which was
  chosen) and `?ref=<id>` (the form opens with that style reference chosen). Unknown ids are ignored.

The rule that does not move: numbers on screen come from the app's data or what the agent typed. An uploaded
picture is a picture; nothing reads figures from it.

## Data

`ins_library_uploads (id uuid pk, agent_id uuid not null, kind text check in ('part','style','ask'), name text
not null, note text not null default '', paths text[] not null default '{}', state text not null default 'wait'
check in ('wait','ok','no','queue','closed'), reason text, decided_by uuid, decided_at timestamptz, created_at
timestamptz not null default now())`, indexes on `agent_id` and `state`, RLS on, service-role only.
`ins_member_delete` takes the member's uploads that are not `ok` and returns their paths under `library` for
Storage to clear; `ok` ones stay in the library. The migration is written in this phase and **applied to
production only on the owner's word**, before the push.

## Not in this phase

Opening คลิปตามโจทย์ to members; video files; an AI summary of a file; room admins reviewing; uploads used in
คลิปเล่าเรื่อง or วิดีโอนำเสนอ; new looks and AI picture styles (phase 4).

## Tests

Rules: kinds, lengths, types by first bytes, 5 MB, the rights box, the cap, the demo and owner cases. Store:
send, list mine, list shared, queue, decide (only from `wait`, only the right verdict for the kind, a reason
with `no`), delete (own only, files removed), who may read a file. Page: tabs by role, the table unreadable.
Prompt clip: an asset scene's check, price and picture count; an asset gone refuses; the style reference is
sent to the painter; links.
