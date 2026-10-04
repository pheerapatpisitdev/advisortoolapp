import { beforeAll, describe, expect, it } from "vitest";

/**
 * One login screen, two reasons to go through it. The reason rides in the signed state, so
 * the callback knows which store to write to without a second route Meta would have to be
 * told about.
 */

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.FB_APP_ID = "1";
  process.env.FB_APP_SECRET = "s";
});

describe("the purpose in the state", () => {
  it("defaults to the Pages, as it always did", async () => {
    const { makeState, statePurpose, stateIsValid } = await import("@/lib/facebook/oauth");
    const s = makeState(undefined, "n1");
    expect(stateIsValid(s, "n1")).toBe(true);
    expect(statePurpose(s, "n1")).toBe("pages");
  });

  it("carries ads, signed", async () => {
    const { makeState, statePurpose, stateIsValid } = await import("@/lib/facebook/oauth");
    const s = makeState("ads", "n1");
    expect(stateIsValid(s, "n1")).toBe(true);
    expect(statePurpose(s, "n1")).toBe("ads");
    // change the purpose without re-signing and the state is dead
    const forged = s.replace(".ads.", ".pages.");
    expect(stateIsValid(forged, "n1")).toBe(false);
    expect(statePurpose(forged, "n1")).toBeUndefined();
  });
});

/** The state is good only in the browser that began the login (review, 2026-10-01). */
describe("the state and the browser", () => {
  it("is refused without the nonce cookie, or with another browser's", async () => {
    const { makeState, newStateNonce, statePurpose } = await import("@/lib/facebook/oauth");
    const mine = newStateNonce();
    const s = makeState("pages", mine);
    expect(statePurpose(s, mine)).toBe("pages");
    expect(statePurpose(s, null)).toBeUndefined();
    expect(statePurpose(s, undefined)).toBeUndefined();
    expect(statePurpose(s, "")).toBeUndefined();
    expect(statePurpose(s, newStateNonce())).toBeUndefined();
  });

  it("cannot have its nonce swapped for the attacker's own", async () => {
    const { makeState, statePurpose } = await import("@/lib/facebook/oauth");
    const s = makeState("pages", "victim");
    const [expires, , purpose, mac] = s.split(".");
    expect(statePurpose(`${expires}.attacker.${purpose}.${mac}`, "attacker")).toBeUndefined();
  });

  it("is signed with a key of its own, not ADMIN_SESSION_SECRET itself", async () => {
    const { createHmac } = await import("node:crypto");
    const { makeState, statePurpose } = await import("@/lib/facebook/oauth");
    const [expires, nonce, purpose, mac] = makeState("pages", "n1").split(".");
    expect(mac).not.toBe(createHmac("sha256", "test-secret").update(`${expires}.${nonce}.${purpose}`).digest("hex"));
    const raw = createHmac("sha256", "test-secret").update(`${expires}.n1.pages`).digest("hex");
    expect(statePurpose(`${expires}.n1.pages.${raw}`, "n1")).toBeUndefined();
  });

  it("asks Meta for ads_read when the purpose is ads", async () => {
    delete process.env.FB_LOGIN_CONFIG_ID;
    delete process.env.FB_ADS_LOGIN_CONFIG_ID;
    const { authorizeUrl, makeState } = await import("@/lib/facebook/oauth");
    const pages = new URL(authorizeUrl("https://x.test", makeState()));
    const ads = new URL(authorizeUrl("https://x.test", makeState("ads"), "ads"));
    expect(pages.searchParams.get("scope")).toBe("pages_show_list,pages_messaging,pages_manage_metadata,pages_manage_posts,pages_read_engagement");
    expect(ads.searchParams.get("scope")).toBe("ads_read");
  });
});

/**
 * The failure this guards against is not hypothetical. A business login replaces the whole
 * grant, so the Pages left unticked on Meta's screen are revoked — which has twice taken this
 * agency's live inbox down. If the advertising login ever went through the Page configuration
 * it would put that screen in front of somebody who only wanted a spend report.
 */
describe("which configuration each login goes through", () => {
  it("never sends an ads login through the Page configuration", async () => {
    process.env.FB_LOGIN_CONFIG_ID = "page-config";
    process.env.FB_ADS_LOGIN_CONFIG_ID = "ads-config";
    const { authorizeUrl, makeState } = await import("@/lib/facebook/oauth");
    const pages = new URL(authorizeUrl("https://x.test", makeState()));
    const ads = new URL(authorizeUrl("https://x.test", makeState("ads"), "ads"));
    expect(pages.searchParams.get("config_id")).toBe("page-config");
    expect(ads.searchParams.get("config_id")).toBe("ads-config");
  });

  it("does not fall back to the Page configuration when the ads one is missing", async () => {
    process.env.FB_LOGIN_CONFIG_ID = "page-config";
    delete process.env.FB_ADS_LOGIN_CONFIG_ID;
    const { adsOauthIsConfigured, authorizeUrl, makeState } = await import("@/lib/facebook/oauth");
    expect(adsOauthIsConfigured()).toBe(false);
    const ads = new URL(authorizeUrl("https://x.test", makeState("ads"), "ads"));
    expect(ads.searchParams.get("config_id")).toBeNull();
  });
});

