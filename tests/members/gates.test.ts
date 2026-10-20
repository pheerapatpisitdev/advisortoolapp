import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PASS_SETTINGS, type PassState } from "@/lib/members/pass";

/**
 * Outside members need a live 30-day pass for /home and Studio (owner, 2026-10-13). UnitOS
 * agents and the owner see no change: the gate only ever looks at a member.
 */

// Next's redirect throws to stop the page; the mock does the same so nothing after it runs
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); }),
}));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));
// getViewer is cached per request; each call here is its own request
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
// the PDF printer's pass, when a test hands one over (src/lib/auth/print-pass.ts)
const jar = vi.hoisted(() => ({ print: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: (name: string) => (name === "ins_print" && jar.print ? { value: jar.print } : undefined) }),
}));

// getViewer reads the session, then the rows: the member's row or the UnitOS agent's
const who = vi.hoisted(() => ({ agentId: "m1", member: null as unknown, agent: null as unknown }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => ({ agentId: who.agentId, issuedAt: Date.now() }) }));
vi.mock("@/lib/auth/epoch", () => ({ sessionNotBefore: async () => null }));

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: db.from }) }));

const access = vi.hoisted(() => ({ memberAccess: vi.fn() }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: access.memberAccess,
}));

const wallet = vi.hoisted(() => ({
  walletSettings: vi.fn(), walletPrices: vi.fn(), holdWallet: vi.fn(), walletFrozen: vi.fn(),
  balanceSatang: vi.fn(), releaseWallet: vi.fn(), settleWallet: vi.fn(),
}));
vi.mock("@/lib/wallet/store", () => wallet);

const brain = vi.hoisted(() => ({ answer: vi.fn() }));
vi.mock("@/lib/copilot/answer", () => ({ answerFromKnowledge: brain.answer }));

const { gateCalc, gatePage } = await import("@/lib/auth/viewer");
const { printPassFor } = await import("@/lib/auth/print-pass");
const { askCopilot } = await import("@/app/actions");
const { createVideo } = await import("@/lib/quote-video/make");
const { PASS_EXPIRED, PASS_EXPIRED_CHAT, PASS_UNREADABLE } = await import("@/lib/members/access");

const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
const expired: PassState = { status: "expired", end: new Date("2026-10-10T00:00:00Z") };
const live: PassState = {
  status: "live",
  period: { rowId: 1, kind: "paid", start: new Date("2026-10-12T00:00:00Z"), end: new Date("2026-11-11T00:00:00Z") },
  end: new Date("2026-11-11T00:00:00Z"),
};

const memberRow = { id: "m1", email: "m@example.com", name: "สมาชิก", status: "active", revoked_at: null };
const agentRow = {
  id: "a1", agent_code: "123456", name: "ตัวแทน",
  tenant: { id: "t1", slug: "t", name: "T", status: "active", config: null, key_epoch: null },
};
const member = { kind: "member", agentId: "m1", staff: null } as unknown as Viewer;
const unitos = { kind: "unitos", agentId: "a1", staff: null } as unknown as Viewer;

/** each table's one row, as getViewer's maybeSingle reads it */
function rowsAre(tables: Record<string, unknown>) {
  db.from.mockImplementation((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
    };
    return chain;
  });
}

const signedInAs = (kind: "member" | "unitos") => {
  who.agentId = kind === "member" ? "m1" : "a1";
  rowsAre(kind === "member" ? { ins_members: memberRow } : { agents: agentRow });
};

beforeEach(() => {
  vi.clearAllMocks();
  jar.print = undefined;
  signedInAs("member");
  access.memberAccess.mockResolvedValue({ gated: true, state: expired, settings: on });
  brain.answer.mockResolvedValue({ text: "คำตอบ", model: "m" });
});

/**
 * The calculators are for members only since 2026-10-20 (owner): "สมาชิกหมายถึงคนที่ทดลองใช้ด้วย",
 * so a member on trial or paid is in, an expired one renews, somebody signed out signs in.
 */
