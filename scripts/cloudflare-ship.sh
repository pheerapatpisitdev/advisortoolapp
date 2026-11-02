#!/usr/bin/env bash
# The Cloudflare Worker (the live site since the Cloudflare move, step 4, owner chose ก 2026-11-02) built from the
# commit about to reach main, and deployed before main moves. Vercel builds the same commit from GitHub on its own
# and stays the standby. Run by .githooks/pre-push with the commit being pushed; by hand: scripts/cloudflare-ship.sh
#
# When the Worker's last code upload already carries this commit (its version tag) it ends at once. Otherwise
# (about 10 minutes): npm run cf:build for www.advisortool.app, then opennextjs-cloudflare deploy --tag <commit>.
# A secret changed in the dashboard or with `wrangler secret put` makes a version of its own but keeps the code,
# so those versions are skipped when looking for the last upload.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SHA="${1:-$(git -C "$ROOT" rev-parse HEAD)}"
WORKER=advisortool
SITE=https://www.advisortool.app

# what is built is the working tree, so it has to be the commit being pushed and nothing else
[ "$(git -C "$ROOT" rev-parse HEAD)" = "$SHA" ] || { echo "cloudflare ship: HEAD is not the commit being pushed ($SHA) — check it out first" >&2; exit 1; }
git -C "$ROOT" diff --quiet HEAD -- || { echo "cloudflare ship: uncommitted changes — commit or stash them first" >&2; exit 1; }

cd "$ROOT"
last_upload() {
  npx wrangler versions list --name "$WORKER" --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const code = JSON.parse(s).filter((v) => (v.annotations ?? {})["workers/triggered_by"] !== "secret").at(-1);
      process.stdout.write((code?.annotations ?? {})["workers/tag"] ?? "");
    });'
}
if [ "$(last_upload)" = "$SHA" ]; then
  echo "cloudflare ship: $WORKER runs ${SHA:0:8}."
  exit 0
fi
echo "cloudflare ship: building $WORKER for ${SHA:0:8} (about 10 minutes)…"
NEXT_PUBLIC_SITE_URL="$SITE" npm run cf:build >/tmp/advisortool-cf-build.log 2>&1 || {
  tail -30 /tmp/advisortool-cf-build.log >&2
  echo "cloudflare ship: the build failed (full log: /tmp/advisortool-cf-build.log)" >&2
  exit 1
}
# only the tag: OpenNext hands its arguments to wrangler through a shell, so a --message with spaces breaks apart
npx opennextjs-cloudflare deploy --tag "$SHA" >/tmp/advisortool-cf-deploy.log 2>&1 || {
  tail -30 /tmp/advisortool-cf-deploy.log >&2
  echo "cloudflare ship: the deploy failed (full log: /tmp/advisortool-cf-deploy.log)" >&2
  exit 1
}
[ "$(last_upload)" = "$SHA" ] || { echo "cloudflare ship: deployed, but the Worker does not name ${SHA:0:8}" >&2; exit 1; }
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$SITE/api/health")"
[ "$code" = 200 ] || { echo "cloudflare ship: $SITE/api/health answered $code after the deploy" >&2; exit 1; }
echo "cloudflare ship: $WORKER runs ${SHA:0:8}, health 200."
