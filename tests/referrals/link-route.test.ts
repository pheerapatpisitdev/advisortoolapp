import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ inviterOf: vi.fn() }));
vi.mock("@/lib/referrals/store", () => store);
const { GET } = await import("@/app/r/[code]/route");

const ORIGIN = "https://advisortool.example";
const open = (code: string) =>
  GET(new Request(`${ORIGIN}/r/${code}`, { headers: { host: "advisortool.example" } }), { params: Promise.resolve({ code }) });

beforeEach(() => { store.inviterOf.mockReset(); });

describe("an invitation link", () => {
  it("remembers the code for 30 days and goes to the front page", async () => {
    store.inviterOf.mockResolvedValue({ id: "a", kind: "member", name: "สมชาย" });
    const res = await open("somcha7");
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^ref=SOMCHA7;/);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("keeps nothing for a code nobody owns, or one that cannot be one", async () => {
    store.inviterOf.mockResolvedValue(null);
    expect((await open("NOBODY7")).headers.get("set-cookie")).toBeNull();
    expect((await open("x")).headers.get("set-cookie")).toBeNull();
  });

  it("keeps nothing, and still lands on the front page, when the code cannot be read", async () => {
    store.inviterOf.mockImplementation(async () => { throw new Error("db down"); });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await open("SOMCHA7");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
  });
});
