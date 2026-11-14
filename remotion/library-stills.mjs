// คลังแอนิเมชัน's preview pictures (public/library/*.jpg in the app), drawn by Remotion as the clips are. From the repo root:
//
//   node remotion/library-stills.mjs
//
// It makes the props (remotion/prepare/library.test.ts: one คลิปเล่าเรื่อง per health episode and look, and the moments
// to photograph), bundles the drawing code afresh (the bundle refuses props of another REMOTION_DRAWING), then photographs
// each moment at 432×768 and shrinks it to 216×384, JPEG quality 85. NO_BUNDLE=1 keeps remotion/build as it is; ONLY=room
// photographs only the files whose names start so. Needs remotion's npm install and the fonts and faces a full prepare
// once wrote (remotion/README.md step 2). No voice, no database, no paid call.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const HERE = new URL(".", import.meta.url).pathname;
const APP = join(HERE, "..");
const OUT = join(APP, "public/library");
const serveUrl = join(HERE, "build");

const run = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
run("npx", ["vitest", "run", "--config", "remotion/prepare/vitest.config.ts", "remotion/prepare/library.test.ts"], APP, { LIBRARY: "1" });
if (!process.env.NO_BUNDLE) run("npx", ["remotion", "bundle", "src/index.ts", "--out-dir", "build"], HERE);

const shots = JSON.parse(readFileSync(join(HERE, "public/props/library.json"), "utf8")).filter((s) => !process.env.ONLY || s.file.startsWith(process.env.ONLY));
await ensureBrowser();
mkdirSync(OUT, { recursive: true });
const tmp = join(tmpdir(), `library-stills-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const loaded = new Map();
for (const shot of shots) {
  if (!loaded.has(shot.props)) {
    const inputProps = JSON.parse(readFileSync(join(HERE, `public/props/${shot.props}.json`), "utf8"));
    loaded.set(shot.props, { inputProps, composition: await selectComposition({ serveUrl, id: "StoryClip", inputProps }) });
  }
  const { inputProps, composition } = loaded.get(shot.props);
  const frame = Math.min(composition.durationInFrames - 1, Math.round(shot.at * composition.fps));
  const big = join(tmp, shot.file.replace(/\.jpg$/, ".png"));
  await renderStill({ composition, serveUrl, inputProps, frame, output: big, imageFormat: "png", scale: 0.4 });
  await sharp(big).resize(216, 384).jpeg({ quality: 85, mozjpeg: true }).toFile(join(OUT, shot.file));
  console.log(shot.file, `${shot.props} t=${(frame / composition.fps).toFixed(2)}`);
}
rmSync(tmp, { recursive: true, force: true });
