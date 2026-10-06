import { describe, expect, it } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { endAtOf, isRunDays, postPath, spendCeiling, storyIdOf } from "@/lib/ads/run-path";

/** How an Organic post would run as an ad (spec 2026-10-07): boosted, a new ad, or not yet. */

const now = new Date("2026-10-07T05:00:00Z");
const poster = { headline: "x" } as unknown as NonNullable<ContentItem["output"]["poster"]>;
const post = (over: Partial<Pick<ContentItem, "format" | "status" | "publish" | "output">> = {}) => ({
  format: "post" as ContentItem["format"],
  status: "used" as ContentItem["status"],
  publish: null as ContentItem["publish"],
  output: { hooks: ["h"], body: "", closing: "", hashtags: [], imagePrompt: "", disclaimer: "", poster } as ContentItem["output"],
  ...over,
});
const published = (state: "published" | "scheduled" | "failed" | "cancelled", at: string | null, postId: string | null = "105_77") =>
  ({ state, pageId: "105", postId, at, error: null });

describe("postPath", () => {
  it("boosts a published post", () => {
    expect(postPath(post({ publish: published("published", "2026-10-01T00:00:00Z") }), now)).toEqual({ kind: "boost", postId: "105_77" });
  });

  it("waits for a post scheduled ahead", () => {
    const at = "2026-10-07T06:00:00Z";
    expect(postPath(post({ publish: published("scheduled", at) }), now)).toEqual({ kind: "scheduled", at });
  });

  it("boosts a scheduled post whose time has passed", () => {
    expect(postPath(post({ publish: published("scheduled", "2026-10-07T04:00:00Z") }), now)).toEqual({ kind: "boost", postId: "105_77" });
  });

  it("makes a new ad from a draft, or a post whose posting failed or was cancelled", () => {
    expect(postPath(post(), now)).toEqual({ kind: "new" });
    expect(postPath(post({ status: "draft" }), now)).toEqual({ kind: "new" });
    expect(postPath(post({ publish: published("failed", null, null) }), now)).toEqual({ kind: "new" });
    expect(postPath(post({ publish: published("cancelled", null, null) }), now)).toEqual({ kind: "new" });
  });

  it("says why a post cannot run", () => {
    const bare = post();
    expect(postPath({ ...bare, output: { ...bare.output, poster: undefined } }, now)).toEqual({ kind: "none", reason: "โพสต์นี้ยังไม่มีรูป" });
    expect(postPath(post({ status: "trashed" }), now)).toEqual({ kind: "none", reason: "โพสต์นี้อยู่ในถังขยะ" });
    expect(postPath(post({ format: "script" }), now)).toEqual({ kind: "none", reason: "ยิงได้เฉพาะโพสต์" });
  });
});

describe("storyIdOf", () => {
  it("uses a <page>_<post> id of this Page as it is", () => {
    expect(storyIdOf("105", "105_77")).toBe("105_77");
  });
  it("needs a lookup for a photo id, and never takes another Page's story", () => {
    expect(storyIdOf("105", "1070061492680588")).toBeNull();
    expect(storyIdOf("105", "999_77")).toBeNull();
  });
});

describe("the spend sum and the end", () => {
  it("is posts × baht a day × days", () => {
    expect(spendCeiling(2, 200, 7)).toBe(2800);
  });
  it("ends days × 24 h from now", () => {
    expect(endAtOf(new Date("2026-10-07T00:00:00Z"), 7)).toBe("2026-10-14T00:00:00.000Z");
  });
  it("offers 3, 7 or 14 days", () => {
    expect(isRunDays(7)).toBe(true);
    expect(isRunDays(5)).toBe(false);
    expect(isRunDays("7")).toBe(false);
  });
});
