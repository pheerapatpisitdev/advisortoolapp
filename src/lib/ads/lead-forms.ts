import { graph } from "./graph";

/**
 * Which Instant Forms a Page offers a lead ad, and whether the Page has accepted Meta's lead-ads
 * terms (without them Meta refuses every lead ad on it).
 *
 * The forms are read with the Page's own token, which Meta hands to the user token of the ads
 * login: that login carries pages_manage_ads, so no further permission is asked for. Only ACTIVE
 * forms are offered; an archived one cannot take an ad.
 */

export interface LeadForm {
  id: string;
  name: string;
}

export type LeadForms = { ok: true; tosAccepted: boolean; forms: LeadForm[] } | { ok: false; error: string };

const BAD_PAGE = "เพจไม่ถูกต้อง";
const NOT_MANAGED = "บัญชีที่เชื่อมไว้สำหรับสร้างแอดไม่ได้ดูแลเพจนี้ เชื่อมบัญชีใหม่แล้วติ๊กเพจนี้";

/** Where the owner accepts the lead-ads terms for a Page. */
export const tosUrl = (pageId: string) => `https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}`;

export async function listLeadForms(pageId: string, userToken: string, fetchFn: typeof fetch = fetch): Promise<LeadForms> {
  // the id goes into Graph paths; anything else would let a bad value pick a different endpoint
  if (!/^\d+$/.test(pageId)) return { ok: false, error: BAD_PAGE };

  const page = await graph(fetchFn, userToken, `${pageId}?fields=access_token,leadgen_tos_accepted`);
  if (!page.ok) return page;
  const pageToken = page.body.access_token;
  if (typeof pageToken !== "string" || !pageToken) return { ok: false, error: NOT_MANAGED };
  if (page.body.leadgen_tos_accepted !== true) return { ok: true, tosAccepted: false, forms: [] };

  const list = await graph(fetchFn, pageToken, `${pageId}/leadgen_forms?fields=id,name,status&limit=100`);
  if (!list.ok) return list;
  const rows = Array.isArray(list.body.data) ? (list.body.data as Record<string, unknown>[]) : [];
  const forms = rows.flatMap((f) =>
    f.status === "ACTIVE" && typeof f.id === "string" && f.id ? [{ id: f.id, name: typeof f.name === "string" ? f.name : f.id }] : [],
  );
  return { ok: true, tosAccepted: true, forms };
}
