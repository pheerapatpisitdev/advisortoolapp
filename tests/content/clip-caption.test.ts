import { describe, expect, it } from "vitest";
import { captionFlags, clipYardstick } from "@/lib/content/clip-caption";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";
import { briefFor } from "@/lib/content/brief";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import type { ContentItem } from "@/lib/content/store";

const words = [{ word: "การันตี", kind: "banned" as const, fix: null }];

describe("captionFlags", () => {
  it("checks the caption as a post's words are checked", () => {
    const f = captionFlags("การันตีคืนเงิน 999 บาท", "", words, {});
    expect(f.words.map((w) => w.word)).toEqual(["การันตี"]);
    expect(f.numbers.length).toBeGreaterThan(0);
    expect(f.fixes).toBeNull();
  });
});


describe("clipYardstick", () => {
  it("holds the product's brief, the script's hooks, body and closing, and the agent's note", () => {
    const href = CONTENT_PRODUCTS[0].href;
    const item: ContentItem = {
      id: "p", createdAt: "", planHref: href, format: "script", angle: "", length: "60",
      output: { ...clipOutput(""), hooks: ["ฮุคหนึ่ง"], body: "เนื้อหาบท", closing: "ปิดท้ายบท", video: {
        path: "p/x.mp4", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS, brief: "โน้ตตัวแทน 777",
      } },
      flags: NO_FLAGS, model: null, costThb: 0, status: "draft", hookTemplateId: null, publish: null, agentId: "a", pageId: "1", plan: null, campaignId: null,
    };
    const y = clipYardstick(item);
    for (const part of ["ฮุคหนึ่ง", "เนื้อหาบท", "ปิดท้ายบท", "โน้ตตัวแทน 777", briefFor(href)?.text ?? ""]) expect(y).toContain(part);
  });
});

