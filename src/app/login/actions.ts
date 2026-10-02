"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { admit } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/next";
import { endEverySession } from "@/lib/auth/epoch";
import { endSession, readSession, startSession } from "@/lib/auth/session";
import { agentsByCode, staffRow } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

/**
 * Wrong agent codes from every address together, per WINDOW_MINUTES (review, 2026-10-01).
 *
 * Five per address does nothing against many addresses sharing out the million codes. Thirty
 * across the site is far above what the staff mistype in a quarter of an hour, and holds a
 * guesser to 2,880 tries a day however many addresses they have. It is a brake, not a wall:
 * each try still hits one code in (live codes ÷ 1,000,000), so with a few hundred agents a
 * patient guesser could still land one within days — a longer secret is the wall, and the
 * owner keeps the 6-digit code (2026-10-01). Past the ceiling the code tab waits for the
 * window to pass, for everybody; the way in from UnitOS's menu (/sso) and the members' Google
 * button are not affected, which is what makes a ceiling anybody can trip bearable.
 */
const SITE_CODE_FAILURES = 30;

const BROKEN = "ระบบขัดข้อง ลองใหม่อีกครั้ง";

function sinceWindow(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
}

/**
 * Failed sign-ins from one address in the window (members' PIN attempts until 2026-10-02 too).
 * Throws when it cannot count: a lock that cannot be read must not read as no lock.
 */
async function ipFailures(ip: string, since: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("created_at", since);
  if (error || count == null) throw new Error(`นับการเข้าสู่ระบบไม่ได้: ${error?.message ?? "no count"}`);
  return count;
}

/** Wrong agent codes from anywhere in the window: the members' old PIN attempts carry a phone, the code's do not. */
async function codeFailures(since: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .is("phone", null)
    .eq("ok", false)
    .gte("created_at", since);
  if (error || count == null) throw new Error(`นับการเข้าสู่ระบบไม่ได้: ${error?.message ?? "no count"}`);
  return count;
}

/**
 * Signing in with the agent's own 6-digit code — the same code UnitOS takes. Staff may still
 * use it (owner, 2026-10-01).
 *
 * A code is not a secret the way a password is: colleagues may know it. What keeps guessing
 * from working is the count below (five wrong codes from one address and it waits fifteen
 * minutes), the same counter the back office's PIN had, in the same table, and a ceiling on
 * wrong codes from every address together (SITE_CODE_FAILURES).
 *
 * The attempt is written as a failure before anything is counted or checked, and only turned
 * into a success once the code lets somebody in: counted first and recorded after, a burst of parallel requests all saw a count
 * below the limit and each got a guess (review, 2026-10-01). Written first, they count each
 * other, so the counts include this attempt. A count or a write that fails refuses the
 * sign-in rather than letting it through uncounted.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!/^\d{6}$/.test(code)) return { error: "กรุณากรอกรหัสตัวแทน 6 หลัก" };

  const ip = clientIp(await headers());
  const supabase = supabaseAdmin();
  const since = sinceWindow();

  const { data: attempt, error: claimError } = await supabase
    .from("ins_login_attempts")
    .insert({ ip, ok: false })
    .select("id")
    .single();
  if (claimError || !attempt) {
    console.error("signIn: could not record the attempt", claimError);
    return { error: BROKEN };
  }
  // a refused attempt is taken back, so a lock does not extend itself
  const release = () => supabase.from("ins_login_attempts").delete().eq("id", attempt.id);

  let agentId: string;
  // what follows the claim can throw (database down); say so in words rather than reach the
  // error boundary. startSession and redirect stay outside: redirect works by throwing.
  try {
    const fromIp = await ipFailures(ip, since);
    if (fromIp > MAX_FAILURES) {
      await release();
      return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
    }
    if ((await codeFailures(since)) > SITE_CODE_FAILURES) {
      await release();
      return { error: `มีการกรอกรหัสตัวแทนผิดจำนวนมาก ปิดการเข้าด้วยรหัสชั่วคราว กรุณารออีก ${WINDOW_MINUTES} นาที หรือเข้าจากเมนูใน UnitOS` };
    }

    const agents = await agentsByCode(code);
    if (agents.length > 1) {
      // UnitOS keeps codes apart only within a room; if two rooms ever hold the same one, the
      // code alone cannot say who this is, and guessing would sign somebody in as a stranger.
      // It stays counted as a failure: it still says the code is somebody's
      return { error: "รหัสนี้มีในมากกว่าหนึ่งห้อง กรุณาเข้าจากเมนูใน UnitOS" };
    }
    const agent = agents[0] ?? null;
    const viewer = agent ? admit(agent, await staffRow(agent.id), Date.now()) : null;

    if (!viewer) {
      const left = MAX_FAILURES - fromIp;
      // one answer for an unknown code and a closed room, so the page does not say which codes exist
      const why = "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้";
      return { error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
    }
    agentId = viewer.agentId;
  } catch (e) {
    console.error("signIn failed after the attempt was recorded:", e);
    return { error: BROKEN };
  }
  // left as a failure if this does not land: it counts against the address, it lets nobody in
  const { error: okError } = await supabase.from("ins_login_attempts").update({ ok: true }).eq("id", attempt.id);
  if (okError) console.error("signIn: could not mark the attempt a success", okError);
  await startSession(agentId);
  redirect(next);
}

/**
 * Signs out on every device, not only this one (review, 2026-10-01): a copy of the cookie
 * taken elsewhere stops working too (src/lib/auth/epoch.ts). If the stamp cannot be written
 * this browser is still signed out — the button must always do at least what it says.
 */
export async function signOut(): Promise<void> {
  try {
    const session = await readSession();
    if (session) await endEverySession(session.agentId, new Date());
  } catch (e) {
    console.error("signOut: other devices could not be signed out:", e);
  }
  await endSession();
  redirect("/");
}
