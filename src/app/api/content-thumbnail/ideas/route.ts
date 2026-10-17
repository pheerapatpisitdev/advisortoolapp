import { refuseUnless } from "@/lib/auth/viewer";
import { makeIdeas } from "@/lib/content/thumbnail-run";
import { closedNow } from "@/lib/switches/store";

export const maxDuration = 60;

export async function POST(req: Request) {
  const refused = await refuseUnless();
  if (refused) return refused;
  // switched off by the Super Admin (เปิด-ปิดฟังก์ชัน)
  const closed = await closedNow("thumbnail");
  if (closed) return Response.json({ ok: false, error: closed }, { status: 503 });
  const body = await req.json().catch(() => null) as { topic?: unknown } | null;
  return Response.json(await makeIdeas(typeof body?.topic === "string" ? body.topic : ""));
}
