import { describe, expect, it } from "vitest";
import { linkCodeIn, newMemberText } from "@/lib/line/owner-alert";
import { clipFailedText, clipWhat } from "@/lib/quote-video/fail-alert";

describe("the owner's link code", () => {
  it("is read from the words on /admin/line, with or without the space, through a keyboard's zero-width space", () => {
    expect(linkCodeIn("ผูก 048213")).toBe("048213");
    expect(linkCodeIn("ผูก048213")).toBe("048213");
    expect(linkCodeIn("ผูก​ 048213 ")).toBe("048213");
  });

  it("is not read from a customer's ordinary message", () => {
    expect(linkCodeIn("ผูก 4821")).toBeNull();
    expect(linkCodeIn("อยากผูก 048213 กับอะไร")).toBeNull();
    expect(linkCodeIn("ชาย 35 1000000")).toBeNull();
  });
});

describe("the new-member alert", () => {
  it("names the member, their address, the time in Thailand and the total", () => {
    const text = newMemberText({ name: "สมชาย ก.", email: "somchai.k@gmail.com", createdAt: "2026-10-15T11:42:00Z" }, 3);
    expect(text).toContain("🆕 สมาชิกใหม่\nสมชาย ก.\nsomchai.k@gmail.com\n");
    expect(text).toContain("18:42");
    expect(text).toContain("สมาชิกทั้งหมด 3 คน");
    expect(text).toMatch(/\/admin\/members$/);
  });
});

describe("the failed-clip alert", () => {
  const base = {
    what: "วิดีโอนำเสนอ · Life Protect", who: "คุณวิภาวรรณ (ตัวแทน 015872)", at: "2026-10-19T14:38:25Z",
    reason: "ขณะเตรียม · ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง", link: "https://www.advisortool.app/admin/history/abc",
  };

  it("says which clip, who, when in Thailand, why and the money given back", () => {
    const text = clipFailedText({ ...base, paidBy: "wallet", heldSatang: 500 });
    expect(text.split("\n")).toEqual([
      "⚠️ คลิปไม่สำเร็จ", "วิดีโอนำเสนอ · Life Protect", "คุณวิภาวรรณ (ตัวแทน 015872)",
      expect.stringContaining("21:38"), "เหตุ: ขณะเตรียม · ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง",
      "คืนเงินแล้ว ฿5 เข้ากระเป๋า", "https://www.advisortool.app/admin/history/abc",
    ]);
  });

  it("tells a free clip, the owner's own clip and a failed scene redraw apart", () => {
    expect(clipFailedText({ ...base, paidBy: "free", heldSatang: 0 })).toContain("คืนสิทธิ์คลิปฟรีแล้ว");
    expect(clipFailedText({ ...base, paidBy: "staff", heldSatang: null })).toContain("ทำในชื่อแอดมิน ไม่ได้ตัดเงิน");
    const recut = clipFailedText({ ...base, paidBy: "wallet", heldSatang: null, recut: { satang: 300 } });
    expect(recut).toMatch(/^⚠️ แก้ฉากไม่สำเร็จ/);
    expect(recut).toContain("คลิปเดิมยังอยู่ · คืนค่าวาดฉาก ฿3 แล้ว");
  });

  it("names each video tool as the board does", () => {
    expect(clipWhat({ product: "ISHIELD", style: "motion" })).toBe("วิดีโอนำเสนอ · iShield (Motion)");
    expect(clipWhat({ age: 35 })).toBe("วิดีโอนำเสนอ · Life Protect");
    expect(clipWhat({ product: "FHC" })).toBe("วิดีโอนำเสนอ · สรุป FHC");
    expect(clipWhat({ product: "STORY", topic: "pool48" })).toBe("คลิปเล่าเรื่อง · กองกลาง 48 คน");
    expect(clipWhat({ product: "FREESTORY", title: "เงินก้อนสุดท้าย" })).toBe("คลิปตามโจทย์ · เงินก้อนสุดท้าย");
  });
});
