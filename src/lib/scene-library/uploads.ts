import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FILE_MAX, isUploadId, isUploadKind, NAME_MAX, NOTE_MAX, PER_PERSON, REASONS, SHOTS_MAX, sniff,
  type UploadKind, type UploadRow, type UploadState,
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
