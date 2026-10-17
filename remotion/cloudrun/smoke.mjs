// A run of job.mjs against a stand-in app: the payload, the voice and the cut-outs served as links, the video PUT
// and the callback caught here. THEME=collage node cloudrun/smoke.mjs (after the prepare step and the bundle).
// THEME=ih-zh runs the iHealthy props (IHEALTHY prepare step). DRAWING=x sends props made for another drawing (the image must refuse them). In the image (PUBLIC=build/public),
// BUCKET names where the clip and the callback go, with the job's own account, as render.mjs does.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { runJob } from "../job.mjs";

const root = new URL("..", import.meta.url).pathname;
const pub = `${root}${process.env.PUBLIC || "public"}`;
const out = process.env.BUCKET ? "/tmp" : `${root}out`;
const theme = process.env.THEME || "collage";
let callback;
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  res.setHeader("Access-Control-Allow-Origin", "*"); // as Supabase storage answers the signed links
  req.on("end", () => {
    if (req.method === "PUT" && req.url === "/upload") { writeFileSync(`${out}/smoke-${theme}.mp4`, Buffer.concat(chunks)); res.end(); return; }
    if (req.method === "POST" && req.url === "/callback") { callback = JSON.parse(Buffer.concat(chunks).toString()); res.end("{}"); return; }
    try { res.end(readFileSync(`${pub}${decodeURIComponent(req.url)}`)); } catch { res.statusCode = 404; res.end(); }
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const props = JSON.parse(readFileSync(`${pub}/props/${theme}.json`, "utf8"));
if (process.env.DRAWING) props.drawing = process.env.DRAWING;
props.audio = `${base}/${props.audio}`;
for (const k of Object.keys(props.pieces)) props.pieces[k] = `${base}/${props.pieces[k]}`;
for (const f of props.scriptFont ?? []) f.url = `${base}/${f.url}`;
const payload = { id: "smoke", remotion: { props }, uploads: { out_1: { uploadUrl: `${base}/upload`, path: "smoke/quote.mp4" } }, callbackUrl: `${base}/callback`, token: "t" };
writeFileSync(`${pub}/smoke-payload.json`, JSON.stringify(payload));
const t0 = Date.now();
const code = await runJob({ env: { JOB_URL: `${base}/smoke-payload.json` }, log: (m) => console.log(m) });
const result = { code, theme, seconds: (Date.now() - t0) / 1000, callback };
console.log(JSON.stringify(result));
server.close();
if (process.env.BUCKET) {
  const tok = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } }).then((r) => r.json());
  const name = `${process.env.PREFIX || "render"}/${theme}-${process.env.CLOUD_RUN_EXECUTION || Date.now()}`;
  const put = (n, body, type) => fetch(`https://storage.googleapis.com/upload/storage/v1/b/${process.env.BUCKET}/o?uploadType=media&name=${encodeURIComponent(n)}`, {
    method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": type }, body,
  });
  if (callback?.state === "done") await put(`${name}.mp4`, readFileSync(`${out}/smoke-${theme}.mp4`), "video/mp4");
  await put(`${name}.json`, JSON.stringify(result), "application/json");
}
