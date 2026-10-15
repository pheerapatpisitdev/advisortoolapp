import { describe, expect, it } from "vitest";
import { readBroadcastInput, REPLY_CHOICES, toLineMessages } from "@/lib/line/broadcasts";

const PREFIX = "https://x.supabase.co/storage/v1/object/public/line-broadcast/";
const NOW = Date.parse("2026-10-15T10:00:00Z");

describe("readBroadcastInput", () => {
  it("keeps parts in order, drops empty text, and sends now without a time", () => {
    const r = readBroadcastInput({
      parts: [{ type: "text", text: " สวัสดี " }, { type: "text", text: "  " }, { type: "image", url: `${PREFIX}a.jpg` }],
      replies: [REPLY_CHOICES[0].text, "anything else"],
      sendAt: null,
    }, PREFIX, NOW);
    expect(r).toEqual({ ok: true, value: {
      parts: [{ type: "text", text: "สวัสดี" }, { type: "image", url: `${PREFIX}a.jpg` }],
      replies: [REPLY_CHOICES[0]],
      sendAt: null,
    } });
  });

  it("refuses a picture from anywhere but the bucket, an empty broadcast, and more than five parts", () => {
    expect(readBroadcastInput({ parts: [{ type: "image", url: "https://evil.example/a.jpg" }] }, PREFIX, NOW).ok).toBe(false);
    expect(readBroadcastInput({ parts: [{ type: "text", text: "" }] }, PREFIX, NOW).ok).toBe(false);
    expect(readBroadcastInput({ parts: Array.from({ length: 6 }, () => ({ type: "text", text: "a" })) }, PREFIX, NOW).ok).toBe(false);
  });

  it("takes a time ahead, and refuses one past or a year out", () => {
    const ahead = readBroadcastInput({ parts: [{ type: "text", text: "a" }], sendAt: "2026-10-16T12:00:00.000Z" }, PREFIX, NOW);
    expect(ahead.ok && ahead.value.sendAt?.toISOString()).toBe("2026-10-16T12:00:00.000Z");
    expect(readBroadcastInput({ parts: [{ type: "text", text: "a" }], sendAt: "2026-10-15T09:00:00Z" }, PREFIX, NOW).ok).toBe(false);
    expect(readBroadcastInput({ parts: [{ type: "text", text: "a" }], sendAt: "2027-12-01T00:00:00Z" }, PREFIX, NOW).ok).toBe(false);
  });
});

describe("toLineMessages", () => {
  it("sends the words as written and puts the buttons on the last bubble", () => {
    const m = toLineMessages(
      [{ type: "text", text: "สวัสดีครับ" }, { type: "image", url: `${PREFIX}a.jpg` }],
      [REPLY_CHOICES[0]],
    );
    expect(m[0]).toEqual({ type: "text", text: "สวัสดีครับ" });
    expect(m[1]).toMatchObject({ type: "image", originalContentUrl: `${PREFIX}a.jpg`, previewImageUrl: `${PREFIX}a.jpg` });
    expect(m[1].quickReply?.items[0].action).toEqual({ type: "message", label: REPLY_CHOICES[0].label, text: REPLY_CHOICES[0].text });
  });
});
