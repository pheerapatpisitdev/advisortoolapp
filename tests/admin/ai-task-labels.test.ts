import { describe, expect, it } from "vitest";
import { taskLabel } from "@/app/admin/ai/task-labels";

describe("taskLabel", () => {
  it("names a known job in Thai", () => {
    expect(taskLabel("route")).toBe("บอทแชท — อ่านว่าลูกค้าถามอะไร");
    expect(taskLabel("content-image")).toBe("Studio — สร้างรูป");
  });

  it("keeps an unlabelled job under its own name rather than hiding it", () => {
    expect(taskLabel("some-new-task")).toBe("some-new-task");
  });

  it("says when the ledger did not record a job", () => {
    expect(taskLabel(null)).toBe("ไม่ระบุงาน");
    expect(taskLabel("")).toBe("ไม่ระบุงาน");
  });
});
