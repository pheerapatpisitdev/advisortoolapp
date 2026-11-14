import type { NextRequest } from "next/server";
import { can } from "@/lib/auth/access";
import { getViewer, refuseUnless } from "@/lib/auth/viewer";
import { FILE_MAX, isUploadId, SHOTS_MAX } from "@/lib/scene-library/upload-rules";
import { readableUpload, sendUpload, uploadFile } from "@/lib/scene-library/uploads";

/**
 * คลังแอนิเมชัน's uploads (spec 2026-11-14-library-uploads-design.md).
 *
 * POST — multipart: kind, name, note, rights ("1" when ticked), file (repeated). Answers { ok, id, state }
 *   or { ok: false, error } (400). The count and size of the files are checked before any is read.
 * GET ?id=<uuid>&n=<0..2> — one picture of an upload, to whoever may see it; anything else is the same 404.
 */

const NOT_FOUND = "ไม่พบไฟล์นี้";
const gone = () => new Response(NOT_FOUND, { status: 404 });
const refuse = (error: string) => Response.json({ ok: false, error }, { status: 400 });

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return refuse("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");

  // an empty file input arrives as a zero-size part: no file at all
  const parts = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (parts.length > SHOTS_MAX) return refuse("แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ");
  if (parts.some((f) => f.size > FILE_MAX)) return refuse("ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่");
  const files = await Promise.all(parts.map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()) })));

  try {
    const sent = await sendUpload(
      { agentId: viewer.agentId, owner: can(viewer, "owner"), demo: viewer.kind === "demo" },
      { kind: form.get("kind"), name: form.get("name"), note: form.get("note"), rights: form.get("rights") === "1", files },
    );
    return sent.ok ? Response.json(sent) : Response.json(sent, { status: 400 });
  } catch (e) {
    console.error("library upload failed:", e);
    return Response.json({ ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  const q = req.nextUrl?.searchParams ?? new URL(req.url).searchParams;
  const id = q.get("id");
  const asked = q.get("n");
  const n = asked === null ? 0 : /^\d+$/.test(asked) ? Number(asked) : -1;
  if (!isUploadId(id) || n < 0 || n >= SHOTS_MAX) return gone();
  try {
    const row = await readableUpload({ agentId: viewer.agentId, owner: can(viewer, "owner") }, id);
    const path = row?.paths[n];
    if (!row || !path) return gone();
    const file = await uploadFile(path);
    if (!file) return gone();
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": path.endsWith(".png") ? "image/png" : "image/jpeg",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    console.error("library upload read failed:", e);
    return gone();
  }
}
