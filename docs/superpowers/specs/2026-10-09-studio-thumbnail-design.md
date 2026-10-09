# ภาพปกคลิป (Studio thumbnail) — design

Date: 2026-10-09. Owner request: a cover-image / thumbnail generator for video clips, split out of Organic Studio and placed in the Studio main menu.

## Decisions from the owner

- **Sizes:** 9:16 (Reels / TikTok) and 16:9 (YouTube / Facebook video), picked before generating.
- **Main picture, three sources:** the owner's own photo (people library), a frame from an uploaded clip, or a fully AI-made picture.
- **Words on the cover:** AI proposes headlines from a topic or script; the owner may type their own and edit freely.
- **Words are drawn by the AI inside the picture** (not overlaid by code). A read-back check warns about wrong Thai; the owner can regenerate.
- **Free prompt:** a field to write the scene by hand.
- **After generating:** download, plus a history to come back to. Linking a cover to a Studio video clip is a later round.
- **Where:** a new item in the Studio left menu, beside Organic Studio. **Owner only** (like Ads Studio). No wallet, no free rounds; cost counts toward the owner's monthly AI budget.

## Rounds

1. **Round 1:** sizes, headline ideas, AI-made picture or own photo, free prompt, check, download, history.
2. **Round 2:** frame from an uploaded clip, extracted in the browser (no upload of the clip), then AI composes the cover on it.
3. **Round 3 (only if asked):** use a cover on a Studio video clip when posting to a Page.

This spec covers round 1 in detail; rounds 2–3 are noted so round 1 leaves room for them.

## Screen — `/studio/thumbnail`

Menu: `{ href: "/studio/thumbnail", label: "ภาพปกคลิป", icon: "image" }` in `studioMenu` after Organic Studio, hidden unless `who.owner`. The page calls `gatePage("/studio/thumbnail", "owner")`.

Left, in order: size (9:16 / 16:9) → topic or script + "ให้ AI คิดหัวปก" (5 options; picking fills **หัวปก** and **บรรทัดรอง**, both editable) → main picture (`AI สร้างทั้งภาพ` / `รูปตัวเอง` with person + pose from `POSES`) → cover style (4: big YouTube-bold, alert/news, clean minimal, warm friendly) → folded "เขียน prompt เอง" → AI model → **สร้างภาพปก**.

Right: the picture at true ratio, the text check (`✓` or `⚠` with what the AI wrote), buttons download / generate again (same settings) / use these settings (refill the form), and the history (newest first, view large, download, delete). Desktop is two columns, phone stacks.

Safe areas are put into the prompt by the code: 9:16 keeps text out of roughly the top 15% and bottom 25%; 16:9 keeps the bottom-right corner clear.

## Generation of one cover

1. **Headline ideas** (optional): one `chat` call, task `content-thumbnail-ideas`, returns 5 `{ headline, sub }` (headline about 6–8 words), using the opening-formula ideas already in the app.
2. **Prompt:** English prompt built from size, style, main picture, and the exact Thai words to draw character for character. A free prompt replaces only the *scene* part; size, words, safe areas and the keep-the-face instruction stay. Follows `posterPrompt()` in `src/lib/content/background.ts`.
3. **Draw:** `drawImage` gains an optional per-call `aspect` (`"9:16" | "16:9"`). Gemini receives `aspect_ratio` directly; OpenAI gets `1024x1536` / `1536x1024` (2:3 / 3:2) and the result is cropped to the exact ratio, with the prompt asking for words clear of the cropped edges. Gemini is first for both with and without a person (exact size); OpenAI is the fallback. Calls that do not pass `aspect` stay 1:1 as today.
4. **Check:** `readPosterText` compares the picture with the typed words. Warning only; download is never locked.
5. **Save:** full image to a private bucket `thumbnail-images` at `<agentId>/<rowId>.jpg`; a row in `ins_thumbnail_history` with all settings (size, headline, sub, style, source, person id, pose, free prompt, model, cost, text-check result). Newest 200 kept; older rows and files removed on each save. Modelled on `src/lib/content/describe-history.ts` (signed links of an hour, UUID checks, agent id from the server).

## Limits, cost, errors

- Task names start with `content-` (`content-thumbnail`, `content-thumbnail-ideas`) so the monthly ceiling counts them; labels added in `src/app/admin/ai/task-labels.ts` ("ภาพปกคลิป").
- Shares the 40-pictures-per-hour limiter with Organic.
- No `takeRound` / wallet: the owner alone uses it.
- Failures show a Thai message (provider down, budget used up); no history row is written without a picture.

## Files (planned)

- `src/lib/ai/client.ts`, `src/lib/ai/images.ts` — per-call `aspect`; crop for OpenAI.
- `src/lib/content/thumbnail.ts` — prompt builder, styles, safe areas, headline-ideas call.
- `src/lib/content/thumbnail-history.ts` — save / list / delete.
- `src/app/api/content-thumbnail/route.ts` (+ ideas route) — owner-gated.
- `src/app/studio/thumbnail/` — `page.tsx`, `ThumbnailBoard.tsx`.
- `src/lib/shell/menu.ts` and `tests/calc/shell-menu.test.ts` — menu item and test.
- `supabase/migrations/20261014_thumbnail_history.sql` — table + bucket (additive).
- `docs`/memory note after release.

## Testing

Unit tests for the prompt builder (words included verbatim, free prompt replaces only the scene, safe areas per size), the crop ratio, history trimming and ids, and the menu test. Then a browser check on the dev server — note `.env.local` is the production database, so a test generation writes a real row and spends real AI budget.

## Out of scope for round 1

Clip frame extraction (round 2), cover-to-clip linking (round 3), editing text on a finished image without redrawing, multi-image batches, other roles.
