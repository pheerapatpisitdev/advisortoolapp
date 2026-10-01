import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signing in with the agent's 6-digit code (review, 2026-10-01): the attempt is written before
 * it is counted, so a burst of parallel guesses counts itself; wrong codes from every address
 * together have a ceiling; and a count or a write that fails refuses rather than lets through.
 */

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn(), readSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const epoch = vi.hoisted(() => ({ endEverySession: vi.fn() }));
vi.mock("@/lib/auth/epoch", () => epoch);
const who = vi.hoisted(() => ({ agentsByCode: vi.fn(), staffRow: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => who);
vi.mock("@/lib/auth/member-store", () => ({ memberByPhone: vi.fn(), phoneFailures: vi.fn() }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db, has, type Step } from "../helpers/fake-db";
const { signIn, signOut } = await import("@/app/login/actions");

const AGENT = {
  id: "3f1c2b1e-7a52-4d8f-9a4b-0c7d7e2b9a11", agent_code: "015495", name: "บอย",
  tenant: { id: "t1", slug: "83g", name: "83G", status: "active", config: null, key_epoch: null },
};

const form = (code: string, next = "/studio/write") => {
  const fd = new FormData();
  fd.set("code", code);
  fd.set("next", next);
  return fd;
};

const isSite = (steps: Step[]) => has(steps, "is", "phone", null);
/** the attempts table: the claim answers with an id; the address's and the site's counts include this attempt */
const answerAttempts = (fromIp: number, fromSite = fromIp) =>
  db.on("ins_login_attempts", (steps) => {
    if (has(steps, "insert")) return { data: { id: "a1" } };
    if (has(steps, "update") || has(steps, "delete")) return {};
    return { count: isSite(steps) ? fromSite : fromIp };
  });

const BROKEN = { error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  answerAttempts(1);
  who.agentsByCode.mockResolvedValue([AGENT]);
  who.staffRow.mockResolvedValue(null);
});

describe("signIn with the agent code", () => {
  it("signs the agent in, turning the claimed attempt into a success", async () => {
    expect(await signIn(form("015495"))).toBeUndefined();
    expect(auth.startSession).toHaveBeenCalledWith(AGENT.id);
    expect(nav.redirect).toHaveBeenCalledWith("/studio/write");
    const claims = db.writes("ins_login_attempts", "insert");
    expect(claims.map((s) => s[0].args[0])).toEqual([{ ip: "1.2.3.4", ok: false }]);
    const updates = db.writes("ins_login_attempts", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0][0].args[0]).toEqual({ ok: true });
    expect(has(updates[0], "eq", "id", "a1")).toBe(true);
  });

  it("writes the claim before it counts anything or looks the code up", async () => {
    const order: string[] = [];
    db.on("ins_login_attempts", (steps) => {
      if (has(steps, "insert")) { order.push("claim"); return { data: { id: "a1" } }; }
      if (has(steps, "update") || has(steps, "delete")) return {};
      order.push(isSite(steps) ? "site count" : "ip count");
      return { count: 1 };
    });
    who.agentsByCode.mockImplementation(async () => { order.push("lookup"); return [AGENT]; });
    await signIn(form("015495"));
    expect(order).toEqual(["claim", "ip count", "site count", "lookup"]);
  });

  it("counts down with the attempt included, and leaves a wrong code counted", async () => {
    who.agentsByCode.mockResolvedValue([]);
    answerAttempts(1);
    expect(await signIn(form("000000"))).toEqual({ error: "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้ เหลืออีก 4 ครั้ง" });
    answerAttempts(5);
    expect(await signIn(form("000000"))).toEqual({ error: "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้ ถูกระงับชั่วคราว" });
    expect(db.writes("ins_login_attempts", "update")).toHaveLength(0);
    expect(db.writes("ins_login_attempts", "delete")).toHaveLength(0);
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("does not let a burst through: a sixth attempt from the address is refused unverified", async () => {
    answerAttempts(6);
    expect(await signIn(form("015495"))).toEqual({ error: "กรอกผิดเกิน 5 ครั้ง กรุณารออีก 15 นาที" });
    expect(who.agentsByCode).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
    const deletes = db.writes("ins_login_attempts", "delete");
    expect(deletes).toHaveLength(1);
    expect(has(deletes[0], "eq", "id", "a1")).toBe(true);
  });

  it("closes the code tab for everybody past thirty wrong codes from all addresses together", async () => {
    answerAttempts(1, 30);
    expect(await signIn(form("015495"))).toBeUndefined();
    vi.clearAllMocks();
    answerAttempts(1, 31);
    const r = await signIn(form("015495"));
    expect(r?.error).toContain("ปิดการเข้าด้วยรหัสชั่วคราว");
    expect(r?.error).toContain("เข้าจากเมนูใน UnitOS");
    expect(who.agentsByCode).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("counts only the code's attempts across the site, which carry no phone", async () => {
    await signIn(form("015495"));
    const site = db.log.filter((l) => l.table === "ins_login_attempts" && isSite(l.steps));
    expect(site).toHaveLength(1);
    expect(has(site[0].steps, "eq", "ok", false)).toBe(true);
    expect(site[0].steps.some((s) => s.method === "eq" && s.args[0] === "ip")).toBe(false);
  });

  it("fails closed when the attempt cannot be recorded, looking nothing up", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.on("ins_login_attempts", (steps) => (has(steps, "insert") ? { error: { message: "down" } } : { count: 0 }));
    expect(await signIn(form("015495"))).toEqual(BROKEN);
    expect(who.agentsByCode).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("fails closed when the address's count or the site's cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const broken of [(s: Step[]) => !isSite(s), isSite]) {
      db.on("ins_login_attempts", (steps) => {
        if (has(steps, "insert")) return { data: { id: "a1" } };
        if (has(steps, "update") || has(steps, "delete")) return {};
        return broken(steps) ? { error: { message: "timeout" }, count: null } : { count: 0 };
      });
      expect(await signIn(form("015495"))).toEqual(BROKEN);
    }
    expect(who.agentsByCode).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("says the system is down, and starts no session, when the lookup throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    who.agentsByCode.mockRejectedValue(new Error("down"));
    expect(await signIn(form("015495"))).toEqual(BROKEN);
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("asks for six digits before writing or counting anything", async () => {
    expect(await signIn(form("12345"))).toEqual({ error: "กรุณากรอกรหัสตัวแทน 6 หลัก" });
    expect(db.log).toHaveLength(0);
  });
});

describe("signOut", () => {
  it("ends the agent's sessions everywhere, then this browser's", async () => {
    auth.readSession.mockResolvedValue({ agentId: AGENT.id, issuedAt: 1 });
    await signOut();
    expect(epoch.endEverySession).toHaveBeenCalledWith(AGENT.id, expect.any(Date));
    expect(auth.endSession).toHaveBeenCalled();
    expect(nav.redirect).toHaveBeenCalledWith("/");
  });

  it("still signs this browser out when the stamp cannot be written", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    auth.readSession.mockResolvedValue({ agentId: AGENT.id, issuedAt: 1 });
    epoch.endEverySession.mockRejectedValue(new Error("down"));
    await signOut();
    expect(auth.endSession).toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("stamps nothing without a session", async () => {
    auth.readSession.mockResolvedValue(null);
    await signOut();
    expect(epoch.endEverySession).not.toHaveBeenCalled();
    expect(auth.endSession).toHaveBeenCalled();
  });
});
