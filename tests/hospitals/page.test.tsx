import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HospitalCatalogue } from "@/app/hospitals/HospitalCatalogue";
import { places } from "@/lib/hospitals/places";

/** /hospitals as it is first drawn (mockup https://claude.ai/artifact/2pdzVimrFm1xLhR5uSNfv5, ก ×5) */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const list = places(new Map());
const html = renderToStaticMarkup(<HospitalCatalogue places={list} />);
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("โรงพยาบาลในเครือ", () => {
  it("opens on every place in Bangkok, the seven regions and the region's provinces beside it", () => {
    for (const r of ["กรุงเทพฯ และปริมณฑล", "ภาคกลาง", "ภาคเหนือ", "ภาคอีสาน", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้"]) expect(text).toContain(r);
    for (const p of ["นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "นครปฐม"]) expect(text).toContain(p);
    const bkk = list.filter((p) => p.province === "กรุงเทพมหานคร");
    expect(text).toContain(`กรุงเทพมหานคร ${bkk.length} แห่ง`);
    for (const p of bkk) expect(html).toContain(p.th.replace(/&/g, "&amp;"));
    expect(html).not.toContain("โรงพยาบาลกรุงเทพเชียงใหม่");
  });
  it("offers the four filters with their counts, ทั้งหมด pressed", () => {
    expect(text).toContain(`ทั้งหมด ${list.length}`);
    expect(text).toContain(`คลินิก ${list.filter((p) => p.clinic).length}`);
    expect(text).toContain(`มีเบอร์แผนก ${list.filter((p) => p.dept).length}`);
    expect(html).toMatch(/aria-pressed="true"[^>]*>ทั้งหมด/);
  });
  it("shows a place's departments, each number a tap to call, with where they were read", () => {
    expect(text).toContain("Fax Claim 0 2561 1111 ต่อ 2232-3");
    expect(html).toContain('href="tel:025611111"');
    expect(text).toContain("www.vibhavadi.com (24 พ.ย. 2569)");
    expect(text).toContain("เบอร์กลาง");
  });
  it("has the copy button and one search box", () => {
    expect(text).toContain("คัดลอกรายชื่อ");
    expect(html.match(/type="search"/g)).toHaveLength(1);
  });
});

describe("the page", () => {
  const page = readFileSync("src/app/hospitals/page.tsx", "utf8");
  it("asks for a sign-in before anything is read", () => {
    expect(page).toContain('await gatePage("/hospitals")');
    expect(page.indexOf("gatePage(")).toBeLessThan(page.indexOf("ownerPhonesOrNone("));
  });
});
