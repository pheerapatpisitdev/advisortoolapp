# Remotion trial: วิดีโอนำเสนอ's Motion Graphic themes (2026-10-17)

The Life Protect clip (WLF19H, ชาย 35, ทุน 1 ล้าน, portrait, 5 scenes) in the four themes, drawn by Remotion
with the app's own `motion.tsx` / `themes.tsx`. Report: https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9.

In the app (src/lib/quote-video/remotion.ts, make.ts cutWithRemotion): a portrait Motion Graphic Life Protect clip is
marked `engine: "remotion"` when made, as the switch on /admin/ai says (remotion-switch.ts; column
`ins_ai_settings.remotion_for`: off / owner / all, migration 20261116). Its voice and cut-outs go up as links and Cloud
Run job `remotion-render` (8 vCPU / 8 GiB, runs as clip-runner, started by clip-render) renders `job.mjs` from the
payload and answers /api/quote-video/job like clip-ffmpeg. Other plans, square and landscape stay on the satori frames.

**The image carries a copy of the drawing code.** Each clip's props say which version they were made for
(`REMOTION_DRAWING`), and the image refuses another (the clip fails and is not charged). When
`tests/quote-video/remotion-drawing.test.ts` fails, the drawing code changed: set the fingerprint it prints, then run
steps 2, 3 and 5 below before pushing, so the image and the app agree.

1. `npm install` here.
2. From the repo root: `npx vitest run --config remotion/prepare/vitest.config.ts` — writes `public/props/<theme>.json`,
   `public/audio/<theme>.wav`, fonts, pictures and stand-in cut-outs (Mac `say -v Narisa`; no database, no paid call).
   `OLD=1` also makes the same clips on the current engine in `out/`.
3. `npm run bundle`, then `THEME=collage OUT=$PWD/out/collage.mp4 node render.mjs`.
4. `THEME=collage node cloudrun/smoke.mjs` runs job.mjs against a stand-in app (links, upload, callback) on this Mac
   (`DRAWING=x` checks the refusal). The same on Cloud Run, through the trial job, which can write the trial bucket:
   `gcloud run jobs execute remotion-port --region asia-southeast1 --wait --args=node,cloudrun/smoke.mjs --update-env-vars THEME=paper,PUBLIC=build/public,PREFIX=render`.
5. Image: `gcloud builds submit . --config cloudrun/cloudbuild.yaml --region asia-southeast1` (tags clip/remotion-render;
   the job takes :latest at its next run). `cloudrun/stats.sh <execution>` reads a trial run's timing.

`remotion.config.ts` aliases `@` to the app's `src`, and `node:fs/promises`, `node:path`, `sharp` to `src/shims`, which read
the same files from this project's `public/` in the browser. `.sat` CSS in `Clip.tsx` makes Chrome lay boxes out as satori does.
Licence: Remotion's free licence (company of up to 3 people); re-read LICENSE.md before moving to Remotion 5.
