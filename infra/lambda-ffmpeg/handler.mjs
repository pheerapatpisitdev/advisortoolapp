import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { localize, postWithRetry, splitArgs } from "./core.mjs";

const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/ffmpeg/ffmpeg";

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800) || `ffmpeg ${code}`))));
  });
}

/** tell the app; retried on a hiccup. Logs the job id and a short reason only, never a URL or token. */
function callback(event, body) {
  return postWithRetry(event.callbackUrl, { id: event.id, token: event.token, ...body }, { log: (m) => console.error(`job ${event.id}: ${m}`) });
}

/** the render itself: resolves with the uploaded outputs, throws on any failure */
async function render(event, dir) {
  for (const o of event.job.outputs) {
    if (!event.uploads?.[o.name]) throw new Error(`no upload target for ${o.name}`);
  }
  await mkdir(dir, { recursive: true });
  const inputs = {};
  for (const i of event.job.inputs) { inputs[i.name] = `${dir}/${i.name}`; await download(i.url, inputs[i.name]); }
  const outputs = Object.fromEntries(event.job.outputs.map((o) => [o.name, `${dir}/${o.file}`]));
  // split first, then fill each argument, so a path can never be split or re-quoted
  await run(splitArgs(event.job.command).map((a) => localize(a, inputs, outputs)));
  const done = {};
  for (const o of event.job.outputs) {
    const up = event.uploads[o.name];
    const res = await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": o.contentType, "x-upsert": "false" }, body: await readFile(outputs[o.name]) });
    if (!res.ok) throw new Error(`upload ${o.name} ${res.status}`);
    done[o.name] = { path: up.path };
  }
  return done;
}

export async function handler(event) {
  const dir = `/tmp/${event.id}`;
  let result;
  try {
    result = { state: "done", outputs: await render(event, dir) };
  } catch (e) {
    const error = String(e?.message ?? e).slice(0, 500);
    console.error(`job ${event.id}: render failed: ${error}`);
    result = { state: "failed", error };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  // outside the try: a finished render is never reported failed because the POST hiccupped
  await callback(event, result).catch((e) => { console.error(`job ${event.id}: ${e.message}`); });
}
