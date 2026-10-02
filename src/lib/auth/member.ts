/**
 * สมาชิกทั่วไป: the rules for an account outside UnitOS (owner, 2026-10-01). Since 2026-10-02
 * Google says who a member is (./google.ts); what is left here is pure, so it can be tested
 * without a database. src/lib/auth/member-store.ts reads and writes the rows.
 */

/** accounts one address may open in a day — the free rounds are real money (owner, 2026-10-01) */
export const SIGNUPS_PER_IP_PER_DAY = 3;

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}
