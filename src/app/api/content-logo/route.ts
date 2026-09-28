import type { NextRequest } from "next/server";
import { refuseUnless } from "@/lib/auth/viewer";
import { isLogoPath, LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/content/logo";
import { currentLogo, logoOwner, mayUseLogo, saveLogo } from "@/lib/content/logo-store";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A Page's logo (src/lib/content/logo.ts): what the create form shows and uploads.
 *
 * GET ?page=<id> — the logo a round for that Page would carry (the caller's own when they do
 *   not post to Pages), as { path } or { path: null }.
 * GET ?path=<logos/…> — the picture itself, for the form's thumbnail, to whoever may use it.
 * POST — a new logo for the Page in `page` (or the caller's own): the file in `logo`, already
 *   shrunk by the page. A Page's logo is set only by the posting staff (logoOwner).
 */

export async function GET(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const q = req.nextUrl.searchParams;
  const path = q.get("path");
  if (path !== null) {
    if (!isLogoPath(path) || !(await mayUseLogo(path))) return new Response("ไม่พบรูปนี้", { status: 404 });
    const { data, error } = await supabaseAdmin().storage.from("content-media").download(path);
    if (error || !data) return new Response("ไม่พบรูปนี้", { status: 404 });
    return new Response(new Uint8Array(await data.arrayBuffer()), {
      headers: { "content-type": data.type || "image/png", "cache-control": "private, max-age=86400, immutable" },
    });
  }
  const owner = await logoOwner(q.get("page"));
  if (!owner) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  try {
    return Response.json({ ok: true, path: await currentLogo(owner) });
  } catch (e) {
    console.error("logo read failed:", e);
    return Response.json({ ok: false, error: "อ่านโลโก้ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File) || file.size === 0) return Response.json({ ok: false, error: "เลือกรูปโลโก้ก่อนนะครับ" }, { status: 400 });
  if (!LOGO_TYPES[file.type]) return Response.json({ ok: false, error: "รับเฉพาะรูป PNG, JPG หรือ WebP" }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) return Response.json({ ok: false, error: "รูปโลโก้ใหญ่เกิน 2 MB" }, { status: 400 });
  const page = form?.get("page");
  const owner = await logoOwner(typeof page === "string" ? page : null);
  if (!owner) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  // asked for a Page's logo but not let set one: said, rather than filed as the caller's own
  if (typeof page === "string" && page && !("pageId" in owner)) {
    return Response.json({ ok: false, error: "เปลี่ยนโลโก้ของเพจได้เฉพาะทีมงานที่มีสิทธิ์ลงโพสต์" }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, path: await saveLogo(owner, Buffer.from(await file.arrayBuffer()), file.type) });
  } catch (e) {
    console.error("logo save failed:", e);
    return Response.json({ ok: false, error: "บันทึกโลโก้ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}
