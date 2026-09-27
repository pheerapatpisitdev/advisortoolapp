import { describe, it, expect, beforeEach, vi } from "vitest";

/** A minimal cookie jar standing in for Next's cookies() during these tests. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const SECRET = "test-secret";
process.env.ADMIN_SESSION_SECRET = SECRET;

const { encodeSession, decodeSession, readSession, startSession, endSession, SESSION_COOKIE } = await import("@/lib/auth/session");

const AGENT = "3f1c2b1e-7a52-4d8f-9a4b-0c7d7e2b9a11";

describe("session cookie", () => {
  beforeEach(() => jar.clear());

  it("reads back what it wrote", () => {
    const raw = encodeSession(AGENT, 1000, 5000, SECRET);
    expect(decodeSession(raw, SECRET, 2000)).toEqual({ agentId: AGENT, issuedAt: 1000 });
  });

  it("refuses an expired one", () => {
    const raw = encodeSession(AGENT, 1000, 5000, SECRET);
    expect(decodeSession(raw, SECRET, 5001)).toBeNull();
  });

  it("refuses a changed signature", () => {
    const raw = encodeSession(AGENT, 1000, 5000, SECRET);
    expect(decodeSession(raw.slice(0, -2) + "00", SECRET, 2000)).toBeNull();
  });

  it("refuses somebody else's agent id under the same signature", () => {
    const raw = encodeSession(AGENT, 1000, 5000, SECRET);
    const other = raw.replace(AGENT, "00000000-0000-0000-0000-000000000000");
    expect(decodeSession(other, SECRET, 2000)).toBeNull();
  });

  it("refuses a later expiry under the same signature", () => {
    const raw = encodeSession(AGENT, 1000, 5000, SECRET);
    const [id, issued, , mac] = raw.split(".");
    expect(decodeSession(`${id}.${issued}.99999999999999.${mac}`, SECRET, 2000)).toBeNull();
  });

  it("refuses one signed with another secret", () => {
    const raw = encodeSession(AGENT, 1000, 5000, "other");
    expect(decodeSession(raw, SECRET, 2000)).toBeNull();
  });

  it("refuses rubbish", () => {
    for (const raw of ["", "a.b", "a.b.c.d.e", `${AGENT}.x.y.z`, "....."]) {
      expect(decodeSession(raw, SECRET, 2000)).toBeNull();
    }
  });

  it("starts, reads and ends a session through the cookie", async () => {
    await startSession(AGENT);
    expect(jar.has(SESSION_COOKIE)).toBe(true);
    expect((await readSession())?.agentId).toBe(AGENT);
    await endSession();
    expect(await readSession()).toBeNull();
  });
});
