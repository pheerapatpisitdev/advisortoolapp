import type { NextRequest } from "next/server";
import { addPerson, deletePerson, MAX_PHOTO_BYTES, PersonError, PHOTO_TYPES, updatePerson } from "@/lib/content/people-store";
import { MAX_PHOTOS } from "@/lib/content/people";
import { piecesWithPerson } from "@/lib/content/store";
import { getViewer, refuseUnless } from "@/lib/auth/viewer";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { readPageField } from "@/lib/content/people-pages";

/**
 * Adding and removing people, as plain requests: ten photos are more than a server action's
 * one-megabyte body takes, and the page resizes them to 1024px before they are sent anyway.
 * The consent tick is checked here as well as on the page — the rule is the server's.
 */

const noPage = () => Response.json({ ok: false, error: "เลือกเพจที่เชื่อมไว้ในระบบนะครับ" }, { status: 400 });

/**
 * The Page a person goes under, from the form's `page` field (src/lib/content/people-pages.ts).
 * Only the posting staff place people on a Page; for anyone else the field is refused, not
 * quietly dropped, since their screen never sends it.
 */
async function pageField(form: FormData): Promise<{ ok: true; pageId: string | null | undefined } | { ok: false }> {
  const raw = form.get("page");
  if (raw === null) return { ok: true, pageId: undefined };
  if (!can(await getViewer(), "publish")) return { ok: false };
  // a person goes under a Page the caller looks after, not any Page connected
  return readPageField(String(raw), await myPages());
}

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) return Response.json({ ok: false, error: "ตั้งชื่อ 1–40 ตัวอักษรนะครับ" }, { status: 400 });
  if (form.get("consent") !== "on") {
    return Response.json({ ok: false, error: "ต้องติ๊กยืนยันว่าได้รับความยินยอมจากเจ้าของรูปก่อนนะครับ" }, { status: 400 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ ok: false, error: "เลือกรูปอย่างน้อย 1 รูปนะครับ" }, { status: 400 });
  if (files.length > MAX_PHOTOS) return Response.json({ ok: false, error: `เลือกได้ไม่เกิน ${MAX_PHOTOS} รูปนะครับ` }, { status: 400 });
  for (const f of files) {
    if (!PHOTO_TYPES[f.type]) return Response.json({ ok: false, error: "รับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
    if (f.size > MAX_PHOTO_BYTES) return Response.json({ ok: false, error: "รูปใหญ่เกิน 5 MB" }, { status: 400 });
  }
  try {
    const page = await pageField(form);
    if (!page.ok) return noPage();
    const photos = await Promise.all(files.map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type })));
    const person = await addPerson(name, photos, page.pageId ?? null);
    return Response.json({ ok: true, person });
  } catch (e) {
    console.error("person add failed:", e);
    return Response.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}

/** `?usage=<id>`: how many pieces were drawn with this person, asked before a delete */
export async function GET(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const id = req.nextUrl.searchParams.get("usage") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ ok: false, error: "ไม่พบบุคคลนี้" }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await piecesWithPerson(id)) });
  } catch (e) {
    console.error("person usage failed:", e);
    return Response.json({ ok: false, error: "อ่านไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    await deletePerson(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("person delete failed:", e);
    return Response.json({ ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}

/** A rename, photos removed by path, photos added — the same checks as adding a person. */
export async function PATCH(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!form || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ ok: false, error: "ไม่พบบุคคลนี้" }, { status: 400 });
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) return Response.json({ ok: false, error: "ตั้งชื่อ 1–40 ตัวอักษรนะครับ" }, { status: 400 });
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    if (!PHOTO_TYPES[f.type]) return Response.json({ ok: false, error: "รับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
    if (f.size > MAX_PHOTO_BYTES) return Response.json({ ok: false, error: "รูปใหญ่เกิน 5 MB" }, { status: 400 });
  }
  try {
    const page = await pageField(form);
    if (!page.ok) return noPage();
    const add = await Promise.all(files.map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type })));
    const main = form.get("main");
    const person = await updatePerson(id, { name, remove: form.getAll("remove").map(String), add, ...(typeof main === "string" && main ? { main } : {}), pageId: page.pageId });
    return Response.json({ ok: true, person });
  } catch (e) {
    if (e instanceof PersonError) return Response.json({ ok: false, error: e.message }, { status: 400 });
    console.error("person update failed:", e);
    return Response.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}
