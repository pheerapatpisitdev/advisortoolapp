import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Viewer } from "@/lib/auth/access";

/** สมัครสมาชิก (owner, 2026-10-27, mockup 189doYqMskU9fUDbvfHbLU): name, Gmail and สำนักงาน after Google. */

const MEMBER: Viewer = {
  kind: "member", agentId: "m1", code: "somchai@gmail.com", name: "สมชาย", tenantId: null, tenantSlug: "",
  tenantName: "สมาชิกทั่วไป", trial: false, staff: null, profileDue: true,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer, getViewer: async () => who.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error(`redirect ${to}`); }) }));
vi.mock("next/navigation", () => nav);
const later = vi.hoisted(() => ({ after: vi.fn((f: () => unknown) => f()) }));
vi.mock("next/server", () => later);
const store = vi.hoisted(() => ({ memberProfile: vi.fn(), setProfile: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);
const alerts = vi.hoisted(() => ({ alertNewMember: vi.fn() }));
vi.mock("@/lib/line/owner-alert", () => alerts);
const access = vi.hoisted(() => ({ memberAccess: vi.fn() }));
vi.mock("@/lib/members/access", () => access);
vi.mock("@/app/login/actions", () => ({ signOut: vi.fn() }));

const { saveSignup } = await import("@/app/signup/actions");
const { default: SignupPage } = await import("@/app/signup/page");

const HOUR = 3_600_000;
const profile = (over: Record<string, unknown> = {}) => ({
  name: "สมชาย ใจดี", email: "somchai.jaidee@gmail.com", office: null, createdAt: new Date(Date.now() - HOUR).toISOString(), ...over,
});
const page = async (next = "/studio") => {
  const el = await SignupPage({ searchParams: Promise.resolve({ next }) });
  return renderToStaticMarkup(el);
};

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
  store.memberProfile.mockResolvedValue(profile());
  access.memberAccess.mockResolvedValue({
    gated: true, state: { status: "none" },
    settings: { enabled: true, satang: 19900, trialDays: 3, trialCreditSatang: 1500, creditSatang: 5000 },
  });
});

describe("saveSignup", () => {
  it("saves the cleaned name and สำนักงาน and goes on to the page asked for", async () => {
    await expect(saveSignup("  สมชาย  ใจดี ", " กรุงไทย-แอกซ่า  สาขาบางนา ", "/ask")).rejects.toThrow("redirect /ask");
    expect(store.setProfile).toHaveBeenCalledWith("m1", { name: "สมชาย ใจดี", office: "กรุงไทย-แอกซ่า สาขาบางนา" });
  });

  it("never goes on to another site", async () => {
    await expect(saveSignup("สมชาย", "AIA", "https://evil.example")).rejects.toThrow("redirect /studio");
  });

  it("says which box is empty, and saves nothing", async () => {
    expect(await saveSignup(" ", "AIA", "/studio")).toEqual({ ok: false, field: "name", error: "กรอกชื่อ - นามสกุล (ไม่เกิน 60 ตัวอักษร)" });
    expect(await saveSignup("สมชาย", "  ", "/studio")).toEqual({ ok: false, field: "office", error: "กรอกชื่อสำนักงาน หรือบริษัทที่สังกัด" });
    expect(await saveSignup("สมชาย", "ก".repeat(101), "/studio")).toMatchObject({ field: "office" });
    expect(store.setProfile).not.toHaveBeenCalled();
  });

  it("tells the owner's LINE of a member who joined in the last day, once", async () => {
    await expect(saveSignup("สมชาย", "AIA", "/studio")).rejects.toThrow("redirect");
    expect(alerts.alertNewMember).toHaveBeenCalledWith("m1");
  });

  it("tells nobody of a member from before the page, or one filling it in again", async () => {
    store.memberProfile.mockResolvedValueOnce(profile({ createdAt: "2026-10-10T00:00:00Z" }));
    await expect(saveSignup("สมชาย", "AIA", "/studio")).rejects.toThrow("redirect");
    store.memberProfile.mockResolvedValueOnce(profile({ office: "AIA" }));
    await expect(saveSignup("สมชาย", "AIA", "/studio")).rejects.toThrow("redirect");
    expect(alerts.alertNewMember).not.toHaveBeenCalled();
  });

  it("refuses a UnitOS agent", async () => {
    who.viewer = { ...MEMBER, kind: "unitos" };
    expect(await saveSignup("สมชาย", "AIA", "/studio")).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" });
  });

  it("says so when the save fails", async () => {
    store.setProfile.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveSignup("สมชาย", "AIA", "/studio")).toEqual({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
  });
});

describe("the สมัครสมาชิก page", () => {
  it("asks a new member for the three things, the Gmail shown rather than typed, and starts the trial", async () => {
    const html = await page();
    expect(html).toContain("สมัครสมาชิก");
    expect(html).toMatch(/<label[^>]*for="signup-name"[^>]*>ชื่อ - นามสกุล<\/label>/);
    expect(html).toContain('value="สมชาย ใจดี"');
    expect(html).toContain("Gmail สำหรับเข้าใช้งาน");
    expect(html).toContain("somchai.jaidee@gmail.com");
    expect(html).not.toMatch(/<input[^>]*somchai\.jaidee/);
    expect(html).toMatch(/<label[^>]*for="signup-office"[^>]*>สำนักงาน<\/label>/);
    expect(html).toContain("ทดลองฟรี 3 วัน · ถาม AI ไม่จำกัด · เครดิต Studio ฿15");
    expect(html).toContain("เริ่มทดลองฟรี 3 วัน");
    expect(html).toContain("ใช้บัญชี Google อื่น");
  });

  it("says nothing of a trial to a member from before the page", async () => {
    store.memberProfile.mockResolvedValueOnce(profile({ createdAt: "2026-10-10T00:00:00Z" }));
    const html = await page();
    expect(html).not.toContain("ทดลองฟรี");
    expect(html).toContain("บันทึกแล้วใช้งานต่อ");
  });

  it("sends somebody signed out to the front page, and anybody with nothing to fill in on", async () => {
    who.viewer = null;
    await expect(page("/ask")).rejects.toThrow("redirect /?next=%2Fask");
    who.viewer = { ...MEMBER, profileDue: undefined };
    await expect(page("/ask")).rejects.toThrow("redirect /ask");
    who.viewer = { ...MEMBER, kind: "unitos", profileDue: undefined };
    await expect(page("/ask")).rejects.toThrow("redirect /ask");
  });
});
