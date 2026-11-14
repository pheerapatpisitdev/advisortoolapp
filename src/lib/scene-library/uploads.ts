import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FILE_MAX, isUploadId, isUploadKind, NAME_MAX, NOTE_MAX, PER_PERSON, REASONS, SHOTS_MAX, sniff,
  type UploadKind, type UploadRow, type UploadState, type UploadView,
} from "./upload-rules";

/**
 * คลังแอนิเมชัน's uploads (spec 2026-11-14-library-uploads-design.md): what a member sends (a part, a style
 * picture, or a request), what the owner decides, and who may read a file. Rows are ins_library_uploads;
 * files live in the private content-media bucket under library/. Server only.
 */

export type Sent = { ok: true; id: string; state: UploadState } | { ok: false; error: string };
export type Verdict = "ok" | "no" | "queue" | "closed";
type Done = { ok: true } | { ok: false; error: string };

const TABLE = "ins_library_uploads";
const MEDIA = "content-media";
const FAILED = "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง";
const NOT_FOUND = "ไม่พบไฟล์นี้";
const ALREADY = "ไฟล์นี้ตรวจไปแล้ว";
const FILE_PATH = /^library\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$/;

interface DbRow {
  id: string; agent_id: string; kind: string; name: string; note: string; paths: string[]; state: string;
  reason: string | null; created_at: string;
}

const toRow = (r: DbRow): UploadRow => ({
  id: r.id, agentId: r.agent_id, kind: r.kind as UploadKind, name: r.name, note: r.note ?? "",
  paths: r.paths ?? [], state: r.state as UploadState, reason: r.reason ?? null, createdAt: r.created_at,
});

export async function sendUpload(
  who: { agentId: string; owner: boolean; demo: boolean },
  v: { kind: unknown; name: unknown; note: unknown; rights: boolean; files: { bytes: Buffer }[] },
): Promise<Sent> {
  const no = (error: string): Sent => ({ ok: false, error });
  if (who.demo) return no("บัญชีทดลองอัปโหลดไม่ได้");
  if (!isUploadKind(v.kind)) return no("เลือกแบบที่จะส่ง");
  const kind = v.kind;
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > NAME_MAX) return no("ตั้งชื่อ ไม่เกิน 60 ตัวอักษร");
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length > NOTE_MAX) return no("หมายเหตุยาวเกิน 300 ตัวอักษร");

  const files = Array.isArray(v.files) ? v.files : [];
  if (kind === "ask") {
    if (files.length > SHOTS_MAX) return no("แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ");
  } else if (files.length !== 1) {
    return no("เลือกไฟล์ภาพก่อนส่ง");
  }
  if (files.some((f) => f.bytes.length > FILE_MAX)) return no("ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่");
  // the type is read from the first bytes, never from what the browser said
  const types = files.map((f) => sniff(f.bytes));
  if (kind === "part" && types[0] !== "png") return no("ชิ้นส่วนภาพรับเฉพาะไฟล์ PNG");
  if (types.some((t) => !t)) return no("รับเฉพาะรูป JPG หรือ PNG");
  if (kind !== "ask" && !v.rights) return no("ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง");

  const db = supabaseAdmin();
  if (!who.owner) {
    const { count, error } = await db.from(TABLE).select("id", { count: "exact", head: true }).eq("agent_id", who.agentId);
    if (error) { console.error("library upload count failed:", error.message); return no(FAILED); }
    if ((count ?? 0) >= PER_PERSON) return no("ส่งครบ 20 ไฟล์แล้ว ลบไฟล์เก่าก่อนส่งใหม่");
  }

  // files first, then the row; a row that fails takes the files back (as saveLogo does)
  const paths = files.map((_, i) => `library/${crypto.randomUUID()}.${types[i] === "png" ? "png" : "jpg"}`);
  const stored: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const { error } = await db.storage.from(MEDIA).upload(paths[i], files[i].bytes, {
      contentType: types[i] === "png" ? "image/png" : "image/jpeg", upsert: false,
    });
    if (error) {
      console.error("library file not stored:", error.message);
      if (stored.length) await db.storage.from(MEDIA).remove(stored);
      return no(FAILED);
    }
    stored.push(paths[i]);
  }
  const id = crypto.randomUUID();
  const state: UploadState = who.owner && kind !== "ask" ? "ok" : "wait";
  const { error } = await db.from(TABLE).insert({ id, agent_id: who.agentId, kind, name, note, paths, state });
  if (error) {
    console.error("library upload row not saved:", error.message);
    if (paths.length) await db.storage.from(MEDIA).remove(paths);
    return no(FAILED);
  }
  return { ok: true, id, state };
}

