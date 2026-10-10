import { describe, expect, it } from "vitest";
import { cleanDetails } from "@/lib/fhc/customers";

describe("cleanDetails", () => {
  it("keeps a name, contact and note, tidied", () => {
    expect(cleanDetails({ name: "  สมชาย   ใจดี ", contact: " 081-234-5678 ", note: "นัดศุกร์", consent: true }))
      .toEqual({ name: "สมชาย ใจดี", contact: "081-234-5678", note: "นัดศุกร์" });
  });

  it("refuses an empty name", () => {
    expect(cleanDetails({ name: "   ", consent: true })).toBe("ใส่ชื่อลูกค้าก่อนนะครับ");
  });

  it("refuses a save without the customer's consent, whatever else it carries", () => {
    expect(cleanDetails({ name: "สมชาย" })).toBe("ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ");
    expect(cleanDetails({ name: "สมชาย", consent: "true" })).toBe("ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ");
  });

  it("cuts what is too long and ignores what is not text", () => {
    const d = cleanDetails({ name: "ก".repeat(300), contact: 12345, note: "x".repeat(900), consent: true });
    expect(typeof d).toBe("object");
    if (typeof d === "object") {
      expect(d.name).toHaveLength(100);
      expect(d.contact).toBe("");
      expect(d.note).toHaveLength(300);
    }
  });
});
