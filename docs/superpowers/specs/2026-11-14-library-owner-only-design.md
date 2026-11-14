# คลังแอนิเมชัน — the owner's alone

Owner, 2026-11-14: "ตัวคลัง ให้แสดงและจัดการเฉพาะ ผมผู้ดูแลคนเดียวเท่านั้น", then "ก ตัดส่วนสมาชิก" on mockup
https://claude.ai/artifact/5M3orXAdEViBYn7qSGALXr. Production holds no uploads and no marks, so nothing moves and no
migration is needed. The members' code paths stay in the codebase but are unreachable; nothing is deleted from the
database schema.

"The owner" is `can(viewer, "owner")` (src/lib/auth/access.ts), which includes the Super Admin and excludes the demo
account, assistants and agents.

## Who reaches what

- **Menu**: `/studio/library` (คลังแอนิเมชัน) is listed only for the owner, the way `/studio/prompt-story` is
  (`who?.owner`, src/lib/shell/menu.ts).
- **Page**: anyone else who opens `/studio/library` sees only "ฟังก์ชันนี้ปิดใช้งานอยู่ ทำคลิปได้ที่ คลิปเล่าเรื่อง หรือ
  วิดีโอนำเสนอ" with the two links — the same line and look as `/studio/prompt-story` (reuse `PROMPT_STORY_CLOSED`'s
  pattern; give the library its own constant if the wording must not be tied to prompt-story). No marks or uploads are read
  for them.
- **Server**: every library action and the upload route refuse a non-owner, whatever the page shows:
  `toggleLibraryMark`, `decideLibraryUpload`, `removeLibraryUpload`, `withdrawLibraryUpload` and the new actions below
  answer `{ ok: false, error: "ฟังก์ชันนี้ปิดใช้งานอยู่" }`; `POST /api/library-upload` answers 403 with that error;
  `GET /api/library-upload` answers the same 404 as for a missing file.

## The owner's page

Tabs: **เลือกดู · อัปโหลด · ของฉัน**. No อยากได้มากสุด, no คิวตรวจ.

- **เลือกดู**: unchanged except
  - unbuilt pieces still show "เร็วๆ นี้" but carry no อยากได้ button, no vote count, and the detail panel has no vote
    line or button (it says only "เร็วๆ นี้");
  - upload cards carry the tag **"ไฟล์ของฉัน"** instead of "จากสมาชิก"; the type chip stays "ไฟล์จากสมาชิก"→ rename it
    **"ไฟล์ของฉัน"**.
- **อัปโหลด**: two kinds only — ชิ้นส่วนภาพ, ภาพสไตล์ (no คำขอชิ้นใหม่). No rights box, no "คุณส่งแล้ว N จาก 20" line;
  the line above the form is "ไฟล์ของเจ้าของเข้าคลังทันที ไม่ต้องรอตรวจ". A sent file is `ok` at once and appears in
  เลือกดู; the tab stays on อัปโหลด with "ส่งแล้ว" as today.
- **ของฉัน**: "ที่บันทึกไว้ (N)" (★) as today, then **"ไฟล์ของฉัน (N)"**: every file of the owner, newest first, with its
  state word. Per file:
  - in the library (`ok`): **"ถอนออกจากคลัง"** — no reason asked; the file leaves เลือกดู and คลิปตามโจทย์'s pickers
    (state `gone`, reason null) and stays here with the state word "ถอนออกแล้ว";
  - withdrawn (`gone`): **"นำกลับเข้าคลัง"** — back to `ok`;
  - every file: **"ลบ"** with the inline "ลบไฟล์นี้?" ยืนยัน / ยกเลิก as today (deletes row and files).
  The "กดอยากได้ไว้ N ชิ้น" line goes.

## Store and actions

- `sendUpload`: kind `ask` refused ("เลือกแบบที่จะส่ง"); the rights box is not required of the owner (it is only ever the
  owner now). The demo refusal stays.
- New `hideUpload(by, id)` (ok → gone, reason null, only `where state = 'ok'`) and `showUpload(by, id)` (gone → ok,
  only `where state = 'gone'`), each answering "ไฟล์นี้ตรวจไปแล้ว" when the row was not in the starting state and
  "ไม่พบไฟล์นี้" when it is missing; actions `hideLibraryUpload(id)`, `showLibraryUpload(id)` (owner only).
- `toggleMark` refuses kind `want` ("ไม่พบรายการนี้ในคลัง" or a new line — your choice, tested).
- `uploadViews` for the owner: `mine` = all the owner's own rows; `shared` = ok rows; `waiting` = [] (no queue).
  No name lookups are needed any more.

## Not changed

คลิปตามโจทย์ (already the owner's alone), its ภาพจากคลัง and style reference, the migrations, `ins_member_delete`.

## Tests

Menu: the item only for the owner. Page: a non-owner gets the closed line and no reads; the owner gets three tabs.
Every action and both route methods refuse a non-owner (and the demo). Board: no vote buttons or counts, card tag
"ไฟล์ของฉัน", chip "ไฟล์ของฉัน", upload kinds part and style only, no rights box, no count line. ของฉัน: ถอนออกจากคลัง on
ok, นำกลับเข้าคลัง on gone, ลบ on all. Store: hide/show state rules and races; ask refused; want refused.
