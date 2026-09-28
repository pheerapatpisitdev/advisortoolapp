import { agentFilter, currentScope, maySee } from "@/lib/auth/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReferenceImage } from "@/lib/ai/images";
import { MAX_PHOTOS, pickReferences } from "./people";

/**
 * The people library: consenting people and their reference photos, in a private bucket the
 * server alone reads. A photo's path is "<person id>/<n>.<ext>" and is checked against that
 * shape before any storage call, so a request cannot point the server at another file.
 *
 * A person is the agent's who added them (owner, 2026-09-27: "ไม่แชร์ห้องกัน") — an agent's
 * own face is theirs, not their office's. Staff see each other's, as they share the Page's
 * pieces. Every lookup here asks src/lib/auth/scope.ts, photos included, so a path that is not
 * the asker's is refused like a path that does not exist.
 */

const BUCKET = "content-people";
/**
 * The file names a person's photos may take. Twice MAX_PHOTOS, so an edit can add new
 * photos beside the ones it removes before those are gone; the path pattern allows 0–99.
 */
const SLOTS = Array.from({ length: 2 * MAX_PHOTOS }, (_, n) => n);
const PHOTO_PATH = /^[0-9a-f-]{36}\/\d{1,2}\.(jpg|png|webp)$/;
export const isPhotoPath = (v: unknown): v is string => typeof v === "string" && PHOTO_PATH.test(v);

export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
/** what the bucket itself accepts */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface Person {
  id: string;
  name: string;
  photos: string[];
  consentedAt: string;
  /** the Facebook Page they are drawn for; null is every Page's (src/lib/content/people-pages.ts) */
  pageId: string | null;
}

const toPerson = (r: Record<string, unknown>): Person => ({
  id: String(r.id),
  name: String(r.name),
  photos: (r.photos as string[] | null ?? []).filter(isPhotoPath),
  consentedAt: String(r.consented_at),
  pageId: typeof r.page_id === "string" && r.page_id ? r.page_id : null,
});

const COLUMNS = "id, name, photos, consented_at, page_id";

export async function listPeople(): Promise<Person[]> {
  const only = agentFilter(await currentScope());
  let q = supabaseAdmin().from("ins_people").select(COLUMNS);
  if (only) q = q.or(only);
  const { data, error } = await q.order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPerson);
}

export async function getPerson(id: string): Promise<Person | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [{ data, error }, scope] = await Promise.all([
    supabaseAdmin().from("ins_people").select(`${COLUMNS}, agent_id`).eq("id", id).maybeSingle(),
    currentScope(),
  ]);
  if (error) throw new Error(error.message);
  return data && maySee(scope, data.agent_id as string | null) ? toPerson(data) : null;
}

/**
 * A person and their photos, stored only after the owner's consent tick. The row goes in
 * first so the photos have an id to live under; if an upload fails, the row and whatever
 * made it up are taken back, so no half-saved person is left behind.
 */
export async function addPerson(name: string, photos: { bytes: Buffer; mimeType: string }[], pageId: string | null = null): Promise<Person> {
  const db = supabaseAdmin();
  const owner = (await currentScope()).owner;
  const { data, error } = await db.from("ins_people")
    .insert({ name, photos: [], page_id: pageId, consented_at: new Date().toISOString(), agent_id: owner?.agentId ?? null, tenant_id: owner?.tenantId ?? null })
    .select("id").single();
  if (error) throw new Error(error.message);
  const id = String(data.id);
  const paths: string[] = [];
  try {
    for (const [n, p] of photos.slice(0, MAX_PHOTOS).entries()) {
      const path = `${id}/${n}.${PHOTO_TYPES[p.mimeType]}`;
      const { error: up } = await db.storage.from(BUCKET).upload(path, p.bytes, { contentType: p.mimeType, upsert: true });
      if (up) throw new Error(up.message);
      paths.push(path);
    }
    const { data: saved, error: set } = await db.from("ins_people").update({ photos: paths }).eq("id", id)
      .select(COLUMNS).single();
    if (set) throw new Error(set.message);
    return toPerson(saved);
  } catch (e) {
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    await db.from("ins_people").delete().eq("id", id);
    throw e;
  }
}

/**
 * A person renamed, photos taken away and photos added, in that order, keeping one to
 * MAX_PHOTOS. New photos take free slots, so a path never collides with one still in use. The
 * consent stands: it was given for this person, and editing does not widen it.
 */
