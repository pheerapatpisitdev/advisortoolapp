import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const store = vi.hoisted(() => ({ memberSettings: vi.fn(), signupsFromIp: vi.fn(), memberByPhone: vi.fn(), createMember: vi.fn() }));
vi.mock("@/lib/auth/member-store", () => store);

const { signUp } = await import("@/app/signup/actions");

const form = (over: Record<string, string | null> = {}) => {
  const fields: Record<string, string | null> = { name: "สมชาย", phone: "081-234-5678", pin: "280419", pinAgain: "280419", consent: "on", ...over };
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== null) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  store.memberSettings.mockResolvedValue({ signupOpen: true, contactUrl: null });
  store.signupsFromIp.mockResolvedValue(0);
  store.memberByPhone.mockResolvedValue(null);
  store.createMember.mockResolvedValue({ ok: true, id: "m9" });
});

describe("signUp", () => {
  it("opens an account, signs it in and goes to Studio", async () => {
    expect(await signUp(form())).toBeUndefined();
    const made = store.createMember.mock.calls[0][0];
    expect(made).toMatchObject({ phone: "0812345678", name: "สมชาย", ip: "1.2.3.4" });
    expect(made.pinHash).toMatch(/^scrypt\$/);
    expect(auth.startSession).toHaveBeenCalledWith("m9");
    expect(nav.redirect).toHaveBeenCalledWith("/studio");
  });

  it("takes nobody while the owner has sign-up off", async () => {
    store.memberSettings.mockResolvedValue({ signupOpen: false, contactUrl: null });
    expect(await signUp(form())).toEqual({ error: "ยังไม่เปิดรับสมัคร" });
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("takes three accounts from one address a day", async () => {
    store.signupsFromIp.mockResolvedValue(3);
    expect(await signUp(form())).toEqual({ error: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้" });
    const since = store.signupsFromIp.mock.calls[0][1] as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("says what is wrong with the form before anything is looked up", async () => {
    expect(await signUp(form({ pin: "123456", pinAgain: "123456" }))).toEqual({ error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(await signUp(form({ consent: null }))).toEqual({ error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" });
    expect(store.memberByPhone).not.toHaveBeenCalled();
  });

  it("says a phone already taken, whether seen first or refused by the index", async () => {
    store.memberByPhone.mockResolvedValueOnce({ id: "m1" });
    expect(await signUp(form())).toEqual({ error: "เบอร์นี้สมัครไว้แล้ว", taken: true });
    store.createMember.mockResolvedValueOnce({ ok: false, taken: true });
    expect(await signUp(form())).toEqual({ error: "เบอร์นี้สมัครไว้แล้ว", taken: true });
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("says the system failed, without its words, when the database does", async () => {
    store.createMember.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await signUp(form())).toEqual({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" });
  });
});
