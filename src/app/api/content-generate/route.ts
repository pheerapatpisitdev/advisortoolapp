import type { NextRequest } from "next/server";
import { generateContent, type GenerateInput } from "@/app/studio/actions";
import { refuseUnless } from "@/lib/auth/viewer";

/**
 * A round of writing, as a plain request rather than a server action.
 *
 * Next runs a page's server actions one after another, and a round takes twenty to forty
 * seconds: every tab, filter, ✓ ใช้จริง and ลบ pressed meanwhile waited behind it, the tab
 * lit up with the old list under it. A fetch is outside that line. The input is checked
 * and the limits applied by generateContent itself, exactly as before.
 */

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const input = await req.json().catch(() => null) as GenerateInput | null;
  if (!input || typeof input !== "object") return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  return Response.json(await generateContent(input));
}
