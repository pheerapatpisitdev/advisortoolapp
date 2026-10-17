// Renders one theme's clip from the pre-built bundle and prints how long each step took (local and Cloud Run).
//   THEME=navy node render.mjs           CONC=<n> to cap the browser tabs (default: every core)
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { readFileSync, statSync } from "node:fs";
import os from "node:os";

const t0 = Date.now();
const lap = (what) => console.log(JSON.stringify({ what, ms: Date.now() - t0 }));
const serveUrl = new URL("./build", import.meta.url).pathname;
const theme = process.env.THEME || "navy";
const inputProps = JSON.parse(readFileSync(new URL(`./build/public/props/${theme}.json`, import.meta.url), "utf8"));
const concurrency = Number(process.env.CONC || os.cpus().length);
const out = process.env.OUT || `/tmp/${theme}.mp4`;
await ensureBrowser();
lap("browser ready");
const composition = await selectComposition({ serveUrl, id: "QuoteMotion", inputProps });
lap("composition selected");
let last = -10;
await renderMedia({
  composition, serveUrl, inputProps, codec: "h264", crf: 21, concurrency, outputLocation: out,
  imageFormat: "jpeg", jpegQuality: 90, audioBitrate: "128k",
  onProgress: ({ progress }) => { const p = Math.floor(progress * 10) * 10; if (p > last) { last = p; lap(`render ${p}%`); } },
});
lap("render done");
const result = { done: true, theme, totalMs: Date.now() - t0, cpus: os.cpus().length, concurrency, memGiB: Math.round(os.totalmem() / 2 ** 30), bytes: statSync(out).size, seconds: inputProps.total };
console.log(JSON.stringify(result));

// on Cloud Run: the clip and its timing into the trial's bucket, with the job's own account
if (process.env.BUCKET) {
  const tok = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } }).then((r) => r.json());
  const run = `${process.env.PREFIX || "port"}/${theme}-${process.env.CLOUD_RUN_EXECUTION || Date.now()}`;
  const put = (name, body, type) => fetch(`https://storage.googleapis.com/upload/storage/v1/b/${process.env.BUCKET}/o?uploadType=media&name=${encodeURIComponent(name)}`, {
    method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": type }, body,
  }).then((r) => { if (!r.ok) throw new Error(`upload ${name}: ${r.status}`); });
  await put(`${run}.mp4`, readFileSync(out), "video/mp4");
  await put(`${run}.json`, JSON.stringify(result), "application/json");
  lap("uploaded");
}
