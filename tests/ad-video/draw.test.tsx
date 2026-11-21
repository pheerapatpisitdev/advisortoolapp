import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdDisclaimer, AdPhotoScene, adCtaBlock, bodyFigure } from "@/lib/ad-video/draw";
import { adCta } from "@/lib/ad-video/make";
import { fixedCta } from "@/lib/ad-video/plan";
import type { AdCtaKey } from "@/lib/ad-video/keys";
import { HEADLINE_MAX } from "@/lib/quote-video/brief";
import { DISCLAIMER } from "@/lib/content/output";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";

/**
 * วิดีโอโฆษณา's own drawing (draw.tsx): the photo scenes, the closing words and the regulator's line. Every
 * one-line piece must fit the 1080-wide clip, as tests/quote-video/recipe-frames.test.tsx holds the recipes to.
 */

/**
 * Every one-line piece (white-space:nowrap) whose text is wider than `room` px at 0.6 em a letter — the same
 * measure as recipe-frames.test.tsx's, copied so importing it does not run that file's tests here too.
 */
function nowrapOverflows(html: string, room = 1080): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<div style="([^"]*white-space:nowrap[^"]*)">([^<]*)</g)) {
    const size = Number(/font-size:([\d.]+)px/.exec(m[1])?.[1]);
    if (size * 0.6 * [...m[2]].length > room) out.push(m[2]);
  }
  return out;
}

const W = 1080;
const H = 1920;
const CONTACT = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
const lp = (age = 35): VideoInput => ({ product: "LIFEPROTECT", variant: "WLF19H", age, sex: "M", sumAssured: 1_000_000, style: "motion" } as VideoInput);
const KEYS: AdCtaKey[] = ["chat", "line", "comment", "nextyear", "meet"];
/** every closing the screen can show, the รอปีหน้า one at its widest figure */
const CTAS = KEYS.map((k) => adCta(fixedCta(k, { said: "12,345", per: "เดือนละ" })));

describe("AdPhotoScene", () => {
  it("draws the photo filling the frame, pushed in 1.00 → 1.12 over the scene", () => {
    const at = (t: number) => renderToStaticMarkup(AdPhotoScene({ src: "ad/a.png", t, dur: 4, w: W, h: H, kind: "hook" }));
    expect(at(0)).toContain('src="ad/a.png"');
    expect(at(0)).toContain("object-fit:cover");
    expect(at(0)).toContain("scale(1.0000)");
    expect(at(2)).toContain("scale(1.0600)");
    expect(at(4)).toContain("scale(1.1200)");
    expect(at(9)).toContain("scale(1.1200)");
  });

  it("keeps the hook's headline on one line each, inside 1080", () => {
    const html = renderToStaticMarkup(AdPhotoScene({ src: "a.png", t: 1, dur: 4, w: W, h: H, kind: "hook", headline: ["วันละ 79 บาท", "เงินก้อน 2 ล้าน"] }));
    expect(html).toContain("วันละ 79 บาท");
    expect(html).toContain("เงินก้อน 2 ล้าน");
    expect(nowrapOverflows(html)).toEqual([]);
    const longest = renderToStaticMarkup(AdPhotoScene({ src: "a.png", t: 1, dur: 4, w: W, h: H, kind: "hook", headline: ["ก".repeat(HEADLINE_MAX), "ข".repeat(HEADLINE_MAX)] }));
    expect(nowrapOverflows(longest)).toEqual([]);
  });

  it("draws a body's figure line, and keeps it inside 1080", () => {
    const html = renderToStaticMarkup(AdPhotoScene({ src: "a.png", t: 1, dur: 4, w: W, h: H, kind: "body", line: "อายุ 85 ขอคืนได้ 1,234,567 บาท" }));
    expect(html).toContain("อายุ 85 ขอคืนได้ 1,234,567 บาท");
    expect(nowrapOverflows(html)).toEqual([]);
  });

  it("closes on the CTA words and the agent, every fixed CTA and a 40-letter name inside 1080", () => {
    for (const cta of CTAS) {
      const html = renderToStaticMarkup(AdPhotoScene({ src: "a.png", t: 3, dur: 4, w: W, h: H, kind: "close", cta, contact: { ...CONTACT, name: "ก".repeat(40) } }));
      expect(html).toContain("081-234-5678");
      expect(html).toContain("LINE @unitclub");
      expect(html).toContain("ก".repeat(40));
      expect(nowrapOverflows(html), cta).toEqual([]);
    }
  });
});

describe("adCtaBlock", () => {
  it("shows the closing words whole, split only at spaces, every fixed CTA inside 1080", () => {
    for (const cta of CTAS) {
      const html = renderToStaticMarkup(adCtaBlock(cta, W));
      const words = [...html.matchAll(/white-space:nowrap[^"]*">([^<]*)</g)].map((m) => m[1]).join(" ");
      expect(words).toBe(cta);
      expect(nowrapOverflows(html), cta).toEqual([]);
    }
  });
  it("shadows the words over a photo only, not on a Motion card the theme repaints", () => {
    expect(renderToStaticMarkup(adCtaBlock(CTAS[0], W))).toContain("text-shadow");
    expect(renderToStaticMarkup(adCtaBlock(CTAS[0], W, false))).not.toContain("text-shadow");
  });
});

describe("AdDisclaimer", () => {
  it("renders the regulator's line exactly", () => {
    expect(renderToStaticMarkup(AdDisclaimer({ w: W }))).toContain(DISCLAIMER);
  });
});

describe("bodyFigure (R6)", () => {
  it("draws each body's figure from the facts", () => {
    const f = quoteVideoFacts(lp(), new Date("2026-10-17T12:00:00+07:00"))!;
    expect(bodyFigure(f, "price")).toBe(`วันละ ${f.perDayAmount} บาท`);
    expect(bodyFigure(f, "cover")).toBe(`${f.lead.label} ${f.lead.amount} บาท`);
    expect(bodyFigure(f, "value")).toBe(`อายุ ${f.breakEven!.age} ขอคืนได้ ${f.breakEven!.cash} บาท`);
    expect(bodyFigure(f, "versus")).toBe(`ออมรวม ${f.totalPaid} บาท`);
  });
  it("says the spoken price when there is no daily figure", () => {
    const f = { ...quoteVideoFacts(lp())!, perDayAmount: undefined };
    expect(bodyFigure(f, "price")).toBe(`${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`);
  });
});