async function rowsOf(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<UploadRow[]> {
  const { data, error } = await query;
  if (error) throw new Error(`อ่านไฟล์ที่ส่งเข้าคลังไม่สำเร็จ: ${error.message}`);
  return ((data ?? []) as DbRow[]).map(toRow);
}

/** this person's own uploads, every state, newest first */
export const myUploads = (agentId: string): Promise<UploadRow[]> =>
  rowsOf(supabaseAdmin().from(TABLE).select("*").eq("agent_id", agentId).order("created_at", { ascending: false }));

/** what everyone may use: approved parts and styles, newest first */
export const sharedUploads = (): Promise<UploadRow[]> =>
  rowsOf(supabaseAdmin().from(TABLE).select("*").eq("state", "ok").in("kind", ["part", "style"]).order("created_at", { ascending: false }));

/** the owner's queue, oldest first */
export const waitingUploads = (): Promise<UploadRow[]> =>
  rowsOf(supabaseAdmin().from(TABLE).select("*").eq("state", "wait").order("created_at", { ascending: true }));

/** the owner's call on a waiting row: ok / no for a part or style, queue / closed for an ask */
export async function decideUpload(by: string, id: string, verdict: Verdict, reason?: string): Promise<Done> {
  if (!isUploadId(id)) return { ok: false, error: NOT_FOUND };
  const db = supabaseAdmin();
  const { data: found, error: readErr } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (readErr) { console.error("library upload not read:", readErr.message); return { ok: false, error: FAILED }; }
  if (!found) return { ok: false, error: NOT_FOUND };
  const kind = (found as DbRow).kind as UploadKind;
  const fits = kind === "ask" ? verdict === "queue" || verdict === "closed" : verdict === "ok" || verdict === "no";
  if (!fits) return { ok: false, error: FAILED };
  if (verdict === "no" && !(typeof reason === "string" && REASONS.includes(reason))) return { ok: false, error: "เลือกเหตุผลก่อน" };

  // only a waiting row changes, and a row must come back, or someone decided it first
  const { data, error } = await db.from(TABLE)
    .update({ state: verdict, reason: verdict === "no" ? reason : null, decided_by: by, decided_at: new Date().toISOString() })
    .eq("id", id).eq("state", "wait").select("id");
  if (error) { console.error("library upload not decided:", error.message); return { ok: false, error: FAILED }; }
  if (!data?.length) return { ok: false, error: ALREADY };
  return { ok: true };
}

export type Withdrawn = { ok: true; removed: boolean } | { ok: false; error: string };

/**
 * ถอนออกจากคลัง (spec 2026-11-14-library-withdraw-design.md): the owner takes an ok part or style back out, with a
 * reason from REASONS. The row becomes gone and its files stay for the sender to delete, unless the sender's
 * account is known to be gone (senderGone): then nobody can delete them, so the row and its files go at once
 * (`removed`). A failure there leaves the row gone and still answers ok: the withdraw itself is done.
 */
export async function withdrawUpload(by: string, id: string, reason: string): Promise<Withdrawn> {
  if (!isUploadId(id)) return { ok: false, error: NOT_FOUND };
  if (!(typeof reason === "string" && REASONS.includes(reason))) return { ok: false, error: "เลือกเหตุผลก่อน" };
  const db = supabaseAdmin();

  // only an ok row changes, and a row must come back, or it was withdrawn (or deleted) first
  const { data, error } = await db.from(TABLE)
    .update({ state: "gone", reason, decided_by: by, decided_at: new Date().toISOString() })
    .eq("id", id).eq("state", "ok").select("agent_id");
  if (error) { console.error("library upload not withdrawn:", error.message); return { ok: false, error: FAILED }; }
  if (!data?.length) {
    const { data: found, error: readErr } = await db.from(TABLE).select("id").eq("id", id).maybeSingle();
    if (readErr) { console.error("library upload not read:", readErr.message); return { ok: false, error: FAILED }; }
    return { ok: false, error: found ? ALREADY : NOT_FOUND };
  }

  const sender = (data as { agent_id: string }[])[0].agent_id;
  if (!(await senderGone(sender))) return { ok: true, removed: false };
  // only the row just withdrawn, still gone and still that sender's
  const { data: dropped, error: dropErr } = await db.from(TABLE).delete()
    .eq("id", id).eq("state", "gone").eq("agent_id", sender).select("paths");
  if (dropErr) { console.error("withdrawn library upload not deleted, kept:", dropErr.message); return { ok: true, removed: false }; }
  if (!dropped?.length) return { ok: true, removed: false };
  const paths = (dropped as { paths: string[] }[]).flatMap((r) => r.paths ?? []);
  if (paths.length) {
    const { error: rmErr } = await db.storage.from(MEDIA).remove(paths);
    // nothing points at them any more, so a file left behind is invisible; log it, do not fail
    if (rmErr) console.error("library files not removed:", rmErr.message);
  }
  return { ok: true, removed: true };
}

/** how long Bluewealth or KingClub may take to say whether they have an id; past it, they cannot tell */
const REMOTE_WAIT_MS = 5000;

/** the promise's answer, or a throw once `ms` have passed (the call itself is left to finish on its own) */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error(`no answer in ${ms} ms`)), ms); });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/**
 * true only when it is known that nobody has this id any more: not the demo account, and looked up, without
 * error, as a UnitClub agent, a member and a Super Admin (here, one after another, stopping at the first found),
 * then as a Bluewealth and a KingClub agent (each within REMOTE_WAIT_MS), and found as none. Each lookup throws
 * when it cannot read (displayNames and the *Names lists swallow their errors, so they are never used here).
 * Bluewealth or KingClub not set up, or not answering in time, cannot say "nobody", so that is doubt too. Any
 * doubt answers false: a withdrawn row is kept, and ในคลังแล้ว says สมาชิก rather than SENDER_GONE.
 */
