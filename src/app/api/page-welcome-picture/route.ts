import type { NextRequest } from "next/server";
import { refuseUnless } from "@/lib/auth/viewer";
import { MAX_PICTURE_BYTES, PICTURE_TYPES } from "@/lib/assistant/page-welcome";
import { savePicture } from "@/lib/chat/page-welcome-store";

/**
 * A picture for a Page's greeting (/admin/welcome): the file in `picture`, already shrunk by
 * the page. Answers with the public URL the greeting will carry; nothing is sent to a customer
 * until the greeting that holds it is saved.
 */
export async function POST(req: NextRequest) {
  const refused = await refuseUnless("admin");
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  const file = form?.get("picture");
  if (!(file instanceof File) || file.size === 0) return Response.json({ ok: false, error: "เลือกรูปก่อน" }, { status: 400 });
  if (!PICTURE_TYPES.includes(file.type)) return Response.json({ ok: false, error: "รับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
  if (file.size > MAX_PICTURE_BYTES) return Response.json({ ok: false, error: "รูปใหญ่เกิน 4 MB" }, { status: 400 });
  try {
    return Response.json({ ok: true, url: await savePicture(Buffer.from(await file.arrayBuffer()), file.type) });
  } catch (e) {
    console.error("welcome picture not saved:", e);
    return Response.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
