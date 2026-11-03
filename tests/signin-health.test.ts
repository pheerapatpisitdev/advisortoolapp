import { describe, expect, it } from "vitest";
import { fresh, step } from "@/lib/ai/health-rules";
import { diagnose, signinAlertText } from "@/lib/signin-health/rules";
import { roomState, routeOf, sortRooms, triesByDay, tallyByRoute, type RoomLine } from "@/lib/signin-health/tally";

const T0 = "2026-11-02T07:52:00Z"; // 14:52 in Bangkok
const T1 = "2026-11-02T08:15:00Z";
const T2 = "2026-11-03T03:05:00Z"; // 10:05 the next day
const LINK = "https://www.advisortool.app/admin/connections";

describe("reading a failed check for the owner (the Bluewealth outage, 2026-11-02/03)", () => {
  it("names the publishable key when Supabase answers Invalid API key", () => {
    const d = diagnose("bluewealth", "อ่านข้อมูลตัวแทนไม่ได้: Invalid API key");
    expect(d.why).toBe("ฐานข้อมูล Bluewealth ไม่รับกุญแจเชื่อมต่อของเรา");
    expect(d.fix.join(" ")).toContain("npx wrangler secret put BLUEWEALTH_ANON_KEY");
  });

  it("names the lookup key when Bluewealth's function says not allowed", () => {
    expect(diagnose("bluewealth", "not allowed").fix.join(" ")).toContain("BLUEWEALTH_LOOKUP_KEY");
  });

  it("names the Google client when Google says invalid_client", () => {
    const d = diagnose("google", "google 401: invalid_client The OAuth client was not found.");
    expect(d.why).toBe("Google ไม่รู้จักรหัสแอปหรือรหัสลับของเรา");
    expect(d.fix.join(" ")).toContain("GOOGLE_CLIENT_SECRET");
  });

  it("says unset keys are unset, and which", () => {
    const d = diagnose("bluewealth", "ยังไม่ได้ตั้งค่าการเชื่อมกับ Bluewealth");
    expect(d.why).toBe("ยังไม่ได้ใส่ค่าการเชื่อมต่อบนเซิร์ฟเวอร์");
    expect(d.fix[0]).toContain("BLUEWEALTH_SUPABASE_URL");
  });

  it("gives nothing to do for a slow or fallen service but wait", () => {
    expect(diagnose("unitos-code", "ไม่ตอบภายใน 10 วินาที")).toEqual({ why: "ไม่ตอบภายใน 10 วินาที", fix: [] });
    expect(diagnose("unitos-sso", "fetch failed").fix).toEqual([]);
    expect(diagnose("google", "google 503: backend").why).toContain("503");
  });
});

describe("the LINE message", () => {
  it("is sent on the second failure in a row, with the cause and who is locked out", () => {
    const once = step(fresh("bluewealth"), { ok: false, error: "Invalid API key" }, T0).next;
    const { event } = step(once, { ok: false, error: "Invalid API key" }, T1);
    const text = signinAlertText([event!], LINK)!;
    expect(text).toContain("🚪 ทางเข้าใช้ไม่ได้");
    expect(text).toContain("ตัวแทน Bluewealth · รหัส 6 หลัก");
    expect(text).toContain("สาเหตุ: ฐานข้อมูล Bluewealth ไม่รับกุญแจเชื่อมต่อของเรา");
    expect(text).toContain("14:52");
    expect(text.endsWith(LINK)).toBe(true);
  });

  it("says when it is back and how long it was out, without the link", () => {
    const text = signinAlertText([{ kind: "up", provider: "bluewealth", since: T0, at: T2 }], LINK)!;
    expect(text).toContain("✅ ทางเข้ากลับมาใช้ได้แล้ว");
    expect(text).toContain("ใช้ไม่ได้ 19 ชม. 13 นาที (14:52–10:05 น.)");
    expect(text).not.toContain(LINK);
  });

  it("is nothing when nothing changed, or the event is not a way in", () => {
    expect(signinAlertText([], LINK)).toBeNull();
    expect(signinAlertText([{ kind: "up", provider: "google-tts", since: T0, at: T1 }], LINK)).toBeNull();
  });
});

describe("counting sign-ins by the way in", () => {
  const unitos = new Set(["u1"]);
  const bw = new Set(["b1"]);
  const now = Date.parse("2026-11-03T05:00:00Z");

  it("tells a UnitOS code from a Bluewealth code by whose id it is", () => {
    expect(routeOf({ agent_id: "u1", how: "code", at: T0 }, unitos, bw)).toBe("unitos-code");
    expect(routeOf({ agent_id: "b1", how: "code", at: T0 }, unitos, bw)).toBe("bluewealth");
    expect(routeOf({ agent_id: "x", how: "sso", at: T0 }, unitos, bw)).toBe("unitos-sso");
    expect(routeOf({ agent_id: "m", how: "google", at: T0 }, unitos, bw)).toBe("google");
    expect(routeOf({ agent_id: "s", how: "super", at: T0 }, unitos, bw)).toBeNull();
  });

  it("counts the week and keeps the latest, older ones included", () => {
    const use = tallyByRoute([
      { agent_id: "b1", how: "code", at: "2026-11-03T02:33:00Z" },
      { agent_id: "b1", how: "code", at: "2026-10-20T02:33:00Z" },
    ], unitos, bw, now);
    expect(use.bluewealth).toEqual({ week: 1, last: "2026-11-03T02:33:00Z" });
    expect(use.google).toEqual({ week: 0, last: null });
  });

  it("buckets tries by Bangkok's day, seven days, today last", () => {
    const days = triesByDay([
      { ok: false, created_at: "2026-11-02T17:30:00Z" }, // 00:30 on the 3rd in Bangkok
      { ok: true, created_at: "2026-11-02T16:30:00Z" }, // 23:30 on the 2nd
      { ok: true, created_at: "2026-10-01T00:00:00Z" }, // outside the week
    ], now);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ day: "2026-11-03", ok: 0, failed: 1 });
    expect(days[5]).toEqual({ day: "2026-11-02", ok: 1, failed: 0 });
    expect(days[0].day).toBe("2026-10-28");
  });
});

describe("a room as its agents meet it at the door", () => {
  const room = (status: string, config: object | null = null) => ({ id: "t", name: "83G", slug: "83g", status, config });
  it("matches the gate in access.ts", () => {
    expect(roomState(room("active")).label).toBe("เปิดใช้");
    expect(roomState(room("trialing")).label).toBe("ทดลองใช้");
    expect(roomState(room("past_due")).tone).toBe("warn");
    expect(roomState(room("canceled")).label).toBe("ห้องปิด");
    expect(roomState(room("active", { isDemo: true })).label).toBe("ห้องสาธิต ปิดไว้");
    expect(roomState(room("active", { features: { adStudio: false } })).label).toBe("ปิด advisortool");
  });

  it("puts the busiest rooms first", () => {
    const r = (name: string, week: number, agents: number): RoomLine => ({ name, system: "UnitOS", label: "", tone: "ok", agents, seenOnly: false, week, last: null });
    expect(sortRooms([r("a", 1, 2), r("b", 61, 62), r("c", 0, 41)]).map((x) => x.name)).toEqual(["b", "a", "c"]);
  });
});
