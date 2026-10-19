#!/usr/bin/env bash
# The Remotion job for the drawing the code names, made before that code reaches main (Remotion move phase 0,
# owner chose ก ก ก ก, 2026-10-19). The app starts `remotion-<REMOTION_DRAWING>` (src/lib/quote-video/remotion.ts),
# so each drawing has a job of its own: the app as deployed and the job it starts always agree, and no
# image has to wait for Vercel. Run by .githooks/pre-push on a push to main; by hand: remotion/cloudrun/ship.sh
#
# When the job is there already it ends at once. Otherwise (5–10 minutes):
#   1. the prepare step (both runs: the four themes, then iHealthy's languages) and the bundle
#   2. the image, :drawing-<fingerprint> (skipped when a stopped run built it already)
#   3. smoke renders of it on the trial job remotion-port (a paper วิดีโอนำเสนอ, กองกลาง 48 คน, a คลิปตามโจทย์), which must end in clips
#   4. the job remotion-<fingerprint> (8 vCPU / 8 GiB, as clip-runner), startable by clip-render
#   5. the drawing jobs past the newest three deleted (no app still deployed names them)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PROJECT=advisortool-video
REGION=asia-southeast1
FP="$(sed -n 's/^export const REMOTION_DRAWING = "\([0-9a-f]*\)";.*/\1/p' "$ROOT/src/lib/quote-video/remotion.ts")"
[ -n "$FP" ] || { echo "ship: REMOTION_DRAWING not found in remotion.ts" >&2; exit 1; }
JOB="remotion-$FP"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/clip/remotion-render:drawing-$FP"
g() { gcloud --project "$PROJECT" --quiet "$@"; }

command -v gcloud >/dev/null || { echo "ship: gcloud is not installed" >&2; exit 1; }
gcloud auth print-access-token >/dev/null 2>&1 || { echo "ship: gcloud is not signed in (gcloud auth login)" >&2; exit 1; }

if g run jobs describe "$JOB" --region "$REGION" >/dev/null 2>&1; then
  echo "ship: $JOB is ready."
  exit 0
fi
echo "ship: the drawing changed — making $JOB (5–10 minutes)…"

# 1. props, fonts, pictures and the bundle
[ -d "$ROOT/remotion/node_modules" ] || (cd "$ROOT/remotion" && npm ci --no-audit --no-fund)
(cd "$ROOT" && npx vitest run --config remotion/prepare/vitest.config.ts --reporter=dot)
(cd "$ROOT" && IHEALTHY=th:collage,zh:navy,ru:paper,my:clean npx vitest run --config remotion/prepare/vitest.config.ts --reporter=dot)
(cd "$ROOT/remotion" && rm -rf build && npm run bundle)

# 2. the image
if g artifacts docker images describe "$IMAGE" >/dev/null 2>&1; then
  echo "ship: image drawing-$FP is built already."
else
  (cd "$ROOT/remotion" && g builds submit . --config cloudrun/cloudbuild.yaml --region "$REGION" --substitutions "_TAG=drawing-$FP")
fi

# 3. clips from it before anyone gets it: a วิดีโอนำเสนอ (paper), กองกลาง 48 คน and a คลิปตามโจทย์, at once
g run jobs update remotion-port --region "$REGION" --image "$IMAGE"
pids=()
for theme in paper st-pool48 st-free; do
  g run jobs execute remotion-port --region "$REGION" --wait --args=node,cloudrun/smoke.mjs \
    --update-env-vars "THEME=$theme,PUBLIC=build/public,PREFIX=ship" >/dev/null 2>&1 &
  pids+=("$!:$theme")
done
for p in "${pids[@]}"; do
  wait "${p%%:*}" || { echo "ship: the smoke render ${p#*:} of drawing-$FP failed (gcloud run jobs executions list --job remotion-port)" >&2; exit 1; }
done

# 4. the job the app will start
g run jobs create "$JOB" --region "$REGION" --image "$IMAGE" --cpu 8 --memory 8Gi --max-retries 0 --task-timeout 900 \
  --service-account "clip-runner@$PROJECT.iam.gserviceaccount.com"
g run jobs add-iam-policy-binding "$JOB" --region "$REGION" \
  --member "serviceAccount:clip-render@$PROJECT.iam.gserviceaccount.com" --role roles/run.jobsExecutorWithOverrides >/dev/null

# 5. the drawing jobs no deployed app names any more
g run jobs list --region "$REGION" --sort-by=~metadata.creationTimestamp --format="value(metadata.name)" \
  | { grep -E '^remotion-[0-9a-f]{12}$' || true; } | tail -n +4 | while read -r old; do
    echo "ship: deleting $old"
    g run jobs delete "$old" --region "$REGION" || echo "ship: $old not deleted (left as it is)" >&2
  done

echo "ship: $JOB is ready."
