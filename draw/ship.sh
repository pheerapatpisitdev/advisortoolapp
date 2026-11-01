#!/usr/bin/env bash
# The draw service (draw/server.ts) for the drawing code this checkout names, deployed before that code reaches main
# (Cloudflare move step 1, owner chose ก 2026-11-02). The app sends DRAW_CORE (src/lib/draw/version.ts) with every
# call and the service refuses another, so the app draws for itself until the service runs its code. Run by
# .githooks/pre-push on a push to main; by hand: draw/ship.sh
#
# When the service already runs this DRAW_CORE it ends at once. Otherwise (3–5 minutes):
#   1. the bundle (node draw/bundle.mjs): build/server.mjs and fonts/
#   2. the image, :core-<DRAW_CORE> (skipped when built already)
#   3. a new revision of advisortool-draw on it, then /health must name this DRAW_CORE
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PROJECT=advisortool-video
REGION=asia-southeast1
SERVICE=advisortool-draw
FP="$(sed -n 's/^export const DRAW_CORE = "\([0-9a-f]*\)";.*/\1/p' "$ROOT/src/lib/draw/version.ts")"
[ -n "$FP" ] || { echo "draw ship: DRAW_CORE not found in version.ts" >&2; exit 1; }
IMAGE="$REGION-docker.pkg.dev/$PROJECT/clip/draw:core-$FP"
g() { gcloud --project "$PROJECT" --quiet "$@"; }

command -v gcloud >/dev/null || { echo "draw ship: gcloud is not installed" >&2; exit 1; }
gcloud auth print-access-token >/dev/null 2>&1 || { echo "draw ship: gcloud is not signed in (gcloud auth login)" >&2; exit 1; }

URL="$(g run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)' 2>/dev/null || true)"
health() { curl -fsS --max-time 20 -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$1/health"; }
if [ -n "$URL" ] && health "$URL" | grep -q "\"core\":\"$FP\""; then
  echo "draw ship: $SERVICE runs core $FP."
  exit 0
fi
echo "draw ship: the drawing code changed — deploying $SERVICE core $FP (3–5 minutes)…"

# 1. the bundle
(cd "$ROOT" && node draw/bundle.mjs)

# 2. the image
if g artifacts docker images describe "$IMAGE" >/dev/null 2>&1; then
  echo "draw ship: image core-$FP is built already."
else
  (cd "$ROOT/draw" && g builds submit . --config cloudbuild.yaml --region "$REGION" --substitutions "_TAG=core-$FP")
fi

# 3. the revision. No instance kept on: Cloud Run charges only while a request is drawn, and an idle
#    instance stays warm a while after one. 2 GiB for the quote PDF's Chrome, as on Vercel.
g run deploy "$SERVICE" --region "$REGION" --image "$IMAGE" --cpu 1 --memory 2Gi --concurrency 8 \
  --min-instances 0 --max-instances 10 --timeout 120 --cpu-boost --no-allow-unauthenticated \
  --service-account "draw-runner@$PROJECT.iam.gserviceaccount.com"
# the only caller: the account of the app's Google key (provider "gcp", the one that starts the clips)
g run services add-iam-policy-binding "$SERVICE" --region "$REGION" \
  --member "serviceAccount:clip-render@$PROJECT.iam.gserviceaccount.com" --role roles/run.invoker >/dev/null
URL="$(g run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
for _ in 1 2 3 4 5 6; do
  if health "$URL" | grep -q "\"core\":\"$FP\""; then
    echo "draw ship: $SERVICE runs core $FP at $URL."
    exit 0
  fi
  sleep 5
done
echo "draw ship: $SERVICE does not answer core $FP at $URL/health" >&2
exit 1
