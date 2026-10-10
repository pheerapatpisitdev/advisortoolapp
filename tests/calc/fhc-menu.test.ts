import { describe, expect, it } from "vitest";
import { isCurrent, menuGroups } from "@/lib/shell/menu";

describe("the Financial Health Check customers link", () => {
  it("sits in วางแผนประกัน right after the check, and nowhere else", () => {
    const groups = menuGroups(false);
    const planning = groups.find((g) => g.title === "วางแผนประกัน");
    expect(planning?.links.map((l) => l.href)).toEqual(["/fhc", "/fhc/customers"]);
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
