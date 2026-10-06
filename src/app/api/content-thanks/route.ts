import type { NextRequest } from "next/server";
import { generateThanks } from "@/app/studio/actions";
import type { ThanksWriteInput } from "@/lib/content/thanks-run";
import { refuseUnless } from "@/lib/auth/viewer";

/** A ขอบคุณลูกค้า round as a plain request, for the reason /api/content-recruit gives. */

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const input = await req.json().catch(() => null) as ThanksWriteInput | null;
  if (!input || typeof input !== "object") return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  return Response.json(await generateThanks(input));
}
