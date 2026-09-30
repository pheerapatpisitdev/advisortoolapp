import { describe, expect, it } from "vitest";
import { backToWorkbench, calendarHref, workbenchHref } from "@/lib/content/workbench-link";

/**
 * Every way into the workbench carries the Page whose project it is (final review, 2026-09-30):
 * a link without one opens the first Page's project, and a piece written there is that Page's for good.
 */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";

describe("a link into one Page's workbench", () => {
  it("carries the Page, with the day the calendar is filling", () => {
    expect(workbenchHref({ day: "2026-10-01", page: "105982528649026" })).toBe("/studio/write?day=2026-10-01&page=105982528649026");
    expect(workbenchHref({ page: "105982528649026" })).toBe("/studio/write?page=105982528649026");
  });

  it("is the bare workbench for an agent with no Pages", () => {
    expect(workbenchHref({})).toBe("/studio/write");
    expect(workbenchHref({ page: null })).toBe("/studio/write");
  });

  it("leads back from the people library to the same Page's workbench, and nowhere else", () => {
    for (const ok of ["/studio/write", "/studio/write?page=105982528649026", `/studio/write?open=${ID}`]) expect(backToWorkbench(ok)).toBe(ok);
    for (const bad of ["https://evil.example/studio/write", "/studio/write?page=1&next=//evil", "/studio/writer", undefined]) {
      expect(backToWorkbench(bad)).toBeNull();
    }
  });

  it("opens the calendar on the same Page", () => {
    expect(calendarHref("105982528649026")).toBe("/studio/calendar?page=105982528649026");
    expect(calendarHref(null)).toBe("/studio/calendar");
  });
});
