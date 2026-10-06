import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => { throw new Error("no database here"); } }));
vi.mock("@/lib/facebook/ads-connection", () => ({ adAccountToken: async () => "tok" }));

const { pageOfCreative, lookUpPages } = await import("@/lib/ads/ad-pages");
const { groupMetaCampaigns } = await import("@/lib/ads/meta-campaigns");

describe("the Page an ad promotes", () => {
  it("is read off the story spec, else the published post, else the actor", () => {
    expect(pageOfCreative({ object_story_spec: { page_id: "111" }, effective_object_story_id: "222_9" })).toBe("111");
    expect(pageOfCreative({ effective_object_story_id: "222_9", actor_id: "333" })).toBe("222");
    expect(pageOfCreative({ actor_id: "333" })).toBe("333");
  });
  it("is '' when the creative names none, so the ad is not asked about again", () => {
    expect(pageOfCreative(undefined)).toBe("");
    expect(pageOfCreative({})).toBe("");
    expect(pageOfCreative({ effective_object_story_id: "x_1" })).toBe("");
  });

  it("is asked of Meta one ad at a time; an ad Meta says is not there is '', a failed one is asked again", async () => {
    const asked: string[] = [];
    const fetchFn = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const id = url.pathname.split("/").pop()!;
      asked.push(id);
      expect(url.searchParams.get("fields")).toContain("object_story_spec{page_id}");
      expect(url.searchParams.get("ids")).toBeNull();
      if (id === "gone") return Response.json({ error: { code: 100, message: "does not exist" } }, { status: 400 });
      if (id === "flaky") return Response.json({ error: { code: 2, message: "try later" } }, { status: 500 });
      return Response.json({ creative: { effective_object_story_id: `777_${id}` } });
    }) as typeof fetch;
    const ads = [...Array.from({ length: 7 }, (_, i) => `a${i}`), "gone", "flaky"];
    const pages = await lookUpPages(ads, "tok", fetchFn);
    expect(asked.sort()).toEqual([...ads].sort());
    expect(pages.get("a0")).toBe("777");
    expect(pages.get("gone")).toBe("");
    expect(pages.has("flaky")).toBe(false);
  });
});

describe("the campaigns built in Meta", () => {
  const row = (ad: string, campaign: string, spend: number, msgs = 1) => ({
    ad_id: ad, campaign_id: `c-${campaign}`, campaign_name: campaign, account_id: "act_1",
    spend: String(spend), impressions: 100, link_clicks: 5, messaging_started: msgs, fetched_at: "2026-10-06T03:52:00Z",
  });

  it("are the Page's rows by campaign, biggest spender first, Ads Studio's own ads left out", () => {
    const got = groupMetaCampaigns(
      [row("a1", "มรดก", 100), row("a1", "มรดก", 50), row("a2", "มรดก", 25), row("s1", "Studio", 999), row("b1", "test", 300, 0)],
      new Set(["s1"]),
      new Map([["act_1", "MANIT"]]),
    );
    expect(got.map((c) => [c.name, c.ads, c.result.spend, c.result.messaging])).toEqual([
      ["test", 1, 300, 0],
      ["มรดก", 2, 175, 3],
    ]);
    expect(got[1]).toMatchObject({ accountName: "MANIT", result: { impressions: 300, clicks: 15 } });
  });

  it("are none when every row is Ads Studio's", () => {
    expect(groupMetaCampaigns([row("s1", "Studio", 10)], new Set(["s1"]), new Map())).toEqual([]);
  });
});
