import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";

/**
 * health-figures.ts is drawn into the Remotion image (story clips read the iHealthy figures): it reads the
 * opening arrangement from ihealthy-choice, so none of the bots' code (src/lib/assistant) comes with it.
 */
it("health-figures bundles no assistant (bot) code", async () => {
  const root = path.resolve(__dirname, "../..");
  const out = await build({
    entryPoints: [path.join(root, "src/lib/scene-library/health-figures.ts")], bundle: true, write: false, metafile: true,
    platform: "node", format: "esm", logLevel: "silent", alias: { "@": path.join(root, "src") }, packages: "external",
  });
  expect(Object.keys(out.metafile.inputs).filter((f) => f.includes("src/lib/assistant"))).toEqual([]);
}, 30_000);
