# Page welcome, edited in the back office

Owner, 2026-10-04: "ทำหน้าแก้ข้อความในหลังบ้านให้หน่อย". Approved in chat in two sections.

## What the customer sees

Each Thai Messenger Page greets in one of two ways:

- **menu** (the default): the three-plan menu. The Page's own text replaces the whole menu
  message wherever the menu is shown; the three quick-reply buttons stay fixed, because they
  are what the bot routes on. Pictures go before it on the first message of a conversation only.
- **one plan**: a first message that says nothing ("สวัสดี", "สนใจ", "ขอรายละเอียด") gets the
  pictures, then the Page's text. After that the chosen plan stands in for an advertisement
  that named none, so "ช 35" is priced for it.

A Page with no row behaves exactly as before. A row that cannot be read is treated as no row.
Particles are still stripped on the way out. The Expat Pages are not on this page.
LuckyPlanner's hard-coded welcome moves into a row.

## Back office

`/admin/welcome` ("ข้อความต้อนรับ", channels group, `admin` permission). One card per
connected Thai Page: mode, plan (one plan only), text prefilled with what is used now,
pictures (up to 5, JPG/PNG/WebP, 4 MB each, reorder, remove), a preview as the customer reads
it, save and reset. Every save checks the permission again and is written to `ins_audit`.

## Storage

- `ins_page_welcome` — one row per Page: `page_id` (pk), `mode` (`menu` | `one_plan`),
  `product`, `text`, `pictures text[]`, `updated_at`, `updated_by`. Service role only.
- `page-welcome` bucket, public (Messenger fetches the pictures by URL), images only, 4 MB.
- A picture is a full URL (an upload) or a site path (`/welcome/...`, the seeded LuckyPlanner
  files in `public/`).

## Code

- `src/lib/assistant/page-welcome.ts` — the shape and its validation, no I/O.
- `src/lib/chat/page-welcome-store.ts` — read, save, reset, picture upload.
- The Messenger handler reads the Page's row and passes it into `answerAny`; the dispatcher
  stays free of the database. It sends the pictures ahead of a message marked `opening`.
- Upload: `POST /api/page-welcome-picture`, staff `admin`, returns the public URL.

## Tests

Both modes, a Page without a row, the menu text replaced and its buttons kept, pictures only
on the first message, input validation (mode, plan, text length, picture count and origin).
