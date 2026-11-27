/**
 * เชื่อม LINE inside LINE (owner chose ง, 2026-11-21, mockup https://claude.ai/artifact/52AkfnWSkmEs9AgQUVjatx):
 * the way UnitOS and KingClub link. A QR opens a small page in the LINE app (a LIFF app of a
 * LINE Login channel); LINE tells that page who is holding the phone, the agent types their
 * 6-digit code, and that LINE gets their alerts.
 *
 * The LINE Login channel must sit under the same provider as the official account @006crkvq:
 * LINE gives each provider its own ids for a person, and only an id from the same provider
 * reaches them with the account's push.
 *
 * LINE_LIFF_ID is the LIFF app's id, "<channel id>-<letters>"; the part before the dash is the
 * LINE Login channel's id, which a sign-in token must have been issued to. Unset = the old way
 * (a code typed into the chat), so the page works before the channel exists.
 */

const LIFF_ID = /^(\d{6,})-[A-Za-z0-9]+$/;

export function liffId(): string | null {
  const id = (process.env.LINE_LIFF_ID ?? "").trim();
  return LIFF_ID.test(id) ? id : null;
}

/** the LINE Login channel the LIFF app belongs to */
export function loginChannelOf(id: string): string {
  return id.split("-")[0];
}

/** the address that opens the LIFF page in LINE; `lt` = a member's one-time link */
export function liffUrl(id: string, lt?: string): string {
  return `https://liff.line.me/${id}${lt ? `?lt=${encodeURIComponent(lt)}` : ""}`;
}

export interface LineIdentity {
  /** the person's id for this provider: the one the official account pushes to */
  userId: string;
  name: string;
}

/**
 * Who a LIFF page's sign-in token belongs to, asked of LINE itself — never read off the token
 * unchecked: anybody can write a token that names somebody else. Null when LINE says no (a
 * forged, stale or other channel's token).
 */
export async function verifyIdToken(idToken: string, channelId: string): Promise<LineIdentity | null> {
  if (!idToken || idToken.length > 4096) return null;
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`LINE verify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { sub?: unknown; name?: unknown; aud?: unknown };
  if (typeof body.sub !== "string" || !body.sub.startsWith("U")) return null;
  if (body.aud !== undefined && body.aud !== channelId) return null;
  return { userId: body.sub, name: typeof body.name === "string" ? body.name : "" };
}
