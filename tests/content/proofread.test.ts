import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: vi.fn(),
}));

import { chat } from "@/lib/ai/client";
import { parseProof, proofread } from "@/lib/content/proofread";

describe("parseProof", () => {
  const post = "ประกันนี้คุ้มคลองถึงอายุ 99 ปี\nสังเกตุว่าเบี้ยเท่าเดิม";

  it("keeps each suggestion whose text is really in the post", () => {
    const reply = JSON.stringify({ fixes: [
      { find: "คุ้มคลอง", replace: "คุ้มครอง", why: "สะกดผิด" },
      { find: "สังเกตุ", replace: "สังเกต", why: "สะกดผิด" },
    ] });
    expect(parseProof(reply, post)).toEqual([
      { find: "คุ้มคลอง", replace: "คุ้มครอง", why: "สะกดผิด" },
      { find: "สังเกตุ", replace: "สังเกต", why: "สะกดผิด" },
    ]);
  });

  it("drops a suggestion that points at nothing, or changes nothing", () => {
    // a proofreader that quotes text the post does not contain cannot be clicked into place
    const reply = JSON.stringify({ fixes: [
      { find: "ไม่มีในโพสต์", replace: "x", why: "" },
      { find: "ประกันนี้", replace: "ประกันนี้", why: "" },
      { find: "", replace: "x", why: "" },
    ] });
    expect(parseProof(reply, post)).toEqual([]);
  });

  it("reads an unreadable reply as no suggestions rather than an error", () => {
    expect(parseProof("ขอโทษครับ", post)).toEqual([]);
  });
});

describe("proofread", () => {
  it("asks an English editor for an English post, a Thai one otherwise", async () => {
    const ai = vi.mocked(chat);
    ai.mockResolvedValue({ text: '{"fixes":[]}', costThb: 0 } as Awaited<ReturnType<typeof chat>>);
    await proofread("Cover that stay with you", "en");
    expect(ai.mock.calls[0][0].messages[0].content).toMatch(/English/);
    await proofread("โพสต์");
    expect(ai.mock.calls[1][0].messages[0].content).toMatch(/บรรณาธิการภาษาไทย/);
  });
});
