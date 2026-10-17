import { describe, expect, it } from "vitest";
import { buildToday, FHC_SHOWN, gapLine, type TodayInput } from "@/lib/home/today";
import type { Gap } from "@/lib/fhc/gaps";

const now = new Date("2026-10-14T09:00:00+07:00");
const base: TodayInput = {
  now, name: "สมชาย", passEnd: null, walletSatang: null, rounds: null,
  postsToday: null, drafts: null, customers: null, clipsMaking: null,
};
const gap = (key: Gap["key"], state: Gap["state"], product?: string): Gap =>
  ({ key, state, unit: "sum", have: 0, should: 1, ...(product ? { product } : {}) });

describe("งานวันนี้ tiles", () => {
  it("shows an agent's wallet, rounds left, and FHC customers", () => {
    const t = buildToday({
      ...base, walletSatang: 41200, rounds: { limit: 10, used: 3 },
      customers: [
        { id: "c1", name: "วิภา", createdAt: "2026-10-10T10:00:00+07:00", gaps: [gap("health", "missing", "iHealthy Ultra")] },
        { id: "c2", name: "ธนา", createdAt: "2026-10-08T10:00:00+07:00", gaps: [gap("life", "ok")] },
      ],
    });
    expect(t.tiles.map((x) => [x.key, x.value, x.note])).toEqual([
      ["wallet", "฿412", "เติมเงิน"],
      ["rounds", "7", "จาก 10 รอบ"],
      ["fhc", "2", "ยังขาดความคุ้มครอง 1"],
    ]);
  });

  it("shows a member's Studio credit, credit and own money together, in place of free rounds (owner, 2026-10-17)", () => {
    const t = buildToday({ ...base, walletSatang: 5800, rounds: { limit: 0, used: 4 }, passEnd: new Date("2026-11-14T09:00:00+07:00") });
    expect(t.tiles.map((x) => [x.key, x.label, x.value, x.note, x.href])).toEqual([
      ["pass", "สมาชิก", "31 วัน", "ถึง 14 พ.ย.", "/membership"],
      ["rounds", "เครดิต Studio", "฿58", "รวมเงินที่เติมเอง", "/studio/wallet"],
    ]);
    expect(buildToday({ ...base, walletSatang: 0, rounds: { limit: 0, used: 0 } }).tiles.find((x) => x.key === "rounds")?.tone).toBe("warn");
    // the wallet off: nothing to spend, so no tile rather than "0 of 0 rounds"
    expect(buildToday({ ...base, walletSatang: null, rounds: { limit: 0, used: 0 } }).tiles).toEqual([]);
  });

  it("shows a member's pass instead of the wallet, in sand from three days out", () => {
    const t = buildToday({ ...base, walletSatang: 5000, passEnd: new Date("2026-10-16T09:00:00+07:00") });
    expect(t.tiles).toHaveLength(1);
    expect(t.tiles[0]).toMatchObject({ key: "pass", value: "2 วัน", tone: "warn", href: "/membership" });
    const later = buildToday({ ...base, passEnd: new Date("2026-10-30T09:00:00+07:00") });
    expect(later.tiles[0]).toMatchObject({ value: "16 วัน", tone: "plain" });
  });

  it("leaves out every figure that was not read, rather than showing a zero", () => {
    expect(buildToday(base).tiles).toEqual([]);
    expect(buildToday(base).todos).toEqual([]);
  });

  it("marks used-up rounds and points a customer-less agent at a first check", () => {
    const t = buildToday({ ...base, rounds: { limit: 10, used: 12 }, customers: [] });
    expect(t.tiles[0]).toMatchObject({ value: "0", tone: "warn" });
    expect(t.tiles[1]).toMatchObject({ value: "0", href: "/fhc", note: "ทำ FHC กับลูกค้าคนแรก" });
  });

  it("counts the Pages behind today's posts, and says so when there are none", () => {
    const posts = [
      { at: "2026-10-14T12:00:00Z", pageName: "A", text: "" },
      { at: "2026-10-14T13:00:00Z", pageName: "A", text: "" },
      { at: "2026-10-14T14:00:00Z", pageName: "B", text: "" },
    ];
    expect(buildToday({ ...base, postsToday: posts }).tiles[0]).toMatchObject({ key: "posts", value: "3", note: "2 เพจ" });
    expect(buildToday({ ...base, postsToday: [] }).tiles[0]).toMatchObject({ value: "0", note: "ยังไม่มีโพสต์" });
  });
});

describe("งานค้าง", () => {
  it("lists clips being made, customers lacking cover, drafts and today's posts, in that order", () => {
    const t = buildToday({
      ...base,
      clipsMaking: [{ id: "v1", label: "Life Protect x 2 · ชาย 35", status: "rendering" }],
      customers: [{ id: "c1", name: "วิภา", createdAt: "2026-10-10T10:00:00+07:00", gaps: [gap("life", "short"), gap("health", "missing", "iHealthy Ultra")] }],
      drafts: 2,
      postsToday: [{ at: "2026-10-14T12:00:00Z", pageName: "LuckyPlanner", text: "คำคมเรื่องมรดก" }],
    });
    expect(t.todos.map((x) => x.kind)).toEqual(["clip", "fhc", "post", "post"]);
    expect(t.todos[0]).toMatchObject({ note: "กำลังตัดต่อคลิป", href: "/studio/quote-video" });
    expect(t.todos[1]).toMatchObject({ title: "วิภา ชีวิตไม่พอ · ยังขาดสุขภาพ", href: "/fhc/customers/c1", action: "เสนอ iHealthy Ultra" });
    expect(t.todos[2]).toMatchObject({ title: "ร่างโพสต์ 2 ชิ้นรอตรวจ", href: "/studio/write" });
    expect(t.todos[3]).toMatchObject({ title: "โพสต์ 19:00 วันนี้ · คำคมเรื่องมรดก", note: "LuckyPlanner" });
  });

  it("names only the newest few customers who still lack cover, and none who are covered", () => {
    const customers = Array.from({ length: FHC_SHOWN + 2 }, (_, n) => ({
      id: `c${n}`, name: `ลูกค้า${n}`, createdAt: "2026-10-10T10:00:00+07:00", gaps: [gap("ci", n === 0 ? "ok" : "missing")],
    }));
    const fhc = buildToday({ ...base, customers }).todos.filter((x) => x.kind === "fhc");
    expect(fhc.map((x) => x.key)).toEqual(["fhc-c1", "fhc-c2", "fhc-c3"]);
    expect(fhc[0].action).toBe("ดู");
  });
});

it("writes the gap line in the check's own order and words", () => {
  expect(gapLine([gap("life", "missing"), gap("health", "ok"), gap("retire", "short")])).toBe("ยังขาดชีวิต · เกษียณไม่พอ");
});
