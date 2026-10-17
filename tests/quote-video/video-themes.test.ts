import { createElement as h, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { addSounds, mixNarration } from "@/lib/quote-video/job";
import { a } from "@/lib/quote-video/motion";
import { readTheme, THEME_KEYS } from "@/lib/quote-video/theme-keys";
import { collageDecor, collageSounds, decorAnims, themed } from "@/lib/quote-video/themes";

type El = ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>;
const kids = (e: El) => [e.props.children].flat().filter(isValidElement) as El[];

describe("วิดีโอนำเสนอ themes (owner, 2026-10-17)", () => {
  it("keeps the four the owner kept, and reads anything else as น้ำเงินทอง", () => {
    expect(THEME_KEYS).toEqual(["navy", "clean", "paper", "collage"]);
    expect(readTheme("collage")).toBe("collage");
    expect(readTheme("gold")).toBe("navy");
    expect(readTheme(undefined)).toBe("navy");
  });

  it("leaves a navy frame as it was", () => {
    const frame = h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000");
    expect(themed(frame, "navy")).toBe(frame);
  });

  it("sets คอลลาจ's big figure on a paper strip and lays its cards crooked, a little differently each step", () => {
    const frame = h("div", { style: { display: "flex" } },
      h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000"),
      h("div", { style: { display: "flex", background: C.paper, color: C.motionNavy } }, "ขอคืนได้"));
    const at = (t: number) => kids(themed(frame, "collage", t) as El);
    const [big, card] = at(0);
    const strip = kids(big)[0];
    expect(strip.props.style?.transform).toBe("rotate(-2deg)");
    expect([strip.props.children].flat()).toEqual(["2,000,000"]);
    expect(String(card.props.style?.transform)).toMatch(/^rotate\(/);
    const tilts = [0, 1 / 6, 2 / 6].map((t) => at(t)[1].props.style?.transform);
    expect(new Set(tilts).size).toBeGreaterThan(1);
  });
});

describe("คอลลาจ's sounds", () => {
  it("plays one as each piece moves in, none for a fade or a count, the pen once a scene", () => {
    const cues = collageSounds([
      { start: 0, anims: [a(0.2, "fade"), a(0.5, "pop"), a(0.55, "pop"), a(1, "up"), a(1.4, "count"), a(2, "stroke"), a(3, "stroke")] },
      { start: 10, anims: [a(0.3, "grow"), a(0.6, "left")] },
    ]);
    expect(cues).toEqual([
      { at: 0.5, kind: "pop" }, { at: 1, kind: "swish" }, { at: 2, kind: "pen" },
      { at: 10.3, kind: "slap" }, { at: 10.6, kind: "swish" },
    ]);
  });

  it("adds a sound under the voice without wiping it, and holds it inside 16 bits", () => {
    const pcm = (v: number, n: number) => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(v, i * 2); return b; };
    const wav = mixNarration([{ pcm: pcm(1000, 10), at: 0 }], 10 / 24000);
    const out = addSounds(wav, [{ pcm: pcm(30000, 4), at: 0, gain: 0.5 }, { pcm: pcm(32000, 2), at: 0, gain: 1 }]);
    expect(out.readInt16LE(44)).toBe(32767);
    expect(out.readInt16LE(44 + 2 * 3)).toBe(1000 + 15000);
    expect(out.readInt16LE(44 + 2 * 6)).toBe(1000);
    expect(wav.readInt16LE(44)).toBe(1000);
  });
});

describe("คอลลาจ's library pictures in the scenes", () => {
  it("pops one under the price and the contact, two under a bar cover, none under a cover that fills the page", () => {
    expect(decorAnims("price").map((x) => x.kind)).toEqual(["pop"]);
    expect(decorAnims("contact")).toHaveLength(1);
    expect(decorAnims("cover", "bars")).toHaveLength(2);
    expect(decorAnims("cover", "rows")).toEqual([]);
    expect(decorAnims("value")).toEqual([]);
  });

  it("leaves out a picture not drawn yet, and never fails the clip over one", async () => {
    const decor = await collageDecor(async (piece) => { if (piece === "umbrella") throw new Error("storage down"); return null; }, "bars");
    expect(decor("price", 5)).toBeNull();
    // the family is the app's own picture, so the cover still has it
    expect([decor("cover", 5)].flat().filter(Boolean)).toHaveLength(1);
    expect(decor("cover", 0.5)).toBeNull();
  });
});
