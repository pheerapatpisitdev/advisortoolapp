import { createElement as h, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { myColorPalette, POSTER_THEMES, QUOTE_VIDEO_COLORS as C, VIDEO_FESTIVAL_COLORS, VIDEO_THEME_COLORS } from "@/lib/card-theme";
import { readTheme, STANDING_THEMES, THEME_KEYS } from "@/lib/quote-video/theme-keys";
import { themed } from "@/lib/quote-video/themes";
import { a, El } from "@/lib/quote-video/motion";

type El = ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>;
const kids = (e: El) => [e.props.children].flat().filter(isValidElement) as El[];

describe("วิดีโอนำเสนอ themes (owner, 2026-10-17)", () => {
  it("keeps the two the owner kept on 2026-10-20 with ไวท์บอร์ด and ตัวหนังสือเด้ง, กระจกใส and โน้ตแปะ after the old ones (2026-10-23), ธีมเทศกาล in its days, and reads anything else as น้ำเงินทอง", () => {
    expect(STANDING_THEMES).toEqual(["navy", "glass", "sticky", "paper", "board", "kinetic", "mine"]);
    expect(THEME_KEYS).toEqual(["navy", "paper", "board", "kinetic", "mine", "festival", "glass", "sticky"]);
    // นิตยสาร was sampled and not kept (owner, 2026-10-23)
    expect(readTheme("editorial")).toBe("navy");
    expect(readTheme("paper")).toBe("paper");
    // a clip asked for in a look since taken away
    expect(readTheme("collage")).toBe("navy");
    expect(readTheme("clean")).toBe("navy");
    expect(readTheme("gold")).toBe("navy");
    expect(readTheme(undefined)).toBe("navy");
  });

  it("leaves a navy frame as it was", () => {
    const frame = h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000");
    expect(themed(frame, "navy")).toBe(frame);
    // ธีมเทศกาล without its festival named draws as น้ำเงินทอง
    expect(themed(frame, "festival")).toBe(frame);
  });

  it("repaints ธีมเทศกาล in its festival's colours", () => {
    const frame = h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000");
    expect((themed(frame, "festival", { festival: "cny" }) as El).props.style?.color).toBe(VIDEO_FESTIVAL_COLORS.cny.accent);
  });

  it("repaints วาดมือบนกระดาษ's gold figure and white card in its own colours, laid as they were", () => {
    const frame = h("div", { style: { display: "flex" } },
      h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000"),
      h("div", { style: { display: "flex", background: C.paper, color: C.motionNavy } }, "ขอคืนได้"));
    const [big, card] = kids(themed(frame, "paper") as El);
    expect(big.props.style?.color).toBe(VIDEO_THEME_COLORS.paper.accent);
    expect(big.props.style?.transform).toBeUndefined();
    expect(card.props.style?.background).toBe(VIDEO_THEME_COLORS.paper.card);
    expect(card.props.style?.color).toBe(VIDEO_THEME_COLORS.paper.onCard);
  });

  it("writes ไวท์บอร์ด's pieces in behind one marker, on the piece started last", () => {
    const frame = h("div", { style: { display: "flex" } },
      h(El, { an: a(0, "pop", 1), t: 0.5, style: { fontSize: 60 } }, "มรดก"),
      h(El, { an: a(0.2, "fade", 1), t: 0.5, style: { fontSize: 60 } }, "2,000,000"),
      h(El, { an: a(2, "fade", 1), t: 0.5, style: { fontSize: 60 } }, "ยังไม่ถึง"));
    const html = JSON.stringify(themed(frame, "board"), (_k, v) => (typeof v === "function" ? undefined : v));
    expect(html.match(/inset\(/g)).toHaveLength(2);
    expect(html.match(/rotate\(32\)/g)).toHaveLength(1);
    // outside the repaint the pieces enter as before
    expect(JSON.stringify(El({ an: a(0, "fade", 1), t: 0.5, style: {} }))).not.toMatch(/inset/);
  });

  it("draws สีของฉัน in the agent's card colours, and as น้ำเงินทอง with no colour named", () => {
    const frame = h("div", { style: { display: "flex", color: C.motionGold, fontSize: 150 } }, "2,000,000");
    expect(themed(frame, "mine")).toBe(frame);
    expect((themed(frame, "mine", { myColor: "emerald" }) as El).props.style?.color).toBe(POSTER_THEMES.emerald.badgeBg);
    // a light set keeps its own dark words
    expect(myColorPalette("blush").ink).toBe(POSTER_THEMES.blush.headline);
    expect(myColorPalette("emerald").ink).toBe("#ffffff");
  });

  it("edges กระจกใส's white card and the subtitle's band in light, and keeps a card's coloured left edge", () => {
    const frame = h("div", { style: { display: "flex" } },
      h("div", { style: { display: "flex", background: C.paper, color: C.motionNavy, borderLeft: `18px solid ${C.motionSky}` } }, "ขอคืนได้"),
      h("div", { style: { display: "flex", background: "rgba(0,0,0,0.45)", color: C.paper } }, "ออมแค่วันละ 79 บาท"));
    const [card, band] = kids(themed(frame, "glass") as El);
    expect(card.props.style?.background).toBe(VIDEO_THEME_COLORS.glass.card);
    expect(card.props.style?.boxShadow).toMatch(/inset/);
    expect(card.props.style?.borderLeft).toBe(`18px solid ${VIDEO_THEME_COLORS.glass.second}`);
    expect(card.props.style?.borderTop).toMatch(/rgba\(255,255,255/);
    expect(band.props.style?.background).toBe(VIDEO_THEME_COLORS.glass.subBg);
    expect(band.props.style?.border).toMatch(/rgba\(255,255,255/);
  });

  it("makes โน้ตแปะ's white cards notes in turn, tilted and taped, and writes every word in its marker", () => {
    const card = (text: string) => h("div", { style: { display: "flex", background: C.paper, color: C.motionNavy, fontFamily: "Plex", fontWeight: 700 } }, text);
    const [one, two] = kids(themed(h("div", { style: { display: "flex" } }, card("ขอคืนได้"), card("ออมไป")), "sticky") as El);
    expect(one.props.style?.background).toBe(VIDEO_THEME_COLORS.sticky.notes[0]);
    expect(two.props.style?.background).toBe(VIDEO_THEME_COLORS.sticky.notes[1]);
    expect(one.props.style?.transform).toMatch(/rotate\(-?\d/);
    expect(one.props.style?.fontFamily).toBe("Sriracha");
    expect(one.props.style?.fontWeight).toBe(400);
    // the strip of tape, the card's last child
    expect(kids(one).at(-1)?.props.style?.position).toBe("absolute");
  });
});
