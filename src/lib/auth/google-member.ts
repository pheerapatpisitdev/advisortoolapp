import type { GoogleError } from "./google";
import { cleanName, SIGNUPS_PER_IP_PER_DAY } from "./member";
import { createMember, deleteMember, memberByGoogleSub, memberSettings, setEmail, signupsFromIp } from "./member-store";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Who a Google account is here (owner, 2026-10-02). A member comes back in — sign-up's switch
 * does not shut out people who already joined. Somebody new is given an account while the
 * owner has sign-up open, three an address a day: the free rounds are real money.
 *
 * The address is counted twice, before and after the insert: parallel requests from one
 * address each read the count before any of them wrote, and the second count catches them.
 * Two tabs finishing the same Google login at once race on the unique google_sub; the loser
 * signs in to the winner's account.
 */
export async function memberFromGoogle(
  user: { sub: string; email: string; name: string },
  ip: string,
): Promise<{ ok: true; id: string } | { ok: false; error: GoogleError }> {
  const known = await memberByGoogleSub(user.sub);
  if (known) {
    if (known.status !== "active") return { ok: false, error: "suspended" };
    // Google lets people change their address; the owner's list should show the one in use
    if (known.email !== user.email) await setEmail(known.id, user.email);
    return { ok: true, id: known.id };
  }

  if (!(await memberSettings()).signupOpen) return { ok: false, error: "closed" };
  const since = new Date(Date.now() - DAY_MS);
  if ((await signupsFromIp(ip, since)) >= SIGNUPS_PER_IP_PER_DAY) return { ok: false, error: "limit" };
  const name = cleanName(user.name) ?? cleanName(user.email.split("@")[0]) ?? "สมาชิก";
  const made = await createMember({ googleSub: user.sub, email: user.email, name, ip });
  if (!made.ok) {
    const winner = await memberByGoogleSub(user.sub);
    return winner && winner.status === "active" ? { ok: true, id: winner.id } : { ok: false, error: "broken" };
  }
  if ((await signupsFromIp(ip, since)) > SIGNUPS_PER_IP_PER_DAY) {
    await deleteMember(made.id);
    return { ok: false, error: "limit" };
  }
  return { ok: true, id: made.id };
}
