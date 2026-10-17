// A local run of job.mjs against a stand-in app: the payload, the voice and the cut-outs served as links, the
// video PUT and the callback caught here. THEME=collage node cloudrun/smoke.mjs (after the prepare step and the bundle).
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { runJob } from "../job.mjs";

const root = new URL("..", import.meta.url).pathname;
const theme = process.env.THEME || "collage";
let callback;
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  res.setHeader("Access-Control-Allow-Origin", "*"); // as Supabase storage answers the signed links
  req.on("end", () => {
    if (req.method === "PUT" && req.url === "/upload") { writeFileSync(`${root}out/smoke-${theme}.mp4`, Buffer.concat(chunks)); res.end(); return; }
    if (req.method === "POST" && req.url === "/callback") { callback = JSON.parse(Buffer.concat(chunks).toString()); res.end("{}"); return; }
    try { res.end(readFileSync(`${root}public${decodeURIComponent(req.url)}`)); } catch { res.statusCode = 404; res.end(); }
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const props = JSON.parse(readFileSync(`${root}public/props/${theme}.json`, "utf8"));
props.audio = `${base}/${props.audio}`;
for (const k of Object.keys(props.pieces)) props.pieces[k] = `${base}/${props.pieces[k]}`;
const payload = { id: "smoke", remotion: { props }, uploads: { out_1: { uploadUrl: `${base}/upload`, path: "smoke/quote.mp4" } }, callbackUrl: `${base}/callback`, token: "t" };
writeFileSync(`${root}public/smoke-payload.json`, JSON.stringify(payload));
const t0 = Date.now();
const code = await runJob({ env: { JOB_URL: `${base}/smoke-payload.json` }, log: (m) => console.log(m) });
console.log(JSON.stringify({ code, seconds: (Date.now() - t0) / 1000, callback }));
server.close();
