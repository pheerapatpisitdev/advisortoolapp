import { searchText, type LibraryFilter } from "./filter";
import type { Sent, Withdrawn } from "./uploads";
import {
  FILE_MAX, NAME_MAX, NOTE_MAX, PER_PERSON, SHOTS_MAX, type UploadKind, type UploadView,
} from "./upload-rules";

/**
 * The upload tabs' logic without the markup (browser-safe): the form's checks (the server's, said before
 * sending), the send, how the three lists change after a send, a verdict or a delete, and the row buttons'
 * state. The components only draw and call these, so each rule is tested as a function.
 */

export interface UploadSet { mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] }
export interface FormState { kind: UploadKind; name: string; note: string; rights: boolean; files: { size: number; type: string }[] }

const PICTURES = ["image/png", "image/jpeg", "image/webp"];
const FAILED = "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง";

/** the first thing wrong with the form, in the server's words (sendUpload says the same), or null */
export function checkForm(f: FormState, who: { owner: boolean; sent: number }): string | null {
  const name = f.name.trim();
  if (!name || name.length > NAME_MAX) return "ตั้งชื่อ ไม่เกิน 60 ตัวอักษร";
  if (f.note.trim().length > NOTE_MAX) return "หมายเหตุยาวเกิน 300 ตัวอักษร";
  if (f.kind === "ask") {
    if (f.files.length > SHOTS_MAX) return "แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ";
  } else if (f.files.length !== 1) {
    return "เลือกไฟล์ภาพก่อนส่ง";
  }
  if (f.files.some((x) => !PICTURES.includes(x.type))) return "รับเฉพาะรูป JPG หรือ PNG";
  if (f.kind !== "ask" && !f.rights) return "ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง";
  if (!who.owner && who.sent >= PER_PERSON) return "ส่งครบ 20 ไฟล์แล้ว ลบไฟล์เก่าก่อนส่งใหม่";
  return null;
}

export interface SendDeps {
  send: (form: FormData) => Promise<Sent>;
  shrink: (file: File, kind: UploadKind) => Promise<Blob>;
}

/** check, shrink, check the size again, send; a failure of any kind comes back as the error line */
export async function submitUpload(
  deps: SendDeps,
  v: { kind: UploadKind; name: string; note: string; rights: boolean; files: File[] },
  who: { owner: boolean; sent: number },
): Promise<Sent> {
  const wrong = checkForm({ ...v, files: v.files.map((f) => ({ size: f.size, type: f.type })) }, who);
  if (wrong) return { ok: false, error: wrong };
  try {
    const blobs = await Promise.all(v.files.map((f) => deps.shrink(f, v.kind)));
    if (blobs.some((b) => b.size > FILE_MAX)) return { ok: false, error: "ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่" };
    const form = new FormData();
    form.set("kind", v.kind);
    form.set("name", v.name.trim());
    form.set("note", v.note.trim());
    if (v.kind !== "ask" && v.rights) form.set("rights", "1");
    blobs.forEach((b, i) => form.append("file", b, `${i}.${v.kind === "part" ? "png" : "jpg"}`));
    return await deps.send(form);
  } catch {
    return { ok: false, error: FAILED };
  }
}

/** the row a sent upload becomes in ของฉัน, before the page is read again */
export const sentView = (v: { kind: UploadKind; name: string; note: string; files: number }, r: { id: string; state: UploadView["state"] }): UploadView => ({
  id: r.id, kind: v.kind, name: v.name.trim(), note: v.note.trim(), files: v.files, state: r.state, reason: null, mine: true,
});

export const withSent = (u: UploadSet, v: UploadView, owner: boolean): UploadSet => ({
  ...u,
  mine: [v, ...u.mine],
  shared: owner && v.state === "ok" && v.kind !== "ask" ? [v, ...u.shared] : u.shared,
});

/** the owner's call: the row leaves the queue; an ok part or style joins shared; the owner's own copy follows */
export function withVerdict(u: UploadSet, id: string, verdict: "ok" | "no" | "queue" | "closed", reason?: string): UploadSet {
  const row = u.waiting.find((r) => r.id === id);
  const decided = (r: UploadView): UploadView => ({ ...r, state: verdict, reason: verdict === "no" ? (reason ?? null) : null });
  return {
    mine: u.mine.map((r) => (r.id === id ? decided(r) : r)),
    shared: verdict === "ok" && row && !u.shared.some((r) => r.id === id) ? [{ ...decided(row), mine: row.mine }, ...u.shared] : u.shared,
    waiting: u.waiting.filter((r) => r.id !== id),
  };
}

