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
