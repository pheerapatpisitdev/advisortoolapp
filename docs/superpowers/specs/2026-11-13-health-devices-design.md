# คลังแอนิเมชัน — phase 1: ชุดประกันสุขภาพ

Owner, 2026-11-13. Mockup https://claude.ai/artifact/JdWaEEaNLGbjUU3SZbPa5T (v5), answers "ก ทุกข้อ":
library first for คลิปตามโจทย์ + คลิปเล่าเรื่อง (1ก); health set first, with the formats ละครสั้น 3 ฉาก and
รีวิวเคสเคลม (2ก); AI picks the device, the agent can change it (4ก). Menu, uploads, votes, the three new
looks and the eight AI picture styles (3ก 5ก 6ก 7ก) are later phases, listed at the end.

## The rule that does not move

Numbers on screen come from data the app already holds (the iHealthy sheet and rate table, the plan
the agent picked) or from what the agent typed (the brief, the form). An AI never types a figure.
Every device field that holds a number is checked against those sources, as `allowedFor` does today
for คลิปตามโจทย์. A device whose number cannot be sourced falls back to its words-only form.

## What a "device" is

A system-drawn scene: a new `KnowShow` layout (`src/lib/quote-video/story-knowledge.ts`), drawn by
`Scene()` (paper, warm, line) and `infoScene()` (plot), timed by `kspec`, its words in `knowText` so the
hand fonts carry its letters. One drawing, used by both clip kinds:

- **คลิปเล่าเรื่อง** — fixed episodes, no AI, as every story topic is today.
- **คลิปตามโจทย์** — a scene may carry `device` instead of an AI picture; it is drawn by the same
  layout in the clip's look (`freeLook`).

A browser-safe registry, `src/lib/scene-library/devices.ts`, names each device (Thai name, family,
product, the clip kinds it serves, its fields and which fields are numbers). Phase 2's menu reads it.

## The eight health devices

| key | ชื่อ | fields | numbers from |
|---|---|---|---|
| `split` | เหมาจ่าย vs แยกจ่าย | title, parts (≤4 words), whole (words) | none |
| `limit` | วงเงินต่อปีเติมหลอด | title, limit, used? | limit: plan's `annualMax`; used: typed |
| `room` | ค่าห้องต่อคืน | title, real?, plan | plan: sheet row 1 for the plan; real: typed |
| `overflow` | ส่วนต่างที่จ่ายเอง | title, bill?, limit? | typed / plan |
| `waiting` | ระยะรอคอย | title, rows | `terms.waitingDays`, `terms.specialWaitingDays` |
| `cashless` | เคลมไม่ต้องสำรองจ่าย | title, note | none |
| `groupgap` | ประกันกลุ่มไม่พอ | title, bill?, group? | typed |
| `agecost` | เบี้ยขึ้นตามอายุ | title, rows (age → premium) | iHealthy rate table for the plan, sex |

Each with a missing optional number draws its words-only form (e.g. `room` without `real`: "ค่าห้อง
รพ. เอกชนมักเกินวงเงินของแผนเล็ก" over the plan's figure). Drawings follow the mockup's sketches; all
three sizes (portrait, square, landscape); all four story looks. Colours go in `STORY_CLIP_COLORS`.

## คลิปเล่าเรื่อง: a new shelf "ประกันสุขภาพ"

`StoryShelf` gains `"health"`; four topics, five scenes each (the existing `knowAsk…knowRecap` keys):

1. **เหมาจ่าย กับ แยกจ่าย** — ask → split → room → limit → recap
2. **ค่าห้องเกิน ใครจ่าย** — ask → room → overflow → list (เลือกวงเงินให้พอ) → recap
3. **สมัครวันนี้ คุ้มครองเมื่อไหร่** — ask → waiting → note (โรคที่เป็นมาก่อน) → cashless → recap
4. **ทำตอนอายุน้อย เบี้ยถูกกว่า** — ask → agecost → note → list → recap

A health topic's figure is an iHealthy plan (new `figure: "health"`: plan code, sex, age). Optional
typed inputs on the form: ค่าห้องต่อคืน that the customer uses, ค่ารักษาตัวอย่าง. The objection
shelf's "มีประกันกลุ่มบริษัทแล้ว" keeps its words and gains `groupgap` when the agent types a bill.
The plot look is offered on this shelf too.

## คลิปตามโจทย์

- `PromptScene` gains `device?: DeviceScene` (`{kind, ...fields}`). A device scene has no AI picture.
- **Writer** (`writer.ts`): the prompt lists the devices, when each fits, and their JSON fields. The
  AI may set `device` on a scene. Number fields must pass `allowedFor` (brief + figure); a scene whose
  device fails is kept as a picture scene, so a bad device never costs the agent a clip.
- **Format** (`format`): ตามโจทย์ (default) · ละครสั้น 3 ฉาก · รีวิวเคสเคลม, chips on the form. Each
  is a structure line in the writer's prompt (ละครสั้น: ชีวิตปกติ → เหตุไม่คาดฝัน → ทางออก;
  รีวิวเคสเคลม: อาการ → ค่ารักษา → ประกันจ่าย → ส่วนที่จ่ายเอง → บทเรียน). รีวิวเคสเคลม shows a line on the
  form: no customer name, figures as the agent types them.
- **Script editor**: each scene shows "ภาพ AI" or the device's name and its words, and a switch
  ภาพ AI ↔ อุปกรณ์ (the device list filtered to those whose fields the scene can fill). "เขียนฉากนี้ใหม่"
  asks the writer for that one scene again, free, up to 3 times a draft.
- **Price**: pictures are charged per picture scene, not per scene (`promptStoryPrice`,
  `promptFreePrice`, `totalLine`). A device scene costs nothing beyond the clip's own price.
- **Drawing**: `freeFrame` draws `Scene()`/`infoScene()` for a device scene in the clip's look;
  subtitle and contact card unchanged.

## Rendering and shipping

One `REMOTION_DRAWING` bump. `prepare` gains samples: each device in each look (stills), one health
story clip and one prompt clip with devices (smoke set adds the health story). One push, on the
owner's word, after sample clips with real voice are shown.

## Not in phase 1

- Phase 2 — Studio menu คลังแอนิเมชัน: เลือกดู, ของฉัน (★), อยากได้ votes, "ใช้แบบนี้" links (5ก 7ก).
- Phase 3 — uploads and the admin คิวตรวจ: storage, approval, uploads used in clips (6ก).
- Phase 4 — looks ไวต์บอร์ด นีออน บลูพริ้นท์ and the eight AI picture styles (3ก).
- Phase 5 on — further device rounds in vote order; quote clips (วิดีโอนำเสนอ) take devices (1ก "later").

## Tests

kspec/knowText per layout; number sourcing per device (typed, sheet, words-only fallback); writer
device parsing and fallback; price with mixed scenes; topic episodes; stills of 8 devices × 4 looks ×
3 sizes looked at before samples go to the owner.
