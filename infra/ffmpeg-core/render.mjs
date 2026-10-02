// The render both containers run (AWS Lambda and Google Cloud Run): download the inputs, one ffmpeg command,
// PUT the outputs to their signed upload URLs, then tell the app. Never logs a URL or token.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { localize, postWithRetry, splitArgs } from "./core.mjs";

async function download(fetchFn, url, path) {
  const res = await fetchFn(url);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
}

function run(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-800) || `ffmpeg ${code}`))));
  });
}

/** the render itself: resolves with the uploaded outputs, throws on any failure */
async function render(event, dir, { ffmpegPath, fetchFn }) {
  for (const o of event.job.outputs) {
    if (!event.uploads?.[o.name]) throw new Error(`no upload target for ${o.name}`);
  }
  await mkdir(dir, { recursive: true });
  const inputs = {};
  for (const i of event.job.inputs) { inputs[i.name] = `${dir}/${i.name}`; await download(fetchFn, i.url, inputs[i.name]); }
  const outputs = Object.fromEntries(event.job.outputs.map((o) => [o.name, `${dir}/${o.file}`]));
  // split first, then fill each argument, so a path can never be split or re-quoted
  await run(ffmpegPath, splitArgs(event.job.command).map((a) => localize(a, inputs, outputs)));
  const done = {};
  for (const o of event.job.outputs) {
    const up = event.uploads[o.name];
    const res = await fetchFn(up.uploadUrl, { method: "PUT", headers: { "Content-Type": o.contentType, "x-upsert": "false" }, body: await readFile(outputs[o.name]) });
    if (!res.ok) throw new Error(`upload ${o.name} ${res.status}`);
    done[o.name] = { path: up.path };
  }
  return done;
}

/**
 * Render, then report to the app (callback retried). Resolves once the callback attempt is over, even when
 * the render failed (the failure was reported). A finished render is never reported failed because the POST hiccupped.
 * Logs the job id and a short reason only.
 */
export async function runRender(event, { ffmpegPath, fetch: fetchFn = fetch, log = (m) => console.error(m) } = {}) {
  const dir = `/tmp/${event.id}`;
  const say = (m) => log(`job ${event.id}: ${m}`);
  let result;
  try {
    result = { state: "done", outputs: await render(event, dir, { ffmpegPath, fetchFn }) };
  } catch (e) {
    const error = String(e?.message ?? e).slice(0, 500);
    say(`render failed: ${error}`);
    result = { state: "failed", error };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  // outside the try: a finished render is never reported failed because the POST hiccupped
  await postWithRetry(event.callbackUrl, { id: event.id, token: event.token, ...result }, { fetchFn, log: say }).catch((e) => { say(e.message); });
}
