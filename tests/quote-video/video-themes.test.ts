import { createElement as h, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { myColorPalette, POSTER_THEMES, QUOTE_VIDEO_COLORS as C, VIDEO_FESTIVAL_COLORS, VIDEO_THEME_COLORS } from "@/lib/card-theme";
import { DEFAULT_THEME, readTheme, STANDING_THEMES, THEME_KEYS } from "@/lib/quote-video/theme-keys";
import { themed } from "@/lib/quote-video/themes";
import { a, El, motionFrame, type MotionContext } from "@/lib/quote-video/motion";
import { quoteVideoFacts, quoteVideoScript, type VideoInput } from "@/lib/quote-video/script";
import { textClips } from "../helpers/text-clips";
import { wideQuoteFrame, type WideQuoteContext } from "@/lib/quote-video/wide";

type El = ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>;
const kids = (e: El) => [e.props.children].flat().filter(isValidElement) as El[];

describe("วิดีโอนำเสนอ themes (owner, 2026-10-17)", () => {
  it("offers ไวท์บอร์ด first, then โน้ตแปะ and ตัวหนังสือเด้ง, and reads any other look as ไวท์บอร์ด (owner chose ก, 2026-11-17; ธีมเทศกาล out 2026-11-20)", () => {
    expect(STANDING_THEMES).toEqual(["board", "sticky", "kinetic"]);
    expect(THEME_KEYS).toEqual(["board", "kinetic", "sticky"]);
    expect(DEFAULT_THEME).toBe("board");
    // the four taken away 2026-11-17, and every look taken away before
    for (const gone of ["navy", "paper", "glass", "mine", "festival", "editorial", "collage", "clean", "gold", undefined]) expect(readTheme(gone)).toBe("board");
    expect(readTheme("sticky")).toBe("sticky");
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

describe("ไวท์บอร์ด writes no word or figure in part (owner chose ก, 2026-11-16)", () => {
  const day = new Date("2026-11-16T12:00:00+07:00");
  const INPUTS: VideoInput[] = [
    { product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 },
    { product: "ISHIELD", variant: "WLCI10", age: 35, sex: "F", sumAssured: 1_000_000 },
    { product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: ["SILVER", "PLATINUM"] },
    { product: "PENSION", age: 40, sex: "M", annuityAge: 60, pay: "6", sumAssured: 1_000_000 },
    { product: "LEGACY", age: 30, sex: "F", tier: 1 },
  ];

  it("shows every word and figure whole or not at all, at every frame of every scene, the pen still drawing", () => {
    let seen = 0;
    let drawn = 0;
    for (const v of INPUTS) {
      const f = quoteVideoFacts(v, day)!;
      for (const sc of quoteVideoScript(f, "สมชาย", "F", "full")) {
        const c = { facts: f, customer: "สมชาย", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, words: sc.voice.split(" ").filter(Boolean), voiceSec: 8 } as unknown as MotionContext;
        for (let i = 0; i < 100; i++) {
          const frame = themed(motionFrame(sc.key, c, i * 0.1), "board");
          if (JSON.stringify(frame, (_k, x) => (typeof x === "function" ? undefined : x)).includes("inset(-40%")) drawn++;
          for (const t of textClips(frame)) {
            seen++;
            expect(t.clipped, `${v.product} ${sc.key} ${(i / 10).toFixed(1)}s "${t.text}"`).toBe(false);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(10_000);
    expect(drawn, "the marker still writes frames, rows and coins in").toBeGreaterThan(100);
  });

  it("does the same in the square and landscape clips", () => {
    let seen = 0;
    for (const v of [INPUTS[0], INPUTS[2]]) {
      const f = quoteVideoFacts(v, day)!;
      for (const size of ["square", "landscape"] as const) for (const sc of quoteVideoScript(f, "สมชาย", "F", "full")) {
        const c = { facts: f, customer: "สมชาย", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, words: sc.voice.split(" ").filter(Boolean), voiceSec: 8 } as unknown as WideQuoteContext;
        for (let i = 0; i < 60; i++) {
          for (const t of textClips(themed(wideQuoteFrame(sc.key, c, i * 0.1, size), "board"))) {
            seen++;
            expect(t.clipped, `${v.product} ${size} ${sc.key} ${(i / 10).toFixed(1)}s "${t.text}"`).toBe(false);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(1_000);
  });

  it("lays a writing piece's words in the board's colours, fading over its lines, and nothing else changes", () => {
    const frame = h("div", { style: { display: "flex" } },
      h(El, { an: a(0, "fade", 1), t: 0.5, style: { fontSize: 60, background: C.paper, color: C.motionNavy } }, "2,000,000"));
    const html = JSON.stringify(themed(frame, "board"), (_k, x) => (typeof x === "function" ? undefined : x));
    expect(html).not.toContain("data-pen");
    expect(html).toContain('"opacity":0.5');
    expect(html.match(/2,000,000/g)).toHaveLength(2);
    expect(html).toContain('"color":"rgba(0,0,0,0)"');
  });
});
