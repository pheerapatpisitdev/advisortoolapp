import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The owner's member list and the เพิ่มวัน form on /admin/members (owner, 2026-10-13). The
 * database is the fake one; nothing here reaches Supabase.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});
vi.mock("@/lib/wallet/store", () => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));
const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "owner-id" })), audit: vi.fn(), memberById: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const grant = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/members/pass-store", async (original) => ({ ...(await original<object>()), grantPass: grant }));

import { db, has, type Step } from "../helpers/fake-db";
const { listMembers } = await import("@/lib/auth/member-store");
const { grantPassDays } = await import("@/app/admin/members/actions");
const { FREE_ROUNDS_FROM } = await import("@/lib/auth/quota");
const { MembersAdmin } = await import("@/app/admin/members/MembersAdmin");

const ID = "00000000-0000-4000-8000-0000000000aa";
const NOW = new Date("2026-10-13T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  viewer.memberById.mockResolvedValue({ id: ID, email: "thana@gmail.com", name: "ธนา", status: "active", revoked_at: null });
});

describe("grantPassDays", () => {
  it("adds the days with the note and the admin's name on it", async () => {
    expect(await grantPassDays(ID, "30", "  โอนพร้อมเพย์ตรง 13 ต.ค. ")).toEqual({ ok: true });
    expect(viewer.requireStaff).toHaveBeenCalledWith("backoffice");
    expect(grant).toHaveBeenCalledWith(ID, 30, "โอนพร้อมเพย์ตรง 13 ต.ค.", "owner-id");
    expect(viewer.audit).toHaveBeenCalledWith("member-pass-grant", ID, { days: 30, note: "โอนพร้อมเพย์ตรง 13 ต.ค." });
  });

  it("refuses days that are not 1 to 365 whole days", async () => {
    for (const days of ["0", "366", "-3", "1.5", "", "abc"]) {
      expect(await grantPassDays(ID, days, "เหตุผล")).toMatchObject({ ok: false });
    }
    expect(grant).not.toHaveBeenCalled();
  });

  it("needs a note", async () => {
    expect(await grantPassDays(ID, "30", "   ")).toMatchObject({ ok: false });
    expect(grant).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a uuid, or a member that is not there", async () => {
    expect(await grantPassDays("x", "30", "เหตุผล")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    viewer.memberById.mockResolvedValueOnce(null);
    expect(await grantPassDays(ID, "30", "เหตุผล")).toEqual({ ok: false, error: "ไม่พบสมาชิกนี้" });
    expect(grant).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not staff, and adds nothing (review, 2026-10-13)", async () => {
    viewer.requireStaff.mockRejectedValueOnce(new Error("forbidden"));
    await expect(grantPassDays(ID, "30", "เหตุผล")).rejects.toThrow();
    expect(grant).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });

  it("says so when the save fails, and audits nothing", async () => {
    grant.mockRejectedValueOnce(new Error("boom"));
    expect(await grantPassDays(ID, "30", "เหตุผล")).toMatchObject({ ok: false });
    expect(viewer.audit).not.toHaveBeenCalled();
  });
});

describe("listMembers with the pass (owner, 2026-10-13)", () => {
  const member = (id: string) => ({ id, name: id, email: `${id}@gmail.com`, status: "active", created_at: "2026-10-01T00:00:00Z" });
  const row = (id: number, member_id: string, kind: string, days: number, created_at: string) =>
    ({ id, member_id, kind, days, revokes: null, created_at, amount_satang: kind === "paid" ? 9900 : null, note: null });
  /** what each member's count asked: the moment it counted from */
  const countedFrom = (steps: Step[]) => steps.find((s) => s.method === "gte")?.args[1];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    db.on("ins_members", { data: ["paid", "trial", "never", "lapsed"].map(member) });
    db.on("ins_wallets", { data: [] });
    db.on("ins_member_passes", { data: [
      row(1, "paid", "paid", 30, "2026-10-12T00:00:00.000Z"),
      row(2, "trial", "trial", 3, "2026-10-13T00:00:00.000Z"),
      row(3, "lapsed", "paid", 30, "2026-09-01T00:00:00.000Z"),
    ] });
    db.on("ins_audit", (steps) => ({ count: has(steps, "eq", "agent_id", "paid") ? 9 : 2 }));
  });
  afterEach(() => vi.useRealTimers());

  it("gives live members no free rounds but their credit left, and says how the pass stands (owner, 2026-10-17)", async () => {
    db.on("ins_ai_settings", { data: { member_pass_enabled: true, member_pass_satang: 19900, member_trial_days: 3, member_trial_credit_satang: 1500, member_pass_credit_satang: 5000 } });
    // what the query filters to: live lots with something left, two of them the paid member's
    db.on("ins_member_credits", { data: [
      { member_id: "paid", left_satang: 3000 }, { member_id: "paid", left_satang: 800 }, { member_id: "trial", left_satang: 1100 },
    ] });
    const list = await listMembers();
    const by = Object.fromEntries(list.map((m) => [m.id, m]));
    expect(by.paid).toMatchObject({ freeUsed: 0, freeLimit: 0, creditSatang: 3800, pass: { status: "live", end: "2026-11-11T00:00:00.000Z", trial: false } });
    expect(by.trial).toMatchObject({ freeUsed: 0, freeLimit: 0, creditSatang: 1100, pass: { status: "live", end: "2026-10-16T00:00:00.000Z", trial: true } });
    expect(by.never).toMatchObject({ freeLimit: 10, creditSatang: 0, pass: { status: "none", end: null, trial: false } });
    expect(by.lapsed).toMatchObject({ freeLimit: 10, creditSatang: 0, pass: { status: "expired", end: "2026-10-01T00:00:00.000Z", trial: false } });

    const counts = db.log.filter((l) => l.table === "ins_audit");
    const from = Object.fromEntries(counts.map((l) => [l.steps.find((s) => s.method === "eq")?.args[1], countedFrom(l.steps)]));
    expect(from).toEqual({
      paid: "2026-10-12T00:00:00.000Z",
      trial: "2026-10-13T00:00:00.000Z",
      never: FREE_ROUNDS_FROM.toISOString(),
      lapsed: FREE_ROUNDS_FROM.toISOString(),
    });
    // one read of the ledger and one of the credit for the whole list, not one per member
    expect(db.log.filter((l) => l.table === "ins_member_passes")).toHaveLength(1);
    expect(db.log.filter((l) => l.table === "ins_member_credits")).toHaveLength(1);
  });

  it("shows a member who paid during the trial as paid, not trial (review, 2026-10-13)", async () => {
    db.on("ins_ai_settings", { data: { member_pass_enabled: true, member_pass_satang: 9900, member_trial_days: 3 } });
    db.on("ins_member_credits", { data: [] });
    db.on("ins_member_passes", { data: [
      row(2, "trial", "trial", 3, "2026-10-13T00:00:00.000Z"),
      row(4, "trial", "paid", 30, "2026-10-13T06:00:00.000Z"),
    ] });
    const list = await listMembers();
    expect(list.find((m) => m.id === "trial")).toMatchObject({ pass: { status: "live", end: "2026-11-15T00:00:00.000Z", trial: false } });
  });

  it("is today's list while the switch is off: no pass, the one-time ten from the same moment", async () => {
    db.on("ins_ai_settings", { data: null });
    const list = await listMembers();
    for (const m of list) expect(m).toMatchObject({ pass: null, freeLimit: 10 });
    expect(list.find((m) => m.id === "paid")?.freeUsed).toBe(9);
    for (const l of db.log.filter((x) => x.table === "ins_audit")) expect(countedFrom(l.steps)).toBe(FREE_ROUNDS_FROM.toISOString());
  });

  it("fails as a whole when the switch cannot be read", async () => {
    db.on("ins_ai_settings", { error: { message: "boom" } });
    await expect(listMembers()).rejects.toThrow();
  });
});

