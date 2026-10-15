import type { NextRequest } from "next/server";
import { refuseUnless, requireMember } from "@/lib/auth/viewer";
import { CLONE_CLOSED, mayClone, saveTake, VoiceError } from "@/lib/voice/mine";

/**
 * One take of เสียงของฉัน (owner, 2026-10-15): a WAV the recorder made, up to a minute, too big
 * for a server action's 1 MB. Kept in the private agent-voice bucket until the clone is made.
 */

const ID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const viewer = await requireMember();
  // the owner's alone since 2026-10-16
  if (!mayClone(viewer)) return Response.json({ ok: false, error: CLONE_CLOSED }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  const n = Number(form?.get("n") ?? 0);
  const file = form?.get("take");
  if (!form || !ID.test(id) || !(file instanceof Blob)) return Response.json({ ok: false, error: "ส่งเสียงไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "ท่อนนี้ยาวเกินไป" }, { status: 413 });
  try {
    await saveTake(viewer.agentId, id, n, Buffer.from(await file.arrayBuffer()));
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof VoiceError) return Response.json({ ok: false, error: e.message }, { status: 400 });
    console.error("voice take not kept:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: "เก็บเสียงไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
