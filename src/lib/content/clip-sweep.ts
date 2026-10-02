import { pageToken } from "@/lib/facebook/connection";
import { reelState } from "@/lib/facebook/publish";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET, CLIP_DRAFT_DAYS, clipFiles, type ClipVideo } from "./clip";
import { listFolder } from "./clip-store";
import { REEL_FAILED, VERIFY_WINDOW_MS } from "./publish-flow";

/**
 * Once a day, the clips nobody needs (owner, 2026-10-02): a posted Reel's file 48 hours after
 * it went up (Facebook has its own copy, and the check that it went up is done), a clip never
 * scheduled after 60 days, and files no piece points at. A held or sending Reel's file is never
 * touched — a move sends it again.
 *
 * A Reel posted "now" is never asked about by verifyDue, so before a posted Reel's file goes
 * Facebook is asked whether it went up: published lets it go; failed keeps the file and turns
 * the row to failed so the agent can post again; anything else waits for tomorrow.
 */

export interface SweepRow {
  id: string; video: ClipVideo | null; state: string | null; at: string | null; rev: string | null;
  /** Facebook's video id and the Page it went to, for asking about a posted Reel */
  postId?: string | null; pageId?: string | null;
}
export interface SweepFile { piece: string; name: string; createdAt: string }

const DAY = 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HELD = new Set(["scheduled", "posting"]);

export function sweepPlan(files: SweepFile[], rows: Map<string, SweepRow>, now: Date): { remove: string[]; expire: string[] } {
  const remove: string[] = [];
  const expire = new Set<string>();
  const t = now.getTime();
  for (const f of files) {
    const path = `${f.piece}/${f.name}`;
    const r = rows.get(f.piece);
    const v = r?.video;
    // a clip keeps its preview and its edited take beside it; anything else in the folder is
    // an upload left half way, a replaced take, a render's pictures — a day's grace, then gone
    if (!r || !v || !clipFiles(v).includes(path)) {
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
  const dirs = await listFolder("", 1000);
  // only a piece's folder is ours to look at; anything else in the bucket is left alone
  const pieces = dirs.map((d) => d.name).filter((n) => UUID.test(n));
  if (pieces.length === 0) return { removed: 0, expired: 0 };

  const files: SweepFile[] = [];
  for (const piece of pieces) {
    // every page of it: a folder past one page kept its later files for good (final review, 2026-10-02)
    const listed = await listFolder(piece).catch((e) => {
      console.error(`clips of ${piece} not listed:`, e instanceof Error ? e.message : e);
      return [];
    });
    for (const f of listed) files.push({ piece, name: f.name, createdAt: f.created_at ?? now.toISOString() });
  }
  // a short read would take live pieces for gone ones: any chunk failing stops the run before a write
  const rows = new Map<string, SweepRow>();
  for (let i = 0; i < pieces.length; i += 100) {
    const { data: found, error: readErr } = await db.from("ins_content")
      .select("id, output, publish_state, publish_at, fb_post_id, fb_page_id").in("id", pieces.slice(i, i + 100));
    if (readErr) throw new Error(readErr.message);
    type Read = { id: string; output: { video?: ClipVideo; rev?: string } | null; publish_state: string | null; publish_at: string | null; fb_post_id?: string | null; fb_page_id?: string | null };
    for (const r of (found ?? []) as Read[]) {
      rows.set(r.id, {
        id: r.id, video: r.output?.video ?? null, state: r.publish_state, at: r.publish_at, rev: r.output?.rev ?? null,
        postId: r.fb_post_id ?? null, pageId: r.fb_page_id ?? null,
      });
    }
  }

  const plan = sweepPlan(files, rows, now);
  const confirmed = await checkPosted(db, plan.expire.map((id) => rows.get(id)).filter((r): r is SweepRow => r?.state === "published"));
  const marked = new Set<string>();
  for (const id of plan.expire) {
    const planned = rows.get(id);
    if (!planned?.video) continue;
    // a posted Reel Facebook has not said is up keeps its file: never marked, so never removed
    if (planned.state === "published" && !confirmed.has(id)) continue;
    const { data } = await db.from("ins_content").select("output").eq("id", id).maybeSingle();
    const output = (data as { output?: { video?: ClipVideo; rev?: string } } | null)?.output;
    // the clip or the revision moved since the plan was made: it is not the one judged
    if (!output?.video || output.video.path !== planned.video.path || (output.rev ?? null) !== planned.rev) continue;
    // the write holds only if the row is still exactly what the plan saw: same revision, same clip,
    // same publish state (a piece claimed since then is sending, and Facebook may be fetching the file)
    let q = db.from("ins_content").update({ output: { ...output, video: { ...output.video, expired: true }, rev: crypto.randomUUID() } }).eq("id", id);
    q = planned.rev ? q.eq("output->>rev", planned.rev) : q.is("output->>rev", null);
    q = q.eq("output->video->>path", planned.video.path);
    q = planned.state === null ? q.is("publish_state", null) : q.eq("publish_state", planned.state);
    if (planned.state === "published" && planned.at) q = q.eq("publish_at", planned.at);
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

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * The posted Reels Facebook says are up. One it says failed is written back as failed (its file
 * kept, so it can be posted again); one it cannot speak for — still processing, no token, a
 * Graph error — is left for tomorrow's run.
 */
async function checkPosted(db: Db, posted: SweepRow[]): Promise<Set<string>> {
  const up = new Set<string>();
  const tokens = new Map<string, Promise<string | null>>();
  const tokenOf = (pageId: string) => {
    if (!tokens.has(pageId)) tokens.set(pageId, pageToken(pageId).catch(() => null));
    return tokens.get(pageId)!;
  };
  for (let i = 0; i < posted.length; i += 10) {
    await Promise.all(posted.slice(i, i + 10).map(async (r) => {
      if (!r.postId || !r.pageId) return;
      try {
        const token = await tokenOf(r.pageId);
        if (!token) return;
        const state = await reelState(r.postId, token);
        if (state === "published") up.add(r.id);
        else if (state === "failed") await markFailed(db, r);
      } catch (e) {
        console.error(`reel ${r.postId} not checked:`, e);
      }
    }));
  }
  return up;
}

/** held to what the plan saw, as the expiry write is: a piece sent again since is not touched */
async function markFailed(db: Db, r: SweepRow): Promise<void> {
  let q = db.from("ins_content").update({ publish_state: "failed", publish_error: REEL_FAILED, fb_post_id: null })
    .eq("id", r.id).eq("publish_state", "published");
  q = r.at ? q.eq("publish_at", r.at) : q.is("publish_at", null);
  if (r.postId) q = q.eq("fb_post_id", r.postId);
  const { error } = await q.select("id");
  if (error) console.error(`reel ${r.id} not marked failed:`, error.message);
}
