// The Remotion render as a Cloud Run Job (src/lib/quote-video/remotion.ts). JOB_URL, set by the app per run, is a
// signed link to the payload { id, remotion: { props }, uploads: { out_1: { uploadUrl, path } }, callbackUrl, token }:
// the clip is rendered from the pre-built bundle, PUT to its upload link, and the app told, as infra/ffmpeg-core does.
// Never logs a URL, a signed link or the token.
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import { pathToFileURL } from "node:url";

const serveUrl = new URL("./build", import.meta.url).pathname;

/** POST a JSON body, tried again on a network error or a non-2xx answer (infra/ffmpeg-core/core.mjs postWithRetry) */
export async function postWithRetry(url, body, { fetchFn = fetch, delaysMs = [1000, 3000, 9000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  let last = "unknown";
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    if (attempt > 0) await sleep(delaysMs[attempt - 1]);
    try {
      const res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) return;
      last = `status ${res.status}`;
    } catch (e) {
      last = String(e?.message ?? e).slice(0, 200);
    }
    log(`callback attempt ${attempt + 1} failed: ${last}`);
  }
  throw new Error(`callback failed after ${delaysMs.length + 1} attempts: ${last}`);
}

/** the clip itself: rendered, then put where the app said; resolves with the outputs as the callback names them */
async function render(event, out, { fetchFn, log, concurrency }) {
  const up = event.uploads?.out_1;
  if (!up) throw new Error("no upload target for out_1");
  const inputProps = event.remotion?.props;
  if (!inputProps?.scenes?.length) throw new Error("no props");
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id: "QuoteMotion", inputProps });
  let last = -25;
  await renderMedia({
    composition, serveUrl, inputProps, codec: "h264", crf: 21, concurrency, outputLocation: out,
    imageFormat: "jpeg", jpegQuality: 90, audioBitrate: "128k",
    onProgress: ({ progress }) => { const p = Math.floor(progress * 4) * 25; if (p > last) { last = p; log(`render ${p}% at ${((Date.now() - t0) / 1000).toFixed(1)}s`); } },
  });
  const res = await fetchFn(up.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "false" }, body: await readFile(out) });
  if (!res.ok) throw new Error(`upload out_1 ${res.status}`);
  return { out_1: { path: up.path } };
}

/** resolves with the exit code: 0 once the callback attempt is over (the render may have failed, and said so), 1 without a payload */
export async function runJob({ env = process.env, fetch: fetchFn = fetch, log = (m) => console.error(m), concurrency = Number(env.CONC || os.cpus().length) } = {}) {
  if (!env.JOB_URL) { log("job: JOB_URL missing"); return 1; }
  let event;
  try {
    const res = await fetchFn(env.JOB_URL);
    if (!res.ok) { log(`job: payload ${res.status}`); return 1; }
    event = JSON.parse(await res.text());
  } catch {
    log("job: payload unreadable");
    return 1;
  }
  const say = (m) => log(`job ${event.id}: ${m}`);
  const out = `/tmp/${String(event.id).replace(/[^\w-]/g, "")}.mp4`;
  let result;
  try {
    result = { state: "done", outputs: await render(event, out, { fetchFn, log: say, concurrency }) };
    say("done");
  } catch (e) {
    const error = String(e?.message ?? e).slice(0, 500);
    say(`render failed: ${error}`);
    result = { state: "failed", error };
  } finally {
    await rm(out, { force: true }).catch(() => {});
  }
  // outside the try: a finished render is never reported failed because the POST hiccupped
  await postWithRetry(event.callbackUrl, { id: event.id, token: event.token, ...result }, { fetchFn, log: say }).catch((e) => say(e.message));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runJob();
}