/**
 * A person's photos in the order they are kept: the one chosen as main first — the drawing
 * sends the first every time and a few others at random, so it is the face the AI holds to —
 * then the rest as they were, then the new ones. New photos used to go last with no way to put
 * a better one first, whatever the page said about the first photo being the main one.
 */
export function orderPhotos(kept: string[], added: string[], main?: string): string[] {
  const all = [...kept, ...added];
  return main && kept.includes(main) ? [main, ...all.filter((p) => p !== main)] : all;
}

export async function updatePerson(id: string, change: {
  name?: string; remove?: string[]; add?: { bytes: Buffer; mimeType: string }[];
  /** a kept photo to put first, as the main one */
  main?: string;
  /** the Page they move to; null is every Page's, undefined leaves it */
  pageId?: string | null;
}): Promise<Person> {
  const person = await getPerson(id);
  if (!person) throw new PersonError("ไม่พบบุคคลนี้");
  const remove = (change.remove ?? []).filter((p) => person.photos.includes(p));
  const kept = person.photos.filter((p) => !remove.includes(p));
  const add = change.add ?? [];
  if (kept.length + add.length === 0) throw new PersonError("ต้องเหลือรูปอย่างน้อย 1 รูป");
  if (kept.length + add.length > MAX_PHOTOS) throw new PersonError(`มีรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
  const db = supabaseAdmin();
  // a slot is taken while a kept photo or one being removed sits in it: the removed ones are
  // deleted last, and a new photo written over one of them would be deleted with it
  const slot = (p: string) => Number(p.split("/")[1].split(".")[0]);
  const taken = new Set([...kept, ...remove].map(slot));
  const free = SLOTS.filter((n) => !taken.has(n));
  if (free.length < add.length) throw new PersonError("เอารูปเดิมออกก่อน บันทึก แล้วค่อยเพิ่มรูปใหม่อีกครั้งนะครับ");
  const added: string[] = [];
  try {
    for (const [i, a] of add.entries()) {
      const path = `${id}/${free[i]}.${PHOTO_TYPES[a.mimeType]}`;
      const { error } = await db.storage.from(BUCKET).upload(path, a.bytes, { contentType: a.mimeType, upsert: true });
      if (error) throw new Error(error.message);
      added.push(path);
    }
  } catch (e) {
    if (added.length) await db.storage.from(BUCKET).remove(added);
    throw e;
  }
  const { data, error } = await db.from("ins_people")
    .update({
      name: change.name ?? person.name, photos: orderPhotos(kept, added, change.main),
      ...(change.pageId !== undefined ? { page_id: change.pageId } : {}),
    }).eq("id", id)
    .select(COLUMNS).single();
  if (error) throw new Error(error.message);
  // the row no longer names them, so the files go last: a failure here leaves strays, not holes
  if (remove.length) await db.storage.from(BUCKET).remove(remove);
  return toPerson(data);
}

/** a refusal the owner can act on, shown as written */
export class PersonError extends Error {}

/** The photos first, then the row: a row without photos is harmless, photos without a row are not. */
export async function deletePerson(id: string): Promise<void> {
  const person = await getPerson(id);
  if (!person) return;
  const db = supabaseAdmin();
  const { data: files } = await db.storage.from(BUCKET).list(id);
  const all = [...new Set([...person.photos, ...(files ?? []).map((f) => `${id}/${f.name}`)])];
  if (all.length) {
    const { error } = await db.storage.from(BUCKET).remove(all);
    if (error) throw new Error(`ลบรูปไม่สำเร็จ: ${error.message}`);
  }
  const { error } = await db.from("ins_people").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function photoBytes(path: string): Promise<ReferenceImage | null> {
  if (!isPhotoPath(path)) return null;
  // the folder is the person: a photo of somebody the asker did not add is not theirs to see
  if (!(await getPerson(path.split("/")[0]))) return null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: data.type || "image/jpeg" };
}

/** Four of a person's photos as the image model wants them; null when the person is gone. */
export async function personPhotos(id: string): Promise<{ person: Person; photos: ReferenceImage[] } | null> {
  const person = await getPerson(id);
  if (!person) return null;
  const photos = (await Promise.all(pickReferences(person.photos).map(photoBytes))).filter((p): p is ReferenceImage => p !== null);
  return photos.length ? { person, photos } : null;
}
