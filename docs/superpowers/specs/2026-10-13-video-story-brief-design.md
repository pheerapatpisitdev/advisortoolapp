# วิดีโอนำเสนอ: โจทย์การเล่า, วนลูป, ความยาว, ขนาด, หลอดความคืบหน้า — design

Owner, 2026-10-13. Approved plan + mockups: https://claude.ai/artifact/G36jyJWaHD7yj248ReEk3E (v5).
Owner's answers: 1 ค, 2–9 as recommended, open to every agent.

## Decisions

1. **Writing method ค (hybrid).** A small-tier model (Gemini Flash / Typhoon, never Claude) writes only
   the opening (hook + story sentence) and the closing half. Price, cover and value scenes stay the
   templates in `script.ts` (the value table's pen notes are timed to the value line's words).
   Every number in a written line must be in the quote's facts; forbidden voice words stay
   (เบี้ย, เสียชีวิต, เวนคืน); no promises past the plan (iShield's 90 days, no %, "การันตี" only for
   the pension's 15 years). A failed check, or a model that does not answer, falls back to today's line.
2. **Price:** inside the clip's price (฿5/฿10). "ดูสคริปต์" is free, 3 regenerations per clip.
3. **Who:** every agent who can make clips.
4. **Hook headline on screen** in the lead scene (≤ 28 characters a line, 2 lines).
5. **Lists:** hooks ถามสะกิด, ตัวเลขช็อก, สวนความเชื่อ, เล่าเรื่องสมมติ, ลิสต์ 3 ข้อ, ตรงไปตรงมา
   (today's line, no AI), ให้ระบบเลือก. Stories per product, offered only when the facts back them
   (plan table §4). Audience: พ่อแม่ลูกเล็ก, เจ้าของกิจการ, พนักงานประจำ, โสด ดูแลพ่อแม่, ใกล้เกษียณ.
   Free note ≤ 100 characters.
6. **คลิปวนลูป ↻** (Studio's LOOP_RULES): no greeting or name in the opening, the closing hangs and
   reads into the opening, the invite (and the name) moves to the end of the price scene, the last
   scene looks like the lead scene with an agent strip at the bottom (ก), tail silence 0.3 s. Named
   clips may loop.
7. **Lengths** 15 s / 50 s / 90 s / 2 min by adding scenes: เรื่องของลูกค้า (90 s+), ถาม-ตอบ 2 ข้อ from
   the product bot's faq.ts (90 s+), เทียบกับเก็บเงินเอง (2 min; บำนาญ 95 gets ลดหย่อนภาษี instead),
   ขั้นตอนเริ่มต้น (2 min). Prices 90 s ฿8 / ฿15, 2 min ฿10 / ฿20, set on /admin/wallet.
8. **Sizes:** every clip portrait / square / landscape. "ลงปฏิทินเพจ" stays portrait-only.
9. **Progress bar** on each clip being made: bar, %, the step, time left. Steps before rendering are
   counted for real; the Cloud Run render is estimated from past clips (ก), held at 98% past the estimate.

## Rounds (one at a time, shown before the next)

0. Progress bar. 1. Brief + loop, Life Protect classic full + short. 2. iShield, บำนาญ 95, iHealthy.
3. Lengths 90 s / 2 min, classic. 4. Sizes for classic + short Motion unlocked. 5. Motion for all of it.

## Round 0 — progress bar

- `ins_quote_videos.progress jsonb` (`{ step, done, of }`), written by `produce` without touching
  `updated_at`: `voice` (lines spoken), `files`, `draw` (scenes drawn), `submit`. Rendering is
  `status = 'rendering'` from `job.startedAt`. Writes are chained so the count never goes back, and a
  failed write never fails the clip.
- Estimates: the median time before rendering and of rendering, per kind (classic/motion × full/short,
  FHC its own), over the last finished clips (renders over 15 min ignored). Measured 2026-10-13:
  classic full ~90 s + ~265 s; short ~30 s + ~260 s; Motion ~45 s + ~155 s. These are the defaults
  when a kind has no history.
- **Changed from the mockup:** the mockup gave rendering 65–98%. Rendering is about three quarters
  of the time, so the bar splits by measured time instead: the steps before rendering take their
  share of the estimate (at least 15%, at most 60%), rendering the rest up to 98%.
- `src/lib/quote-video/progress.ts` (pure, browser-safe) turns a clip's state into
  `{ pct, text, leftSec }`; `ClipProgress.tsx` ticks it every second between the board's 4-second
  polls and never lets the % go back.

## Rounds 1–5 — as built (owner: "ทำต่อทั้งหมดให้เสร็จ", 2026-10-13)

Built together on `feat/quote-video-brief`, not one round at a time, at the owner's word.

- `brief.ts` — the choices (hooks, audiences, stories per product with the facts that back them),
  `cleanBrief`, the checks (`lineProblem`, `writtenProblems`: figures only from the quote or the
  agent's note, the voice's banned words, no greeting, no repeated invitation, lengths) and the fixed
  lines (`fallbackLines`) for every hook × product.
- `writer.ts` — one small-tier call (Gemini Flash Lite answered in ~4 s), checked field by field,
  asked once more with the reasons, then the fixed line for what still fails. Ledgered as
  `quote-video-brief` against the agent. A clip made without ดูสคริปต์ is written in `produce` and
  the lines kept on the row's `input`, so every scene drawer tells the same lines.
- `told.ts` — scene order per length; the four new scenes (`story`, `qa`, `versus`, `steps`) and what
  they say and show. `qa.ts` — the bots' answers said for the voice, no fact added or dropped.
- `script.ts` — the hook opens before the plan's own lead sentence ("แผนนี้ อายุ 35 ทำทุน…"); the
  written closing follows "สนใจ ทักมาคุยกันได้เลยนะคะ"; a loop puts the invitation (and the name) at
  the end of the price scene and closes on the hanging line. No brief: today's clip word for word.
  A man's voice now also turns a question's คะ into ครับ.
- Renderers — headline band over the photo (classic) / above the shield (Motion); loop ending = the
  opening held + agent strip, agent's name/phone/LINE in every scene's footer; the four scenes in
  classic portrait, Motion portrait, Motion square/landscape, and the new `classic-wide.tsx`.
- Classic in every shape — `table-geo.ts CLASSIC_BOXES` moves the photo box and table window per
  size; `job.ts`, `table-pen.tsx`, `pension-table.tsx` take the window as a parameter (portrait
  unchanged, tests prove it). A square classic clip has no chart beside the table (no room); a
  landscape one has it at 760 px.
- Prices `videoLongClassic/Motion`, `videoMaxClassic/Motion` (฿8/฿15, ฿10/฿20) in the stored price
  list, which fills new keys from defaults: no migration.
- Clips over 70 s encode with `-preset veryfast`; a clip is given up on after 20 minutes (was 15):
  Cloud Run's task timeout is 900 s and a 2-minute clip's render is ~2× a 50-second one's.
- A clip over 90 s has no "ลงปฏิทินเพจ" (Facebook Reels' limit).

### Differences from the mockup

- The agent strip in a looping clip is in every scene's footer line (name · phone · LINE) and as a
  card in the last scene, rather than a strip under every scene from the price on — the value
  table's window leaves no room for a strip.
- ดูสคริปต์ again after editing reads the edits back without a model call (no try used); ↻ สุ่มใหม่
  writes again (one of three tries).
- New agents start on "ให้ระบบเลือก": every new clip opens on a hook unless the agent picks
  "ตรงไปตรงมา". The choice is remembered per browser.
- The 15-second clip gets the hook too (~20 s).
