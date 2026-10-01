import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPin } from "@/lib/auth/member";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
vi.mock("@/lib/auth/viewer", () => ({ agentsByCode: vi.fn(), staffRow: vi.fn() }));
const store = vi.hoisted(() => ({ memberByPhone: vi.fn(), phoneFailures: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db, has, type Step } from "../helpers/fake-db";
const { memberSignIn } = await import("@/app/login/actions");

const form = (phone: string, pin: string, next = "/studio/write") => {
  const fd = new FormData();
  fd.set("phone", phone);
  fd.set("pin", pin);
  fd.set("next", next);
  return fd;
};
let STORED = "";

/** the attempts table: the claim insert answers with an id, the count with `count` (this attempt included) */
const answerAttempts = (count: number | ((steps: Step[]) => number)) =>
  db.on("ins_login_attempts", (steps) => {
    if (has(steps, "insert")) return { data: { id: "a1" } };
    if (has(steps, "update") || has(steps, "delete")) return {};
    return { count: typeof count === "function" ? count(steps) : count };
  });

beforeEach(async () => {
  vi.clearAllMocks();
  db.reset();
  answerAttempts(0);
  store.phoneFailures.mockResolvedValue(0);
  STORED ||= await hashPin("280419");
  store.memberByPhone.mockResolvedValue({ id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, pin_hash: STORED });
});

const attempts = () => db.writes("ins_login_attempts", "insert").map((s) => s[0].args[0]);
const claimed = { ip: "1.2.3.4", ok: false, phone: "0812345678" };

describe("memberSignIn", () => {
  it("signs a member in with their phone however typed, and goes on", async () => {
    expect(await memberSignIn(form("081-234-5678", "280419"))).toBeUndefined();
    expect(store.memberByPhone).toHaveBeenCalledWith("0812345678");
    expect(auth.startSession).toHaveBeenCalledWith("m1");
    expect(nav.redirect).toHaveBeenCalledWith("/studio/write");
    expect(attempts()).toEqual([claimed]);
    const updates = db.writes("ins_login_attempts", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0][0].args[0]).toEqual({ ok: true });
    expect(has(updates[0], "eq", "id", "a1")).toBe(true);
  });

  it("gives one answer for a wrong PIN, an unknown phone and a suspended member", async () => {
    answerAttempts(1);
    store.phoneFailures.mockResolvedValue(1);
    const wrong = await memberSignIn(form("0812345678", "280418"));
    store.memberByPhone.mockResolvedValueOnce(null);
    const unknown = await memberSignIn(form("0899999999", "280419"));
    store.memberByPhone.mockResolvedValueOnce({ id: "m1", phone: "0812345678", name: "ก", status: "suspended", pin_changed_at: null, pin_hash: STORED });
    const suspended = await memberSignIn(form("0812345678", "280419"));
    for (const r of [wrong, unknown, suspended]) expect(r).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 4 ครั้ง" });
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(attempts().every((a) => (a as { ok: boolean }).ok === false)).toBe(true);
    expect(db.writes("ins_login_attempts", "update")).toHaveLength(0);
  });

  it("counts down by whichever of the address and the phone is nearer its limit", async () => {
    answerAttempts(1);
    store.phoneFailures.mockResolvedValue(4);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 1 ครั้ง" });
    store.phoneFailures.mockResolvedValue(5);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง ถูกระงับชั่วคราว" });
  });

  it("makes a phone with five wrong PINs wait, from any address, without looking it up", async () => {
    store.phoneFailures.mockResolvedValue(6);
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "เบอร์นี้กรอก PIN ผิดหลายครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    expect(db.writes("ins_login_attempts", "delete")).toHaveLength(1);
  });

  it("makes an address with five failures wait, as the agent code does", async () => {
    answerAttempts((steps) => (has(steps, "eq", "ip", "1.2.3.4") ? 6 : 0));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "กรอกผิดเกิน 5 ครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    const deletes = db.writes("ins_login_attempts", "delete");
    expect(deletes).toHaveLength(1);
    expect(has(deletes[0], "eq", "id", "a1")).toBe(true);
  });

  it("does not let a burst through: the address count includes the attempt, so a sixth is refused unverified", async () => {
    answerAttempts(6);
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "กรอกผิดเกิน 5 ครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    expect(db.writes("ins_login_attempts", "delete")).toHaveLength(1);
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("stops at the fifth wrong PIN being told so, and refuses the sixth", async () => {
    answerAttempts(5);
    store.phoneFailures.mockResolvedValue(5);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง ถูกระงับชั่วคราว" });
    expect(store.memberByPhone).toHaveBeenCalled();
  });

  it("fails closed when the attempt cannot be recorded, looking nothing up", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.on("ins_login_attempts", (steps) => (has(steps, "insert") ? { error: { message: "down" } } : { count: 0 }));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    expect(store.phoneFailures).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("fails closed when the address's count cannot be read (review, 2026-10-01)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.on("ins_login_attempts", (steps) => (has(steps, "insert") ? { data: { id: "a1" } } : { error: { message: "timeout" }, count: null }));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("says the system is down, and starts no session, when a lookup throws after the claim", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.memberByPhone.mockRejectedValueOnce(new Error("down"));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" });
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("writes the claim before it counts the phone or the address", async () => {
    const order: string[] = [];
    db.on("ins_login_attempts", (steps) => {
      if (has(steps, "insert")) { order.push("claim"); return { data: { id: "a1" } }; }
      if (has(steps, "update") || has(steps, "delete")) return {};
      order.push("ip count");
      return { count: 0 };
    });
    store.phoneFailures.mockImplementation(async () => { order.push("phone count"); return 0; });
    await memberSignIn(form("0812345678", "280419"));
    expect(order.slice(0, 3)).toEqual(["claim", "ip count", "phone count"]);
  });

  it("asks for a phone and a PIN before looking anything up", async () => {
    expect(await memberSignIn(form("0812", "280419"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(await memberSignIn(form("0812345678", "28041"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
    expect(db.writes("ins_login_attempts", "insert")).toHaveLength(0);
  });
});