async function senderGone(id: string): Promise<boolean> {
  try {
    const [demo, viewer, bluewealth, kingclub] = await Promise.all([
      import("@/lib/auth/demo"), import("@/lib/auth/viewer"), import("@/lib/auth/bluewealth"), import("@/lib/auth/kingclub"),
    ]);
    if (id === demo.DEMO_ID) return false;
    if (!bluewealth.bluewealthConfigured() || !kingclub.kingclubConfigured()) return false;
    for (const here of [viewer.agentById, viewer.memberById, viewer.superAdminById]) {
      if ((await here(id)) !== null) return false;
    }
    const outside = await Promise.all([
      within(bluewealth.bluewealthAgentById(id), REMOTE_WAIT_MS), within(kingclub.kingclubAgentById(id), REMOTE_WAIT_MS),
    ]);
    return outside.every((r) => r === null);
  } catch (e) {
    console.error("library sender not looked up, taken as still there:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** the sender takes their own row away, in any state; then its files leave Storage */
export async function deleteUpload(agentId: string, id: string): Promise<Done> {
  if (!isUploadId(id)) return { ok: false, error: NOT_FOUND };
  const db = supabaseAdmin();
  const { data, error } = await db.from(TABLE).delete().eq("id", id).eq("agent_id", agentId).select("paths");
  if (error) { console.error("library upload not deleted:", error.message); return { ok: false, error: FAILED }; }
  if (!data?.length) return { ok: false, error: NOT_FOUND };
  const paths = (data as { paths: string[] }[]).flatMap((r) => r.paths ?? []);
  if (paths.length) {
    const { error: rmErr } = await db.storage.from(MEDIA).remove(paths);
    // nothing points at them any more, so a file left behind is invisible; log it, do not fail
    if (rmErr) console.error("library files not removed:", rmErr.message);
  }
  return { ok: true };
}

/** the row when this reader may see its files: ok for anyone, otherwise the sender or the owner */
export async function readableUpload(who: { agentId: string; owner: boolean }, id: string): Promise<UploadRow | null> {
  if (!isUploadId(id)) return null;
  const { data, error } = await supabaseAdmin().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านไฟล์ที่ส่งเข้าคลังไม่สำเร็จ: ${error.message}`);
  if (!data) return null;
  const row = toRow(data as DbRow);
  return row.state === "ok" || who.owner || row.agentId === who.agentId ? row : null;
}

/** a stored file's bytes and type, or null; only library/ files of this module's own naming */
export async function uploadFile(path: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!FILE_PATH.test(path)) return null;
  const { data, error } = await supabaseAdmin().storage.from(MEDIA).download(path);
  if (error || !data) return null;
  return { bytes: Buffer.from(await data.arrayBuffer()), type: path.endsWith(".png") ? "image/png" : "image/jpeg" };
}

/** the ok parts (or styles) among these ids, for คลิปตามโจทย์ */
export async function okUploads(ids: string[], kind: "part" | "style"): Promise<UploadRow[]> {
  const asked = ids.filter(isUploadId);
  if (!asked.length) return [];
  return rowsOf(supabaseAdmin().from(TABLE).select("*").in("id", asked).eq("state", "ok").eq("kind", kind));
}

const toView = (r: UploadRow, who: string, by?: string): UploadView => ({
  id: r.id, kind: r.kind, name: r.name, note: r.note, files: r.paths.length, state: r.state, reason: r.reason,
  mine: r.agentId === who, ...(by ? { by } : {}),
});

/** what the owner's ในคลังแล้ว calls a sender senderGone knows is gone (spec 2026-11-14-library-withdraw-design.md) */
export const SENDER_GONE = "สมาชิกที่ลบบัญชีแล้ว";
/** what it calls a sender with no name who may still be there (displayNames swallows a failed read) */
export const SENDER_UNNAMED = "สมาชิก";

/**
 * What the page may hold of the three lists: no agentId anywhere, and the sender's name only on the owner's
 * waiting rows and the owner's shared rows (ในคลังแล้ว). displayNames logs and swallows each source's failed read,
 * so a missing name proves nothing: a shared sender it left unnamed is SENDER_GONE only when senderGone (the
 * strict check a withdraw's delete uses) says so, and SENDER_UNNAMED on any doubt. A non-owner's `waiting` is
 * empty and never read, their shared rows carry no name, and nobody is looked up for them. null when the table
 * cannot be read (trouble, or not migrated yet): the page then leaves the upload tabs out.
 */
export async function uploadViews(who: { agentId: string; owner: boolean }): Promise<{ mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] } | null> {
  try {
    const [mine, shared, waiting] = await Promise.all([
      myUploads(who.agentId), sharedUploads(), who.owner ? waitingUploads() : Promise.resolve([] as UploadRow[]),
    ]);
    // the owner's lists only; names that cannot be read leave the rows without one, and the lists still show
    const named = who.owner ? [...waiting, ...shared] : [];
    const names: Record<string, string> = named.length
      ? await import("@/lib/auth/viewer").then((m) => m.displayNames(named.map((r) => r.agentId))).catch(() => ({}))
      : {};
    // a shared sender left unnamed: gone only on senderGone's word, each id asked once
    const unnamed = who.owner ? [...new Set(shared.map((r) => r.agentId).filter((id) => !names[id]))] : [];
    const gone = new Set((await Promise.all(unnamed.map(async (id) => ((await senderGone(id)) ? id : null)))).filter((id): id is string => id !== null));
    const sharedBy = (id: string) => names[id] || (gone.has(id) ? SENDER_GONE : SENDER_UNNAMED);
    return {
      mine: mine.map((r) => toView(r, who.agentId)),
      shared: shared.map((r) => toView(r, who.agentId, who.owner ? sharedBy(r.agentId) : undefined)),
      waiting: waiting.map((r) => toView(r, who.agentId, names[r.agentId])),
    };
  } catch (e) {
    console.error("library uploads not read:", e);
    return null;
  }
}
