import { describe, expect, it } from "vitest";
import {
  buildAsks, buildLogins, buildOpens, buildPasses, buildRounds, buildSetup, deviceOf, fromHistory, groupDays, ipShort, mergeItems,
  summarizeAdmin, toCsv, type AdminItem,
} from "@/lib/admin/people-history";

/** ประวัติผู้ใช้ (owner, 2026-10-15): the Super Admin's lines of anybody's history */

const A = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const OWNER = "1c8e4a5f-2d3b-4c6e-9f0a-1b2c3d4e5f60";

describe("ถาม AI", () => {
  it("shows the words of a kept question beside what its calls cost", () => {
    const [line] = buildAsks(
      [{ id: "q1", at: "2026-10-15T06:50:00Z", by: A, question: "ลูกค้าอายุ 45 ชาย อยากได้มรดก 3 ล้าน", answer: "เบี้ยปีละ …", model: "gemini", failed: false }],
      [{ askId: "q1", at: "2026-10-15T06:50:01Z", by: A, thb: 0.31, calls: 2, model: "gemini-2.5-flash", studio: false }],
    );
    expect(line.title).toBe("ถาม “ลูกค้าอายุ 45 ชาย อยากได้มรดก 3 ล้าน”");
    expect(line.text).toBe("ลูกค้าอายุ 45 ชาย อยากได้มรดก 3 ล้าน");
    expect(line.answer).toBe("เบี้ยปีละ …");
    expect(line.costThb).toBe(0.31);
    expect(line.note).toContain("2 ครั้งที่เรียก AI");
  });

  it("keeps a question from before the words were kept, by its cost alone, and never a Studio round's calls", () => {
    const lines = buildAsks([], [
      { askId: "old", at: "2026-10-12T03:00:00Z", by: A, thb: 0.2, calls: 1, model: "gemini", studio: false },
      { askId: "round", at: "2026-10-12T04:00:00Z", by: A, thb: 1.1, calls: 3, model: "gpt-image", studio: true },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].title).toBe("ถาม AI");
    expect(lines[0].text).toBeUndefined();
    expect(lines[0].note).toContain("ก่อนเริ่มเก็บข้อความ");
  });
});

describe("sign-ins", () => {
  it("names the way in, the device and a shortened address", () => {
    const [line] = buildLogins([{
      id: "1", at: "2026-10-15T03:41:00Z", by: A, how: "sso", ip: "49.228.10.20",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    }]);
    expect(line.title).toBe("เข้าระบบผ่าน UnitOS");
    expect(line.note).toBe("iPhone · Safari · IP 49.228.x.x");
  });

  it("tells LINE's and Facebook's own browsers from Chrome", () => {
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36 Line/14.1.0")).toBe("Android · LINE");
    expect(deviceOf("Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]")).toBe("iPhone · Facebook");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36")).toBe("Windows · Chrome");
    expect(deviceOf(null)).toBe("");
    expect(ipShort(null)).toBe("");
  });
});

