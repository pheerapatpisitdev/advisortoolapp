import { describe, expect, it } from "vitest";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { briefFor } from "@/lib/content/brief";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { SALES_PAGES } from "@/lib/shell/menu";

describe("the products the generator offers", () => {
  // group insurance is sold to an HR manager, not posted; /fhc is the planner, not a product
  it("are every sales page but group insurance and the planner", () => {
    const pages = SALES_PAGES.map((p) => p.href).filter((h) => h !== "/group-insurance" && h !== "/fhc").sort();
    expect(CONTENT_PRODUCTS.map((p) => p.href).sort()).toEqual(pages);
  });
});

describe("briefFor", () => {
  const today = new Date("2026-09-23");

  it("builds a brief for every product, with its name, points and figures", () => {
    for (const p of CONTENT_PRODUCTS) {
      const b = briefFor(p.href, today)!;
      expect(b, p.href).not.toBeNull();
      expect(b.text).toContain(p.name);
      expect(b.text).toContain(p.points[0]);
      expect(b.text, p.href).toMatch(/\d/);
    }
  });

  it("carries today's prices while the table is current", () => {
    const b = briefFor("/lifeprotect", today)!;
    expect(b.expired).toBe(false);
    expect(b.text).toContain("เบี้ย");
    expect(b.text).not.toContain("ห้ามระบุเบี้ย");
  });

  it("drops every price, and says so, once a rate table has lapsed", () => {
    for (const href of ["/lifeprotect", "/ci123", "/cancer"]) {
      const b = briefFor(href, new Date("2099-01-01"))!;
      expect(b.expired, href).toBe(true);
      expect(b.text, href).toContain("ห้ามระบุเบี้ย");
      expect(b.text, href).not.toMatch(/เบี้ย[^\n]*\d[^\n]*บาท/);
    }
  });

  it("says the pension bands as the page does, in whole per cent", () => {
    // the engine stores 0.15; "0.15% ของทุน" once reached a brief
    expect(briefFor("/bumnan95", today)!.text).toContain("รับ 15% ของทุน");
  });

  it("knows nothing of a page it does not offer", () => {
    expect(briefFor("/group-insurance", today)).toBeNull();
  });
});

describe("a total beside a monthly premium", () => {
  /**
   * The totals are yearly premiums added up. Beside a monthly premium with nothing said,
   * "4,914 บาท/เดือน รวมทั้งสัญญา 491,400" was a sum a reader could not make.
   */
  it("says it is for paying yearly, and gives the yearly premium beside the monthly one", () => {
    for (const p of CONTENT_PRODUCTS) {
      const lines = briefFor(p.href)?.text.split("\n") ?? [];
      for (const line of lines.filter((l) => /บาท\/เดือน/.test(l) && /รวม/.test(l))) {
        expect(line, p.name).toContain("ถ้าจ่ายรายปี");
        expect(line, p.name).toMatch(/หรือ [\d,]+ บาท\/ปี/);
      }
    }
  });
});

describe("briefFor with expat", () => {
  it("gives an expat iHealthy brief the foreign-customer facts, the 90 days from the sheet", () => {
    const t = briefFor("/ihealthy-ultra", new Date("2026-10-02"), { expat: true })!.text;
    expect(t).toContain("ข้อมูลสำหรับลูกค้าชาวต่างชาติ");
    expect(t).toContain(`ภายใน ${iHealthyFacts().terms.outOfTerritoryDays} วัน`);
    expect(t).toMatch(/ห้ามระบุชื่อหรือประเภทวีซ่า/);
    expect(briefFor("/ihealthy-ultra", new Date("2026-10-02"))!.text).not.toContain("ชาวต่างชาติ");
    expect(briefFor("/lifeprotect", new Date("2026-10-02"), { expat: true })!.text).not.toContain("ชาวต่างชาติ");
  });
});
