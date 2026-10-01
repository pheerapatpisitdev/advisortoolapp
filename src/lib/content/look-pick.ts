import { chat } from "@/lib/ai/client";
import { within } from "./deadline";
import { lookMessages, parseLook, settleLook, type Look } from "./looks";

/**
 * The look of a picture about to be drawn (looks.ts): one cheap call chooses it for the scene,
 * away from the Page's recent pictures, and settleLook holds it to the rules. A picker that is
 * down never stops the drawing — the picture is drawn in the original look (or, if that was the
 * Page's last, the next style along).
 */
/** `timeoutMs`: the most the pick may take in all (the drawing's deadline, deadline.ts); 0 skips it for the original look */
export async function pickLook(opts: { scene: string; person: boolean; recent: Look[]; timeoutMs?: number }): Promise<Look> {
  if (opts.timeoutMs === 0) return settleLook(null, opts);
  try {
    const ask = chat({ tier: "small", task: "content-image-look", messages: lookMessages(opts), maxTokens: 200, json: true, timeoutMs: opts.timeoutMs });
    const r = await (opts.timeoutMs ? within(ask, opts.timeoutMs, "look pick") : ask);
    return settleLook(parseLook(r.text), opts);
  } catch (e) {
    console.error("look not picked:", e);
    return settleLook(null, opts);
  }
}
