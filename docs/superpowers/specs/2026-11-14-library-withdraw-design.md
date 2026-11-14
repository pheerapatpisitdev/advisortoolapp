# คลังแอนิเมชัน — ถอนออกจากคลัง

Owner, 2026-11-14 ("เพิ่มปุ่มถอน", then "ก ทุกข้อ" on mockup https://claude.ai/artifact/N9j67uWTABLsQgv5Fs24Dk).
Builds on phase 3 (live 84dd1234, spec 2026-11-14-library-uploads-design.md). Answers: 1ก a reason is required; 2ก the
withdrawn file is kept for its sender to delete, except a file whose sender's account is gone, which is deleted at once.

## The owner's side (คิวตรวจ)

A third list after ไฟล์รออนุมัติ and คำขอชิ้นใหม่: **"ในคลังแล้ว (N)"** with the line "ไฟล์ที่ทุกคนเห็นในแท็บเลือกดู
ถอนออกได้ทุกเมื่อ". Each `ok` part and style: thumbnail, name, "<kind> · จาก <name>", the tag ใช้ร่วมแล้ว, and a button
**"ถอนออกจากคลัง"**. Pressing it opens the reasons (the four REASONS of คิวตรวจ, "เลือกเหตุผลที่คนส่งจะเห็น"), then
**"ยืนยันถอนออก"** (disabled until a reason is picked) and ยกเลิก. Empty list: "ยังไม่มีไฟล์ในคลัง". A sender whose account
is gone is named **"สมาชิกที่ลบบัญชีแล้ว"**. The count on the คิวตรวจ tab stays the number waiting (wait rows), not this list.

## What withdrawing does

- The row goes from `ok` to a new state `gone` with the reason, `decided_by`, `decided_at`. Only an `ok` row can be
  withdrawn (a second press, or a sender's delete in between: "ไฟล์นี้ตรวจไปแล้ว" / "ไม่พบไฟล์นี้").
- `gone` is not `ok`, so at once: not in เลือกดู, not among คลิปตามโจทย์'s parts or styles, its file readable only by its
  sender and the owner, and a clip whose scene or style reference uses it is refused before anything is held (all already
  true of any non-`ok` row).
- The sender's ของฉัน shows the state **"ถอนออกแล้ว"** and the reason (as for ไม่ผ่าน); ลบ works as for any row.
- A sender whose account is gone (no agent and no member with that id — looked up successfully and not found): the row
  and its files are deleted instead of kept. A lookup that fails keeps the row (state `gone`), never deletes.
- Clips already made keep their own picture copy.
- A member delete already removes every non-`ok` row of that member, `gone` included; nothing to change there.

## Data

Migration `20261216_library_withdraw.sql`: the `state` check of `ins_library_uploads` gains `'gone'` (drop and re-add
the check constraint; find its real name in 20261215 — Postgres names an inline column check
`ins_library_uploads_state_check`). Applied to production only on the owner's word, before the push. Code deployed
before it: withdrawing fails with the normal failure line; nothing else changes.

## Tests

Store: withdraw only from `ok`; reason required and from REASONS; a non-uuid / missing id; a race (row no longer `ok`);
the sender-gone case deletes row and files; a failed account lookup keeps the row. Action: owner only, not demo. View:
the owner's in-library list carries `by` (or "สมาชิกที่ลบบัญชีแล้ว"), no one else gets `by`. Flow: withdrawing removes the
row from shared; the sender's view shows "ถอนออกแล้ว" and the reason. Migration file: the check lists six states.
