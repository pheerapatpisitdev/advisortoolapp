import { adManageAccounts, adManageToken, readPendingAdsManage } from "@/lib/facebook/ads-manage-connection";
import { adsManageMissingEnv, adsManageOauthIsConfigured, listAdAccounts, tokenExpiry, type TokenExpiry } from "@/lib/facebook/oauth";
import type { AdAccount } from "@/lib/facebook/ads-connection";
import { thVerifiedIdentity } from "@/lib/ads/launch";
import { maxDailyBudgetThb } from "@/lib/ads/launch-limits";

/**
 * The ad accounts connected for making ads, as Ads Studio's settings show them (moved out of the
 * old actions.ts, 2026-10-07). Server only, and not a server action: it hands back the accounts
 * for the caller's own use, so it is called from the page and from owner-gated actions only.
 */

/**
 * The ad accounts the owner has connected for creating ads, as the list and the room both show
 * them. Names, currencies and dates only: no token leaves the server.
 */
export interface Connection {
  /** the ads-manage login is set up on this deployment (FB_ADS_MANAGE_CONFIG_ID) */
  configured: boolean;
  /** the names of the settings the login still lacks on this server, empty when configured */
  missing: string[];
  accounts: {
    id: string;
    name: string;
    currency: string | null;
    /** when Meta stops honouring the login; null when Meta would not say */
    expiresAt: string | null;
    /** false once Meta has already stopped honouring it; null when Meta would not say */
    tokenValid: boolean | null;
  }[];
  /** the ad accounts a half-finished login is waiting to choose between */
  /** the ad accounts a finished Facebook login reached, waiting to be picked; currency so the page can say which can launch */
  choices: { id: string; name: string; currency: string | null }[];
  maxDailyBudgetThb: number;
  /** META_TH_VERIFIED_IDENTITY_ID is set: Meta refuses ad sets reaching Thailand without it */
  thIdentity: boolean;
}

/**
 * When each account's login runs out, asked of Meta's token inspector, once per distinct
 * token. Anything that fails is left out: the date is a courtesy, and the page that cannot
 * open because Meta was slow to answer about a date would be the worse page.
 */
async function expiries(ids: string[]): Promise<Map<string, TokenExpiry>> {
  const out = new Map<string, TokenExpiry>();
  const byToken = new Map<string, Promise<TokenExpiry | null>>();
  await Promise.all(ids.map(async (id) => {
    const token = await adManageToken(id).catch(() => null);
    if (!token) return;
    if (!byToken.has(token)) {
      byToken.set(token, tokenExpiry(token).catch((e) => { console.error("ads-manage token expiry unreadable:", e); return null; }));
    }
    const e = await byToken.get(token)!;
    if (e) out.set(id, e);
  }));
  return out;
}

async function pendingChoices(): Promise<Connection["choices"]> {
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return [];
    return (await listAdAccounts(pending.token)).map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  } catch (e) {
    console.error("ads-manage pending accounts unreadable:", e);
    return [];
  }
}

/**
 * The ad-account strip both pages show. `accounts` is handed back as well, for looking up launches.
 */
export async function connection(): Promise<{ connection: Connection; accounts: AdAccount[] }> {
  const [accounts, choices] = await Promise.all([adManageAccounts(), pendingChoices()]);
  const missing = adsManageMissingEnv();
  // the expiry is asked with the app's own id and secret; a server without them (a laptop
  // without the secret) would only log an error per account, so it does not ask
  const canAskMeta = !missing.includes("FB_APP_ID") && !missing.includes("FB_APP_SECRET");
  const expiry = canAskMeta ? await expiries(accounts.map((a) => a.id)) : new Map<string, TokenExpiry>();
  return {
    accounts,
    connection: {
      configured: adsManageOauthIsConfigured(),
      missing,
      accounts: accounts.map((a) => {
        const e = expiry.get(a.id);
        // the earlier of the token's own end and the end of the person's data access, as /admin/ads says it
        const ends = e ? [e.expiresAt, e.dataAccessExpiresAt].filter((d): d is string => Boolean(d)).sort()[0] ?? null : null;
        return { id: a.id, name: a.name, currency: a.currency, expiresAt: ends, tokenValid: e ? e.valid : null };
      }),
      choices,
      maxDailyBudgetThb: maxDailyBudgetThb(),
      thIdentity: thVerifiedIdentity() !== null,
    },
  };
}
