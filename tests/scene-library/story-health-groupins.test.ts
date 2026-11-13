import { describe, expect, it } from "vitest";
import { checkedStory } from "@/lib/quote-video/story";
import { objectionScenes } from "@/lib/quote-video/story-objection";

describe("มีประกันกลุ่มบริษัทแล้ว without a typed bill", () => {
  it("keeps today's five scenes exactly", () => {
    const input = checkedStory({ topic: "groupins", faces: { narrator: "w26", hero: "w15" } }, "F");
    if (typeof input === "string") throw new Error(input);
    expect(objectionScenes("groupins", input)).toMatchSnapshot();
  });
});
