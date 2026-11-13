import { describe, expect, it } from "vitest";
import { checkedStory, healthPlanChoices, previewHealth } from "@/lib/quote-video/story";
import { STORY_TOPICS, topicOf } from "@/lib/story/topics";

const faces = { narrator: "w26", hero: "w15" };
const PLAN = { plan: "SILVER", sex: "M", age: 35 };

describe("the story-clip form's health input", () => {
  it("accepts a health topic with plan, sex and age and keeps the figures", () => {
    const s = checkedStory({ topic: "lumpsum", faces, health: PLAN }, "F");
    if (typeof s === "string") throw new Error(s);
    expect(s.health?.figures.planName).toBeTruthy();
    expect(s.health?.room).toBeUndefined();
  });
  it("keeps the optional room and bill the agent typed", () => {
    const s = checkedStory({ topic: "roomcost", faces, health: { ...PLAN, room: "6000", bill: 300_000 } }, "F");
    if (typeof s === "string") throw new Error(s);
    expect(s.health).toMatchObject({ room: 6000, bill: 300_000 });
  });
  it("refuses a health topic without a plan", () => {
    expect(checkedStory({ topic: "waiting", faces, health: { sex: "M", age: 35 } }, "F")).toBe("เลือกแผน");
    expect(checkedStory({ topic: "waiting", faces }, "F")).toMatch(/[ก-๙]/);
  });
  it("ignores room on a topic that has no health figure", () => {
    const other = STORY_TOPICS.find((t) => t.figure !== "health" && t.shelf !== "health")!;
    const s = checkedStory({ topic: other.key, faces, health: { ...PLAN, room: 6000 } }, "F");
    if (typeof s === "string") throw new Error(s);
    expect(s.health).toBeUndefined();
  });
  it("takes groupins' typed numbers through home, with no plan", () => {
    expect(topicOf("groupins")?.home).toBe("group");
    const s = checkedStory({ topic: "groupins", faces, home: { bill: 300_000, group: 50_000 } }, "F");
    if (typeof s === "string") throw new Error(s);
    expect(s.home).toEqual({ kind: "group", bill: 300_000, group: 50_000 });
    expect(checkedStory({ topic: "groupins", faces, home: { bill: 300_000 } }, "F")).toMatch(/[ก-๙]/);
  });
  it("lists the plans the company sells at an age, with Thai names, and previews the sheet", () => {
    const plans = healthPlanChoices(35);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.code && /\S/.test(p.name))).toBe(true);
    const ok = previewHealth({ plan: plans[0].code, sex: "F", age: 35 });
    expect(ok).toMatchObject({ plans: expect.any(Array) });
    expect(previewHealth({ plan: "NOPE", sex: "F", age: 35 })).toMatchObject({ error: "เลือกแผน" });
  });
});
