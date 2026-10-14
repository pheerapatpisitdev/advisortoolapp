import { describe, expect, it, vi } from "vitest";

/**
 * The two judgements the ออโต้โพสต์ screen makes on its own, away from Meta and the database:
 * where each Page's posts stand, and what a refusal from Facebook means for posting.
 */

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => { throw new Error("no database in this test"); } }));

const { activityByPage, explainCheck } = await import("@/lib/content/posting-health");

const now = new Date("2026-09-25T14:00:00Z");
const row = (pageId: string | null, state: string, at: string | null, error: string | null = null) =>
  ({ pageId, state, at, error }) as Parameters<typeof activityByPage>[0][number];

describe("where each Page's posts stand", () => {
  it("counts a held post as scheduled until its time, and as posted after", () => {
    const a = activityByPage([
      row("P1", "scheduled", "2026-09-26T05:00:00Z"),
      row("P1", "scheduled", "2026-09-27T05:00:00Z"),
      row("P1", "scheduled", "2026-09-25T05:00:00Z"),
      row("P1", "published", "2026-09-24T05:00:00Z"),
    ], now).get("P1")!;
    expect(a.scheduled).toBe(2);
    expect(a.nextAt).toBe("2026-09-26T05:00:00Z");
    expect(a.published).toBe(2);
    expect(a.lastPublishedAt).toBe("2026-09-25T05:00:00Z");
  });

  it("keeps the newest refusal's words, and counts a stuck send as refused", () => {
    const a = activityByPage([
      row("P1", "failed", "2026-09-24T01:00:00Z", "older"),
      row("P1", "failed", "2026-09-25T01:00:00Z", "newer"),
      row("P1", "posting", "2026-09-24T12:00:00Z"),
    ], now).get("P1")!;
    expect(a.failed).toBe(3);
    expect(a.lastError).toBe("newer");
  });

  it("leaves out taken-back posts, a send still in flight, and rows with no Page", () => {
    const m = activityByPage([
      row("P1", "cancelled", "2026-09-26T05:00:00Z"),
      row("P1", "posting", "2026-09-25T13:58:00Z"),
      row(null, "published", "2026-09-24T05:00:00Z"),
    ], now);
    expect(m.get("P1")).toEqual({ scheduled: 0, nextAt: null, published: 0, lastPublishedAt: null, failed: 0, lastError: null });
    expect(m.size).toBe(1);
  });

  it("keeps Pages apart", () => {
    const m = activityByPage([
      row("P1", "published", "2026-09-24T05:00:00Z"),
      row("P2", "scheduled", "2026-09-26T05:00:00Z"),
    ], now);
    expect(m.get("P1")!.published).toBe(1);
    expect(m.get("P2")!.scheduled).toBe(1);
  });
});

describe("what Facebook's refusal means for posting", () => {
  it("names the Page role and two-factor setting on #200, which is the owner's case", () => {
    const c = explainCheck(200, "(#200) User does not have sufficient administrative permission for this action on this page. If the page business requires Two Factor Authentication, the user also needs to enable Two Factor Authentication.");
    expect(c.status).toBe("bad");
    if (c.status !== "bad") return;
    expect(c.advice).toMatch(/ยืนยันตัวตน 2 ขั้นตอน/);
    expect(c.advice).toMatch(/เพจและช่องทาง/);
    expect(c.detail).toMatch(/#200/);
  });

  it("asks for posting permission on any other permission refusal", () => {
    const c = explainCheck(10, "(#10) Application does not have permission for this action");
    expect(c.status).toBe("bad");
    if (c.status !== "bad") return;
    expect(c.advice).toMatch(/อนุญาต/);
    expect(c.advice).not.toMatch(/ยืนยันตัวตน/);
  });

  it("says the Page was taken back on 190", () => {
    const c = explainCheck(190, "Error validating access token");
    expect(c.status).toBe("bad");
    if (c.status !== "bad") return;
    expect(c.advice).toMatch(/ถอนสิทธิ์/);
  });

  it("is not a fault when Meta is only rate-limiting", () => {
    expect(explainCheck(4, "Application request limit reached").status).toBe("unknown");
  });
});