/** after a send: the lists, and where the page goes (a member lands on ของฉัน; the owner stays, with "ส่งแล้ว") */
export function afterSent(u: UploadSet, row: UploadView, owner: boolean): { ups: UploadSet; tab: "mine" | null } {
  return { ups: withSent(u, row, owner), tab: owner ? null : "mine" };
}

export const ALREADY_DECIDED = "ไฟล์นี้ตรวจไปแล้ว";

/** after the owner's call came back: ok applies the verdict; "already decided" only drops the row from the queue; other errors change nothing */
export function afterDecide(
  u: UploadSet, id: string, verdict: "ok" | "no" | "queue" | "closed", reason: string | undefined, done: { ok: true } | { ok: false; error: string },
): UploadSet {
  if (done.ok) return withVerdict(u, id, verdict, reason);
  if (done.error === ALREADY_DECIDED) return { ...u, waiting: u.waiting.filter((r) => r.id !== id) };
  return u;
}

export const NOT_FOUND = "ไม่พบไฟล์นี้";

/**
 * after the owner's ถอนออกจากคลัง came back: ok takes the row out of shared (so out of เลือกดู), and the owner's
 * own copy in mine becomes gone with the reason; a row deleted with its gone sender leaves every list. Withdrawn
 * or deleted first only drops it from shared; other errors change nothing.
 */
export function afterWithdraw(u: UploadSet, id: string, done: Withdrawn, reason?: string): UploadSet {
  if (done.ok && done.removed) return withoutUpload(u, id);
  const unshared = { ...u, shared: u.shared.filter((r) => r.id !== id) };
  if (done.ok) return { ...unshared, mine: u.mine.map((r): UploadView => (r.id === id ? { ...r, state: "gone", reason: reason ?? null } : r)) };
  if (done.error === ALREADY_DECIDED || done.error === NOT_FOUND) return unshared;
  return u;
}

export const withoutUpload = (u: UploadSet, id: string): UploadSet => ({
  mine: u.mine.filter((r) => r.id !== id), shared: u.shared.filter((r) => r.id !== id), waiting: u.waiting.filter((r) => r.id !== id),
});

/** which row has its delete question or its reasons open, and the reason picked (one at a time) */
export interface RowState { removing: string | null; refusing: string | null; reason: string | null }
export type RowAction =
  | { type: "ask-remove"; id: string }
  /** opens a row's reasons: ไม่ผ่าน in the queue, ถอนออกจากคลัง in ในคลังแล้ว (one panel, one row at a time) */
  | { type: "ask-no"; id: string }
  | { type: "pick"; reason: string }
  | { type: "cancel" }
  /** a row's call finished: closes only that row's question, never another row's */
  | { type: "done"; id: string };
export const NO_ROW: RowState = { removing: null, refusing: null, reason: null };
export function rowReducer(s: RowState, a: RowAction): RowState {
  switch (a.type) {
    case "ask-remove": return { removing: a.id, refusing: null, reason: null };
    case "ask-no": return { removing: null, refusing: a.id, reason: null };
    case "pick": return { ...s, reason: a.reason };
    case "cancel": return NO_ROW;
    case "done": return s.removing === a.id || s.refusing === a.id ? NO_ROW : s;
  }
}

/**
 * A row's call claimed before it starts: true and the id taken when none is on its way, false for a second
 * press. The set is a ref's, read and written in the same tick, so two fast presses never both get through
 * (a state Set is the render's copy and only changes on the next one).
 */
export function claimRow(flying: Set<string>, id: string): boolean {
  if (flying.has(id)) return false;
  flying.add(id);
  return true;
}

/** the upload cards เลือกดู lets through: the catalogue's chips, with ไฟล์จากสมาชิก among the types */
export function uploadsFor(shared: readonly UploadView[], f: Omit<LibraryFilter, "type"> & { type: LibraryFilter["type"] | "upload" }): UploadView[] {
  if ((f.type !== "any" && f.type !== "upload") || f.state === "soon" || f.product !== "any") return [];
  const words = searchText(f.q).split(" ").filter(Boolean);
  return shared.filter((v) => !words.length || words.every((w) => searchText(`${v.name} ${v.note}`).includes(w)));
}

/** "ใช้แบบนี้": คลิปตามโจทย์ with this file chosen, as the picture itself (part) or as the look to follow (style) */
export const uploadHref = (v: UploadView): string => `/studio/prompt-story?${v.kind === "style" ? "ref" : "asset"}=${v.id}`;
