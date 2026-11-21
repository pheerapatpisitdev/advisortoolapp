import { rememberBluewealthAgent } from "@/lib/auth/bluewealth";
import { rememberKingclubAgent } from "@/lib/auth/kingclub";
import { DEMO_CODE, admitDemo, demoRow } from "@/lib/auth/demo";
import type { Viewer } from "@/lib/auth/access";
import { admitAgent, refusalOf } from "@/lib/auth/special";
import { agentsByCode, staffRow } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The agent's 6-digit code, checked the one way wherever it is typed: the sign-in page
 * (src/app/login/actions.ts) and เชื่อม LINE inside LINE (src/app/api/line/link, owner chose ง,
 * 2026-11-21 — the way UnitOS and KingClub link). Moved here from the sign-in action unchanged.
 */

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

export const BROKEN = "ระบบขัดข้อง ลองใหม่อีกครั้ง";
const PREMIUM_ONLY = "advisortool สำหรับสมาชิก Premium ของทีม";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; premium?: true };

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
 * One guess, counted. The attempt is written as a failure before anything is counted or
 * checked, and only turned into a success once `check` lets somebody in: counted first and
 * recorded after, a burst of parallel requests all saw a count below the limit and each got a
 * guess (review, 2026-10-01). Written first, they count each other, so the counts include this
 * attempt. A count or a write that fails refuses rather than letting the guess through uncounted.
 */
export async function counted<T>(ip: string, check: (left: number) => Promise<Checked<T>>): Promise<Checked<T>> {
  const supabase = supabaseAdmin();
  const since = sinceWindow();
  const { data: attempt, error: claimError } = await supabase
    .from("ins_login_attempts")
    .insert({ ip, ok: false })
    .select("id")
    .single();
  if (claimError || !attempt) {
    console.error("code check: could not record the attempt", claimError);
    return { ok: false, error: BROKEN };
  }
  // a refused attempt is taken back, so a lock does not extend itself
  const release = () => supabase.from("ins_login_attempts").delete().eq("id", attempt.id);

  let result: Checked<T>;
  try {
    const fromIp = await ipFailures(ip, since);
    if (fromIp > MAX_FAILURES) {
      await release();
      return { ok: false, error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
    }
    if ((await codeFailures(since)) > SITE_CODE_FAILURES) {
      await release();
      return { ok: false, error: `มีการกรอกรหัสตัวแทนผิดจำนวนมาก ปิดการเข้าด้วยรหัสชั่วคราว กรุณารออีก ${WINDOW_MINUTES} นาที หรือเข้าจากเมนูใน UnitOS` };
    }
    result = await check(MAX_FAILURES - fromIp);
  } catch (e) {
    console.error("code check failed after the attempt was recorded:", e);
    return { ok: false, error: BROKEN };
  }
  if (!result.ok) return result;
  // left as a failure if this does not land: it counts against the address, it lets nobody in
  const { error: okError } = await supabase.from("ins_login_attempts").update({ ok: true }).eq("id", attempt.id);
  if (okError) console.error("code check: could not mark the attempt a success", okError);
  return result;
}

/**
 * Who this 6-digit code lets in, or why not. `demo` says whether the บัญชีสาธิต's code counts
 * (signing in: yes; linking a LINE: no, the account is shared).
 */
export async function checkAgentCode(code: string, ip: string, opts: { demo: boolean }): Promise<Checked<Viewer>> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "กรุณากรอกรหัสตัวแทน 6 หลัก" };
  return counted(ip, async (left) => {
    let demo = false;
    // the บัญชีสาธิต customers try the system with (owner, 2026-11-11, ./demo.ts): ours, not UnitOS's
    if (code === DEMO_CODE) {
      if (!opts.demo) return { ok: false, error: "บัญชีทดลองใช้ร่วมกันหลายคน จึงใช้ที่นี่ไม่ได้" };
      if (!admitDemo(await demoRow(), Date.now())) return { ok: false, error: "บัญชีทดลองใช้ปิดอยู่ในตอนนี้" };
      demo = true;
    }
    const agents = demo ? [] : await agentsByCode(code);
    if (agents.length > 1) {
      // UnitOS keeps codes apart only within a room; if two rooms ever hold the same one, the
      // code alone cannot say who this is, and guessing would sign somebody in as a stranger.
      // It stays counted as a failure: it still says the code is somebody's
      return { ok: false, error: "รหัสนี้มีในมากกว่าหนึ่งห้อง กรุณาเข้าจากเมนูใน UnitOS" };
    }
    const agent = agents[0] ?? null;
    const staff = agent ? await staffRow(agent.id) : null;
    const viewer = demo ? admitDemo(await demoRow(), Date.now()) : agent ? await admitAgent(agent, staff, Date.now()) : null;

    if (!viewer && (await refusalOf(agent, staff, Date.now())) === "premium") {
      // the right code of a basic agent in a room that keeps advisortool for Premium (owner,
      // 2026-10-16): told to renew rather than that the code is wrong. It stays counted as a
      // failure, as a code held in two rooms does: it still says the code is somebody's
      return { ok: false, error: PREMIUM_ONLY, premium: true };
    }
    if (!viewer) {
      // one answer for an unknown code and a closed room, so the page does not say which codes exist
      const why = "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้";
      return { ok: false, error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
    }
    // a Bluewealth agent's name and room, kept for the back office (src/lib/auth/bluewealth.ts)
    if (agent?.system === "bluewealth") await rememberBluewealthAgent(agent);
    // KingClub's, for the back office and the starter credit (src/lib/auth/kingclub.ts)
    if (agent?.system === "kingclub") await rememberKingclubAgent(agent);
    return { ok: true, value: viewer };
  });
}
