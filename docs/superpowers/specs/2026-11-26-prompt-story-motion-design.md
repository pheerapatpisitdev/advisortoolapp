# คลิปตามโจทย์ — หน้าตาโมชันกราฟิก (แบบ ข)

Owner, 2026-11-26: chose ข on mockup https://claude.ai/artifact/L7fHebBLfnTWYD4JqUNLRq (round 1 compared today's clip,
ก and ข; round 2 showed ข in three sizes, its layouts and the editor), "ผมไม่ชอบฟอนต์ลายมือ", and "ตามแนะนำ" to the four
questions of round 2. The mockup's page (both versions) is the visual reference: its geometry tables (`HOOK`, `CARD`,
`NUM`, `CMP`, `CHECK`, `CONTACT`, in em of 30 px) and its timings are the starting values.

## What changes for the agent

- Step 2 of the form becomes **หน้าตาคลิป และสไตล์รูป**. A choice comes first: **โมชันกราฟิก (ใหม่)**, the default, or
  **หน้าตาเดิม**. หน้าตาเดิม is today's form and clip, unchanged. With โมชันกราฟิก the 14 style chips stay, headed
  **สไตล์ภาพ AI**: they decide only how the clip's pictures are painted (`STYLE_PREFIX`), never its colours.
- The writer is told the design before it writes, so a โมชันกราฟิก script comes back with a layout for every scene.
- The editor's per-scene choice (today ภาพ AI / อุปกรณ์ / ภาพจากคลัง) becomes **แบบฉาก**: เปิดเรื่อง, ภาพการ์ด,
  ตัวเลขใหญ่, เทียบสองฝั่ง, เช็กลิสต์, ภาพเต็มจอ, อุปกรณ์, ภาพจากคลัง. The fields under it follow the layout. Each scene
  card shows a small looping preview of the scene (no voice, free) on the right; device and library scenes show a label
  instead.
- The clip: every scene in its layout, a progress bar of thin segments at the top, the voice's subtitle as a dark pill
  with the word being spoken on gold, a gold wipe between scenes, the contact card at the end. All words in **Prompt**
  (400, 600, 800); no handwriting face anywhere in the look.

## Layouts (`PromptScene.motion`)

| kind | Thai | the writer gives | painted? |
|---|---|---|---|
| `hook` | เปิดเรื่อง | 1–3 `lines`, `key` (index of the line swept with gold, or -1), `icon` | no |
| `card` | ภาพการ์ด | `tag`, two `chips`; the scene's `picture` words | yes |
| `number` | ตัวเลขใหญ่ | `value` (a whole number written in the brief or the plan), `unit`, `tag`, `bill` | no |
| `compare` | เทียบสองฝั่ง | `title`, `bad` and `good`, each `{ head, lines: [2] }` | no |
| `check` | เช็กลิสต์ | 2 `lines` (the second swept with gold), 3 `ticks`, `photo` (a round picture above) | only with `photo` |
| `full` | ภาพเต็มจอ | 1–2 `lines`, `key` | yes |

Icons: `fever` ปรอท, `hospital` โรงพยาบาล, `money` เงิน, `heart` หัวใจ, `shield` โล่, `home` บ้าน.

Limits in characters: a hook or full line 22, tag 24, chip 16, unit 10, bill 22, compare title 24, side head 16, side
line 22, check line 22, tick 28. Every text field passes the same rules as the screen words today (`FORBIDDEN`, the
other insurers, digits only when the brief or the plan has that number). `value` must be in `deviceAllowed(brief,
figure)`.

Device scenes (`device`), library parts (`asset`) and the premium card (`showFigure`) stay. In โมชันกราฟิก a device is
drawn by the อินโฟกราฟิก route in a new Kit (`MOTION_KIT`), a library part on the look's navy ground, and a
`showFigure` scene draws a system figure card in place of its layout and paints nothing.

The writer: the first scene a `hook`; neighbours of the same kind avoided; painted scenes (card, full, check with photo)
at most ceil(n/2); devices at most floor(n/2) as today. A scene whose layout fails the checks twice becomes a `hook` of
its screen words (free), and is listed in `notes` as today.

## Model

โมชันกราฟิก scripts and rewrites are written by `claude-sonnet-5`, falling back to `gemini-3.7-flash` then `gpt-5`,
with effort low. หน้าตาเดิม keeps the `video-script` lane. Nothing on /admin/ai changes.

## Money

A scene is painted (and charged a picture) when it has no device and no library part, and, in โมชันกราฟิก, when it is not
the premium card and its layout is `card`, `full` or `check` with `photo`. One function decides this for the price, the
editor's count, the drawing and the refund.

## Colours

Navy ground `#06235f` → `#0d3a8c`, cream `#fbf6ec` with a dot grid, gold `#f2c75c`, coral `#e4572e`, red `#c2412d`,
teal `#2f9c97`, ink `#1d2433`, grey `#e6dfd2`, muted `#8a8f9c`, subtitle pill `rgba(6,14,36,0.78)`. Keys in
`STORY_CLIP_COLORS`, named `mg*`.

## Sizes

Portrait, square and landscape, as the mockup draws them: landscape puts words left and the picture or card right;
square stacks compare's two sides. A line is shrunk to fit its box rather than wrapped.

## Not in this round

ElevenLabs word timing; an AI check of rendered frames; library stills of the look; คลิปเล่าเรื่อง in this look.

## Shipping

One `REMOTION_DRAWING` change (f9d4370809ae). `remotion/prepare/prepare.test.ts` downloads Prompt and gains a
โมชันกราฟิก free clip (with a device scene) so the ship script renders it. The เครื่องวาดคลิป workflow
(`.github/workflows/remotion-job.yml`) runs `remotion/cloudrun/ship.sh` on the pull request and built the job
`remotion-f9d4370809ae` there, so the merge needs no step from the Mac; merge only while that check is green.
