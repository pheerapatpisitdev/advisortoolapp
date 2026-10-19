# Remotion trial: วิดีโอนำเสนอ's Motion Graphic themes (2026-10-17)

The Life Protect clip (WLF19H, ชาย 35, ทุน 1 ล้าน, portrait, 5 scenes) in the four themes, drawn by Remotion
with the app's own `motion.tsx` / `themes.tsx`. Report: https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9.

In the app (src/lib/quote-video/remotion.ts, make.ts cutWithRemotion): a portrait Motion Graphic Life Protect clip is
marked `engine: "remotion"` when made, as the switch on /admin/ai says (remotion-switch.ts; column
`ins_ai_settings.remotion_for`: off / owner / all, migration 20261116). Its voice and cut-outs go up as links and Cloud
Run job `remotion-<REMOTION_DRAWING>` (8 vCPU / 8 GiB, runs as clip-runner, started by clip-render) renders `job.mjs` from the
payload and answers /api/quote-video/job like clip-ffmpeg. Other plans, square and landscape stay on the satori frames.

**The image carries a copy of the drawing code, so each drawing has a job of its own** (Remotion move phase 0,
2026-10-19). Each clip's props say which version they were made for (`REMOTION_DRAWING`), and the image refuses another
(the clip fails and is not charged). The app starts `remotion-<REMOTION_DRAWING>`. When
`tests/quote-video/remotion-drawing.test.ts` fails, the drawing code changed: set the fingerprint it prints. The push to
main then runs `cloudrun/ship.sh` from `.githooks/pre-push`: prepare, bundle, image `:drawing-<fingerprint>`, a smoke
render on `remotion-port`, then the job `remotion-<fingerprint>` (8 vCPU / 8 GiB, as clip-runner, startable by
clip-render), keeping the newest three. A drawing whose job is there already pushes at once; a new one takes 5–10
minutes. A change merged on GitHub skips the hook: run `remotion/cloudrun/ship.sh` from this Mac before Vercel serves it,
or its Remotion clips fail (not charged) until it is run.

The steps below are what ship.sh does, for trying a drawing by hand.

1. `npm install` here.
2. From the repo root: `npx vitest run --config remotion/prepare/vitest.config.ts` — writes `public/props/<theme>.json`,
   `public/audio/<theme>.wav`, fonts, pictures and stand-in cut-outs (Mac `say -v Narisa`; no database, no paid call).
   `OLD=1` also makes the same clips on the current engine in `out/`.
3. `npm run bundle`, then `THEME=paper OUT=$PWD/out/paper.mp4 node render.mjs`.
4. `THEME=paper node cloudrun/smoke.mjs` runs job.mjs against a stand-in app (links, upload, callback) on this Mac
   (`DRAWING=x` checks the refusal). The same on Cloud Run, through the trial job, which can write the trial bucket:
   `gcloud run jobs execute remotion-port --region asia-southeast1 --wait --args=node,cloudrun/smoke.mjs --update-env-vars THEME=paper,PUBLIC=build/public,PREFIX=render`.
5. Image: `gcloud builds submit . --config cloudrun/cloudbuild.yaml --region asia-southeast1` (tags clip/remotion-render:latest, or `--substitutions _TAG=drawing-<fingerprint>`;
   the job takes :latest at its next run). `cloudrun/stats.sh <execution>` reads a trial run's timing.
   An image with a new fingerprint refuses the live app's clips until the app is pushed: to try it first, build it
   under a tag of its own (`remotion-render:drawing-<fingerprint>`, the yaml with its tag changed), point remotion-port
   at it for step 4, point it back, and at push time add `latest` to that tag
   (`gcloud artifacts docker tags add …:drawing-<fingerprint> …:latest`).

iHealthy (owner chose 1ก 2ก): `IHEALTHY=th:paper,zh:navy,ru:paper,my:navy` on step 2 writes `props/ih-<lang>.json` with
each language's Noto face cut down as the app cuts it; `THEME=ih-zh` runs one on steps 3 and 4.

`remotion.config.ts` aliases `@` to the app's `src`, and `node:fs/promises` and `node:path` to `src/shims`, which read
the same files from this project's `public/` in the browser. `.sat` CSS in `Clip.tsx` makes Chrome lay boxes out as satori does.
Licence: Remotion's free licence (company of up to 3 people); re-read LICENSE.md before moving to Remotion 5.
