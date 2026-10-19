import { describe, expect, it } from "vitest";
import { buildStats, parsePeriod, pastMonths, periodRange, taskTool, type StatsInput } from "@/lib/stats/usage";
import { CALCULATORS, calculatorName } from "@/lib/stats/calculators";

const now = new Date("2026-10-14T15:00:00+07:00");
const [from, to] = periodRange("month", now);
const base: StatsInput = { from, to, now, ledger: [], rounds: [], posts: [], videos: [], customers: [], sends: [], opens: [], wallet: [] };
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

describe("what a ledger task was spent on", () => {
  it("names Studio, the agents' chat and the customer bots apart", () => {
    expect(["content", "content-plan", "content-image", "content-image-look", "content-claim-read", "content-thumbnail-ideas", "quote-video-voice", "library", "route_health", "chat-review", "content-image-test"].map(taskTool))
      .toEqual(["write", "write", "draw", "draw", "claim", "thumbnail", "video", "ask", "bot", "system", "system"]);
  });
});

describe("สถิติการใช้งาน", () => {
  it("counts one ask as one use of its most telling tool, with all of its cost", () => {
    const s = buildStats({
      ...base,
      ledger: [
        // a writing round that drew its picture: one use of เขียนโพสต์
        { task: "content-plan", agentId: A, askId: "k1", thb: 0.1, at: "2026-10-12T02:00:00Z" },
        { task: "content", agentId: A, askId: "k1", thb: 2, at: "2026-10-12T02:00:05Z" },
        { task: "content-image", agentId: A, askId: "k1", thb: 3, at: "2026-10-12T02:00:30Z" },
        // a question on /ask, which runs the bots' own brain
        { task: "route", agentId: B, askId: "k2", thb: 0.01, at: "2026-10-13T02:00:00Z" },
        { task: "library", agentId: B, askId: "k2", thb: 0.2, at: "2026-10-13T02:00:02Z" },
        // a customer on Messenger: nobody's use, the system's cost
        { task: "route", agentId: null, askId: null, thb: 0.02, at: "2026-10-13T03:00:00Z" },
        { task: "probe", agentId: null, askId: null, thb: 0.5, at: "2026-10-13T03:00:00Z" },
      ],
    });
    expect(s.tools.map((t) => [t.key, t.uses, t.people, +t.thb.toFixed(2)])).toEqual([["write", 1, 1, 5.1], ["ask", 1, 1, 0.21]]);
    expect(s.system.map((r) => [r.key, r.calls, r.thb])).toEqual([["bot", 1, 0.02], ["system", 1, 0.5]]);
    expect(s.totals.uses).toBe(2);
    expect(s.people.map((p) => [p.agentId, p.uses, p.topTool, +p.thb.toFixed(2)])).toEqual([[A, 1, "เขียนโพสต์ Organic", 5.1], [B, 1, "ถาม AI", 0.21]]);
  });

  it("puts a clip's cost on วิดีโอนำเสนอ but counts the clip from its own table, split by plan", () => {
    const s = buildStats({
      ...base,
      ledger: [{ task: "quote-video-voice", agentId: A, askId: "v", thb: 1, at: "2026-10-12T02:00:00Z" }],
      videos: [
        { agentId: A, at: "2026-10-12T02:00:00Z", product: null, fhc: false },
        { agentId: A, at: "2026-10-12T03:00:00Z", product: "PENSION", fhc: false },
        { agentId: B, at: "2026-10-12T04:00:00Z", product: null, fhc: true },
      ],
    });
    expect(s.tools).toEqual([{
      key: "video", name: "วิดีโอนำเสนอ", sub: "ทุกแบบประกัน", uses: 3, people: 2, thb: 1,
      parts: [{ name: "Life Protect", uses: 1 }, { name: "บำนาญ 95", uses: 1 }, { name: "สรุป FHC", uses: 1 }],
    }]);
  });

  it("reads an agent's rounds from the audit only before the ledger knew who", () => {
    const s = buildStats({
      ...base,
      rounds: [
        { action: "ai-draw", agentId: A, at: "2026-10-05T02:00:00Z" },
        { action: "ai-draw", agentId: A, at: "2026-10-11T02:00:00Z" },
        { action: "ai-returned", agentId: A, at: "2026-10-05T02:00:00Z" },
      ],
    });
    expect(s.tools.map((t) => [t.key, t.uses])).toEqual([["draw", 1]]);
  });

  it("counts posts, FHC customers, ad sends and calculator opens; wallet top-ups apart from charges", () => {
    const s = buildStats({
      ...base,
      posts: [{ agentId: A, at: "2026-10-01T02:00:00Z" }, { agentId: A, at: "2026-10-02T02:00:00Z" }],
      customers: [{ agentId: B, at: "2026-10-03T02:00:00Z" }],
      sends: [{ agentId: A, at: "2026-10-03T02:00:00Z" }],
      opens: [{ agentId: B, name: "Life Protect x 2", at: "2026-10-14T02:00:00Z" }, { agentId: B, name: "iShield", at: "2026-10-14T03:00:00Z" }],
      wallet: [
        { agentId: B, kind: "topup", satang: 50000, at: "2026-10-03T02:00:00Z" },
        { agentId: B, kind: "charge", satang: -1000, at: "2026-10-04T02:00:00Z" },
        { agentId: B, kind: "adjust", satang: 5000, at: "2026-10-04T02:00:00Z" },
      ],
    });
    expect(s.tools.map((t) => [t.key, t.uses, t.people])).toEqual([["post", 2, 1], ["calc", 2, 1], ["fhc", 1, 1], ["ads", 1, 1]]);
    expect(s.totals).toMatchObject({ people: 2, uses: 6, topupSatang: 50000, topups: 1, chargedSatang: 1000 });
    expect(s.people.find((p) => p.agentId === B)?.paidSatang).toBe(1000);
  });

  it("gives every day of the period up to today, empty days too", () => {
    const s = buildStats({ ...base, posts: [{ agentId: A, at: "2026-10-01T02:00:00Z" }, { agentId: A, at: "2026-10-14T16:59:00Z" }] });
    expect(s.daily).toHaveLength(14);
    expect([s.daily[0], s.daily[13]]).toEqual([{ day: "2026-10-01", uses: 1 }, { day: "2026-10-14", uses: 1 }]);
  });
});

describe("periods", () => {
  it("reads ?p= safely", () => {
    expect(["today", "7d", "30d", "month", "2026-09", "2026-10", "2026-08", "x", undefined].map((p) => parsePeriod(p, now)))
      .toEqual(["today", "7d", "30d", "month", "2026-09", "month", "month", "month", "month"]);
  });

  it("starts rolling periods at midnight Bangkok and ends tomorrow", () => {
    expect(periodRange("today", now).map((d) => d.toISOString())).toEqual(["2026-10-13T17:00:00.000Z", "2026-10-14T17:00:00.000Z"]);
    expect(periodRange("7d", now).map((d) => d.toISOString())).toEqual(["2026-10-07T17:00:00.000Z", "2026-10-14T17:00:00.000Z"]);
    expect(periodRange("2026-09", now).map((d) => d.toISOString())).toEqual(["2026-08-31T17:00:00.000Z", "2026-09-30T17:00:00.000Z"]);
    expect(pastMonths(now)).toEqual(["2026-09"]);
  });
});

describe("the calculators counted", () => {
  it("are the menu's sales pages", () => {
    expect(CALCULATORS.length).toBeGreaterThan(5);
    expect([calculatorName("/lifeprotect"), calculatorName("/home"), calculatorName("/admin/stats")]).toEqual(["Life Protect x 2", null, null]);
  });
});
