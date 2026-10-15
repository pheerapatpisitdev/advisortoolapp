import { describe, expect, it } from "vitest";
import { alertDue, capFull, freeCapRefusal, freeSpend, monthKey, nextFirst } from "@/lib/wallet/free-cap";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const OWNER = "cccccccc-0000-0000-0000-000000000003";
const MEMBER = "dddddddd-0000-0000-0000-000000000004";
const now = new Date("2026-10-15T23:00:00+07:00");

describe("เพดานงบใช้ฟรี: what agents' free use cost", () => {
  it("counts Studio and clips asked for by agents, less what they paid from wallets", () => {
    const s = freeSpend(
      [
        { agentId: A, task: "content", model: "gemini", thb: 3 },
        { agentId: A, task: "content-image", model: "gemini", thb: 2 },
        { agentId: A, task: "quote-video-voice", model: "eleven_v3", thb: 4 },
        { agentId: A, task: "library", model: "gemini", thb: 9 }, // ถาม AI: free for everyone, not counted
        { agentId: A, task: "content", model: "reservation", thb: 9 }, // money set aside, not spent
        { agentId: OWNER, task: "content", model: "gemini", thb: 50 }, // the owner's own
        { agentId: MEMBER, task: "content", model: "gemini", thb: 7 }, // came with the pass
        { agentId: null, task: "content", model: "gemini", thb: 6 }, // nobody's
      ],
      [
        { agentId: A, round: "ai-draw", costThb: 2 },
        { agentId: A, round: "quote-video", costThb: 1.5 },
        { agentId: MEMBER, round: "ai-write", costThb: 7 },
      ],
      new Set([OWNER, MEMBER]),
    );
    expect(s).toEqual({ studioThb: 3, clipsThb: 2.5, thb: 5.5 });
  });

  it("is full at the ceiling, never with no ceiling", () => {
    const spent = { studioThb: 200, clipsThb: 100, thb: 300 };
    expect(capFull({ cap: 300, spent })).toBe(true);
    expect(capFull({ cap: 300.01, spent })).toBe(false);
    expect(capFull({ cap: null, spent })).toBe(false);
  });
});

describe("the owner's LINE alerts", () => {
  const at = (thb: number, alerted: string | null) => alertDue({ cap: 300, spent: { studioThb: thb, clipsThb: 0, thb }, alerted }, now);

  it("sends 80% once, then full once, and starts again next month", () => {
    expect(at(239, null)).toBeNull();
    expect(at(240, null)).toEqual({ key: "2026-10:1", full: false });
    expect(at(250, "2026-10:1")).toBeNull();
    expect(at(300, "2026-10:1")).toEqual({ key: "2026-10:2", full: true });
    expect(at(310, "2026-10:2")).toBeNull();
    // last month's full alert does not hold back this month's
    expect(at(300, "2026-09:2")).toEqual({ key: "2026-10:2", full: true });
  });

  it("says nothing with no ceiling", () => {
    expect(alertDue({ cap: null, spent: { studioThb: 999, clipsThb: 0, thb: 999 }, alerted: null }, now)).toBeNull();
  });
});

describe("the Bangkok month", () => {
  it("names the month and the 1st the rounds come back", () => {
    expect(monthKey(now)).toBe("2026-10");
    // 31 Oct 23:30 in Bangkok is still October; 1 Nov 00:30 is November
    expect(monthKey(new Date("2026-10-31T23:30:00+07:00"))).toBe("2026-10");
    expect(monthKey(new Date("2026-11-01T00:30:00+07:00"))).toBe("2026-11");
    expect(nextFirst(now)).toBe("1 พ.ย.");
    expect(nextFirst(new Date("2026-12-20T12:00:00+07:00"))).toBe("1 ม.ค.");
    expect(freeCapRefusal(now)).toContain("วันที่ 1 พ.ย.");
  });
});

describe("the ceiling as typed", () => {
  it("is no limit when empty, and baht otherwise", async () => {
    const { readFreeBudget } = await import("@/lib/wallet/free-cap");
    expect(readFreeBudget("", 500)).toEqual({ ok: true, value: null });
    expect(readFreeBudget(" ฿300 ", 500)).toEqual({ ok: true, value: 300 });
    expect(readFreeBudget("0", 500)).toEqual({ ok: true, value: 0 });
    expect(readFreeBudget("1,000", null)).toEqual({ ok: true, value: 1000 });
  });

  it("refuses words, a minus, and more than the month's whole AI budget", async () => {
    const { readFreeBudget } = await import("@/lib/wallet/free-cap");
    expect(readFreeBudget("abc", 500).ok).toBe(false);
    expect(readFreeBudget("-5", 500).ok).toBe(false);
    const over = readFreeBudget("600", 500);
    expect(over.ok === false && over.error).toMatch(/ไม่เกินงบ AI รวมต่อเดือน \(฿500\)/);
  });
});
