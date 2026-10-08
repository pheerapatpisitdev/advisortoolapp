import type { NextRequest } from "next/server";
import { generateSaying } from "@/app/studio/actions";
import type { SayingWriteInput } from "@/lib/content/saying-run";
import { refuseUnless } from "@/lib/auth/viewer";

/** A คำคม round as a plain request, for the reason /api/content-recruit gives. */

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const input = await req.json().catch(() => null) as SayingWriteInput | null;
  if (!input || typeof input !== "object") return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  return Response.json(await generateSaying(input));
}
