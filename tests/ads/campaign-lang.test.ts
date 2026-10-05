import { describe, expect, it } from "vitest";
import { campaignLang } from "@/lib/ads/campaign-lang";
import { EXPAT_PAGES } from "@/lib/assistant/expat";
import { contactBlock } from "@/lib/ads/page-contact";
import { ctaLabel } from "@/lib/ads/ads-list";
import { EXPAT_NICHES, NICHES, readerFor } from "@/lib/content/prompt";

/**
 * A campaign's language (spec 2026-10-06): English only for iHealthy Ultra on an Expat Page, Thai
 * for everything else — derived, never stored.
 */

const EXPAT = "112110731809903";
const THAI_PAGE = "104857600123456";

describe("campaignLang", () => {
  it.each([
    ["/ihealthy-ultra", EXPAT, "en"],
    ["/ihealthy-ultra", "112079600278201", "en"],
    ["/ihealthy-ultra", "107330411059217", "en"],
    ["/ihealthy-ultra", THAI_PAGE, "th"],
    ["/lifeprotect", EXPAT, "th"],
    ["/lifeprotect", THAI_PAGE, "th"],
    ["/ihealthy-ultra", "", "th"],
    ["/ihealthy", EXPAT, "th"],
  ])("%s on %s is %s", (href, page, want) => {
    expect(campaignLang(href, page)).toBe(want);
  });

  it("is English on every Expat Page", () => {
    for (const page of EXPAT_PAGES) expect(campaignLang("/ihealthy-ultra", page)).toBe("en");
  });
});

describe("an English ad's contacts and button", () => {
  it("keeps the contact lines, and invites in English when there are none", () => {
    const c = { agentName: "Phet", lineId: "expatphet", inboxUrl: "https://m.me/112110731809903" };
    expect(contactBlock(c, "en")).toBe("👉 Phet\n📲 Line: @expatphet\n👉 Inbox: https://m.me/112110731809903");
    expect(contactBlock(null, "en")).toBe("Message us");
    expect(contactBlock(null)).toBe("ทักแชทได้เลย");
  });

  it("says Send message under an English ad not sent or sent for messages", () => {
    expect(ctaLabel(null, "en")).toBe("Send message");
    expect(ctaLabel({ objective: "messages", cta: null }, "en")).toBe("Send message");
    expect(ctaLabel({ objective: "traffic", cta: null }, "en")).toBe("Learn more");
    expect(ctaLabel(null)).toBe("ส่งข้อความ");
  });

  it("words a lead form's button in English", () => {
    expect(ctaLabel({ objective: "leads", cta: "GET_QUOTE" }, "en")).toBe("Get quote");
    expect(ctaLabel({ objective: "leads", cta: "SIGN_UP" }, "en")).toBe("Sign up");
    expect(ctaLabel({ objective: "leads", cta: "LEARN_MORE" }, "en")).toBe("Learn more");
    expect(ctaLabel({ objective: "leads", cta: null }, "en")).toBe("Learn more");
    expect(ctaLabel({ objective: "leads", cta: "GET_QUOTE" })).toBe("รับใบเสนอราคา");
  });
});

describe("an English campaign's saved reader", () => {
  it("drops a Thai chip and keeps an expat chip or typed words (WriteForm uses readerFor)", () => {
    expect(readerFor(NICHES[0], true)).toBe("");
    expect(readerFor(EXPAT_NICHES[0], true)).toBe(EXPAT_NICHES[0]);
    expect(readerFor("Retired teachers in Chiang Mai", true)).toBe("Retired teachers in Chiang Mai");
  });
});
