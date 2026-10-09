import { describe, expect, it } from "vitest";
import { parseSettings } from "@/lib/content/thumbnail-history";
import { MAX_HEADLINE } from "@/lib/content/thumbnail";

const good = { size: "16:9", style: "bold", headline: "หัว", sub: "รอง", scene: "", source: "ai", personId: null, pose: "auto" };

describe("parseSettings", () => {
  it("accepts a good set", () => {
    expect(parseSettings(good)).toEqual(good);
  });
  it("rejects a size or style that is not offered", () => {
    expect(parseSettings({ ...good, size: "1:1" })).toBeNull();
    expect(parseSettings({ ...good, style: "neon" })).toBeNull();
    expect(parseSettings(null)).toBeNull();
    expect(parseSettings("x")).toBeNull();
  });
  it("needs a headline, and cuts long fields", () => {
    expect(parseSettings({ ...good, headline: "  " })).toBeNull();
    expect(parseSettings({ ...good, headline: "ก".repeat(MAX_HEADLINE + 20) })!.headline).toHaveLength(MAX_HEADLINE);
    expect(parseSettings({ ...good, scene: "s".repeat(9000) })!.scene).toHaveLength(2500);
  });
  it("keeps a person only for the person source, and only a uuid", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseSettings({ ...good, source: "person", personId: id })!.personId).toBe(id);
    expect(parseSettings({ ...good, source: "person", personId: "nope" })).toBeNull();
    expect(parseSettings({ ...good, source: "ai", personId: id })!.personId).toBeNull();
  });
});
