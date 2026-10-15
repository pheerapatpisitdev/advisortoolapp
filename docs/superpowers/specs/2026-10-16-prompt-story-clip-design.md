# คลิปตามโจทย์: พิมพ์โจทย์ ให้ AI วางเรื่อง วาดรูป และทำเป็นวิดีโอ — design

Owner, 2026-10-16. Asked: "สร้างเรื่องได้ตามอิสระ แค่เขียน prompt แล้ว AI ก็ทำสตอรี่บอร์ดให้ วางโครงให้เจนเป็นวีดีโอได้เลย".
Owner's answers (15 questions, all confirmed in chat): ทุกคนใช้ได้, เรื่องประกันเท่านั้น, ส่งลูกค้าและลงเพจ,
เบี้ยจริงได้, เลขในโจทย์ใช้ได้, ผิดแล้วระบบแก้เอง, AI วาดรูปประกอบ, ตัวแทนเลือกสไตล์รูป, 3/5/8 ฉาก,
เห็นแค่บทพูดก่อนเจน, บทฟรีรูปคิดต่อรูป, ราคาคลิป + รูปต่อฉาก, หน้าใหม่ใน Studio, เก็บประวัติ, เสียงและขนาดเหมือนคลิปเล่าเรื่อง.

Status: spec only. Nothing is built. The screens are mocked up and approved separately before any code (owner's mockup-first rule).

## Goal

An agent types what the clip should be about (and optionally a plan's real premium). The system writes a
short script, the agent reads and edits it, then one button makes the whole clip: a picture drawn for each
scene, the voice, the words and numbers laid over, and the agent's card at the end. Afterwards one scene's
picture can be drawn again without paying for the whole clip.

Success: an agent goes from a one-line brief to a finished clip in under 5 minutes, every number in the clip
comes from the brief or the rate tables, and a brief outside insurance is refused with a reason.

## Flow

1. **Brief.** The agent types the prompt (up to 600 characters) and picks: scenes (3 / 5 / 8), picture style,
   picture quality (the Organic painters: มาตรฐาน / คมชัด / Gemini), size (portrait / square / landscape),
   voice (as คลิปเล่าเรื่อง), customer's name (optional), and optionally a plan's real premium
   (the story clip's plan / age / sum picker, `storyFigure`).
2. **เขียนบท** (free, repeatable). Returns the title, then per scene: the spoken line, the words on screen,
   and a short note of the picture. The agent edits any of the three; edits stick when the script is
   rewritten for another scene only if the agent asks for that scene alone.
3. **สร้างคลิป** (the one payment). Shows the total before the press: the story clip's price plus one picture
   price per scene. Draws each picture, voices each line, renders. A failed clip is released, as every clip is.
4. **After.** The finished clip sits on the desk like any clip, with its Page caption (no customer name).
   Each scene has "วาดภาพฉากนี้ใหม่": one picture price, the clip is cut again without voicing again.

## Writing the script

- **Who writes:** the small tier (Gemini Flash / Typhoon), never Claude at runtime, as วิดีโอนำเสนอ's writer
  (`src/lib/quote-video/writer.ts`). One call returns JSON: `onTopic`, `refusal`, `title`, `caption`, and
  `scenes[]` of `{ voice, screen, picture, showFigure }`.
- **Scope gate:** the same call decides `onTopic` (insurance, family money, protection, retirement, health
  costs). Off topic: nothing is written, the agent sees the reason and can edit the brief. The prompt is data
  placed between delimiters; instructions inside it are never followed.
- **Numbers:** every number said or shown must be one the agent typed in the brief or one of the figure's
  facts (premium, sum, age). The model may not work out its own sums. Checked in code, as
  `allowedNumbers` / `numbersIn` do for วิดีโอนำเสนอ (`brief.ts`).
- **Words:** the existing forbidden voice words (เบี้ย in the voice, เสียชีวิต, เวนคืน), no promise past the
  plan (no "การันตี", no "ไม่ต้องตรวจสุขภาพ", no returns, no named company comparisons).
- **Failure:** a scene that fails is asked for once more with the reasons; if it fails again that scene gets
  a plain line with no figures. If the model is down the script is a fixed three-line outline the agent edits.
  The clip can always be made.
- **Figure scene:** if a premium was picked, the writer marks one scene `showFigure`. The system, not the
  model, draws that scene's note card with the exact figures, as the story clip does.

## Pictures

- One image per scene from the Organic painters (`src/lib/content/models.ts`), prompted from the scene's
  picture note plus the chosen style's fixed prefix. Every prompt ends with "no text, no numbers, no logos,
  no real people's likeness", because words and numbers are laid over by the renderer and cannot be wrong.
- **Styles (first round, three):** ลายเส้นการ์ตูน, ภาพสมจริง, มินิมอลแบน. Each is a prefix in one table; a
  fourth is one more row.
- Picture sizes follow the clip's size. A picture that fails is retried once, then the scene falls back to the
  paper background with its words, and the agent is told which scene to redraw.
- Pictures are filed with the clip so a single scene can be redrawn and the clip cut again.

## Rendering

- New input `product: "FREESTORY"` beside `STORY` (`isStoryInput`-style guard), carrying the brief, the chosen
  options and the approved script. The clip row is the existing `ins_quote_videos` row, so the desk, progress
  bar, save, Page calendar and ประวัติผู้ใช้ already show it.
- Scenes: a new scene key (`freeScene`, indexed) joins `StorySceneKey` and `TRANSITIONS`. A scene is the picture
  full bleed with a slow push-in, the on-screen words and the subtitles over it; the last scene is the existing
  agent card (`storyContact`).
- Voice, sizes, ElevenLabs, quota notice and the Cloud Run engine are unchanged.
- Re-drawing one picture reuses the stored voice files; if they are not kept today, keeping them is part of
  this work.

## Money

| Step | Cost |
| --- | --- |
| เขียนบท | free (rate-limited: 20 scripts per agent per hour, to cap the owner's model spend) |
| สร้างคลิป | `videoStory` price + scenes × the painter's picture price, shown before the press |
| วาดภาพฉากนี้ใหม่ | one picture price |

Charged and released as the story clip's wallet flow is; the free-clip allowance covers the clip part only.
Owner can set both prices on /admin/wallet (existing keys; no new price key in round one).

## Where, who, history

- New Studio page **คลิปตามโจทย์** (`/studio/prompt-story`) in the menu beside คลิปเล่าเรื่อง. Open to every
  agent and to สมาชิกทั่วไป, as the story clip is.
- Table `ins_prompt_drafts` (id, agent_id, brief jsonb, script jsonb, created_at) keeps briefs and scripts
  before a clip exists; the finished clip's input keeps the final script. One migration, applied to the
  production database before the push.
- ประวัติผู้ใช้ (/admin/history) lists every brief, script and clip per person for the Super Admin.

## Not in round one

The owner's hand-drawn faces and the family cast, the existing shelves' fixed episodes (they stay in
คลิปเล่าเรื่อง), a scene count the AI chooses, loops, the 90-second and 2-minute lengths, and posting
straight to a Page from this page (the calendar button on the clip does it).

## Testing

- Writer: a fake model proves refusal for an off-topic brief, a number not in the brief or the figure is
  caught and retried, a second failure falls back to a plain line, a model that is down returns the outline.
- Pipeline: a three-scene and an eight-scene input render in every size with fake pictures; one redrawn
  picture changes one frame and no voice file.
- Money: the total shown equals the amount reserved; a failed clip releases it; a redraw charges once.
- Frames rendered to PNG and looked at for long titles, eight scenes, and the figure scene, as for the shelves.
- The form itself is checked signed in on prod, which a local run cannot do.

## Open for the plan, not the owner

- Whether stored voice files already exist per scene (decides the size of the redraw work).
- The exact picture-style prefixes; they are tuned on real output before release.
- Whether the free-clip allowance should count the clip only (as written) or pictures too; default is the
  clip only unless the owner says otherwise.
