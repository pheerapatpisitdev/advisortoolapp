import { runRender } from "../ffmpeg-core/render.mjs";

const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/ffmpeg/ffmpeg";

export async function handler(event) {
  await runRender(event, { ffmpegPath: FFMPEG });
}
