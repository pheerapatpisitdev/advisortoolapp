import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanMessage, cleanSwitches, closedHrefs, DEFAULT_CLOSED, FEATURES, isFeature, MESSAGE_MAX } from "@/lib/switches/features";

// the one settings row, as the store reads and writes it
const db = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, fail: false, written: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => (db.fail ? { data: null, error: { message: "down" } } : { data: db.row, error: null }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        db.written.push(row);
        db.row = { feature_switches: row.feature_switches };
        return { error: null };
      },
    }),
  }),
}));
const viewer = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => viewer.current }));

const { closedFor, closedNotice, closedNow, saveSwitch } = await import("@/lib/switches/store");

const agent = { kind: "agent", agentId: "a1", staff: null } as never;
const owner = { kind: "agent", agentId: "o1", staff: { owner: true } } as never;
const superAdmin = { kind: "super", agentId: "s1" } as never;

beforeEach(() => {
  db.row = null;
  db.fail = false;
  db.written = [];
  viewer.current = null;
});

describe("the switches as stored (features.ts)", () => {
  it("lists the eight tools of the mockup, each once", () => {
    expect(FEATURES.map((f) => f.label)).toEqual(["วิดีโอนำเสนอ", "คลิปเล่าเรื่อง", "คลิปตามโจทย์", "Organic Studio", "ภาพปกคลิป", "ถอดรูปเป็น prompt", "Ads Studio", "ถาม AI"]);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
  });

  it("reads anything unreadable as on, with the default words", () => {
    for (const raw of [null, "x", [], { "quote-video": "off" }, { "quote-video": { off: "true" } }]) {
      const s = cleanSwitches(raw);
      expect(Object.values(s).every((v) => !v.off && v.message === DEFAULT_CLOSED)).toBe(true);
    }
    expect(cleanSwitches({ "quote-video": { off: true, message: "เสียงขัดข้อง", at: "2026-10-17T10:40:00Z" } })["quote-video"])
      .toEqual({ off: true, message: "เสียงขัดข้อง", at: "2026-10-17T10:40:00Z" });
  });

  it("keeps the words to one short line", () => {
    expect(cleanMessage("  ระบบ\n\nขัดข้อง  ")).toBe("ระบบ ขัดข้อง");
    expect(cleanMessage("   ")).toBe(DEFAULT_CLOSED);
    expect(cleanMessage(42)).toBe(DEFAULT_CLOSED);
    expect(cleanMessage("ก".repeat(500))).toHaveLength(MESSAGE_MAX);
  });

  it("marks the menu items of the tools that are off", () => {
    const s = cleanSwitches({ "quote-video": { off: true }, ask: { off: true }, write: { off: false } });
    expect(closedHrefs(s)).toEqual(["/studio/quote-video", "/ask"]);
    expect(isFeature("ask")).toBe(true);
    expect(isFeature("voice")).toBe(false);
  });
});

describe("who is refused (store.ts)", () => {
  it("refuses an agent with the Super Admin's words while a tool is off, and lets them through while it is on", async () => {
    db.row = { feature_switches: { "quote-video": { off: true, message: "เสียงพากย์ขัดข้อง" } } };
    expect(await closedFor(agent, "quote-video")).toBe("เสียงพากย์ขัดข้อง");
    expect(await closedFor(agent, "story-clip")).toBeNull();
  });

  it("never refuses the owner or the Super Admin, who try it before it is back on (ข้อ 2 ก)", async () => {
    db.row = { feature_switches: { "quote-video": { off: true, message: "x" } } };
    expect(await closedFor(owner, "quote-video")).toBeNull();
    expect(await closedFor(superAdmin, "quote-video")).toBeNull();
    expect(await closedNotice(owner, "quote-video")).toEqual({ message: "x", forOthers: true });
    expect(await closedNotice(agent, "quote-video")).toEqual({ message: "x", forOthers: false });
  });

  it("refuses somebody it cannot name, for a route", async () => {
    db.row = { feature_switches: { thumbnail: { off: true, message: "ปิดก่อน" } } };
    expect(await closedNow("thumbnail")).toBe("ปิดก่อน");
    viewer.current = owner;
    expect(await closedNow("thumbnail")).toBeNull();
  });

  it("keeps every tool on when the settings cannot be read", async () => {
    db.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await closedFor(agent, "quote-video")).toBeNull();
  });

  it("switches one tool and leaves the others, stamping the time only when it flips", async () => {
    db.row = { feature_switches: { ask: { off: true, message: "แชทปิด", at: "2026-10-17T01:00:00Z" } } };
    await saveSwitch("quote-video", true, "  เสียงขัดข้อง ");
    const saved = db.written[0].feature_switches as Record<string, { off: boolean; message: string; at: string | null }>;
    expect(saved.ask).toEqual({ off: true, message: "แชทปิด", at: "2026-10-17T01:00:00Z" });
    expect(saved["quote-video"].off).toBe(true);
    expect(saved["quote-video"].message).toBe("เสียงขัดข้อง");
    expect(saved["quote-video"].at).toMatch(/^\d{4}-/);
    // new words on a tool already off keep the time it went off
    await saveSwitch("ask", true, "แชทปิดถึงพรุ่งนี้");
    expect((db.written[1].feature_switches as Record<string, { at: string }>).ask.at).toBe("2026-10-17T01:00:00Z");
  });
});

describe("the rows /admin/switches shows (owner chose 7ก, 2026-10-18)", () => {
  it("leaves Ads Studio off: the owner alone uses it, and no switch stops the owner", async () => {
    const { SHOWN_FEATURES, FEATURES } = await import("@/lib/switches/features");
    expect(SHOWN_FEATURES.map((f) => f.key)).not.toContain("ads");
    expect(SHOWN_FEATURES).toHaveLength(FEATURES.length - 1);
  });
});
