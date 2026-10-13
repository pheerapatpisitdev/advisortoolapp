import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PASS_SETTINGS, type PassRow } from "@/lib/members/pass";

const store = vi.hoisted(() => ({ passSettings: vi.fn(), passRows: vi.fn(), ensureTrial: vi.fn() }));
vi.mock("@/lib/members/pass-store", () => store);

const { memberAccess, passOpen } = await import("@/lib/members/access");

const member = { kind: "member", agentId: "m1" } as unknown as Viewer;
const unitos = { kind: "unitos", agentId: "a1" } as unknown as Viewer;
const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
const now = new Date("2026-10-13T00:00:00Z");
const row = (createdAt: string, days = 3): PassRow =>
  ({ id: 1, kind: "trial", days, revokes: null, createdAt, amountSatang: null, note: null });

beforeEach(() => { vi.clearAllMocks(); store.passSettings.mockResolvedValue(on); });

describe("memberAccess", () => {
  it("never gates a UnitOS agent and reads nothing", async () => {
    expect(await memberAccess(unitos, now)).toEqual({ gated: false });
    expect(store.passSettings).not.toHaveBeenCalled();
  });
  it("does not gate with the switch off", async () => {
    store.passSettings.mockResolvedValue(DEFAULT_PASS_SETTINGS);
    expect(await memberAccess(member, now)).toEqual({ gated: false });
    expect(store.passRows).not.toHaveBeenCalled();
  });
  it("writes the trial once when there are no rows, then re-reads", async () => {
    store.passRows.mockResolvedValueOnce([]).mockResolvedValueOnce([row("2026-10-13T00:00:00Z")]);
    const a = await memberAccess(member, now);
    expect(store.ensureTrial).toHaveBeenCalledTimes(1);
    expect(store.ensureTrial).toHaveBeenCalledWith("m1", 3);
    expect(a.gated && a.state.status).toBe("live");
    expect(passOpen(a)).toBe(true);
  });
  it("writes no trial when trialDays is 0", async () => {
    store.passSettings.mockResolvedValue({ ...on, trialDays: 0 });
    store.passRows.mockResolvedValue([]);
    const a = await memberAccess(member, now);
    expect(store.ensureTrial).not.toHaveBeenCalled();
    expect(a.gated && a.state.status).toBe("none");
    expect(passOpen(a)).toBe(false);
  });
  it("does not write a trial when rows exist (even all revoked)", async () => {
    store.passRows.mockResolvedValue([row("2026-09-01T00:00:00Z")]);
    const a = await memberAccess(member, now);
    expect(store.ensureTrial).not.toHaveBeenCalled();
    expect(a.gated && a.state.status).toBe("expired");
    expect(passOpen(a)).toBe(false);
  });
  it("rejects when the store does", async () => {
    store.passSettings.mockRejectedValue(new Error("down"));
    await expect(memberAccess(member, now)).rejects.toThrow("down");
  });
  it("a lost trial race still ends with the one live trial", async () => {
    store.passRows.mockResolvedValueOnce([]).mockResolvedValueOnce([row("2026-10-12T23:59:00Z")]);
    store.ensureTrial.mockResolvedValue(undefined); // 23505 swallowed in the store
    expect(passOpen(await memberAccess(member, now))).toBe(true);
  });
});
