import { describe, expect, it } from "vitest";
import { linkCodeIn, newMemberText } from "@/lib/line/owner-alert";

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
