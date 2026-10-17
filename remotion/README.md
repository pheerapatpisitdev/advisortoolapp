# Remotion trial: วิดีโอนำเสนอ's Motion Graphic themes (2026-10-17)

The Life Protect clip (WLF19H, ชาย 35, ทุน 1 ล้าน, portrait, 5 scenes) in the four themes, drawn by Remotion
with the app's own `motion.tsx` / `themes.tsx`. Report: https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9.

In the app (src/lib/quote-video/remotion.ts, make.ts cutWithRemotion): the owner's portrait Thai/English Motion Graphic
clips are marked `engine: "remotion"` when made; their voice and cut-outs go up as links and Cloud Run job
`remotion-render` (8 vCPU / 8 GiB, runs as clip-runner, started by clip-render) renders `job.mjs` from the payload and
answers /api/quote-video/job like clip-ffmpeg. Everyone else's clips are made as before.

**The image carries a copy of the drawing code.** After any change to motion.tsx, themes.tsx or what they import, run
the prepare step, `npm run bundle` and the Cloud Build below again, or Remotion clips keep the old drawing.

1. `npm install` here.
2. From the repo root: `npx vitest run --config remotion/prepare/vitest.config.ts` — writes `public/props/<theme>.json`,
   `public/audio/<theme>.wav`, fonts, pictures and stand-in cut-outs (Mac `say -v Narisa`; no database, no paid call).
   `OLD=1` also makes the same clips on the current engine in `out/`.
3. `npm run bundle`, then `THEME=collage OUT=$PWD/out/collage.mp4 node render.mjs`.
4. `THEME=collage node cloudrun/smoke.mjs` runs job.mjs against a stand-in app (links, upload, callback) on this Mac.
5. Image: `gcloud builds submit . --config cloudrun/cloudbuild.yaml --region asia-southeast1` (tags clip/remotion-render;
   the job takes :latest at its next run). The trial's job `remotion-port` ran render.mjs with THEME (image clip/remotion-port);
   `cloudrun/stats.sh <execution>` reads a run's timing.

`remotion.config.ts` aliases `@` to the app's `src`, and `node:fs/promises`, `node:path`, `sharp` to `src/shims`, which read
the same files from this project's `public/` in the browser. `.sat` CSS in `Clip.tsx` makes Chrome lay boxes out as satori does.
Licence: Remotion's free licence (company of up to 3 people); re-read LICENSE.md before moving to Remotion 5.