describe("gateCalc", () => {
  it("turns an expired member from a calculator to the membership page", async () => {
    await expect(gateCalc("/lifeprotect")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    await expect(gateCalc("/ihealthy-ultra")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    await expect(gateCalc("/fhc")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
  });

  it("lets a member on trial in", async () => {
    const trial: PassState = { ...live, period: { ...live.period, kind: "trial" } } as PassState;
    access.memberAccess.mockResolvedValue({ gated: true, state: trial, settings: on });
    expect(await gateCalc("/ishield")).toMatchObject({ kind: "member" });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("lets a UnitOS agent in without asking about a pass", async () => {
    signedInAs("unitos");
    expect(await gateCalc("/bumnan95")).toMatchObject({ kind: "unitos" });
    expect(access.memberAccess).not.toHaveBeenCalled();
  });

  it("sends somebody signed out to sign in and back", async () => {
    rowsAre({});
    await expect(gateCalc("/plb")).rejects.toThrow("NEXT_REDIRECT /?next=%2Fplb");
  });

  it("lets our PDF printer through on its pass, with nobody signed in", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret");
    rowsAre({});
    jar.print = printPassFor();
    expect(await gateCalc("/lifeprotect")).toBeNull();
    jar.print = printPassFor(Date.now() - 3 * 60 * 1000);
    await expect(gateCalc("/lifeprotect")).rejects.toThrow("NEXT_REDIRECT /?next=%2Flifeprotect");
    vi.unstubAllEnvs();
  });
});

describe("gatePage", () => {
  it("turns an expired member from /home and from Studio to the membership page", async () => {
    await expect(gatePage("/home")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    await expect(gatePage("/ask")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    await expect(gatePage("/studio/write")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    await expect(gatePage("/studio")).rejects.toThrow("NEXT_REDIRECT /membership?expired=1");
    expect(nav.redirect).toHaveBeenCalledTimes(4);
  });

  it("lets a member with a live pass in", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    expect(await gatePage("/studio/write")).toMatchObject({ kind: "member", agentId: "m1" });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("lets a member in while the switch is off", async () => {
    access.memberAccess.mockResolvedValue({ gated: false });
    expect(await gatePage("/home")).toMatchObject({ kind: "member" });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("never consults the pass for the membership page or any page outside /home and Studio", async () => {
    for (const page of ["/membership", "/admin/members", "/studios", "/homepage", "/asking"]) {
      expect(await gatePage(page)).toMatchObject({ kind: "member" });
    }
    expect(access.memberAccess).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("never redirects a UnitOS agent, and never asks about a pass for one", async () => {
    signedInAs("unitos");
    for (const page of ["/home", "/studio", "/studio/write"]) {
      expect(await gatePage(page)).toMatchObject({ kind: "unitos", agentId: "a1" });
    }
    expect(access.memberAccess).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("lets an unreadable pass throw to the error page, never redirecting on it", async () => {
    access.memberAccess.mockRejectedValue(new Error("pass store down"));
    await expect(gatePage("/home")).rejects.toThrow("pass store down");
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});

describe("askCopilot", () => {
  it("tells an expired member to renew, asking no model", async () => {
    expect(await askCopilot("iShield อายุ 40 เบี้ยเท่าไร")).toEqual({ text: PASS_EXPIRED_CHAT, model: "—" });
    expect(brain.answer).not.toHaveBeenCalled();
  });

  it("says the pass cannot be read when it cannot, asking no model", async () => {
    access.memberAccess.mockRejectedValue(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await askCopilot("ถาม")).toEqual({ text: PASS_UNREADABLE, model: "—", failed: true });
    err.mockRestore();
    expect(brain.answer).not.toHaveBeenCalled();
  });

  it("answers a member with a live pass", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    expect(await askCopilot("ถาม")).toEqual({ text: "คำตอบ", model: "m" });
  });

  it("answers a UnitOS agent as before", async () => {
    signedInAs("unitos");
    access.memberAccess.mockResolvedValue({ gated: false });
    expect(await askCopilot("ถาม")).toEqual({ text: "คำตอบ", model: "m" });
  });
});

describe("createVideo", () => {
  it("refuses an expired member before counting any free clip", async () => {
    expect(await createVideo(member, {} as never, "ลูกค้า")).toEqual({ refusal: PASS_EXPIRED });
    expect(db.from).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses when the pass cannot be read, rather than make a clip", async () => {
    access.memberAccess.mockRejectedValue(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createVideo(member, {} as never, "ลูกค้า")).toEqual({ refusal: PASS_UNREADABLE });
    err.mockRestore();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("does not ask about a pass for the owner", async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "v1" }, error: null }) }) }));
    db.from.mockImplementation(() => ({ insert }));
    const owner = { ...unitos, staff: { owner: true, publish: true, connect: true, admin: true } } as Viewer;
    expect(await createVideo(owner, {} as never, "ลูกค้า")).toEqual({ id: "v1" });
    expect(access.memberAccess).not.toHaveBeenCalled();
  });
});
