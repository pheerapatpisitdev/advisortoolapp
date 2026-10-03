import { describe, expect, it, vi } from "vitest";
import {
  ADS_MANAGE_PENDING_KEY,
  ADS_PENDING_KEY,
  adAccountIdInKey,
  adsKeyFor,
  adsManageAccountIdInKey,
  adsManageKeyFor,
  isAdsKey,
  isAdsManageKey,
  keyFor,
  pageIdInKey,
} from "@/lib/facebook/keys";

/**
 * Ad accounts and Pages share one table of encrypted tokens. The rows must not be mistaken
 * for one another: a Page listing that showed an ad account would offer to "refresh the
 * subscription" of something that has no inbox.
 */

describe("the shape of an ad-account key", () => {
  it("is told apart from a Page key", () => {
    expect(adsKeyFor("act_123")).toBe("facebook_ads:act_123");
    expect(isAdsKey("facebook_ads:act_123")).toBe(true);
    expect(isAdsKey(ADS_PENDING_KEY)).toBe(true);
    expect(isAdsKey(keyFor("123"))).toBe(false);
    expect(isAdsKey("facebook")).toBe(false);
  });

  it("gives the account id back, and no Page id", () => {
    expect(adAccountIdInKey("facebook_ads:act_123")).toBe("act_123");
    expect(adAccountIdInKey("facebook:123")).toBeUndefined();
    expect(pageIdInKey("facebook_ads:act_123")).toBeUndefined();
  });
});

describe("the shape of an ads_management key", () => {
  it("is kept apart from the ads_read key, and from a Page key", () => {
    expect(adsManageKeyFor("act_1")).toBe("facebook_ads_manage:act_1");
    expect(ADS_MANAGE_PENDING_KEY).toBe("facebook_ads_manage_pending");
    expect(isAdsManageKey("facebook_ads_manage:act_1")).toBe(true);
    expect(isAdsManageKey(ADS_MANAGE_PENDING_KEY)).toBe(true);
    expect(isAdsManageKey(adsKeyFor("act_1"))).toBe(false);
    expect(isAdsManageKey(keyFor("1"))).toBe(false);
  });

  it("counts as an ads key, so the Page listing leaves it out", () => {
    expect(isAdsKey("facebook_ads_manage:act_1")).toBe(true);
    expect(isAdsKey(ADS_MANAGE_PENDING_KEY)).toBe(true);
  });

  it("gives its own account id back, and none to the other readers", () => {
    expect(adsManageAccountIdInKey("facebook_ads_manage:act_1")).toBe("act_1");
    expect(adsManageAccountIdInKey("facebook_ads:act_1")).toBeUndefined();
    expect(adsManageAccountIdInKey(ADS_MANAGE_PENDING_KEY)).toBeUndefined();
    expect(adAccountIdInKey("facebook_ads_manage:act_1")).toBeUndefined();
    expect(pageIdInKey("facebook_ads_manage:act_1")).toBeUndefined();
  });
});

describe("the Page listing", () => {
  it("does not list an ad account, or an ads_management one, as a Page", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: () => ({
        from: () => ({
          select: () => ({
            order: async () => ({
              data: [
                { key: "facebook:1", page_id: "1", page_name: "เพจ", scopes: [], fields: [], updated_at: "2026-09-22T00:00:00Z" },
                { key: "facebook_ads:act_9", page_id: "act_9", page_name: "บัญชีโฆษณา", scopes: ["ads_read"], fields: [], updated_at: "2026-09-22T00:00:00Z" },
                { key: "facebook_ads_manage:act_9", page_id: "act_9", page_name: "บัญชีโฆษณา", scopes: ["ads_management"], fields: [], updated_at: "2026-09-22T00:00:00Z" },
                { key: "facebook_ads_manage_pending", page_id: null, page_name: null, scopes: ["ads_management"], fields: [], updated_at: "2026-09-22T00:00:00Z" },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }));
    const { pageConnections } = await import("@/lib/facebook/connection");
    const pages = await pageConnections();
    expect(pages.map((p) => p.pageId)).toEqual(["1"]);
  });
});
