import { createElement as h, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { QUOTE_VIDEO_COLORS as C, VIDEO_FESTIVAL_COLORS, VIDEO_THEME_COLORS } from "@/lib/card-theme";
import { readTheme, STANDING_THEMES, THEME_KEYS } from "@/lib/quote-video/theme-keys";
import { themed } from "@/lib/quote-video/themes";

type El = ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>;
const kids = (e: El) => [e.props.children].flat().filter(isValidElement) as El[];

describe("วิดีโอนำเสนอ themes (owner, 2026-10-17)", () => {
  it("keeps the two the owner kept on 2026-10-20, ธีมเทศกาล in its days, and reads anything else as น้ำเงินทอง", () => {
    expect(STANDING_THEMES).toEqual(["navy", "paper"]);
    expect(THEME_KEYS).toEqual(["navy", "paper", "festival"]);
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
    expect((themed(frame, "festival", "cny") as El).props.style?.color).toBe(VIDEO_FESTIVAL_COLORS.cny.accent);
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
});
