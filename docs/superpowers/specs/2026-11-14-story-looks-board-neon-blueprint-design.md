# คลังแอนิเมชัน — phase 4ก: หน้าตาคลิป ไวต์บอร์ด นีออน บลูพริ้นท์

Owner, 2026-11-14, "ก ทุกข้อ" on mockup https://claude.ai/artifact/4wNeMcrM1Yat1q7oXYMQSS: 1ก two rounds, the three
clip looks first (this spec), the eight AI picture styles later (4ข); 2ก the looks in คลิปเล่าเรื่อง and คลิปตามโจทย์;
3ก real AI samples before 4ข (not this round). The mockup's sketches are the visual reference.

## The three looks

Ids (the `art` of a story input, and the คลิปตามโจทย์ `PictureStyle`): `board`, `neon`, `blueprint`. Thai names:
**ไวต์บอร์ด**, **นีออน**, **บลูพริ้นท์** (catalogue ids `look-board`, `look-neon`, `look-blueprint`, already listed as
unbuilt). They are not the วิดีโอนำเสนอ theme "ไวท์บอร์ด" (quote-video `ThemeKey` board) and share no code with it.

All three are drawn through the อินโฟกราฟิก / ปากกาพล็อตเตอร์ route (`infoShow` / `infoDrawn` / `infoBody` and its
`Kit`), as plot is: no people, every knowledge and health device drawn by the info drawers. So, like plot:
- คลิปเล่าเรื่อง offers them only on topics of `INFO_SHELVES` (knowledge, objection, health); on other topics the chips
  are not shown and a stored or linked choice falls back as plot's does.
- คลิปตามโจทย์ offers them always (its devices are not shelf-bound).

| | ไวต์บอร์ด | นีออน | บลูพริ้นท์ |
|---|---|---|---|
| ground | a white board (#fbfcfd) in a grey frame (#9aa6b5) on a pale wall (#cfd6df), a marker tray at the bottom with a blue and a red marker | dark violet (#1c1236 centre → #07060f edges), faint horizontal lines low down, one thin pink glowing frame | blueprint blue (#1f5aa6) with a fine grid (#3c78c4, every 12 px at 216 wide) and a coarse grid (#4f8ad3), a thin white border, a small title block bottom right |
| ink / words | dark ink #1d2b44 | lavender #c9c3e6 for plain words | white #eaf3ff |
| accent (heading, the plan's figure) | marker blue #2f7de1 | cyan #33f0ff and pink #ff4fd8, glowing | light cyan #9fd0ff |
| bad news / the agent's share | marker red #d64545 | neon red #ff4f6d, glowing | amber #ffd27a |
| good / tick | #2e9d5b | #5dff9b glowing | #9fd0ff |
| muted | #5a6580 | #8f86b8 | #a9c8ee |
| hand face | Mali (as today) | Sriracha | IBM Plex Sans Thai (bold for headings) |
| how a piece comes in | written in, left to right, as plot's pen writes (the same clip reveal), with no machine; circles and underlines are drawn as marker strokes | switched on: dark, a flicker (two quick dips), then full glow | drawn in left to right like plot, and each figure row gets a thin dimension line |
| subtitle band | dark ink band #1d2b44, white words | #1a1230 band, cyan words | #0f3d78 band, white words |
| footer ("Application by …") | #4b5668 | #6f6699 | #a9c8ee |

Glow (neon) is a text and box shadow in the line's own colour, never a blur filter over the whole frame. Every colour
is a key in `STORY_CLIP_COLORS` (src/lib/card-theme.ts), named `board*`, `neon*`, `bp*`.

Each look also dresses what is around the scenes, as plot and line do: the background (`storyBackground`), the opening
title, the subtitle, the agent's contact card (the dark looks use the light-on-dark card, as the `onDark` path does), the
footer colour, and in คลิปตามโจทย์ the screen words over a picture (a marker sheet, a glowing sign, a white-on-blue
plate) and the ground behind a library part (`lookGround`).

## คลิปตามโจทย์

`PICTURE_STYLES` gains the three after the four of today, in this order: ไวต์บอร์ด, นีออน, บลูพริ้นท์. Each has a
painter prefix (`STYLE_PREFIX`) so its AI pictures sit in the look:
- board: "Hand-drawn whiteboard marker illustration: dark blue and black marker lines on a clean white board, a few red
  and blue marker accents, simple shapes, no shading, generous white space."
- neon: "Neon sign illustration on a dark violet background: glowing cyan, pink and yellow neon tube outlines, simple
  shapes, soft glow, no fill except the glow."
- blueprint: "Technical blueprint drawing: thin white lines on blueprint blue paper with a faint grid, simple
  isometric outlines and dimension marks, no colour other than white and pale cyan."
(The shared suffix forbidding text, numbers, logos and real people's likeness stays.)

## The library

`look-board`, `look-neon`, `look-blueprint` become ready (their unbuilt entries go), each with a preview still
`/library/look-<id>.jpg` and links into both forms. Every health device gains the three looks in its look switcher
(`DEVICE_LOOK_ORDER`), with stills `/library/<device>-<id>.jpg` (8 devices × 3 looks + 3 look stills = 27 new JPEGs,
216×384, made by `remotion/library-stills.mjs`).

## Shipping

One `REMOTION_DRAWING` change (a new Cloud Run job on push, ~10 min). `remotion/prepare/prepare.test.ts` gains a block
per look (two story topics on info shelves, one free clip) so the push hook renders them. No database change.
Before the push the owner sees: the stills of all three looks, and sample clips with real voice (one story topic per
look, one คลิปตามโจทย์ with a device scene).

## Not in this round

The eight AI picture styles (4ข). People-drawn versions of these looks for the non-info shelves.

## Tests

Allowlists and forms (each id accepted, unknown ignored, chips only on info shelves in คลิปเล่าเรื่อง, always in
คลิปตามโจทย์, a stored look survives a reload). Drawing: each look renders every knowledge layout and all 8 health
devices without throwing, its ground colour at a corner pixel, its heading in its accent, its glow only on neon.
Prompt clip framing per look. Catalogue: ready, previews exist on disk, the 63-still count.
