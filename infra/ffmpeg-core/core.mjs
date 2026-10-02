// Pure helpers shared by the clip ffmpeg containers (AWS Lambda and Cloud Run) — tested in tests/video/lambda-core.test.ts.

/** a command line split like a shell would: double-quoted runs stay one argument, the quotes themselves are dropped; single quotes inside stay as characters (ffmpeg's filter parser wants them) */
export function splitArgs(command) {
  const out = [];
  let cur = "";
  let quote = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      cur += ch;
      continue;
    }
    if (ch === "\"") { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) { if (started) { out.push(cur); cur = ""; started = false; } continue; }
    cur += ch;
    started = true;
  }
  if (started) out.push(cur);
  return out;
}

/** {{in_1}} / {{out_1}} replaced by local paths */
export function localize(command, inputs, outputs) {
  return command.replace(/\{\{((?:in|out)_\d+)\}\}/g, (m, name) => inputs[name] ?? outputs[name] ?? m);
}

/**
 * POST a JSON body, trying again on a network error or a non-2xx answer (delays between attempts).
 * Throws the last failure. fetchFn / sleep are injectable for tests.
 */
export async function postWithRetry(url, body, { fetchFn = fetch, delaysMs = [1000, 3000, 9000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = (message) => void message } = {}) {
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
    log(`callback attempt ${attempt + 1} failed: ${last}`); // reason only: never the URL or token
  }
  throw new Error(`callback failed after ${delaysMs.length + 1} attempts: ${last}`);
}
