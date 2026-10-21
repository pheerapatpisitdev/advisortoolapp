import { describe, expect, it } from "vitest";
import { totalLine } from "@/lib/prompt-story/total";
import { promptStoryPrice } from "@/lib/prompt-story/types";
import type { Prices } from "@/lib/wallet/prices";

// satang: the clip ฿5, pictures ฿1 / ฿2 / ฿5, ElevenLabs +฿2
const prices = { videoPrompt: 500, videoPromptDesign: 1500, drawStandard: 100, drawSharp: 200, drawGemini: 500, elevenExtra: 200 } as Prices;
const base = { scenes: 5, painter: "standard" as const, prices };

describe("totalLine", () => {
  it("adds the clip and every picture, as the server will hold it", () => {
    const t = totalLine({ ...base, kind: "wallet" });
    expect(t.baht).toBe("10");
    expect(t.text).toBe("ค่าคลิป ฿5 + รูป 5 × ฿1 = ฿10 · เสียง ElevenLabs +฿2 (ถ้าเลือก)");
  });

  it("prices ดีไซน์พิเศษ at its own clip price", () => {
    const t = totalLine({ ...base, kind: "wallet", design: "blue" });
    expect(t.baht).toBe("20");
    expect(t.text).toBe("ค่าคลิปดีไซน์พิเศษ ฿15 + รูป 5 × ฿1 = ฿20 · เสียง ElevenLabs +฿2 (ถ้าเลือก)");
  });

  it("a free clip in ดีไซน์พิเศษ pays the pictures and the extra", () => {
    const t = totalLine({ ...base, kind: "free", design: "film" });
    expect(t.baht).toBe("15");
    expect(t.text).toBe("ใช้สิทธิ์ฟรี 1 ครั้งกับค่าคลิป · รูป 5 × ฿1 + ดีไซน์พิเศษ ฿10 = ฿15 หักจากกระเป๋า");
  });

  it("adds the voice when one is chosen", () => {
    const t = totalLine({ ...base, kind: "wallet", voice: "abc" });
    expect(t.baht).toBe("12");
    expect(t.text).toBe("ค่าคลิป ฿5 + รูป 5 × ฿1 + เสียง ElevenLabs ฿2 = ฿12");
  });

  it("agrees with promptStoryPrice", () => {
    for (const painter of ["standard", "sharp", "gemini"] as const) {
      for (const scenes of [3, 5, 8] as const) {
        const want = promptStoryPrice({ scenes: Array.from({ length: scenes }, () => ({ voice: "", screen: "", picture: "" })), painter } as never, prices);
        expect(totalLine({ scenes, painter, prices, kind: "wallet" }).baht).toBe(String(want / 100));
      }
    }
  });

  it("charges only the pictures on a free clip, and nothing to the owner", () => {
    const free = totalLine({ ...base, kind: "free", voice: "abc" });
    expect(free.baht).toBe("5");
    expect(free.text).toContain("ใช้สิทธิ์ฟรี");
    expect(free.text).toContain("รูป 5 × ฿1 = ฿5");
    const owner = totalLine({ ...base, kind: "staff" });
    expect(owner.baht).toBe("0");
    expect(owner.text).toBe("เจ้าของใช้ฟรี");
  });

  it("blocks a free clip while the wallet is off: its pictures have nowhere to be paid from", () => {
    const off = totalLine({ ...base, kind: "free", walletOff: true });
    expect(off.blocked).toBe(true);
    expect(off.text).toBe("ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้ จึงยังสร้างคลิปตามโจทย์ไม่ได้");
    expect(totalLine({ ...base, kind: "free" }).blocked).toBeFalsy();
    expect(totalLine({ ...base, kind: "wallet" }).blocked).toBeFalsy();
  });
});
