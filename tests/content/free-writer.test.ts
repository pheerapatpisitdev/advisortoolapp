import { describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: (...a: unknown[]) => ai.chat(...a) }));

const { fallbackWriters, FREE_FULL, UnreadableReply, writeChat } = await import("@/lib/content/write");
import { FREE_WRITER_MODEL, WRITERS, writerOf } from "@/lib/content/models";

describe("Studio's ทดลองฟรี writer", () => {
  it("is offered, free, and falls back to nothing paid (owner chose 4ก, 2026-10-18)", () => {
    expect(writerOf("free")).toMatchObject({ model: FREE_WRITER_MODEL, thb: 0, label: "ทดลองฟรี" });
    expect(fallbackWriters(FREE_WRITER_MODEL)).toEqual([FREE_WRITER_MODEL]);
  });

  it("says the free writer is full when it fails, in words every round shows", async () => {
    ai.chat.mockRejectedValueOnce(new Error("429 quota"));
    const e = await writeChat({ tier: "large", task: "content", messages: [], prefer: FREE_WRITER_MODEL } as never).catch((x) => x);
    expect(e).toBeInstanceOf(UnreadableReply);
    expect(e.message).toBe(FREE_FULL);
  });

  it("leaves a paid writer's failure as it was", async () => {
    const boom = new Error("down");
    ai.chat.mockRejectedValueOnce(boom);
    expect(await writeChat({ tier: "large", task: "content", messages: [], prefer: "gpt-5" } as never).catch((x) => x)).toBe(boom);
  });

  it("is no paid pick's fallback, and ประหยัด still falls back to nothing dearer", () => {
    expect(fallbackWriters("claude-sonnet-5")).not.toContain(FREE_WRITER_MODEL);
    expect(fallbackWriters("gemini-3.7-flash")).toEqual(["gemini-3.7-flash"]);
  });

  it("is never what อัตโนมัติ picks", () => {
    expect(writerOf("auto").id).toBe("best");
    expect(writerOf("auto", 1).id).toBe("cheap");
    expect(WRITERS.map((w) => w.id)).toEqual(["best", "balanced", "cheap", "free"]);
  });
});
