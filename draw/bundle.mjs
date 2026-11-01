// The service's one file, build/server.mjs: draw/server.ts and the app's drawing code it imports, bundled the
// way tests/draw/core-fingerprint.test.ts fingerprints them; the card faces copied to fonts/. Run from the repo
// root by draw/ship.sh (node draw/bundle.mjs).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

export const ROOT = path.resolve(import.meta.dirname, "..");
/** installed in the image (draw/package.json), not bundled: native, or Chrome itself */
export const EXTERNAL = ["satori", "@resvg/resvg-js", "sharp", "puppeteer-core", "@sparticuz/chromium"];
export const FONTS = ["IBMPlexSansThai-Regular.ttf", "IBMPlexSansThai-SemiBold.ttf", "Trirong-SemiBold.ttf"];

/** @param {boolean} write @returns {import("esbuild").BuildOptions & { metafile: true }} */
export function bundleOptions(write) {
  return {
    entryPoints: [path.join(ROOT, "draw/server.ts")], bundle: true, platform: "node", target: "node22", format: "esm",
    outfile: path.join(ROOT, "draw/build/server.mjs"), write, metafile: true, logLevel: "silent",
    alias: { "@": path.join(ROOT, "src") }, external: EXTERNAL,
    // a CommonJS module bundled into ESM may still call require()
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rmSync(path.join(ROOT, "draw/build"), { recursive: true, force: true });
  await build(bundleOptions(true));
  mkdirSync(path.join(ROOT, "draw/fonts"), { recursive: true });
  for (const f of FONTS) cpSync(path.join(ROOT, "src/app/api/card", f), path.join(ROOT, "draw/fonts", f));
  console.log("draw: bundled build/server.mjs and fonts/");
}
