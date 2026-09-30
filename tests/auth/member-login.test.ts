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

import { db, has } from "../helpers/fake-db";
const { memberSignIn } = await import("@/app/login/actions");

const form = (phone: string, pin: string, next = "/studio/write") => {
  const fd = new FormData();
  fd.set("phone", phone);
  fd.set("pin", pin);
  fd.set("next", next);
  return fd;
};
let STORED = "";

beforeEach(async () => {
  vi.clearAllMocks();
  db.reset();
  db.on("ins_login_attempts", { count: 0 });
  store.phoneFailures.mockResolvedValue(0);
  STORED ||= await hashPin("280419");
  store.memberByPhone.mockResolvedValue({ id: "m1", phone: "0812345678", name: "สมชาย", status: "active", pin_changed_at: null, pin_hash: STORED });
});

const attempts = () => db.writes("ins_login_attempts", "insert").map((s) => s[0].args[0]);

describe("memberSignIn", () => {
  it("signs a member in with their phone however typed, and goes on", async () => {
    expect(await memberSignIn(form("081-234-5678", "280419"))).toBeUndefined();
    expect(store.memberByPhone).toHaveBeenCalledWith("0812345678");
    expect(auth.startSession).toHaveBeenCalledWith("m1");
    expect(nav.redirect).toHaveBeenCalledWith("/studio/write");
    expect(attempts()).toEqual([{ ip: "1.2.3.4", ok: true, phone: "0812345678" }]);
  });

  it("gives one answer for a wrong PIN, an unknown phone and a suspended member", async () => {
    const wrong = await memberSignIn(form("0812345678", "280418"));
    store.memberByPhone.mockResolvedValueOnce(null);
    const unknown = await memberSignIn(form("0899999999", "280419"));
    store.memberByPhone.mockResolvedValueOnce({ id: "m1", phone: "0812345678", name: "ก", status: "suspended", pin_changed_at: null, pin_hash: STORED });
    const suspended = await memberSignIn(form("0812345678", "280419"));
    for (const r of [wrong, unknown, suspended]) expect(r).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 4 ครั้ง" });
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(attempts().every((a) => (a as { ok: boolean }).ok === false)).toBe(true);
  });

  it("counts down by whichever of the address and the phone is nearer its limit", async () => {
    store.phoneFailures.mockResolvedValue(3);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก 1 ครั้ง" });
    store.phoneFailures.mockResolvedValue(4);
    expect(await memberSignIn(form("0812345678", "280418"))).toEqual({ error: "เบอร์หรือ PIN ไม่ถูกต้อง ถูกระงับชั่วคราว" });
  });

  it("makes a phone with five wrong PINs wait, from any address, without looking it up", async () => {
    store.phoneFailures.mockResolvedValue(5);
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "เบอร์นี้กรอก PIN ผิดหลายครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("makes an address with five failures wait, as the agent code does", async () => {
    db.on("ins_login_attempts", (steps) => ({ count: has(steps, "eq", "ip", "1.2.3.4") ? 5 : 0 }));
    expect(await memberSignIn(form("0812345678", "280419"))).toEqual({ error: "กรอกผิดเกิน 5 ครั้ง กรุณารออีก 15 นาที" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("asks for a phone and a PIN before looking anything up", async () => {
    expect(await memberSignIn(form("0812", "280419"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(await memberSignIn(form("0812345678", "28041"))).toEqual({ error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });
});
