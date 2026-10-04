import { describe, expect, it } from "vitest";
import { captionFlags, clipMessages, clipYardstick, parseClipReply, spokenFlagsOf } from "@/lib/content/clip-transcribe";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";
import { briefFor } from "@/lib/content/brief";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import type { ContentItem } from "@/lib/content/store";

const words = [{ word: "การันตี", kind: "banned" as const, fix: null }];

describe("parseClipReply", () => {
  it("reads segments in order and the caption", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 2.5, text: "สวัสดีครับ" }, { start: 2.5, end: 6, text: "วันนี้มาเล่าเรื่องภาษี" }],
      caption: "ลดหย่อนภาษีได้ #ประกัน",
    }), 10);
    expect(r).toEqual({ segments: [{ start: 0, end: 2.5, text: "สวัสดีครับ" }, { start: 2.5, end: 6, text: "วันนี้มาเล่าเรื่องภาษี" }], caption: "ลดหย่อนภาษีได้ #ประกัน" });
  });

  it("drops segments that are empty, backwards, out of order or past the clip's end; moves an overlapping start up", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 1, text: "ก" }, { start: 3, end: 2, text: "กลับหัว" }, { start: 0.5, end: 2, text: "ย้อน" },
        { start: 1, end: 2, text: "  " }, { start: 2, end: 99, text: "เกิน" }, { start: 2, end: 3, text: "ข" }],
      caption: "c",
    }), 10);
    expect(r?.segments).toEqual([{ start: 0, end: 1, text: "ก" }, { start: 1, end: 2, text: "ย้อน" }, { start: 2, end: 3, text: "ข" }]);
  });

  it("drops a segment that starts before the one before it started", () => {
    const r = parseClipReply(JSON.stringify({ segments: [{ start: 2, end: 4, text: "ก" }, { start: 1, end: 5, text: "ย้อน" }], caption: "" }), 10);
    expect(r?.segments.map((s) => s.text)).toEqual(["ก"]);
  });

  it("reads m:ss and string seconds", () => {
    const r = parseClipReply(JSON.stringify({ segments: [{ start: "0:02", end: "0:05", text: "ก" }, { start: "5.5", end: "1:05.5", text: "ข" }], caption: "" }), 70);
    expect(r?.segments).toEqual([{ start: 2, end: 5, text: "ก" }, { start: 5.5, end: 65.5, text: "ข" }]);
  });

  it("drops a segment whose time is null, empty, a boolean or other text", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: null, end: 2, text: "a" }, { start: "", end: 2, text: "b" }, { start: true, end: 2, text: "c" }, { start: "soon", end: 2, text: "d" }, { start: 0, end: 2, text: "ok" }],
      caption: "c",
    }), 10);
    expect(r?.segments.map((s) => s.text)).toEqual(["ok"]);
  });

  it("is null when segments were written and none could be read, even with a caption", () => {
    expect(parseClipReply(JSON.stringify({ segments: [{ start: null, end: 2, text: "a" }], caption: "c" }), 10)).toBeNull();
  });

  it("keeps a caption for a silent clip (no segments written)", () => {
    expect(parseClipReply(JSON.stringify({ segments: [], caption: "c" }), 10)).toEqual({ segments: [], caption: "c" });
  });

  it("is null for a reply that is not JSON, or has no segment and no caption", () => {
    expect(parseClipReply("not json", 10)).toBeNull();
    expect(parseClipReply(JSON.stringify({ segments: [], caption: "" }), 10)).toBeNull();
  });

  it("reads JSON wrapped in a code fence, and cuts a caption that runs long", () => {
    const r = parseClipReply("```json\n" + JSON.stringify({ segments: [{ start: 0, end: 1, text: "ก" }], caption: "x".repeat(5000) }) + "\n```", 10);
    expect(r?.caption.length).toBe(2200);
  });
});

describe("spokenFlagsOf", () => {
  it("flags a banned word, a stray figure and a policy breach at the second it was said", () => {
    const f = spokenFlagsOf([
      { start: 0, end: 3, text: "สวัสดีครับ" },
      { start: 42.4, end: 45, text: "ผมการันตีเลยครับ" },
      { start: 50, end: 53, text: "เบี้ยแค่ 999 บาทต่อเดือน" },
    ], words, "เบี้ย 1,200 บาท", {});
    expect(f.find((x) => x.kind === "word")).toMatchObject({ at: 42.4, text: "การันตี" });
    expect(f.find((x) => x.kind === "number")).toMatchObject({ at: 50 });
    expect(f.every((x) => x.message.length > 0)).toBe(true);
  });

  it("is empty for a clean clip", () => {
    expect(spokenFlagsOf([{ start: 0, end: 2, text: "สวัสดีครับ" }], words, "", {})).toEqual([]);
  });
});

describe("captionFlags", () => {
  it("checks the caption as a post's words are checked", () => {
    const f = captionFlags("การันตีคืนเงิน 999 บาท", "", words, {});
    expect(f.words.map((w) => w.word)).toEqual(["การันตี"]);
    expect(f.numbers.length).toBeGreaterThan(0);
    expect(f.fixes).toBeNull();
  });
});

describe("clipMessages", () => {
  it("tells Gemini what the clip is about and asks for JSON in Thai", () => {
    const m = clipMessages({ script: "บทพูด", brief: "", product: "Life Protect" });
    const all = m.map((x) => x.content).join("\n");
    expect(all).toContain("บทพูด");
    expect(all).toContain("Life Protect");
    expect(all).toContain("segments");
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

describe("parseClipReply — editing suggestions", () => {
  it("keeps a segment's cut mark and reason, and the suggested hook", () => {
    const r = parseClipReply(JSON.stringify({
      segments: [{ start: 0, end: 1, text: "เอ่อ", cut: true, why: "คำเติม" }, { start: 1, end: 3, text: "สวัสดีครับ" }],
      caption: "c", hook: { top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" },
    }), 10);
    expect(r?.segments[0]).toMatchObject({ cut: true, why: "คำเติม" });
    expect(r?.segments[1].cut).toBeUndefined();
    expect(r?.hook).toEqual({ top: "ขอบคุณลูกเพจทุกท่าน", main: "ปิดยอดไปแล้ว 881,533 บาท" });
  });
  it("cuts a hook that runs long, and drops a blank one", () => {
    const r = parseClipReply(JSON.stringify({ segments: [], caption: "c", hook: { top: "x".repeat(40), main: "y".repeat(40) } }), 10);
    expect(r?.hook).toEqual({ top: "x".repeat(24), main: "y".repeat(28) });
    expect(parseClipReply(JSON.stringify({ segments: [], caption: "c", hook: { main: "  " } }), 10)?.hook).toBeUndefined();
  });
  it("ignores a cut that is not true", () => {
    expect(parseClipReply(JSON.stringify({ segments: [{ start: 0, end: 1, text: "ก", cut: "yes" }], caption: "c" }), 10)?.segments[0].cut).toBeUndefined();
  });
});
