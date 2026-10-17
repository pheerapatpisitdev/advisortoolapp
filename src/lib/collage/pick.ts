import { chat } from "@/lib/ai/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PIECES, type Piece } from "./library";

/**
 * คลังภาพคอลลาจ in every video (owner chose ก, 2026-10-17, mockup https://claude.ai/artifact/RcQRD93uywHi12PhSWVGbH):
 * AI reads each scene's spoken line and picks the library piece that fits it best. It picks from
 * the names only — nothing is drawn — so a clip's picks cost a small-tier call. Only pieces drawn
 * into the library can be picked; a scene AI gives nothing usable for gets its fallback, if drawn.
 */

export const PICK_TASK = "collage-pick";

/** the library's pieces that have been drawn: only these can be laid in a clip */
export async function drawnPieces(): Promise<Piece[]> {
  const { data, error } = await supabaseAdmin().storage.from("collage-library").list("", { limit: 200 });
  if (error) throw new Error(error.message);
  const drawn = new Set((data ?? []).map((f) => f.name.replace(/\.png$/, "")));
  return PIECES.filter((p) => drawn.has(p.key));
}

/**
 * One piece for each scene, by key: AI's pick when it is a drawn piece not yet used in the clip,
 * else the scene's fallback when that is drawn and unused, else null (the scene has no picture).
 * Never throws.
 */
export async function pickPieces<K extends string>(
  scenes: { key: K; voice: string; role?: string }[], drawn: Piece[], fallback: Partial<Record<K, string>> = {}, ask: typeof chat = chat,
): Promise<Record<K, string | null>> {
  const out = {} as Record<K, string | null>;
  if (!scenes.length) return out;
  const known = new Set(drawn.map((p) => p.key));
  let got: unknown = null;
  if (drawn.length) {
    const prompt = [
      "You choose cut-out pictures for a short Thai insurance video in a paper-collage style.",
      "For each scene, pick the ONE picture from the list that best fits what its line says. Use each picture at most once. Answer \"none\" when nothing fits.",
      'Answer JSON only: {"scenes":[{"key":"<scene key>","piece":"<picture key or none>"}]}',
      "",
      "Pictures:",
      ...drawn.map((p) => `- ${p.key}: ${p.name}`),
      "",
      "Scenes:",
      ...scenes.map((s) => `- key "${s.key}"${s.role ? ` (${s.role})` : ""}: ${s.voice}`),
    ].join("\n");
    try {
      got = JSON.parse((await ask({ tier: "small", task: PICK_TASK, json: true, maxTokens: 400, messages: [{ role: "user", content: prompt }] })).text);
    } catch {
      got = null;
    }
  }
  const list = Array.isArray((got as { scenes?: unknown })?.scenes) ? (got as { scenes: unknown[] }).scenes : [];
  const used = new Set<string>();
  const take = (k: string | undefined) => (k && known.has(k) && !used.has(k) ? (used.add(k), k) : null);
  for (const { key } of scenes) {
    const row = list.find((r) => (r as { key?: unknown })?.key === key) as { piece?: unknown } | undefined;
    out[key] = take(typeof row?.piece === "string" ? row.piece : undefined) ?? take(fallback[key]);
  }
  return out;
}
