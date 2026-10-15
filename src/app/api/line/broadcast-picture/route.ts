import type { NextRequest } from "next/server";
import { refuseUnless } from "@/lib/auth/viewer";
import { saveBroadcastPicture } from "@/lib/line/broadcasts";

const TYPES = ["image/jpeg", "image/png"];
/** LINE's own limit for the small picture it shows in the chat is 1 MB; the page shrinks first */
const MAX_BYTES = 1024 * 1024;

/**
 * A picture for a LINE broadcast (/admin/line): the file in `picture`, already shrunk to JPEG
 * by the page. Answers with the public URL LINE will fetch; nothing is sent to anybody until
 * the broadcast that holds it is sent.
 */
export async function POST(req: NextRequest) {
  const refused = await refuseUnless("backoffice");
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  const file = form?.get("picture");
  if (!(file instanceof File) || file.size === 0) return Response.json({ ok: false, error: "เลือกรูปก่อน" }, { status: 400 });
  if (!TYPES.includes(file.type)) return Response.json({ ok: false, error: "รับเฉพาะรูป JPG หรือ PNG" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "รูปใหญ่เกิน 1 MB หลังย่อ ลองรูปที่เล็กลง" }, { status: 400 });
  try {
    return Response.json({ ok: true, url: await saveBroadcastPicture(Buffer.from(await file.arrayBuffer()), file.type) });
  } catch (e) {
    console.error("[line] broadcast picture not saved:", e);
    return Response.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
