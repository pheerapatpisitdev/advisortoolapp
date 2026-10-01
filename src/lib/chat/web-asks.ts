import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * How many questions one address may put to the home page's assistant in a Bangkok day while
 * not signed in. Counted in the database (supabase/migrations/20261001_copilot_ip_asks.sql),
 * beside the three-question cookie (src/lib/auth/free-asks.ts), because a caller who sends no
 * cookie has always used none (review, 2026-10-01).
 *
 * Forty, not three: an address is not a person. A phone network in Thailand puts thousands of
 * customers behind a few addresses, and an office or a family shares one, so the number has to
 * let a dozen real visitors through on one address in one day — each with their three — while
 * a script that ignores the cookie gets forty answers a day out of it rather than an unlimited
 * number. Someone who reaches it is shown the same invitation to sign up as the cookie's third
 * answer, which is where the owner wants them to go anyway. Signed-in people are not counted
 * here (owner, 2026-10-01: members ask without limit).
 */
export const WEB_ASKS_PER_IP_PER_DAY = 40;

/** PostgREST's code for a function it cannot find */
const FUNCTION_MISSING = "PGRST202";

/**
 * Takes one of today's asks for this address. True when it may go ahead.
 *
 * Claimed before the model is asked, so parallel calls count themselves, and not given back
 * when the answer fails: a failure is rare and a script would otherwise be refunded its errors.
 *
 * Open on failure — a database that cannot be read, or a deploy that arrived before its
 * migration — with the reason in the log. The cookie, the per-minute limit and the monthly
 * budget still stand, and a home page that refuses everyone because a counter is down is
 * worse than one that counts loosely for a while.
 */
export async function claimWebAsk(ip: string, max = WEB_ASKS_PER_IP_PER_DAY): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_copilot_claim_ask", { p_ip: ip.slice(0, 64), p_max: max });
    if (error) {
      console.error(error.code === FUNCTION_MISSING
        ? "ins_copilot_claim_ask is not in the database yet; the daily limit is not counting"
        : `copilot daily limit unreadable: ${error.message}`);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("copilot daily limit unreadable:", e);
    return true;
  }
}
