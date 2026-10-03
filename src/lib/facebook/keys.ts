/**
 * Which row of the channel table belongs to which Page.
 *
 * There was one row, under "facebook", and everything that wanted a token asked for it.
 * Connecting a second Page would have written over the first in silence — the agency's live
 * inbox replaced by whichever Page was picked next, with nothing on screen to say so.
 *
 * Kept in its own file because both the connection module and the migration that renames the
 * existing row have to agree about the shape of a key, and a second copy of that shape is how
 * rows get orphaned.
 */

/** The row written before Pages were told apart. It is live today and is still read. */
export const LEGACY_KEY = "facebook";

/** A login in progress: the user token, held only until a Page is chosen. */
export const PENDING_KEY = "facebook_pending";

const PREFIX = "facebook:";

/** Where a Page's token is kept. */
export function keyFor(pageId: string): string {
  return `${PREFIX}${pageId}`;
}

/**
 * The Page a key belongs to, or nothing for a key that names no Page.
 *
 * Both of those exist and neither is an error: the legacy row names no Page in its key (its
 * page_id is in a column), and the pending row is half a login rather than a connection.
 */
export function pageIdInKey(key: string): string | undefined {
  if (isAdsKey(key)) return undefined;
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length) || undefined : undefined;
}

/**
 * Where an ad account's token is kept.
 *
 * Same table as the Pages, because it is the same kind of secret handled the same way, but
 * under a prefix of its own: the Page listing filters on "has a page_id", and an ad account
 * row also has one (the account id, in that column, for want of a better one). Without the
 * prefix the Messenger screen would list the ad account as a Page and offer to subscribe it.
 */
const ADS_PREFIX = "facebook_ads:";

/** An ads login in progress: the user token, held until an account is chosen. */
export const ADS_PENDING_KEY = "facebook_ads_pending";

export function adsKeyFor(actId: string): string {
  return `${ADS_PREFIX}${actId}`;
}

export function isAdsKey(key: string): boolean {
  return key === ADS_PENDING_KEY || key.startsWith(ADS_PREFIX) || isAdsManageKey(key);
}

export function adAccountIdInKey(key: string): string | undefined {
  return key.startsWith(ADS_PREFIX) ? key.slice(ADS_PREFIX.length) || undefined : undefined;
}

/**
 * Where the token that may create ads is kept.
 *
 * Its own prefix, not `facebook_ads:`, because it is a different grant: `ads_read` can only
 * look, this one can spend. Sharing a key would let a reconnect of one overwrite the other,
 * and the figures sync (which reads with the first) would start carrying a token it never
 * asked for. `facebook_ads_manage:` does not start with `facebook_ads:`, so the readers of
 * the first prefix never see these rows by accident.
 */
const ADS_MANAGE_PREFIX = "facebook_ads_manage:";

/** An ads_management login in progress: the user token, held until an account is chosen. */
export const ADS_MANAGE_PENDING_KEY = "facebook_ads_manage_pending";

export function adsManageKeyFor(actId: string): string {
  return `${ADS_MANAGE_PREFIX}${actId}`;
}

export function isAdsManageKey(key: string): boolean {
  return key === ADS_MANAGE_PENDING_KEY || key.startsWith(ADS_MANAGE_PREFIX);
}

export function adsManageAccountIdInKey(key: string): string | undefined {
  return key.startsWith(ADS_MANAGE_PREFIX) ? key.slice(ADS_MANAGE_PREFIX.length) || undefined : undefined;
}
