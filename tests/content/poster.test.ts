import { describe, expect, it } from "vitest";
import { clip, decodePoster, defaultPoster, encodePoster, parsePoster, posterText, MAX_CHARS } from "@/lib/content/poster";
import { fitScale, withBreaks } from "@/lib/content/poster-layout";

describe("parsePoster", () => {
  it("keeps the lines it knows, and defaults what is missing", () => {
    const p = parsePoster({ blocks: [{ kind: "badge", text: "ประกันชีวิต" }, { kind: "headline", text: "วันละ 20 บาท" }, { kind: "banner", text: "x" }] })!;
    expect(p.layout).toBe("bottom");
    expect(p.theme).toBe("navy");
    expect(p.blocks.map((b) => b.kind)).toEqual(["badge", "headline"]);
  });

  it("clips a line to what a poster can carry, by character and not by byte", () => {
    const p = parsePoster({ blocks: [{ kind: "headline", text: "ก".repeat(200) }] })!;
    expect([...p.blocks[0].text].length).toBeLessThanOrEqual(MAX_CHARS.headline);
  });

  it("cuts a long line at a word, never inside one", () => {
    // cutting by character once left a poster reading "…ได้ทั้งแบ"
    const cut = clip("9 เรื่องที่ควรรู้ก่อนซื้อ Life Protect+ 100 ที่เลือกจ่ายเบี้ยได้ทั้งแบบ 9 ปี 19 ปี หรือถึงอายุ 99 ปีครับ", 70);
    expect(cut.endsWith("…")).toBe(true);
    expect([...cut].length).toBeLessThanOrEqual(70);
    expect(cut).not.toContain("ทั้งแบ…");
  });

  it("refuses a poster with no headline", () => {
    expect(parsePoster({ blocks: [{ kind: "sub", text: "x" }] })).toBeNull();
    expect(parsePoster("poster")).toBeNull();
  });
});

describe("defaultPoster", () => {
  it("puts an older piece's hook under the product's short name", () => {
    const p = defaultPoster("ถ้าพรุ่งนี้ไม่มีเรา", "Life Protect+ 100 (Life Protect x 2)");
    expect(p.blocks[0]).toEqual({ kind: "badge", text: "Life Protect+ 100" });
    expect(p.blocks[1]).toEqual({ kind: "headline", text: "ถ้าพรุ่งนี้ไม่มีเรา" });
  });
});

describe("encodePoster", () => {
  it("survives the trip through a URL, Thai and all", () => {
    const p = defaultPoster("ทุน 1,000,000 บาท คุ้มครองสองเท่า", "iShield");
    const s = encodePoster(p);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePoster(s)).toEqual(p);
    expect(decodePoster("not-a-poster")).toBeNull();
  });

  it("gives the checks every word on the poster", () => {
    expect(posterText(defaultPoster("วันละ 20 บาท", "iShield"))).toContain("วันละ 20 บาท");
  });
});

describe("layout", () => {
  it("marks where Thai may break, without changing what is drawn", () => {
    // the drawing library reads a Thai sentence as one word and will not wrap it
    const broken = withBreaks("ถ้าพรุ่งนี้ไม่มีเรา");
    expect(broken).toContain("​");
    expect(broken.replace(/​/g, "")).toBe("ถ้าพรุ่งนี้ไม่มีเรา");
  });

  it("shrinks a crowded poster to fit, and leaves a short one alone", () => {
    const short = defaultPoster("วันละ 20 บาท", "iShield");
    expect(fitScale(short, { width: 1080, height: 1080 })).toBe(1);
    const long = parsePoster({ blocks: [
      { kind: "headline", text: "ก".repeat(70) },
      { kind: "sub", text: "ข".repeat(110) },
      { kind: "sub", text: "ค".repeat(110) },
      { kind: "sub", text: "ง".repeat(110) },
    ] })!;
    expect(fitScale(long, { width: 1080, height: 1080 })).toBeLessThan(1);
  });
});

describe("an English poster", () => {
  const base = { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "Hi" }] };

  it("keeps lang en through parsePoster and drops any other value", () => {
    expect(parsePoster({ ...base, lang: "en" })?.lang).toBe("en");
    expect(parsePoster({ ...base, lang: "fr" })).not.toHaveProperty("lang");
    expect(decodePoster(encodePoster(parsePoster({ ...base, lang: "en" })!))?.lang).toBe("en");
  });

  it("draws an English default poster", () => {
    const p = defaultPoster("Cover that stays", "iHealthy Ultra", "en");
    expect(p.lang).toBe("en");
    expect(p.blocks.at(-1)).toEqual({ kind: "footer", text: "Message us to ask" });
    expect(defaultPoster("x", "y")).not.toHaveProperty("lang");
  });
});
