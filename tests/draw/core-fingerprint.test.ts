import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { DRAW_CORE } from "@/lib/draw/version";
import { bundleOptions, FONTS } from "../../draw/bundle.mjs";

/**
 * The draw service runs its own copy of the drawing code (draw/server.ts, bundled by draw/bundle.mjs): a picture
 * asked of another version of it could come out different, so the service refuses it and the app draws for
 * itself. DRAW_CORE is that version — a fingerprint of every app file the service bundles, its image's own files
 * and the card faces. Changing any of them fails this test until DRAW_CORE is set to the new one; the pre-push
 * hook then builds and deploys the service for it (draw/ship.sh).
 */

const root = path.resolve(__dirname, "../..");

async function coreNow(): Promise<string> {
  const out = await build(bundleOptions(false));
  const files = Object.keys(out.metafile.inputs)
    .filter((f) => !f.includes("node_modules") && !f.endsWith("src/lib/draw/version.ts"))
    .concat(["draw/Dockerfile", "draw/package.json"]).sort();
  const h = createHash("sha256");
  for (const f of files) h.update(`${f}\n${readFileSync(path.join(root, f), "utf8")}\n`);
  for (const f of FONTS) {
    h.update(`font ${f}\n`);
    h.update(readFileSync(path.join(root, "src/app/api/card", f)));
  }
  return h.digest("hex").slice(0, 12);
}

it("DRAW_CORE is the fingerprint of the drawing code the draw service is built from", async () => {
  const now = await coreNow();
  expect(DRAW_CORE, `the drawing code changed: set DRAW_CORE = "${now}" in src/lib/draw/version.ts; the push to main deploys it (draw/ship.sh)`).toBe(now);
}, 60_000);
