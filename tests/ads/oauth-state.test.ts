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
