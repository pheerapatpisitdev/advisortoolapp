import { describe, expect, it } from "vitest";
import { freeParts, storyParts } from "@/lib/quote-video/make";
import { freeTail } from "@/lib/prompt-story/frames";
import type { DeviceScene, PromptScene, PromptStoryInput } from "@/lib/prompt-story/types";
import { checkedStory, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { HEALTH_LAYOUTS, knowEpisode, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { DEVICE_HOLD, deviceTail, kspec } from "@/lib/quote-video/story-knowledge-motion";
import { LEAD, TAIL, XFADE } from "@/lib/quote-video/timeline";

/** a health device's scene stays until its drawing is whole and held, however short its voice (fix round 1, R10) */
const SPLIT: DeviceScene = { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่ายยังไง"], parts: ["ห้อง", "ยา", "ผ่าตัด", "แพทย์"], whole: "จ่ายตามจริง" };
const LIMIT: DeviceScene = { layout: "limit", title: ["วงเงินต่อปี", "ใช้ไปเท่าไหร่"], limit: 5_000_000, used: 325_000, planName: "iHealthy Silver" };
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.002);

const prompt = (scenes: PromptScene[]): PromptStoryInput => ({
  product: "FREESTORY", brief: "b", title: "t", caption: "c", style: "paper", painter: "standard", faces: { narrator: "w26" }, narrator: "F", scenes,
});
const picture = (voice = "สั้นค่ะ"): PromptScene => ({ voice, screen: "คำ", picture: "a room" });
const device = (d: DeviceScene, voice = "สั้นค่ะ"): PromptScene => ({ voice, screen: "", picture: "", device: d });

describe("deviceTail", () => {
  it("is none for every show but a health device", () => {
    expect(deviceTail({ layout: "ask", title: ["a", "b"] }, 2)).toBeUndefined();
    expect(freeTail(picture(), 2)).toEqual({});
  });

  it("holds the device whole DEVICE_HOLD before the cross-fade, and is never under TAIL", () => {
    for (const d of [SPLIT, LIMIT]) {
      near(deviceTail(d, 2)!, Math.max(TAIL, end(d) + DEVICE_HOLD + XFADE - LEAD - 2));
      expect(deviceTail(d, 2)!).toBeGreaterThan(TAIL);
      expect(deviceTail(d, 30)).toBe(TAIL);
    }
  });
});

describe("freeParts", () => {
  it("lengthens a device scene with a 2 s voice, and leaves a picture scene with the same voice as it was", () => {
    const parts = freeParts({ customer_name: "", input: prompt([device(SPLIT), picture(), device(LIMIT)]) }, [2, 2, 2, 3]);
    const [a, b, c, card] = parts.plans;
    expect(a.dur).toBeGreaterThanOrEqual(end(SPLIT) + DEVICE_HOLD + XFADE - 1e-3);
    expect(c.dur).toBeGreaterThanOrEqual(end(LIMIT) + DEVICE_HOLD + XFADE - 1e-3);
    // the next scene comes in only once the device is whole and held
    expect(b.start - a.start).toBeGreaterThanOrEqual(end(SPLIT) + DEVICE_HOLD - 1e-3);
    near(b.dur, LEAD + 2 + TAIL);
    near(card.dur, LEAD + 3 + TAIL);
  });

  it("plans a clip with no device exactly as before: every scene LEAD + voice + TAIL", () => {
    const parts = freeParts({ customer_name: "", input: prompt([picture(), picture("ยาวขึ้นอีกหน่อยนะคะ"), picture()]) }, [2, 4.5, 1.2, 3]);
    [2, 4.5, 1.2, 3].forEach((s, i) => near(parts.plans[i].dur, LEAD + s + TAIL));
  });
});

describe("storyParts", () => {
  const story = (topic: StoryVideoInput["topic"], health?: Record<string, unknown>): StoryVideoInput => {
    const s = checkedStory({ topic, faces: { narrator: "w26", hero: "w15" }, ...(health ? { health } : {}) }, "F");
    if (typeof s === "string") throw new Error(s);
    return s;
  };

  it("holds a health episode's device scenes on a short voice; its other scenes keep TAIL", () => {
    const input = story("lumpsum", { plan: "SILVER", sex: "M", age: 35 });
    const script = storyScript(input, "", "F");
    const secs = script.map(() => 2);
    const { plans } = storyParts({ customer_name: "", input }, secs);
    const shows = new Map(knowEpisode(input).scenes.map((s) => [s.key, s.show]));
    let devices = 0;
    plans.forEach((p) => {
      const show = shows.get(p.key as never);
      if (show && (HEALTH_LAYOUTS as readonly string[]).includes(show.layout)) {
        devices++;
        expect(p.dur, p.key).toBeGreaterThanOrEqual(end(show) + DEVICE_HOLD + XFADE - 1e-3);
      } else near(p.dur, LEAD + 2 + TAIL);
    });
    expect(devices).toBeGreaterThan(0);
  });

  it("plans a story with no device exactly as before", () => {
    for (const topic of ["pool48", "mythclaim"] as const) {
      const input = story(topic);
      const secs = storyScript(input, "", "F").map(() => 2);
      for (const p of storyParts({ customer_name: "", input }, secs).plans) near(p.dur, LEAD + 2 + TAIL);
    }
  });
});
