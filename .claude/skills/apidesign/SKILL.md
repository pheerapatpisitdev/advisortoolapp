---
name: settings-look
description: The settings-kit look (sidebar of sections, rows with a control on the right, switches, chip + card for each company) used on /admin/ai. Use when building or restyling a settings, keys or admin page "แบบหน้าคีย์และโมเดล", or adding a section to /admin/ai.
---

# Settings look

The owner chose this look for /admin/ai on 2026-11-18 (option ข, mockup https://claude.ai/artifact/J3GD1YGtWCU9WTiovgeoDP, live 699aa48a). It is OpenFilm's settings-kit (MIT) redrawn in the back office's own colors. Reuse it; a new page in this look should feel like the same app.

## The pieces

All in `src/app/admin/ai/kit/` (read the files; their comments are the reference):

- `SettingsNav.tsx`: the frame. Sidebar with search on desktop, a row of buttons on a phone. Each section is named in the address (`#keys`), every section is rendered and the others hidden, so half-typed input survives a look elsewhere.
- `parts.tsx`: `SectionHead`, `GroupLabel`, `Group` (white sheet, a line between rows), `Item` (mark · title + line under · control on the right, wraps on a phone, `muted` when off), `Switch`, `Button` (`primary` navy / `normal` / `quiet`), `fieldClass`, `Said` (the saved/refused note beside its button), `Sheet` (card over the page; Esc, เสร็จสิ้น or a click beside closes).
- `marks.ts` + `ProviderMark`: one-color company logos (anthropic, openai, google, openrouter, elevenlabs; gcp wears google's); any other id draws its first letter in a rounded square.
- `LICENSE-openfilm`: the MIT notice. It stays with the pieces wherever they go.

Worked example of every piece: `src/app/admin/ai/AiClient.tsx` (chips → card, budget rows, rates pill) and `LanesCard.tsx` (ordered rows with หลัก / สำรอง n).

## Steps

1. **Mockup first** (the `mockup-first` skill): show the page in this look, real labels and figures, and wait for the owner's yes.
2. **Move the kit when a second page uses it.** The first page outside /admin/ai moves `src/app/admin/ai/kit/` to `src/components/settings-kit/` (LICENSE with it) and updates the imports. Done when `grep -r "admin/ai/kit" src tests` is empty.
3. **Build from the pieces.** Colors come only from the `--bot-*` tokens (navy `--bot-navy` for the chosen/on state, `--bot-ok` / `--bot-red-ink` / `--bot-sand-ink` for status). One card or table of the old page becomes one section; rows replace tables; on/off is a `Switch`, never a checkbox. A company list is chips with a dot (green on, grey off, red failed last test) opening a `Sheet`. Keep the page's server actions as they are: the look changes, what the buttons call does not. A switch that stops work site-wide keeps its `window.confirm` naming what stops.
4. **Keep old links landing.** Any `/page#anchor` linked from elsewhere becomes a section id.
5. **Check it.** A render test like `tests/admin/ai-kit-page.test.ts` (sections hidden, chips, switches); then tsc, vitest, `next build`. Admin pages need the Google-only Super Admin, so look at the layout through a throwaway sample-data route under `src/app/dev-*` at desktop and 375 px, delete it, and remove `.next/types` before tsc.
