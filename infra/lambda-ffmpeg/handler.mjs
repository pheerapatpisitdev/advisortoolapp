import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { localize, splitArgs } from "./core.mjs";

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

async function callback(event, body) {
  await fetch(event.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id, token: event.token, ...body }) });
}

export async function handler(event) {
  const dir = `/tmp/${event.id}`;
  await mkdir(dir, { recursive: true });
  try {
    const inputs = {};
    for (const i of event.job.inputs) { inputs[i.name] = `${dir}/${i.name}`; await download(i.url, inputs[i.name]); }
    const outputs = Object.fromEntries(event.job.outputs.map((o) => [o.name, `${dir}/${o.file}`]));
    await run(splitArgs(localize(event.job.command, inputs, outputs)));
    const done = {};
    for (const o of event.job.outputs) {
      const up = event.uploads[o.name];
      const res = await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": o.contentType, "x-upsert": "false" }, body: await readFile(outputs[o.name]) });
      if (!res.ok) throw new Error(`upload ${o.name} ${res.status}`);
      done[o.name] = { path: up.path };
    }
    await callback(event, { state: "done", outputs: done });
  } catch (e) {
    await callback(event, { state: "failed", error: String(e?.message ?? e).slice(0, 500) }).catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
