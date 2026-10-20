import { describe, expect, it } from "vitest";
import { fxPropsOf, joinCues, moodFor, musicVolume, tidyCues, transitionOf } from "@/lib/quote-video/fx";
import { classicCues, quoteCues } from "@/lib/quote-video/fx-cues";
import { iconFor } from "@/lib/quote-video/fx-icons";
import { fxModeOf, isFxMode } from "@/lib/quote-video/fx-mode";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { quoteVideoFacts } from "@/lib/quote-video/script";
import { LEAD, type OverlayState } from "@/lib/quote-video/timeline";

/** ลูกเล่นคลิปใหม่ (owner chose ก, 2026-10-20): music, sound effects, the wipe, moving icons; the owner alone first */

describe("what a clip's props are told", () => {
  it("is nothing for a clip made without the new look, so it draws as before", () => {
    expect(fxPropsOf({ product: "LIFEPROTECT" })).toEqual({});
    expect(fxPropsOf({ product: "LIFEPROTECT", noMusic: true })).toEqual({});
  });

  it("carries the music for the product, or none when the agent turned it off", () => {
    expect(fxPropsOf({ product: "LIFEPROTECT", fx: true })).toEqual({ fx: { music: "warm" } });
    expect(fxPropsOf({ product: "IHEALTHY", fx: true })).toEqual({ fx: { music: "bright" } });
    expect(fxPropsOf({ product: "FHC", fx: true })).toEqual({ fx: { music: "calm" } });
    expect(fxPropsOf({ product: "STORY", fx: true, noMusic: true })).toEqual({ fx: { music: null } });
    expect(moodFor(undefined)).toBe("warm");
  });
});

describe("the joins", () => {
  it("wipe in only the new look's few scenes, and only with the new look", () => {
    expect(transitionOf("value", true, TRANSITIONS)).toBe("wipe");
    expect(transitionOf("value", false, TRANSITIONS)).toBe(TRANSITIONS.value);
    expect(transitionOf("price", true, TRANSITIONS)).toBe(TRANSITIONS.price);
    expect(transitionOf("nothing-known", true, TRANSITIONS)).toBe("fade");
  });
});

describe("the music", () => {
  const scenes = [{ start: 0, voiceSec: 4 }, { start: 6, voiceSec: 3 }];
  it("comes up at the start and goes out at the end", () => {
    expect(musicVolume(0, scenes, 10)).toBe(0);
    expect(musicVolume(10, scenes, 10)).toBe(0);
  });

  it("is quieter while the voice speaks than between its lines", () => {
    const speaking = musicVolume(LEAD + 2, scenes, 10);
    const between = musicVolume(5.3, scenes, 10);
    expect(speaking).toBeCloseTo(0.09, 2);
    expect(between).toBeGreaterThan(speaking * 2);
  });
});

describe("the sound effects", () => {
  it("whoosh at each join after the first, a little ahead of it", () => {
    expect(joinCues([{ start: 0 }, { start: 5 }, { start: 9 }])).toEqual([
      { at: 4.8, sound: "whoosh", volume: 0.5 }, { at: 8.8, sound: "whoosh", volume: 0.5 },
    ]);
  });

  it("keep two of one sound apart, and none before the clip starts", () => {
    const out = tidyCues([{ at: 1, sound: "pop", volume: 1 }, { at: 1.2, sound: "pop", volume: 1 }, { at: 1.1, sound: "ding", volume: 1 }, { at: -1, sound: "ding", volume: 1 }]);
    expect(out.map((c) => `${c.sound}@${c.at}`)).toEqual(["pop@1", "ding@1.1"]);
  });

  it("ding as a quote clip's figures finish counting, coins on the price, a pop for each icon", () => {
    const facts = quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 }, new Date("2026-10-17T12:00:00+07:00"))!;
    const at = (key: string, start: number) => ({ key, start, voiceSec: 6, voice: "" });
    const cues = quoteCues([at("lead", 0), at("price", 10), at("cover", 20), at("contact", 30)], facts, true);
    const sounds = cues.map((c) => c.sound);
    expect(sounds.filter((s) => s === "whoosh")).toHaveLength(3);
    expect(sounds).toContain("ding");
    expect(sounds).toContain("coins");
    // cover's house and contact's phone
    expect(cues.filter((c) => c.sound === "pop" && c.at >= 20)).toHaveLength(2);
    // no icons in a square or landscape clip
    expect(quoteCues([at("cover", 0)], facts, false).some((c) => c.sound === "pop")).toBe(false);
  });

  it("ding in a แบบปกติ clip where a figure's count reaches its end", () => {
    const s = (count: number): OverlayState => ({ word: 0, count, sweep: [], bars: [0, 0], ring: 0 });
    const cues = classicCues([{ start: 0, frames: [{ t: 0, state: s(0) }, { t: 1, state: s(0.5) }, { t: 1.7, state: s(1) }] }, { start: 8, frames: [{ t: 0, state: s(1) }] }]);
    expect(cues).toContainEqual({ at: 1.7, sound: "ding", volume: 0.45 });
    expect(cues.filter((c) => c.sound === "ding")).toHaveLength(1);
  });
});

describe("the icons", () => {
  it("go where a scene has no picture of its own", () => {
    expect(iconFor("LIFEPROTECT", "cover")).toBe("home");
    expect(iconFor(undefined, "cover")).toBe("home");
    expect(iconFor("IHEALTHY", "cover")).toBe("hospital");
    expect(iconFor("PENSION", "cover")).toBe("calendar");
    expect(iconFor("PLB", "terms")).toBe("checklist");
    expect(iconFor("FHC", "fhcContact")).toBe("phone");
    for (const scene of ["lead", "price", "value", "compare", "critical", "index"]) expect(iconFor("LIFEPROTECT", scene)).toBeNull();
  });
});

describe("who gets it", () => {
  it("is the owner alone until the back office says otherwise, and when it cannot be read", () => {
    expect(fxModeOf(null)).toBe("owner");
    expect(fxModeOf({ "quote-video": { off: false } })).toBe("owner");
    expect(fxModeOf({ clipFx: { for: "all" } })).toBe("all");
    expect(fxModeOf({ clipFx: { for: "everybody" } })).toBe("owner");
    expect(isFxMode("off")).toBe(true);
    expect(isFxMode("on")).toBe(false);
  });
});
