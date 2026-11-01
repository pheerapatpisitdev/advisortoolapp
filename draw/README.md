# advisortool-draw (Cloud Run)

The service that draws for the web app: every card and table picture, the posters, the LINE menu, the quote PDF
and the cover crop (Cloudflare move step 1, owner chose ก 2026-11-02,
https://claude.ai/artifact/AZyE2MYMK1f66JSta6cxN7).

- `server.ts` — the HTTP service; the drawing itself is the app's own code (`src/lib/draw/core.ts`,
  `src/lib/content/crop-here.ts`, `src/lib/quote-pdf/print.ts`), bundled into `build/server.mjs` by `bundle.mjs`.
- The app asks it when `DRAW_URL` is set (`src/lib/draw/remote.ts`) and draws for itself when it is not, or when the
  service fails or runs other drawing code (409).
- Only the app's Google account may call it (`clip-render@advisortool-video`, the "gcp" key on ตั้งค่า AI): the app
  signs in with that key; the service runs as `draw-runner`, which has no roles.
- `DRAW_CORE` (`src/lib/draw/version.ts`) is the drawing code's fingerprint; `tests/draw/core-fingerprint.test.ts`
  says when it changes, and the pre-push hook deploys it (`ship.sh`) before main moves.

Turn it off: remove `DRAW_URL` from the Vercel project and redeploy — every picture is then drawn on Vercel again.
