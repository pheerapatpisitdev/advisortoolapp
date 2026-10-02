import { describe, expect, it } from "vitest";
import { playClick } from "@/lib/shell/click-sound";

describe("the menu's click sound", () => {
  it("is silent, not broken, where there is no Web Audio (the server render, an old browser)", () => {
    expect(() => playClick()).not.toThrow();
  });
});
