import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const store = vi.hoisted(() => ({ referralSettings: vi.fn(), codeFor: vi.fn(), friendsOf: vi.fn() }));
vi.mock("@/lib/referrals/store", () => store);
const pass = vi.hoisted(() => ({ passSettings: vi.fn() }));
vi.mock("@/lib/members/pass-store", () => pass);

const { referralCard } = await import("@/lib/referrals/card");

const viewer = (over: Partial<Viewer> = {}): Viewer => ({
  kind: "member", agentId: "m1", code: "a@b.c", name: "สมชาย", tenantId: null, tenantSlug: "", tenantName: "", trial: false, staff: null, ...over,
});
const ON = { enabled: true, days: 3, daysCap: 30, satang: 1000, satangCap: 10000 };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.advisortool.app");
  store.referralSettings.mockResolvedValue(ON);
  pass.passSettings.mockResolvedValue({ enabled: true, satang: 9900, trialDays: 3, rounds: 10 });
  store.codeFor.mockResolvedValue("SOMCHA7");
  store.friendsOf.mockResolvedValue([]);
});

describe("the invite card", () => {
  it("gives a member days", async () => {
    expect(await referralCard(viewer())).toEqual({ kind: "member", link: "https://www.advisortool.app/r/SOMCHA7", per: 3, cap: 30, friends: [] });
    expect(store.codeFor).toHaveBeenCalledWith("m1", "member");
  });

  it("gives a UnitOS agent baht, an assistant too", async () => {
    expect(await referralCard(viewer({ kind: "unitos", agentId: "a1" }))).toMatchObject({ kind: "unitos", per: 1000, cap: 10000 });
    const staff = { owner: false, publish: true, connect: false, admin: true };
    expect(await referralCard(viewer({ kind: "unitos", staff }))).toMatchObject({ kind: "unitos" });
  });

  it("is not there for the owner, while the switch is off, or while members pay nothing", async () => {
    expect(await referralCard(viewer({ kind: "unitos", staff: { owner: true, publish: true, connect: true, admin: true } }))).toBeNull();
    store.referralSettings.mockResolvedValueOnce({ ...ON, enabled: false });
    expect(await referralCard(viewer())).toBeNull();
    pass.passSettings.mockResolvedValueOnce({ enabled: false, satang: 9900, trialDays: 3, rounds: 10 });
    expect(await referralCard(viewer())).toBeNull();
  });
});
