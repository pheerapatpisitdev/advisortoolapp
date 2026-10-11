import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminSecret, deriveKey } from "@/lib/auth/keys";

/**
 * Connecting a Page by logging in to Facebook, instead of pasting a token into a deploy
 * config. Meta hands back a short-lived user token; it is traded for a long-lived one,
 * because the Page tokens derived from a long-lived user token do not expire — which is the
 * whole point of doing this once rather than every couple of months.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const DIALOG = "https://www.facebook.com/v23.0/dialog/oauth";

/**
 * The least the bot and the content page can work with: list the Pages this person admins,
 * answer messages as the chosen one, subscribe that Page to this app's webhook, and post to it
 * from /content (pages_manage_posts, with pages_read_engagement that Meta pairs it with).
 * Nothing broader, so a later App Review stays small.
 *
 * With FB_LOGIN_CONFIG_ID set — as it is in production — this list is not sent: the
 * permissions are the ones ticked in that login configuration on Meta's dashboard.
 */
export const SCOPES = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_manage_posts", "pages_read_engagement"];

/**
 * What the ADS page reads with. Kept apart from the Page scopes so that connecting a Page
 * never asks for the advertising account too — the two are done by different people on
 * different days, and a consent screen that asks for more than the task needs is the one
 * people decline.
 */
export const ADS_SCOPES = ["ads_read"];

/**
 * What creating ads from Studio asks for: every Page scope the Page login has, plus the two
 * that make an ad. A Business login replaces the user's whole grant (see the note on
 * adsLoginConfigId), so a login that left `pages_messaging` out would revoke it from the
 * connected Pages and take the live inbox down. `ads_management` is the one that can spend
 * money, so it is its own login, apart from `ads_read` above.
 */
export const ADS_MANAGE_SCOPES = [...SCOPES, "pages_manage_ads", "ads_management"];

/** Why somebody is going through the login: for the bot's Pages, for the ad figures, or to create ads. */
export type LoginPurpose = "pages" | "ads" | "ads-manage";

/** Every purpose the state may carry; parseState checks against this, the signature binds the one chosen. */
const PURPOSES: readonly LoginPurpose[] = ["pages", "ads", "ads-manage"];

/**
 * The events the webhook actually handles: typed messages, taps on ice breakers or buttons,
 * and the page's own outgoing messages.
 *
 * The third of those is not about answering anyone. It is the only way to learn that the
 * agent has replied by hand, which is what tells the bot to stay out of that thread — a page
 * subscribed without it has a bot that talks over its own agent.
 *
 * The fourth is subscribed for a copy of itself. A thread opened from an advertisement
 * carries the ad's id on its first message, but Meta sends that copy only to a page that also
 * subscribes to the standalone referral — so the field is asked for whether or not the event
 * it delivers is ever read, and without it the whole question of which advert paid for a
 * customer goes unanswered.
 */
export const SUBSCRIBED_FIELDS = [
  "messages", "messaging_postbacks", "message_echoes", "messaging_referrals",
];

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export function appId(): string {
  const id = process.env.FB_APP_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า FB_APP_ID");
  return id;
}

function appSecret(): string {
  const s = process.env.FB_APP_SECRET;
  if (!s) throw new Error("ยังไม่ได้ตั้งค่า FB_APP_SECRET");
  return s;
}

export function oauthIsConfigured(): boolean {
  return Boolean(process.env.FB_APP_ID && process.env.FB_APP_SECRET);
}

/**
 * The login configuration the advertising login goes through.
 *
 * Deliberately not the Page one. A Business login replaces the whole grant every time it is
 * used: the Pages left unticked on Meta's screen are revoked, which has twice taken this
 * agency's live inbox down. The Page configuration carries Page assets, so going through it
 * to read advertising figures would put that screen — and that risk — in front of somebody
 * whose only errand was a spend report. This configuration asks for `ads_read` and nothing
 * else, and has no Page assets to lose.
 */
export function adsLoginConfigId(): string | undefined {
  return process.env.FB_ADS_LOGIN_CONFIG_ID || undefined;
}

/**
 * Whether the ads login can be offered at all.
 *
 * Without its own configuration the answer is no, and the ADS page says so rather than
 * falling back to the Page configuration — a fallback that works is exactly how the Page
 * picker would end up in this flow.
 */
export function adsOauthIsConfigured(): boolean {
  return oauthIsConfigured() && Boolean(adsLoginConfigId());
}

