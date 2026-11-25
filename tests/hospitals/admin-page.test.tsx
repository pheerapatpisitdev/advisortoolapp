import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** /admin/hospitals: the Super Admin fills in the departments' numbers (owner chose 5ก, 2026-11-25) */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/admin/hospitals/actions", () => ({ saveHospitalPhones: vi.fn(), resetHospitalPhones: vi.fn() }));

const { HospitalPhones } = await import("@/app/admin/hospitals/HospitalPhones");
const { adminRows } = await import("@/lib/hospitals/places");

const mine = { insurance: ["0 2999 9999"], room: [], appointment: [], reception: [], day: "2026-11-25" };
const VIBHA = adminRows(new Map()).find((r) => r.th === "โรงพยาบาลวิภาวดี")!;
const BARE = adminRows(new Map()).find((r) => !r.found)!;

describe("adminRows", () => {
  it("is every place on the page, with the website's numbers and the owner's apart", () => {
    const rows = adminRows(new Map([[VIBHA.id, mine]]));
    expect(rows).toHaveLength(544);
    const row = rows.find((r) => r.id === VIBHA.id)!;
    expect(row.found?.room).toEqual(["0 2561 1111 ต่อ 4137, 4139"]);
    expect(row.mine).toEqual(mine);
    expect(rows.find((r) => r.id === BARE.id)).toMatchObject({ found: null, mine: null });
  });
});

describe("the form and the list", () => {
  const draw = (rows: ReturnType<typeof adminRows>, open?: string) => renderToStaticMarkup(<HospitalPhones rows={rows} open={open} />);
  const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("opens a hospital with the numbers that show today, one a line", () => {
    const html = draw(adminRows(new Map()), VIBHA.id);
    expect(html).toContain("Fax Claim 0 2561 1111 ต่อ 2232-3\nUR Nurse 0 2561 1111 ต่อ 4537</textarea>");
    for (const l of ["ประกัน", "ค่าห้อง", "นัดแพทย์", "ต้อนรับ"]) expect(words(html)).toContain(l);
    // nothing typed yet, so nothing to go back from
    expect(html).not.toContain("คืนค่าเดิม");
  });
  it("shows the owner's numbers over the website's, with the way back", () => {
    const html = draw(adminRows(new Map([[VIBHA.id, mine]])), VIBHA.id);
    expect(html).toContain("0 2999 9999</textarea>");
    expect(html).not.toContain("UR Nurse 0 2561 1111 ต่อ 4537</textarea>");
    expect(html).toContain("คืนค่าเดิม");
  });
  it("counts what is filled in, read off a website, and missing", () => {
    const w = words(draw(adminRows(new Map([[BARE.id, mine]]))));
    expect(w).toContain("ทั้งหมด 544");
    expect(w).toContain("ยังไม่มีเบอร์แผนก 480");
    expect(w).toContain("จากเว็บโรงพยาบาล 63");
    expect(w).toContain("กรอกเอง 1");
  });
});

describe("the page", () => {
  it("is the Super Admin's alone", () => {
    expect(readFileSync("src/app/admin/hospitals/page.tsx", "utf8")).toContain('await gatePage("/admin/hospitals", "backoffice")');
  });
});
