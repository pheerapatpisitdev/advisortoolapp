import type { NextRequest } from "next/server";
import { generateRecruit } from "@/app/studio/actions";
import type { RecruitWriteInput } from "@/lib/content/recruit-run";
import { refuseUnless } from "@/lib/auth/viewer";

/**
 * A หาทีม round as a plain request, for the reason /api/content-generate gives: a server action
 * waits in the page's line, and a round of twenty to forty seconds held every tab, ✓ใช้จริง,
 * ทิ้ง and save behind it. The input is checked and the limits applied by generateRecruit
 * itself, exactly as before.
 */

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const input = await req.json().catch(() => null) as RecruitWriteInput | null;
  if (!input || typeof input !== "object") return Response.json({ ok: false, error: "ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
  return Response.json(await generateRecruit(input));
}
