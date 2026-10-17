# Remotion trial: วิดีโอนำเสนอ's Motion Graphic themes (2026-10-17)

The Life Protect clip (WLF19H, ชาย 35, ทุน 1 ล้าน, portrait, 5 scenes) in the four themes, drawn by Remotion
with the app's own `motion.tsx` / `themes.tsx`. Report: https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9.
Nothing in the app's clip pipeline uses this yet.

1. `npm install` here.
2. From the repo root: `npx vitest run --config remotion/prepare/vitest.config.ts` — writes `public/props/<theme>.json`,
   `public/audio/<theme>.wav`, fonts, pictures and stand-in cut-outs (Mac `say -v Narisa`; no database, no paid call).
   `OLD=1` also makes the same clips on the current engine in `out/`.
3. `npm run bundle`, then `THEME=collage OUT=$PWD/out/collage.mp4 node render.mjs`.
4. Cloud Run: `gcloud builds submit . --config cloudrun/cloudbuild.yaml --region asia-southeast1`, then
   `gcloud run jobs execute remotion-port --region asia-southeast1 --wait --update-env-vars THEME=paper`
   (job: 8 vCPU / 16 GiB, writes to gs://advisortool-video-remotion-trial/port/). `cloudrun/stats.sh <execution>` reads its timing.

`remotion.config.ts` aliases `@` to the app's `src`, and `node:fs/promises`, `node:path`, `sharp` to `src/shims`, which read
the same files from this project's `public/` in the browser. `.sat` CSS in `Clip.tsx` makes Chrome lay boxes out as satori does.
Licence: Remotion's free licence (company of up to 3 people); re-read LICENSE.md before moving to Remotion 5.
