# วิดีโอโฆษณา: an ad clip per plan, written by AI from the plan's own figures — design

Owner, 2026-11-22. Asked for a Studio system that makes advertising videos for each insurance plan,
tied to the system's sum assured and premium, where the Hook, the content and the Call to Action can
be chosen. Then asked for realistic pictures besides Motion Graphic, and for AI to generate the whole
clip each time while the figures stay the plan's own formulas. Mockup
https://claude.ai/artifact/ByHCizPPWBELQHcmUErCiw (v4), answers **ก ทั้ง 6 ข้อ**:

1. ก a new Studio menu "วิดีโอโฆษณา" (not a fourth mode of วิดีโอนำเสนอ)
2. ก AI writes the hook from the chosen technique and the real figures, checked, editable
3. ก round one: Life Protect, iShield, iHealthy
4. ก every agent may use it, priced as a Motion clip (plus the pictures)
5. ก realistic = an AI still photograph with a slow zoom (not AI video)
6. ก the page opens in "ให้ AI จัดให้ทั้งคลิป"; "เลือกเองทีละท่อน" is the other mode

Picture default on the form: ค ผสม (hook and closing are photographs, number scenes are Motion).

Status: spec only. Nothing is built.

## สรุปสำหรับเจ้าของ (ภาษาไทย)

- เมนูใหม่ในสตูดิโอ **วิดีโอโฆษณา** เลือกแบบประกัน (Life Protect, iShield, iHealthy) ใส่เพศ อายุ ทุน/แผน
- เปิดมาเป็นโหมด **AI จัดให้ทั้งคลิป**: AI เขียน Hook, เนื้อหา 1–3 ฉาก, ปิดท้าย และคำบรรยายภาพ ใหม่ทุกครั้ง กดเปลี่ยนทีละท่อนหรือแก้คำเองได้ก่อนสร้าง
- ตัวเลขทุกตัวมาจากสูตรแบบประกันในระบบ AI เห็นแค่ตัวเลขของใบเสนอนี้ ทุกประโยคถูกตรวจ ไม่ผ่านใช้ประโยคตายตัว ตัวเลขบนจอระบบวาดเอง ไม่ได้มาจาก AI
- ภาพ: ค่าเริ่มต้น "ผสม" ฉาก Hook กับปิดท้ายเป็นภาพถ่ายสมจริงจาก AI ซูมช้าๆ ฉากตัวเลขเป็น Motion Graphic (ไวท์บอร์ด / แบบเดิม)
- คลิปแนวตั้ง 9:16 ไม่ใส่ชื่อลูกค้า ท้ายคลิปมีบรรทัดคำเตือน คปภ. ได้ MP4 + แคปชัน
- ราคา = คลิป Motion + ฿5 ต่อภาพถ่าย ภาพไหนวาดไม่สำเร็จ ไม่คิดเงินภาพนั้น
- ไม่ต้องแก้ฐานข้อมูล คลิปเก่าและหน้าเดิมไม่ถูกแตะ

## Goal

An agent gets a Reels/ad-ready clip for one plan in one press: an opening that stops the scroll, one to
three scenes that sell with the quote's real figures, and a clear next step, every time worded fresh.
Success: every figure spoken or shown equals `quoteVideoFacts`; a clip is always produced, AI down or
not; the agent can swap any part before rendering; the clip records which hook technique, content
scenes and CTA it used.

## Scope

In: `/studio/ad-video`, products `LIFEPROTECT` (no riders, no budget), `ISHIELD`, `IHEALTHY` (one plan,
no compare, no setup), Thai, portrait 9:16, style Motion with theme `board` (ไวท์บอร์ด, default) or
`navy` (แบบเดิม), picture mode ก/ข/ค, voices as วิดีโอนำเสนอ offers them.

Out (round one; phase 2/3 of the mockup): Pension, Legacy, Protection Life, Global Saving; 1:1 and 4:5;
"ทำ 3 Hook ทีเดียว"; Ads Studio hand-off; results per hook; AI video (moving people); riders; other
languages; customer name; loop; festival theme; น้องโล่; carried figures.

## The clip

Scenes, in order. Every clip is one `QuoteMotion` render.

| Scene | Voice | Screen | Picture mode ค (default) |
|---|---|---|---|
| hook | AI hook line (≤150 chars, checked) | headline ≤28 chars over the picture | photo + slow zoom |
| body 1–3 | AI line per chosen content key (checked) | the existing Motion frame for that key, figures from facts | Motion |
| close | AI or fixed CTA line for the chosen CTA key | CTA words + agent contact + DISCLAIMER line | photo + slow zoom |

