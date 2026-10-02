// Cloud Run Job entry: JOB_URL (a signed link, set by the app per run) holds the same payload the Lambda receives.
// Never logs the URL, any signed link or the token.
import { pathToFileURL } from "node:url";
import { runRender as sharedRunRender } from "../ffmpeg-core/render.mjs";

/** resolves with the process exit code: 0 once the render's callback attempt is over, 1 when there is no payload to work with */
export async function runJob({ env = process.env, fetch: fetchFn = fetch, runRender = sharedRunRender, log = (m) => console.error(m) } = {}) {
  const url = env.JOB_URL;
  if (!url) { log("job: JOB_URL missing"); return 1; }
  let event;
  try {
    const res = await fetchFn(url);
    if (!res.ok) { log(`job: payload ${res.status}`); return 1; }
    event = JSON.parse(await res.text());
  } catch {
    log("job: payload unreadable"); // reason only: an error message could carry the link
    return 1;
  }
  await runRender(event, { ffmpegPath: env.FFMPEG_PATH ?? "/opt/ffmpeg/ffmpeg", fetch: fetchFn, log });
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runJob();
}