/**
 * The login configuration for creating ads.
 *
 * Its own, for the same reason as the one above: a Business login replaces the whole grant, so
 * going through the Page configuration would put the Page picker in front of somebody who came
 * to run an ad, and going through the ads_read one would grant nothing that can create. No
 * fallback to either — a missing value means the login is off, not "use the nearest one".
 */
export function adsManageConfigId(): string | undefined {
  return process.env.FB_ADS_MANAGE_CONFIG_ID || undefined;
}

/** Whether the ads-manage login can be offered at all; without its own configuration it cannot. */
export function adsManageOauthIsConfigured(): boolean {
  return oauthIsConfigured() && Boolean(adsManageConfigId());
}

/**
 * The settings the ads-manage login still lacks, by name — never their values.
 *
 * The Studio page used to name only the configuration id whatever was missing, and a machine
 * without the app secret was told to set an id that was already there.
 */
export function adsManageMissingEnv(): string[] {
  const wanted: [string, string | undefined][] = [
    ["FB_APP_ID", process.env.FB_APP_ID],
    ["FB_APP_SECRET", process.env.FB_APP_SECRET],
    ["FB_ADS_MANAGE_CONFIG_ID", adsManageConfigId()],
  ];
  return wanted.filter(([, value]) => !value).map(([name]) => name);
}

/** Meta matches this against its allow-list character for character. */
export function redirectUri(origin: string): string {
  return `${origin}/api/facebook/connect/callback`;
}

const STATE_TTL_MS = 10 * 60 * 1000;

/** A key of the state's own, derived from ADMIN_SESSION_SECRET (src/lib/auth/keys.ts, 2026-10-01). */
function stateSecret(): string {
  return deriveKey(adminSecret(), "oauth-state");
}

/**
 * The browser that began the login (review, 2026-10-01). The state's nonce is also put in a
 * short-lived cookie on the way out, and the callback takes the state only from the browser
 * holding that cookie — so a signed state copied out of somebody's link, or a callback URL
 * pushed at a signed-in admin, cannot finish a login they did not start.
 *
 * Scoped to the callback's path, and sameSite=lax: Facebook's redirect back is a top-level
 * navigation from another site, which lax cookies ride along on and strict ones do not.
 */
export const STATE_COOKIE = "ins_fb_state";
export const STATE_COOKIE_PATH = "/api/facebook/connect/callback";

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: STATE_COOKIE_PATH,
    maxAge: STATE_TTL_MS / 1000,
  };
}

export function newStateNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Signed and short-lived, so a link someone else crafts cannot start a connection for us.
 * The purpose is inside the signature: a state that said "pages" on the way out cannot come
 * back saying "ads" or "ads-manage". The nonce is the one put in the browser's STATE_COOKIE.
 */
export function makeState(purpose: LoginPurpose = "pages", nonce: string = newStateNonce()): string {
  const expires = String(Date.now() + STATE_TTL_MS);
  const mac = createHmac("sha256", stateSecret()).update(`${expires}.${nonce}.${purpose}`).digest("hex");
  return `${expires}.${nonce}.${purpose}.${mac}`;
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The state, if it is ours, unexpired and was begun in the browser that holds `browserNonce`. */
function parseState(state: string | null, browserNonce: string | null | undefined): { purpose: LoginPurpose } | null {
  if (!state || !browserNonce) return null;
  const [expires, nonce, purpose, mac] = state.split(".");
  if (!expires || !nonce || !mac || !PURPOSES.includes(purpose as LoginPurpose)) return null;
  const expected = createHmac("sha256", stateSecret()).update(`${expires}.${nonce}.${purpose}`).digest("hex");
  if (!sameText(mac, expected)) return null;
  if (Number(expires) <= Date.now()) return null;
  if (!sameText(nonce, browserNonce)) return null;
  return { purpose: purpose as LoginPurpose };
}

export function stateIsValid(state: string | null, browserNonce: string | null | undefined): boolean {
  return parseState(state, browserNonce) !== null;
}

/** The purpose a valid state was made for; nothing for a state that cannot be trusted. */
export function statePurpose(state: string | null, browserNonce: string | null | undefined): LoginPurpose | undefined {
  return parseState(state, browserNonce)?.purpose;
}

/**
 * A Business-type app ignores `scope` and asks only for a name and photo; what it wants is a
 * login configuration made in the dashboard, which bundles the same permissions. With one
 * configured the dialog uses it; without, the plain scope list still serves a Consumer app.
 *
 * With a login configuration the ads purpose still depends on the owner having added
 * `ads_read` to that configuration in the dashboard — the URL cannot ask for it. The same goes
 * for ads-manage and `ads_management`.
 */
export function authorizeUrl(origin: string, state: string, purpose: LoginPurpose = "pages"): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(origin),
    state,
    response_type: "code",
  });
  const config = purpose === "ads-manage" ? adsManageConfigId()
    : purpose === "ads" ? adsLoginConfigId()
    : process.env.FB_LOGIN_CONFIG_ID;
  if (config) {
    params.set("config_id", config);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", (purpose === "ads-manage" ? ADS_MANAGE_SCOPES : purpose === "ads" ? ADS_SCOPES : SCOPES).join(","));
  }
  return `${DIALOG}?${params}`;
}

