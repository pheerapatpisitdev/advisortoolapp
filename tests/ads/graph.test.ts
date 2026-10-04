import { describe, expect, it } from "vitest";
import { adsetParams, campaignParams, creativeParams, LEAD_CTAS, LEAD_LINK, messengerLink, type AdGoal } from "@/lib/ads/graph";

/**
 * The builders both ad engines share: what each object carries for a traffic ad and for a lead
 * ad. Traffic is pinned field by field elsewhere (send.test.ts, launch.test.ts); here the two
 * objectives are set side by side so a lead field cannot leak into traffic or the other way.
 */

const traffic: AdGoal = { objective: "traffic", link: "https://x.test/plan" };
const leads: AdGoal = { objective: "leads", leadFormId: "777", cta: "GET_QUOTE" };
const messages: AdGoal = { objective: "messages" };
const adset = (goal: AdGoal) => adsetParams({ name: "n", campaignId: "C1", dailyBudgetMinor: 10000, identity: "VID1", goal, pageId: "111" });
const omit = (o: Record<string, string>, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const creative = (goal: AdGoal) => JSON.parse(creativeParams({
  name: "n", pageId: "111", imageHash: "H1", goal, primaryText: "ข้อความ", headline: "หัวข้อ", description: "คำอธิบาย",
}).object_story_spec);

describe("the campaign", () => {
  it("is traffic when no objective is named, or traffic is", () => {
    expect(campaignParams("n").objective).toBe("OUTCOME_TRAFFIC");
    expect(campaignParams("n", "traffic").objective).toBe("OUTCOME_TRAFFIC");
  });

  it("is a lead campaign for leads, paused and with the same other fields", () => {
    const leads = campaignParams("n", "leads");
    expect(leads.objective).toBe("OUTCOME_LEADS");
    expect(omit(leads, "objective")).toEqual(omit(campaignParams("n", "traffic"), "objective"));
    expect(leads).toMatchObject({ status: "PAUSED", special_ad_categories: "[]", is_adset_budget_sharing_enabled: "false" });
  });

  it("is an engagement campaign for messages, with the same other fields", () => {
    const m = campaignParams("n", "messages");
    expect(m.objective).toBe("OUTCOME_ENGAGEMENT");
    expect(omit(m, "objective")).toEqual(omit(campaignParams("n", "traffic"), "objective"));
  });
});

describe("the ad set", () => {
  it("optimises traffic for link clicks to a website, with no promoted object", () => {
    const a = adset(traffic);
    expect(a).toMatchObject({ optimization_goal: "LINK_CLICKS", destination_type: "WEBSITE" });
    expect(a).not.toHaveProperty("promoted_object");
  });

  it("optimises leads for forms filled on Facebook, promoting the Page", () => {
    const a = adset(leads);
    expect(a).toMatchObject({ optimization_goal: "LEAD_GENERATION", destination_type: "ON_AD" });
    expect(JSON.parse(a.promoted_object)).toEqual({ page_id: "111" });
  });

  it("optimises messages for conversations in Messenger, promoting the Page", () => {
    const a = adset(messages);
    expect(a).toMatchObject({ optimization_goal: "CONVERSATIONS", destination_type: "MESSENGER" });
    expect(JSON.parse(a.promoted_object)).toEqual({ page_id: "111" });
  });

  it("keeps budget, bidding, audience, the Thai identity and PAUSED the same for every objective", () => {
    const pick = (a: Record<string, string>) => omit(a, "optimization_goal", "destination_type", "promoted_object");
    expect(pick(adset(leads))).toEqual(pick(adset(traffic)));
    expect(pick(adset(messages))).toEqual(pick(adset(traffic)));
    expect(adset(leads)).toMatchObject({ status: "PAUSED", daily_budget: "10000", billing_event: "IMPRESSIONS", bid_strategy: "LOWEST_COST_WITHOUT_CAP" });
  });
});

describe("the creative", () => {
  it("sends a traffic button to the link", () => {
    expect(creative(traffic).link_data).toMatchObject({
      link: "https://x.test/plan",
      call_to_action: { type: "LEARN_MORE", value: { link: "https://x.test/plan" } },
    });
  });

  it("opens the chosen form with the chosen button on a lead ad, with the placeholder link", () => {
    const c = creative({ objective: "leads", leadFormId: "777", cta: "SIGN_UP" });
    expect(c.page_id).toBe("111");
    expect(c.link_data).toEqual({
      image_hash: "H1", link: LEAD_LINK, message: "ข้อความ", name: "หัวข้อ", description: "คำอธิบาย",
      call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: "777" } },
    });
  });

  it("opens a Messenger chat with the Page on a messages ad, its link the Page's m.me address", () => {
    expect(creative(messages).link_data).toEqual({
      image_hash: "H1", link: "https://m.me/111", message: "ข้อความ", name: "หัวข้อ", description: "คำอธิบาย",
      call_to_action: { type: "MESSAGE_PAGE", value: { app_destination: "MESSENGER" } },
    });
    expect(messengerLink("111")).toBe("https://m.me/111");
  });

  it("offers the three lead buttons, quote first", () => {
    expect(LEAD_LINK).toBe("http://fb.me/");
    expect(LEAD_CTAS).toEqual(["GET_QUOTE", "SIGN_UP", "LEARN_MORE"]);
  });
});