/**
 * The third login: creating ads, which needs `ads_management`. Same screen, same state, its own
 * configuration — and the purpose is inside the signature, so a state signed for the Page or
 * the ads_read login can never come back as this one.
 */
describe("the ads-manage purpose", () => {
  it("carries ads-manage, signed", async () => {
    const { makeState, statePurpose } = await import("@/lib/facebook/oauth");
    const s = makeState("ads-manage", "n1");
    expect(statePurpose(s, "n1")).toBe("ads-manage");
  });

  it("cannot be swapped to or from the Page and ads_read purposes", async () => {
    const { makeState, statePurpose } = await import("@/lib/facebook/oauth");
    for (const other of ["pages", "ads"] as const) {
      // signed for the other purpose, relabelled ads-manage
      const toManage = makeState(other, "n1").replace(`.${other}.`, ".ads-manage.");
      expect(statePurpose(toManage, "n1")).toBeUndefined();
      // signed for ads-manage, relabelled as the other
      const fromManage = makeState("ads-manage", "n1").replace(".ads-manage.", `.${other}.`);
      expect(statePurpose(fromManage, "n1")).toBeUndefined();
    }
  });

  it("is refused in a browser without the nonce, like the other purposes", async () => {
    const { makeState, statePurpose } = await import("@/lib/facebook/oauth");
    const s = makeState("ads-manage", "n1");
    expect(statePurpose(s, null)).toBeUndefined();
    expect(statePurpose(s, "n2")).toBeUndefined();
  });

  it("goes through its own configuration, never the Page or ads_read ones", async () => {
    process.env.FB_LOGIN_CONFIG_ID = "page-config";
    process.env.FB_ADS_LOGIN_CONFIG_ID = "ads-config";
    process.env.FB_ADS_MANAGE_CONFIG_ID = "manage-config";
    const { authorizeUrl, makeState, adsManageOauthIsConfigured } = await import("@/lib/facebook/oauth");
    const url = new URL(authorizeUrl("https://x.test", makeState("ads-manage"), "ads-manage"));
    expect(url.searchParams.get("config_id")).toBe("manage-config");
    expect(adsManageOauthIsConfigured()).toBe(true);
  });

  it("does not fall back to another configuration when its own is missing", async () => {
    process.env.FB_LOGIN_CONFIG_ID = "page-config";
    process.env.FB_ADS_LOGIN_CONFIG_ID = "ads-config";
    delete process.env.FB_ADS_MANAGE_CONFIG_ID;
    const { authorizeUrl, makeState, adsManageOauthIsConfigured, adsManageConfigId } = await import("@/lib/facebook/oauth");
    expect(adsManageConfigId()).toBeUndefined();
    expect(adsManageOauthIsConfigured()).toBe(false);
    const url = new URL(authorizeUrl("https://x.test", makeState("ads-manage"), "ads-manage"));
    expect(url.searchParams.get("config_id")).toBeNull();
    // a Business login replaces the whole grant, so this list is the Page set plus the two ad scopes
    expect(url.searchParams.get("scope")).toBe(
      "pages_show_list,pages_messaging,pages_manage_metadata,pages_manage_posts,pages_read_engagement,pages_manage_ads,ads_management",
    );
  });

  it("asks for every Page scope the Page login does, so the ads login cannot revoke the inbox", async () => {
    const { ADS_MANAGE_SCOPES, SCOPES } = await import("@/lib/facebook/oauth");
    expect(ADS_MANAGE_SCOPES).toEqual([...SCOPES, "pages_manage_ads", "ads_management"]);
    for (const s of SCOPES) expect(ADS_MANAGE_SCOPES).toContain(s);
    expect(ADS_MANAGE_SCOPES).toContain("pages_messaging");
  });

  it("treats an empty configuration as missing", async () => {
    process.env.FB_ADS_MANAGE_CONFIG_ID = "";
    const { adsManageOauthIsConfigured } = await import("@/lib/facebook/oauth");
    expect(adsManageOauthIsConfigured()).toBe(false);
  });
});