/** a Graph that hangs fails here instead of holding the login callback to the function's limit */
const GRAPH_TIMEOUT_MS = 15_000;

async function graph<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `${path} ${res.status}`);
  return body;
}

/**
 * The code is exchanged for a token that lasts about an hour, then for one that lasts about
 * two months. Both calls carry the app secret, so both happen on the server only.
 */
export async function tokenFromCode(code: string, origin: string): Promise<string> {
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: redirectUri(origin),
    code,
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

export async function grantedScopes(userToken: string): Promise<string[]> {
  const res = await graph<{ data: { permission: string; status: string }[] }>(
    "/me/permissions", {}, userToken,
  );
  return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

/** Each Page comes with its own token, already scoped to that Page. */
export async function listPages(userToken: string): Promise<FacebookPage[]> {
  const res = await graph<{ data: { id: string; name: string; access_token: string }[] }>(
    "/me/accounts", { fields: "id,name,access_token", limit: "100" }, userToken,
  );
  return (res.data ?? []).map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}

export interface FacebookAdAccount {
  /** `act_` and the number, as every insights path wants it */
  id: string;
  name: string;
  currency: string | null;
}

/** The ad accounts this person may read. Needs `ads_read`. */
export async function listAdAccounts(userToken: string): Promise<FacebookAdAccount[]> {
  const res = await graph<{ data: { id: string; name?: string; currency?: string }[] }>(
    "/me/adaccounts", { fields: "id,name,currency", limit: "100" }, userToken,
  );
  return (res.data ?? []).map((a) => ({ id: a.id, name: a.name ?? a.id, currency: a.currency ?? null }));
}

/** When a user token stops working, as Meta's own inspector reports it. */
export interface TokenExpiry {
  /** false once Meta has already stopped honouring it */
  valid: boolean;
  /** when the token itself runs out; null for a token that does not expire */
  expiresAt: string | null;
  /** when the person's grant of data access runs out (90 days after they last logged in) */
  dataAccessExpiresAt: string | null;
}

/**
 * Asks Meta when a user token expires.
 *
 * The ads login keeps no expiry of its own — tokenFromCode throws the `expires_in` away — so
 * the date is read back from /debug_token, which answers for any token issued to this app
 * when asked with the app's own credentials. No permission beyond what the login already has
 * is needed, and nothing is stored: the ADS page asks each time it opens.
 */
export async function tokenExpiry(userToken: string): Promise<TokenExpiry> {
  const res = await graph<{ data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number } }>(
    "/debug_token",
    { input_token: userToken },
    // the app token rides in the header, like every other token here, not in a URL a log keeps
    `${appId()}|${appSecret()}`,
  );
  const d = res.data ?? {};
  const at = (unix?: number) => (unix && unix > 0 ? new Date(unix * 1000).toISOString() : null);
  return { valid: Boolean(d.is_valid), expiresAt: at(d.expires_at), dataAccessExpiresAt: at(d.data_access_expires_at) };
}

/** Without this the Page never sends its messages to the webhook, whatever the token says. */
export async function subscribePage(page: FacebookPage): Promise<string[]> {
  const url = `${GRAPH}/${page.id}/subscribed_apps`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${page.accessToken}` },
    body: JSON.stringify({ subscribed_fields: SUBSCRIBED_FIELDS.join(",") }),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const body = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `subscribe ${res.status}`);
  return SUBSCRIBED_FIELDS;
}

export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${pageToken}` },
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`unsubscribe ${res.status}: ${(await res.text()).slice(0, 120)}`);
}