describe("the member list on /admin/members (owner, 2026-10-13)", () => {
  type Summary = Awaited<ReturnType<typeof listMembers>>[number];
  const m = (id: string, pass: Summary["pass"], freeUsed = 2, freeLimit = 10, creditSatang = 0): Summary =>
    ({ id, name: id, email: `${id}@gmail.com`, status: "active", createdAt: "2026-10-01T00:00:00Z", balanceSatang: 0, freeUsed, freeLimit, creditSatang, footprint: null, pass });
  const members = [
    m("paid", { status: "live", end: "2026-11-11T00:00:00.000Z", trial: false }, 0, 0, 3800),
    m("soon", { status: "live", end: "2026-10-15T00:00:00.000Z", trial: false }),
    m("trial", { status: "live", end: "2026-10-16T00:00:00.000Z", trial: true }),
    m("lapsed", { status: "expired", end: "2026-10-01T00:00:00.000Z", trial: false }),
    m("never", { status: "none", end: null, trial: false }),
  ];
  const draw = (passOn: boolean, revenueSatang: number | null = 118800, list = members) =>
    renderToStaticMarkup(createElement(MembersAdmin, { settings: { signupOpen: true }, members: list, passOn, revenueSatang, now: NOW.toISOString() }));
  const chip = (tone: string, text: string) => new RegExp(`bot-${tone}[^"]*"[^>]*>${text}<`);

  it("counts the tiles and colours each chip: green running, amber trial or 3 days left, red over or never", () => {
    const html = draw(true);
    expect(html).toMatch(/>2<\/div><div[^>]*>จ่ายอยู่</);
    expect(html).toMatch(/>1<\/div><div[^>]*>ทดลองใช้</);
    expect(html).toMatch(/>1<\/div><div[^>]*>หมดอายุ</);
    expect(html).toContain("฿1,188.00");
    expect(html).toMatch(chip("ok", "11 พ.ย."));
    expect(html).toMatch(chip("sand", "15 ต.ค. · เหลือ 2 วัน"));
    expect(html).toMatch(chip("sand", "16 ต.ค. · ทดลอง"));
    expect(html).toMatch(chip("red", "หมด 1 ต.ค."));
    expect(html).toMatch(chip("red", "ยังไม่เคยใช้"));
    // the credit left in place of free rounds (owner, 2026-10-17)
    expect(html).toContain("เครดิตเหลือ");
    expect(html).toContain("฿38.00");
    expect(html).toContain("เพิ่มวัน");
  });

  it("offers ลบ on suspended members only (owner 2ข, 2026-10-14)", () => {
    const html = draw(false, 0, [
      { ...members[0], pass: null },
      { ...members[1], pass: null, status: "suspended", footprint: { pieces: 3, customers: 1, people: 0 } },
    ]);
    expect(html.match(/>ลบ</g)).toHaveLength(1);
    expect(html.indexOf(">ลบ<")).toBeGreaterThan(html.indexOf("soon@gmail.com"));
  });

  it("shows — on the money tile when the revenue cannot be read", () => {
    expect(draw(true, null)).toMatch(/>—<\/div><div[^>]*>ค่าสมาชิกเดือนนี้</);
  });

  it("is today's table while the switch is off: no tiles, no pass column, no เพิ่มวัน", () => {
    const html = draw(false, 0, members.map((x) => ({ ...x, pass: null })));
    expect(html).not.toContain("จ่ายอยู่");
    expect(html).not.toContain("ใช้ได้ถึง");
    expect(html).not.toContain("เพิ่มวัน");
    expect(html).toContain("2/10");
  });
});
