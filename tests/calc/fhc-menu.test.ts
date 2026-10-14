import { describe, expect, it } from "vitest";
import { isCurrent, menuGroups } from "@/lib/shell/menu";

describe("the Financial Health Check customers link", () => {
  it("sits in งานของฉัน right after หน้าหลัก, and nowhere else (owner chose ข, 2026-10-14)", () => {
    const groups = menuGroups(false);
    expect(groups[0].title).toBe("งานของฉัน");
    expect(groups[0].links.map((l) => l.href).slice(0, 2)).toEqual(["/home", "/fhc/customers"]);
    // the check itself stays a sales page, alone under วางแผนประกัน
    expect(groups.find((g) => g.title === "วางแผนประกัน")?.links.map((l) => l.href)).toEqual(["/fhc"]);
    const homes = groups.filter((g) => g.links.some((l) => l.href === "/fhc/customers"));
    expect(homes).toHaveLength(1);
  });

  it("lights only itself: the check is not current on the customers page", () => {
    expect(isCurrent("/fhc", "/fhc")).toBe(true);
    expect(isCurrent("/fhc", "/fhc/customers")).toBe(false);
    expect(isCurrent("/fhc/customers", "/fhc/customers")).toBe(true);
    expect(isCurrent("/fhc/customers", "/fhc/customers/abc")).toBe(true);
  });
});
