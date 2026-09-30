import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import type { AiText, PosterSpec } from "./poster";
import { READ_FAILED, blocksKey, comparePosterRead } from "./poster-text";

/**
 * The words on a poster the image model drew, read back off the picture and set against the
 * words it was told to draw (poster-text.ts). The reader is รีวิวเคลม's (claim-run.ts): it reads
 * Thai off a photograph well and cheaply. A reader that is down never costs the picture — the
 * agent is asked to read it themselves.
 */

const READER = "gemini-3.7-flash";
const READ_FALLBACK = ["gpt-5", "claude-sonnet-5"];
const READ_TIMEOUT_MS = 60_000;

const SYSTEM = [
  "Transcribe every piece of text visible in the image exactly as it is drawn, including Thai.",
  "Do not correct spelling, do not translate, do not add anything that is not drawn. Keep each line of text on its own line.",
  'Reply with JSON only: {"text":"…"} — lines separated by \\n. If there is no text, {"text":""}.',
].join("\n");

export async function readPosterText(bytes: Buffer, mimeType: string, poster: Pick<PosterSpec, "blocks">): Promise<AiText> {
  const blocks = blocksKey(poster);
  try {
    const r = await chat({
      tier: "large", task: "content-poster-read", json: true, maxTokens: 1500, timeoutMs: READ_TIMEOUT_MS,
      prefer: READER, within: READ_FALLBACK,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: "Read all the text on this poster.", images: [{ base64: bytes.toString("base64"), mimeType }] },
      ],
    });
    const raw = parseJsonReply<{ text?: unknown }>(r.text);
    const read = typeof raw?.text === "string" ? raw.text.slice(0, 2000) : "";
    return { blocks, read, issues: comparePosterRead(read, poster), checked: false };
  } catch (e) {
    console.error("poster words not read:", e);
    return { blocks, read: "", issues: [READ_FAILED], checked: false };
  }
}