Mode ข: body scenes also get a photo, with the figure line drawn on a band over it. Mode ก: no photos;
hook and close are drawn on the theme ground.

Length is whatever the voices take (about 15–30 s). The clip is stored with `length: "short"`, so it is
priced as `videoMotion` and never says a customer's name.

### Content keys (per product)

Each key names an existing Motion drawing; the AI only writes its spoken line.

| Product | Key | Draws (existing frame) | Fits when |
|---|---|---|---|
| LIFEPROTECT | `price` | price scene | always |
| | `cover` | cover bars | always |
| | `value` | cash value table | `breakEven` |
| | `versus` | `versus` extra scene | `totalPaid` |
| ISHIELD | `price`, `cover` (70 โรค), `versus` | as above | `versus` when `totalPaid` |
| IHEALTHY | `price`, `cover` (benefit rows) | as above | always |

The content keys are the clip's own `SceneKey`s, so the clip is a standard Motion clip with the scene
list `lead` (hook) → bodies → `contact` (CTA). In picture mode ก the hook scene draws the standard
`lead` frame (the big figure) with the hook headline, as a brief-written clip does today. iHealthy's
วงเงิน is said in the hook and shown on its `lead` frame. The mockup's `เส้นชีวิต` card (the recipe
`life` frame) is left for round two: it draws a whole recipe, not one scene.

### CTA keys

`chat` ทักแชทขอใบเสนอ · `line` แอด LINE · `comment` คอมเมนต์ "สนใจ" · `nextyear` รอปีหน้าเบี้ยขึ้น ·
`meet` นัดคุย 15 นาที. `nextyear` is offered only where the quote at age+1 prices higher; its figure is
that quote's `perDayAmount` (or spoken price), passed to the checker as an allowed figure (`note`).

### Hook techniques

The five `WRITTEN_HOOKS` of brief.ts (`question`, `shock`, `myth`, `story`, `list`), plus in เลือกเอง
mode the agent's own line (checked by `lineProblem`; a failing line is replaced and the reason shown).
A formula from `ins_hook_templates` as a hook card is left for round two.

## The written plan (`AdPlan`)

Stored on the clip's `input.ad` (jsonb, no migration):

```ts
interface AdPlan {
  mode: "ai" | "pick";
  hook: { kind: WrittenHook | "own"; voice: string; headline: string[] };  // 1–2 lines ≤ 28
  body: { key: AdBodyKey; voice: string }[];   // 1–3, in order
  cta: { key: AdCtaKey; voice: string };
  photos: { hook?: string; close?: string; body?: string[] };  // English prompts, no Thai, no figures
  art: "motion" | "photo" | "mixed";
  brief?: string;        // what the agent asked to stress, ≤100 chars
  written: boolean;      // false = all fixed lines
  model?: string;
}
```

