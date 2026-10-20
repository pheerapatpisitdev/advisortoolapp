import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { REMOTION_DRAWING } from "@/lib/quote-video/remotion";

/**
 * The Remotion image carries its own copy of the drawing code (remotion/README.md): a clip whose
 * props were made by another version of it would be drawn wrong, so the image refuses it
 * (remotion/src/Root.tsx). REMOTION_DRAWING is that version — a fingerprint of every file the
 * composition bundles, from the app's src and data. Changing any of them fails this test until
 * the fingerprint is set to the new one; the pre-push hook then makes that drawing's job (remotion/cloudrun/ship.sh).
 */

const root = path.resolve(__dirname, "../..");
const SHIMS: Record<string, string> = {
  "node:fs/promises": "remotion/src/shims/fs.ts", "node:path": "remotion/src/shims/path.ts",
};

/** the fingerprint of the drawing code as it stands; remotion.ts is read without the line that holds it */
async function drawingNow(): Promise<string> {
  const out = await build({
    entryPoints: [path.join(root, "remotion/src/index.ts")], bundle: true, write: false, metafile: true, platform: "browser",
    format: "esm", jsx: "automatic", logLevel: "silent", alias: { "@": path.join(root, "src") },
    external: ["remotion", "react", "react-dom", "react/*"],
    plugins: [{
      name: "shims",
      setup(b) {
        b.onResolve({ filter: /^(node:fs\/promises|node:path)$/ }, (a) => ({ path: path.join(root, SHIMS[a.path]) }));
      },
    }],
  });
  const files = Object.keys(out.metafile.inputs).filter((f) => !f.includes("node_modules"))
    .concat(["remotion/remotion.config.ts", "remotion/package.json"]).sort();
  const h = createHash("sha256");
  for (const f of files) {
    let text = readFileSync(path.join(root, f), "utf8");
    if (f.endsWith("src/lib/quote-video/remotion.ts")) text = text.replace(/^export const REMOTION_DRAWING = .*$/m, "");
    h.update(`${f}\n${text}\n`);
  }
  // ลูกเล่นคลิปใหม่'s music and sound effects go into the image too (remotion/prepare copies them to public/fx)
  for (const f of readdirSync(path.join(root, "remotion/sounds")).sort()) {
    h.update(`remotion/sounds/${f}\n`);
    h.update(readFileSync(path.join(root, "remotion/sounds", f)));
  }
  return h.digest("hex").slice(0, 12);
}

it("REMOTION_DRAWING is the fingerprint of the drawing code the Remotion image is built from", async () => {
  const now = await drawingNow();
  expect(REMOTION_DRAWING, `the drawing code changed: set REMOTION_DRAWING = "${now}" in src/lib/quote-video/remotion.ts; the push to main makes its job (remotion/cloudrun/ship.sh)`).toBe(now);
}, 60_000);
