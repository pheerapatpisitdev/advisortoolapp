# คลังแอนิเมชัน — phase 2: the Studio menu

Owner, 2026-11-14 ("ใช้ได้ ทำรอบ 2"). Mockup https://claude.ai/artifact/JdWaEEaNLGbjUU3SZbPa5T (v5, section หน้าเมนู),
answers 5ก (a Studio menu) and 7ก (unfinished pieces shown as เร็วๆ นี้ with an อยากได้ vote). Phase 1 (health
devices) is live at 25ff4cfb. Uploads and the admin's file queue (6ก) are phase 3 and are not on this page yet.

## The page

`/studio/library`, "คลังแอนิเมชัน", in Studio's group วางแผนและคลัง after คลังบุคคล (logo `an`). Every viewer
who reaches Studio may open it (gated like `/studio/hooks`, no feature switch). Clips are still made in their own
forms; this page shows what exists and sends the agent to the right form with the choice already made.

Tabs:
- **เลือกดู** — search, and three filter rows: type (ทั้งหมด · รูปแบบรายการ · อุปกรณ์ภาพ · สไตล์ภาพ · ลูกเล่น),
  product (ทุกสินค้า · สุขภาพ · ชีวิต · ออม บำนาญ มรดก), state (ใช้ได้แล้ว · เร็วๆ นี้ · ทั้งหมด; default ใช้ได้แล้ว).
  Cards: preview, name, tags, and either **ใช้แบบนี้** (ready) or **อยากได้ · N** (not built), plus ★.
  Pressing the preview opens the detail: larger preview, what it tells, for a device a look switcher, and one
  button per form it works in ("ใช้ใน คลิปเล่าเรื่อง").
- **ของฉัน** — what the viewer saved (★), and how many pieces they asked for.
- **อยากได้มากสุด** — the owner only: unfinished pieces by vote count, most first.

## The catalogue

One browser-safe list, `src/lib/scene-library/catalog.ts`, built from what the code already knows wherever it can
(`DEVICES`, `PROMPT_FORMATS`, the story looks, `RECIPE_NAMES`, `MUSIC_MOODS`) so a ready piece cannot be listed
that the forms do not offer. Pieces not built yet are a plain list in the same file, taken from the mockup's map
(devices, formats, the looks ไวต์บอร์ด นีออน บลูพริ้นท์, the eight AI picture styles, effects).

An item: `id` (stable, kebab-case ASCII), `type`, `name`, `tells`, `product`, `ready`, `uses` (which forms, and
the link into each), `preview` (a picture path, or none).

A ready item is only ready for a viewer who may open one of its forms: คลิปตามโจทย์ is the owner's alone, and a
switched-off feature is closed to others. Where the viewer can open none of an item's forms the card says
"ยังไม่เปิดให้ใช้" in place of the button — it is not shown as เร็วๆ นี้ and takes no vote.

## Links into the forms

- `/studio/story-clip?topic=<key>&look=<paper|minimal|plot|line>` — the form opens on that topic and look. A
  link's choice wins over the look remembered in localStorage. Unknown values are ignored.
- `/studio/prompt-story?format=<free|drama3|claimreview>&style=<paper|warm|plot|line>` — the same.
- `/studio/quote-video?product=…` — already reads its link (`videoStartFrom`); recipes and looks that have no
  link field open the form as it is.

A health device links to the story topic that shows it (e.g. ค่าห้องต่อคืน → `topic=roomcost`) and to
คลิปตามโจทย์; a format to its form; a look to each form with that look.

## Saved pieces and votes

One table, `ins_library_marks (agent_id uuid, item text, kind text check in ('save','want'), created_at,
primary key (agent_id, item, kind))`, service-role only like its neighbours, added to `ins_member_delete` and
`ins_demo_wipe`. `item` must be a catalogue id; `want` only on an item that is not ready. The vote count a card
shows is the number of `want` rows for the item. The migration is written in this phase and **applied to
production only on the owner's word**, before the push.

## Pictures

Small stills (216×384 JPEG, a few KB each) committed under `public/library/`: each health device in each of the
four story looks, and one picture per look. Made by a script kept in the repo (`remotion/library-stills.mjs` or
the satori path the phase 1 stills used), at the end of each device's animation, with the figures of iHealthy
Silver, a man of 35. A piece with no picture shows a plain tile with its type's mark.

## Not in this phase

Uploads, the admin's file queue, uploaded pieces used in clips (phase 3). New looks and AI picture styles
(phase 4) — listed here as เร็วๆ นี้ only. Further device rounds follow the votes.

## Tests

Catalogue: every ready item's link parses back to a choice its form accepts; ids unique; ready items come from
the code's own lists. Marks: save/unsave, want only on unbuilt items, unknown item refused, counts, a member's
delete and the demo wipe clear them. Links: each form honours its params and ignores unknown ones, and a link
beats localStorage. Page: gated; menu and logo tests updated; a viewer who cannot open คลิปตามโจทย์ sees no link
into it.