`cleanAdPlan(raw, f)` re-checks everything the form sends (keys fit the facts, 1–3 bodies, every voice
passes `lineProblem` with the plan's allowed figures, headline ≤ `HEADLINE_MAX`) and replaces a failing
line with its fixed line, so a tampered or stale plan cannot put a wrong figure in a clip.

## Writing (AI) and the guard

`src/lib/ad-video/writer.ts`, task `ad-video-script` (added to `VIDEO_SCRIPT_TASKS`, lane
`video-script`, small tier, never Claude), JSON reply, 20 s timeout.

1. The model is given `factLines(f)` (+ the next-year figure when `nextyear` is possible), the content
   keys that fit with one line on what each scene shows, the CTA keys, the hook techniques, the agent's
   brief, and the house rules of `writer.ts` (female endings, no banned words, figures only from the
   list). In เลือกเอง mode the keys are fixed and it only writes the lines.
2. Each line is checked with `lineProblem` / `writtenProblems`; picture prompts are checked for Thai
   letters and digits (both refused).
3. Failing fields are asked for once more with the reasons; what fails again takes its fixed line
   (`fallbackLines` for the hook; the fixed scene voices of `femaleScript`/`shortScript` for bodies; a
   fixed sentence per CTA key; a fixed picture prompt per product and scene).
4. "เปลี่ยน" on one part re-asks for that part only, with the rest given as context.

Rate limit as `previewScript`: 60 per hour per agent.

## Pictures

`src/lib/ad-video/photo.ts`: `photoPrompt(scene, product, audience?)` builds an English prompt from
`looks.ts` (`STYLES` editorial/phone/film `say`, `SUBJECTS` thai/family/elders), the AI's scene idea,
`background.ts` `AVOID` and the no-text rule, aspect 9:16, "no identifiable real person", nothing
frightening (no funerals, accidents, hospital emergencies). Drawn in `produce` beside the voice, like
prompt-story's `drawPictures`: `drawImage({task: "ad-video-photo", aspect: "9:16", prefer: painter})`,
two tries, `null` → that scene is drawn as Motion on the theme ground and the picture's price comes off
`held_satang`. Files `<id>/pic-<n>.png`, paths on `input.pictures`.

## Rendering

The ad clip runs the standard Motion path of `remotion/src/Clip.tsx` (theme, `motionFrame`, the
brief's `shown.headline` on `lead`, `shown.extra` from `extraOf(facts, {})` for `versus`). One new
optional prop, `ad: { photos: (string | null)[]; cta: string }` (one entry per scene): a scene with a
photo draws `AdPhotoScene` (an `<Img>` with the existing 0.12 push, as StoryClip, under the hook
headline on `lead`, the scene's figure line on a body, or the CTA words + contact on `contact`) in
place of its themed layer; the `contact` scene shows the CTA words above the contact block, and every
ad clip shows the `DISCLAIMER` line (output.ts) on its last scene. Clips without `ad` are unchanged. `REMOTION_DRAWING` changes, so the push builds a new Cloud Run job; `prepare.test.ts` adds
smoke props `ad-lp` and ship.sh renders it.

## Pricing

`videoPrice` for an ad input = `prices.videoMotion` + `pictureSatang(painter)` × photos asked
(`elevenExtra` as usual for an ElevenLabs voice). No new `PriceKey`. Missing photos are refunded before
settle. Owner free, demo capped, free clips as today.

## Page and form

`/studio/ad-video` (`AdVideoBoard.tsx`), studio look, same gates as quote-video (`gatePage`,
`closedFor(viewer, "ad-video")`).

1. วิธีสร้าง: two cards, ✦ AI จัดให้ทั้งคลิป (default) / เลือกเองทีละท่อน.
2. แบบประกันและตัวเลข: product chips; sex, age, term (LP 9/19/99, iShield 5/10/15/20), sum or plan;
   the quote preview line from `previewQuote`.
3. AI mode: brief box (optional), "✦ ให้ AI เขียน" → plan rows Hook / เนื้อหา n / ปิดท้าย, each editable
   with "เปลี่ยน"; figures highlighted. Pick mode: hook technique cards (+ formula, + own), content
   cards (1–3, order of tapping), CTA cards; the AI writes the lines on "สร้างวิดีโอ".
4. ภาพประกอบ: ก / ข / ค (default ค), theme ไวท์บอร์ด / แบบเดิม, voice picker (reused).
5. Price line under the button (`costLine`, base + pictures), contact required as today, then
   "สร้างวิดีโอ". The clip list below shows the ad board's clips with PostPanel (caption from the
   plan: hook, bodies as ✓ lines, CTA, DISCLAIMER).

## Plumbing

- `boardOf` → `"ad"` when `input.ad`; `myVideos("ad")`; ClipList titles "วิดีโอโฆษณา · <product>".
- `make.ts`: `spokenLines` and `quotePartsFor` take the plan's lines and scene list (as `recipeParts`);
  `produce` draws photos.
- `progress.ts clipKind`, `fail-alert.ts`, `home/history.ts`, `history-read.ts`, `line/agent-line.ts`,
  `stats/usage-read.ts`, `admin/people-history-read.ts`: name the new kind where they name kinds.
- Menu: `studioMenu` make group, `TOOL_LOGOS` (`av`), `FEATURES` key `ad-video`.
- After the push: a draft row in `ins_updates` (grp studio, link /studio/ad-video).

## Errors

AI down → whole fixed plan (`written:false`), the form says "ใช้ประโยคมาตรฐาน". Quote not priced →
`NOT_PRICED` as today. Photo fails → Motion ground, refunded. Render fails → hold released (existing
`fail`). Stale plan (rates changed) → `cleanAdPlan` fixes lines on make.

## Testing

Unit: keys fit per product; `cleanAdPlan` rejects wrong figures, Thai in prompts, 0 or 4 bodies;
writer with mocked `chat` (good reply, one bad field retried, double failure → fixed); photo prompt
has no Thai/digits and says 9:16; price = Motion + photos; refund of a missing photo; `boardOf("ad")`;
nextyear figure allowed only via note. Drawing: `remotion-drawing.test.ts` constant, a frame test that
headline/CTA words do not overflow at 9:16, smoke render `ad-lp`. Manual: one real clip per product on
www after the push.
