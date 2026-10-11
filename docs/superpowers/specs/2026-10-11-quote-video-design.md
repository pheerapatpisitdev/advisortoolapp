# วิดีโอนำเสนอ (quote video) — design

Owner, 2026-10-11. Approved mockups:
- clip: https://claude.ai/artifact/ThD99LRjrEmQtjNhQgxj7g
- Studio screens: https://claude.ai/artifact/9SL2w8Kb7k5qwWt41yAM5T

## What

A Studio menu **วิดีโอนำเสนอ** (owner only in round one). The agent enters a Life Protect quote —
sex, age, sum, 9 or 19 years, optional customer name — and gets a ~50 s 1080×1920 MP4 with a Thai
female voice (Gemini TTS, voice Kore), word-by-word subtitles and the free effects pack. No music.

Five scenes, figures taken from the same engine as the card and value table (`quoteCard`,
`valueTableCard`, `valueTableChart`) — never written by AI:

| scene | screen | voice (casual, owner-approved wording) |
|---|---|---|
| 1 legacy | plan line, insured, family photo (Ken Burns), มรดก count-up, highlighter "ตกวันละ" | สวัสดีค่ะ [คุณชื่อ] ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ … ครอบครัวได้เงินก้อนสูงสุดถึง X บาทค่ะ |
| 2 price | premium box (yearly / 6-month / monthly count-up), marks "จ่ายเบี้ยแค่ N ปี", "เบี้ยคงที่ตลอด" | ค่าใช้จ่ายตกแค่วันละ … หรือเดือนละ … จ่ายแค่ N ปีก็จบ ราคาไม่ขึ้นเลยตลอดที่จ่ายค่ะ |
| 3 cover | death benefit rows, two growing bars, "คุ้มครองถึงอายุ 99 ปี" | ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้ … หลังจากนั้นได้ … ดูแลยาวไปถึงอายุ 99 เลยค่ะ |
| 4 value | chart (Chart component) + our own value table panning down to the break-even row, red pen ring drawn round it | ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน … พออายุ X ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ … |
| 5 contact | agent photo, name, phone, LINE from บัญชีของฉัน | [คุณชื่อ]สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ |

Round one: base plan only (no riders) — the riders picker comes later.

## Agent contact

`ins_agent_contact (agent_id pk, phone, line_id, photo_path, updated_at)` + private bucket
`agent-contact`. Edited in /studio/account, which every agent now opens (members keep their name
form; UnitOS agents see the contact card only). Name in the clip = the viewer's display name.
Name + phone required to make a clip; photo and LINE optional (initial letter without a photo).

## Rendering

Everything is drawn on Vercel with satori (`renderPng`), and Cloud Run (`clip-ffmpeg`, unchanged
container) runs **one** ffmpeg command:

- per scene: an opaque `base` PNG (static content), an optional moving layer (scene 1 photo with a
  time-scaled zoom; scene 4 tall table PNG with a time-driven `crop` y = pan), and an `ffconcat`
  list of transparent overlay frames (subtitle state + animated items) with per-frame durations;
- scenes joined with `xfade` (fade / slideleft / zoomin, 0.5 s);
- one narration WAV, mixed in Node from the five PCM clips at their scene offsets.

Overlay frames are made only where something changes (word steps, count-up steps, sweep steps, bar
and ring steps), deduplicated — about 200 small PNGs per clip.

Job flow: server action inserts `ins_quote_videos` row (status `drawing`) and returns; `after()`
does TTS → drawing → uploads (bucket `quote-video`, prefix `{videoId}/`) → payload file → Cloud Run
submit (status `rendering`). `/api/quote-video/job` checks the token hash and marks `done` /
`failed`; inputs are deleted, the MP4 kept. The board polls the row. 15 min timeout → failed.

Spend: TTS recorded per call (`quote-video-voice`), render on callback (`quote-video-render`), both
attributed to the agent (`asWho`).