describe("rounds, calculators, set-up and passes", () => {
  it("says whether a round was paid from the wallet, free, or handed back", () => {
    const lines = buildRounds([
      { id: "1", at: "2026-10-15T04:12:00Z", by: A, action: "ai-draw", target: null, wallet: true },
      { id: "2", at: "2026-10-15T04:05:00Z", by: A, action: "ai-write", target: null, wallet: false },
      { id: "3", at: "2026-10-15T04:00:00Z", by: A, action: "ai-returned", target: null, wallet: false },
    ]);
    expect(lines.map((l) => [l.title, l.note])).toEqual([
      ["ใช้รอบ AI · วาดภาพ", "จ่ายจากกระเป๋า"],
      ["ใช้รอบ AI · เขียนโพสต์", "รอบฟรี"],
      ["คืนรอบ AI (ทำไม่สำเร็จ)", "ไม่นับรอบนี้"],
    ]);
  });

  it("makes one line of a calculator opened many times in a Bangkok day", () => {
    const rows = ["2026-10-15T02:00:00Z", "2026-10-15T03:58:00Z", "2026-10-15T03:00:00Z", "2026-10-15T18:00:00Z"]
      .map((at) => ({ at, by: A, tool: "/lifeprotect", name: "Life Protect" }));
    const lines = buildOpens(rows).sort((a, b) => b.at.localeCompare(a.at));
    // 18:00Z is 01:00 the next day in Bangkok
    expect(lines.map((l) => [l.at, l.note])).toEqual([["2026-10-15T18:00:00Z", ""], ["2026-10-15T03:58:00Z", "เปิด 3 ครั้งในวันนั้น"]]);
    expect(lines[1].title).toBe("เปิดเครื่องคิดเบี้ย Life Protect");
  });

  it("says who did a thing to the person, and leaves out what has a line of its own", () => {
    const lines = buildSetup([
      { id: "1", at: "2026-10-14T02:12:00Z", actor: OWNER, action: "wallet-adjust", target: A, detail: { satang: 1000, note: "คืนค่าคลิป" } },
      { id: "2", at: "2026-10-14T02:00:00Z", actor: A, action: "connect-page", target: "123", detail: { pageName: "LuckyPlanner" } },
      { id: "3", at: "2026-10-14T01:00:00Z", actor: A, action: "post", target: null, detail: null },
    ], A, { [OWNER]: "เจ้าของ" });
    expect(lines.map((l) => [l.title, l.note, l.by])).toEqual([
      ["ปรับยอดกระเป๋า", "+฿10 · หมายเหตุ: คืนค่าคลิป · ทำโดย: เจ้าของ", A],
      ["เชื่อมเพจ", "LuckyPlanner", A],
    ]);
  });

  it("counts a paid pass as money in", () => {
    const [paid, trial] = buildPasses([
      { id: "5", at: "2026-10-15T07:20:00Z", by: A, kind: "paid", days: 30, satang: 9900, note: null },
      { id: "4", at: "2026-10-01T07:20:00Z", by: A, kind: "trial", days: 3, satang: 0, note: null },
    ]);
    expect([paid.title, paid.satang]).toEqual(["ซื้อบัตรรายเดือน 30 วัน", 9900]);
    expect([trial.title, trial.satang]).toEqual(["เริ่มทดลองใช้ 3 วัน", undefined]);
  });
});

describe("the month", () => {
  const items: AdminItem[] = mergeItems(
    fromHistory([
      { key: "piece-p1", kind: "studio", word: "Studio", at: "2026-10-15T04:05:00Z", title: "เขียนโพสต์ · Life Protect", note: "", href: null, action: null },
      { key: "clip-c1", kind: "clip", word: "คลิป", at: "2026-10-15T07:31:00Z", title: "วิดีโอนำเสนอ", note: "เสร็จแล้ว · ปกติ", href: null, action: null },
      { key: "money-m1", kind: "money", word: "เงิน", at: "2026-10-15T07:32:00Z", title: "หักค่าวิดีโอนำเสนอ", note: "", href: null, action: null, satang: -1000 },
      { key: "money-m2", kind: "money", word: "เงิน", at: "2026-10-14T13:15:00Z", title: "เติมเงินกระเป๋า", note: "", href: null, action: null, satang: 100000 },
    ], new Map([["piece-p1", A]])),
    buildAsks([{ id: "q", at: "2026-10-15T06:50:00Z", by: A, question: "ถาม \"ราคา\"", answer: "", model: null, failed: false }], []),
  );
  items[items.length - 1].media = [{ type: "image", url: "https://x/1.png" }, { type: "image", url: null }];

  it("sums the figures over the month", () => {
    expect(summarizeAdmin(items, 58.4)).toEqual({
      studio: 1, clips: 1, customers: 0, asks: 1, toppedUpSatang: 100000, spentSatang: 1000, aiThb: 58.4, pictures: 1,
    });
  });

  it("puts the lines under their Bangkok day, newest first, with the hour", () => {
    const days = groupDays(items, new Date("2026-10-15T10:00:00Z"));
    expect(days.map((d) => d.day)).toEqual(["2026-10-15", "2026-10-14"]);
    expect(days[0].label.startsWith("วันนี้")).toBe(true);
    expect(days[0].items[0].time).toBe("14:32");
  });

  it("writes a CSV Excel opens in Thai, quotes escaped", () => {
    const csv = toCsv(items, { [A]: "สุภาวดี" });
    expect(csv.startsWith('\uFEFF"เวลา","ชื่อ",')).toBe(true);
    expect(csv).toContain('"2026-10-15 14:32","","เงิน","หักค่าวิดีโอนำเสนอ","","-10.00"');
    expect(csv).toContain('"ถาม ""ราคา"""');
  });
});
