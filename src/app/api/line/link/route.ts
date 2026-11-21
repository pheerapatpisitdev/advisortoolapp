import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/assistant/rate-limit";
import { BROKEN, checkAgentCode, counted } from "@/lib/auth/code-check";
import { OA_ID, agentOfLinkCode, lineIsLinked, linkAgentLine } from "@/lib/line/agent-line";
import { liffId, loginChannelOf, verifyIdToken } from "@/lib/line/liff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * เชื่อม LINE inside LINE (owner chose ง, 2026-11-21): what the LIFF page at /line/link calls, the
 * way UnitOS's liff/me and liff/link work.
 *
 *   { idToken }                → { linked }: whether this LINE already gets somebody's alerts
 *   { idToken, code }          → links this LINE to the agent whose 6-digit code it is
 *   { idToken, lt }            → links it to the member whose one-time link (ตั้งค่าส่วนตัว) it is
 *
 * The sign-in token is asked of LINE, never trusted as written. Codes and one-time links are
 * guesses like the sign-in page's, counted in the same table (src/lib/auth/code-check.ts).
 */
export async function POST(req: NextRequest) {
  const id = liffId();
  if (!id) return Response.json({ ok: false, error: "ยังไม่ได้ตั้งค่า LINE ของ advisortool" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { idToken?: unknown; code?: unknown; lt?: unknown } | null;
  const idToken = typeof body?.idToken === "string" ? body.idToken : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const lt = typeof body?.lt === "string" ? body.lt.trim() : "";

  let who;
  try {
    who = await verifyIdToken(idToken, loginChannelOf(id));
  } catch (e) {
    console.error("[line] sign-in token not checked:", e);
    return Response.json({ ok: false, error: BROKEN }, { status: 502 });
  }
  if (!who) return Response.json({ ok: false, error: "เข้าสู่ระบบ LINE ไม่สำเร็จ ปิดหน้านี้แล้วสแกนใหม่" }, { status: 401 });

  try {
    if (!code && !lt) return Response.json({ ok: true, linked: await lineIsLinked(who.userId) });

    const ip = clientIp(req.headers);
    const r = code
      ? await checkAgentCode(code, ip, { demo: false }).then((c) => (c.ok ? { ok: true as const, value: { agentId: c.value.agentId, name: c.value.name } } : c))
      : await counted(ip, async () => {
        const agentId = await agentOfLinkCode(lt);
        return agentId
          ? { ok: true as const, value: { agentId, name: "" } }
          : { ok: false as const, error: "ลิงก์นี้หมดเวลาหรือใช้ไปแล้ว ขอลิงก์ใหม่ที่หน้า ตั้งค่าส่วนตัว ใน advisortool" };
      });
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });

    await linkAgentLine(r.value.agentId, who.userId);
    return Response.json({ ok: true, linked: true, name: r.value.name, oa: OA_ID });
  } catch (e) {
    console.error("[line] link from LINE failed:", e);
    return Response.json({ ok: false, error: BROKEN }, { status: 500 });
  }
}
