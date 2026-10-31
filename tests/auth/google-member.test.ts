import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  memberByGoogleSub: vi.fn(), setEmail: vi.fn(), memberSettings: vi.fn(), signupsFromIp: vi.fn(),
  createMember: vi.fn(), deleteMember: vi.fn(),
}));
vi.mock("@/lib/auth/member-store", () => store);

const { memberFromGoogle } = await import("@/lib/auth/google-member");

const user = { sub: "g-1", email: "somchai@gmail.com", name: "  สมชาย   ใจดี " };
const row = (over = {}) => ({ id: "m1", google_sub: "g-1", email: "somchai@gmail.com", name: "สมชาย", status: "active", revoked_at: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  store.memberByGoogleSub.mockResolvedValue(null);
  store.memberSettings.mockResolvedValue({ signupOpen: true });
  store.signupsFromIp.mockResolvedValue(0);
  store.createMember.mockResolvedValue({ ok: true, id: "m9" });
});

describe("memberFromGoogle", () => {
  it("lets a member back in, whether or not sign-up is open", async () => {
    store.memberByGoogleSub.mockResolvedValue(row());
    store.memberSettings.mockResolvedValue({ signupOpen: false });
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: true, id: "m1" });
    expect(store.createMember).not.toHaveBeenCalled();
    expect(store.setEmail).not.toHaveBeenCalled();
  });

  it("keeps the email up to date when Google's has changed", async () => {
    store.memberByGoogleSub.mockResolvedValue(row({ email: "old@gmail.com" }));
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: true, id: "m1" });
    expect(store.setEmail).toHaveBeenCalledWith("m1", "somchai@gmail.com");
  });

  it("keeps a suspended member out", async () => {
    store.memberByGoogleSub.mockResolvedValue(row({ status: "suspended" }));
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: false, error: "suspended" });
  });

  it("opens an account for somebody new, named as Google names them", async () => {
    store.signupsFromIp.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: true, id: "m9" });
    expect(store.createMember).toHaveBeenCalledWith({ googleSub: "g-1", email: "somchai@gmail.com", name: "สมชาย ใจดี", ip: "1.2.3.4" });
    expect(store.deleteMember).not.toHaveBeenCalled();
  });

  it("names somebody Google gives no name by their email", async () => {
    await memberFromGoogle({ ...user, name: "" }, "1.2.3.4");
    expect(store.createMember.mock.calls[0][0].name).toBe("somchai");
  });

  it("opens nothing while the owner has sign-up off", async () => {
    store.memberSettings.mockResolvedValue({ signupOpen: false });
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: false, error: "closed" });
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("opens no more than three a day from one address", async () => {
    store.signupsFromIp.mockResolvedValue(3);
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: false, error: "limit" });
    expect(store.createMember).not.toHaveBeenCalled();
  });

  it("takes back an account a burst opened past the limit", async () => {
    store.signupsFromIp.mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: false, error: "limit" });
    expect(store.deleteMember).toHaveBeenCalledWith("m9");
  });

  it("signs in the account another tab opened a moment before", async () => {
    store.memberByGoogleSub.mockResolvedValueOnce(null).mockResolvedValueOnce(row({ id: "m7" }));
    store.createMember.mockResolvedValue({ ok: false, taken: true });
    expect(await memberFromGoogle(user, "1.2.3.4")).toEqual({ ok: true, id: "m7" });
  });
});
