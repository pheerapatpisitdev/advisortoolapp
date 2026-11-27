import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRESH_DAYS, freshHere, freshMenu, freshOf, linkPath } from "@/lib/updates/rules";

/** ป้าย New on the menu (owner chose ก ก ก, 2026-11-24): src/lib/updates/rules.ts */

const now = new Date("2026-11-24T05:00:00Z");
const row = (id: string, link: string | null, published_at: string | null, day = "2026-11-20") =>
  ({ id, link, published_at, day, title: `เรื่อง ${id}`, body: "รายละเอียด" });

describe("linkPath", () => {
  it("is the page a ลองเลย link opens, without its anchor, its query or a closing slash", () => {
    expect(linkPath("/help#tax")).toBe("/help");
    expect(linkPath("/studio/wallet?tab=prices")).toBe("/studio/wallet");
    expect(linkPath("/lifeprotect/")).toBe("/lifeprotect");
    expect(linkPath("/")).toBe("/");
  });
});

describe("freshOf", () => {
  it("keeps the rows with a page, told in the last 14 days, that this person has not opened", () => {
    const rows = [
      row("a", "/lifeprotect", "2026-11-22T03:00:00Z"),
      row("b", null, "2026-11-22T03:00:00Z"),
      row("c", "/pa", "2026-11-09T03:00:00Z"),
      row("d", "/tax", "2026-11-23T03:00:00Z"),
    ];
    expect(freshOf(rows, ["d"], now)).toEqual([{ id: "a", href: "/lifeprotect", title: "เรื่อง a", body: "รายละเอียด" }]);
  });
  it("counts the 14 days from the publishing, not from the day the change was made", () => {
    expect(FRESH_DAYS).toBe(14);
    expect(freshOf([row("a", "/pa", "2026-11-14T07:20:00Z", "2026-09-25")], [], now)).toHaveLength(1);
    expect(freshOf([row("a", "/pa", "2026-11-10T04:59:00Z")], [], now)).toHaveLength(0);
  });
  it("falls back on the row's day when it carries no publishing time", () => {
    expect(freshOf([row("a", "/pa", null, "2026-11-20")], [], now)).toHaveLength(1);
    expect(freshOf([row("a", "/pa", null, "2026-11-01")], [], now)).toHaveLength(0);
  });
});

describe("freshMenu", () => {
  const main = ["/home", "/studio", "/ihealthy-ultra", "/ihealthy-ultra/compare", "/lifeprotect"];
  it("marks the item whose page changed", () => {
    expect([...freshMenu(main, [{ href: "/lifeprotect" }])]).toEqual(["/lifeprotect"]);
  });
  it("marks the nearest item above a page this menu does not list (Studio for a Studio tool)", () => {
    expect([...freshMenu(main, [{ href: "/studio/library" }])]).toEqual(["/studio"]);
    expect([...freshMenu(["/studio", "/studio/library"], [{ href: "/studio/library" }])]).toEqual(["/studio/library"]);
  });
  it("does not mark iHealthy Ultra for its sister page, nor an item that only shares letters", () => {
    expect([...freshMenu(main, [{ href: "/ihealthy-ultra/compare" }])]).toEqual(["/ihealthy-ultra/compare"]);
    expect([...freshMenu(main, [{ href: "/lifeprotect-old" }, { href: "/whats-new" }])]).toEqual([]);
  });
});

describe("freshHere", () => {
  it("is what changed on the page being looked at, and on no page under or over it", () => {
    const fresh = [{ id: "a", href: "/studio" }, { id: "b", href: "/studio/library" }];
    expect(freshHere("/studio/library", fresh).map((f) => f.id)).toEqual(["b"]);
    expect(freshHere("/studio/library/", fresh).map((f) => f.id)).toEqual(["b"]);
    expect(freshHere("/studio/write", fresh)).toEqual([]);
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261220_update_opened.sql", "utf8");
  it("adds the opened mark to the reads and touches nothing else", () => {
    expect(sql).toMatch(/alter table public\.ins_update_reads\s+add column if not exists opened boolean not null default false/);
    expect(sql).not.toMatch(/create or replace function|drop /i);
  });
});
