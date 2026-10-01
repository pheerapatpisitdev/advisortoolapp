import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET, CLIP_DRAFT_DAYS, type ClipVideo } from "./clip";
import { VERIFY_WINDOW_MS } from "./publish-flow";

/**
 * Once a day, the clips nobody needs (owner, 2026-10-02): a posted Reel's file 48 hours after
 * it went up (Facebook has its own copy, and the check that it went up is done), a clip never
 * scheduled after 60 days, and files no piece points at. A held or sending Reel's file is never
 * touched — a move sends it again.
 */

export interface SweepRow { id: string; video: ClipVideo | null; state: string | null; at: string | null; rev: string | null }
export interface SweepFile { piece: string; name: string; createdAt: string }

const DAY = 24 * 60 * 60_000;
const HELD = new Set(["scheduled", "posting"]);

export function sweepPlan(files: SweepFile[], rows: Map<string, SweepRow>, now: Date): { remove: string[]; expire: string[] } {
  const remove: string[] = [];
  const expire = new Set<string>();
  const t = now.getTime();
  for (const f of files) {
    const path = `${f.piece}/${f.name}`;
    const r = rows.get(f.piece);
    const v = r?.video;
    if (!r || !v || v.path !== path) {
      // an upload left half way, a clip replaced, a piece deleted: a day's grace for one still arriving
      if (t - new Date(f.createdAt).getTime() > DAY) remove.push(path);
      continue;
    }
    if (r.state && HELD.has(r.state)) continue;
    const postedLongAgo = r.state === "published" && r.at !== null && t - new Date(r.at).getTime() > VERIFY_WINDOW_MS;
    const neverHeldLong = (r.state === null || r.state === "failed" || r.state === "cancelled")
      && t - new Date(v.uploadedAt).getTime() > CLIP_DRAFT_DAYS * DAY;
    if (postedLongAgo || neverHeldLong) {
      remove.push(path);
      if (!v.expired) expire.add(r.id);
    }
  }
  return { remove, expire: [...expire] };
}

export async function sweepClips(now = new Date()): Promise<{ removed: number; expired: number }> {
  const db = supabaseAdmin();
  const bucket = db.storage.from(CLIP_BUCKET);
  const { data: dirs, error } = await bucket.list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  const pieces = (dirs ?? []).map((d) => d.name).filter(Boolean);
  if (pieces.length === 0) return { removed: 0, expired: 0 };

  const files: SweepFile[] = [];
  for (const piece of pieces) {
    const { data } = await bucket.list(piece, { limit: 100 });
    for (const f of data ?? []) files.push({ piece, name: f.name, createdAt: f.created_at ?? now.toISOString() });
  }
  const { data: found, error: readErr } = await db.from("ins_content")
    .select("id, output, publish_state, publish_at").in("id", pieces);
  if (readErr) throw new Error(readErr.message);
  const rows = new Map<string, SweepRow>();
  for (const r of (found ?? []) as { id: string; output: { video?: ClipVideo; rev?: string } | null; publish_state: string | null; publish_at: string | null }[]) {
    rows.set(r.id, { id: r.id, video: r.output?.video ?? null, state: r.publish_state, at: r.publish_at, rev: r.output?.rev ?? null });
  }

  const plan = sweepPlan(files, rows, now);
  const marked = new Set<string>();
  for (const id of plan.expire) {
    const { data } = await db.from("ins_content").select("output").eq("id", id).maybeSingle();
    const output = (data as { output?: { video?: ClipVideo; rev?: string } } | null)?.output;
    if (!output?.video) continue;
    let q = db.from("ins_content").update({ output: { ...output, video: { ...output.video, expired: true }, rev: crypto.randomUUID() } }).eq("id", id);
    q = output.rev ? q.eq("output->>rev", output.rev) : q.is("output->>rev", null);
    const { data: done, error: e } = await q.select("id");
    if (e) console.error(`clip ${id} not marked expired:`, e.message);
    else if ((done ?? []).length === 1) marked.add(id);
  }
  // a piece's file goes only after its row says expired — a row left pointing at nothing would
  // offer a dead player; one not marked this time is tried again tomorrow
  const waiting = new Set(plan.expire.filter((id) => !marked.has(id)));
  const removable = plan.remove.filter((p) => !waiting.has(p.split("/")[0]));
  const expired = marked.size;
  for (let i = 0; i < removable.length; i += 100) {
    const { error: e } = await bucket.remove(removable.slice(i, i + 100));
    if (e) console.error("clips not removed:", e.message);
  }
  return { removed: removable.length, expired };
}
