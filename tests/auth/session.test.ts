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

const { encodeSession, decodeSession, readSession, startSession, endSession, SESSION_COOKIE, LEGACY_SIGNED_BEFORE } = await import("@/lib/auth/session");
const { deriveKey } = await import("@/lib/auth/keys");

const AGENT = "3f1c2b1e-7a52-4d8f-9a4b-0c7d7e2b9a11";

describe("session cookie", () => {
  beforeEach(() => {
    jar.clear();
    delete process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET_PREVIOUS;
  });

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

/**
 * The session signs with a key of its own, derived from its secret, and the secret can be
 * rotated (review, 2026-10-01) — without signing out everybody whose cookie was signed the old way.
 */
describe("the session's key", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const before = LEGACY_SIGNED_BEFORE - DAY;
  const put = (raw: string) => void jar.set(SESSION_COOKIE, raw);

  beforeEach(() => {
    jar.clear();
    delete process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET_PREVIOUS;
    vi.useRealTimers();
  });

  it("is derived from ADMIN_SESSION_SECRET, not the secret itself", async () => {
    await startSession(AGENT);
    const raw = jar.get(SESSION_COOKIE)!;
    const [, issued, expires] = raw.split(".");
    expect(decodeSession(raw, deriveKey(SECRET, "session"), Number(issued))).not.toBeNull();
    expect(decodeSession(raw, SECRET, Number(issued))).toBeNull();
    expect(Number(expires) - Number(issued)).toBe(7 * DAY);
  });

  it("still reads a cookie signed the old way, issued before the change, for its seven days", async () => {
    vi.useFakeTimers({ now: before + DAY });
    put(encodeSession(AGENT, before, before + 7 * DAY, SECRET));
    expect(await readSession()).toEqual({ agentId: AGENT, issuedAt: before });
  });

  it("does not read an old-way cookie issued after the change, or one that asks for longer than seven days", async () => {
    const after = LEGACY_SIGNED_BEFORE + 1000;
    vi.useFakeTimers({ now: after + 1000 });
    put(encodeSession(AGENT, after, after + 7 * DAY, SECRET));
    expect(await readSession()).toBeNull();
    // whoever holds the raw secret could backdate the issue and stretch the expiry
    put(encodeSession(AGENT, before, after + 365 * DAY, SECRET));
    expect(await readSession()).toBeNull();
  });

  it("signs with SESSION_SECRET once it is set, and drops the old-way cookies with it", async () => {
    process.env.SESSION_SECRET = "rotated";
    await startSession(AGENT);
    const raw = jar.get(SESSION_COOKIE)!;
    expect(decodeSession(raw, deriveKey("rotated", "session"), Date.now())).not.toBeNull();
    expect((await readSession())?.agentId).toBe(AGENT);

    vi.useFakeTimers({ now: before + DAY });
    put(encodeSession(AGENT, before, before + 7 * DAY, SECRET));
    expect(await readSession()).toBeNull();
  });

  it("reads cookies of the previous secret while SESSION_SECRET_PREVIOUS names it, and only then", async () => {
    const now = Date.now();
    const old = encodeSession(AGENT, now, now + DAY, deriveKey(SECRET, "session"));
    process.env.SESSION_SECRET = "rotated";
    put(old);
    expect(await readSession()).toBeNull();
    process.env.SESSION_SECRET_PREVIOUS = SECRET;
    expect((await readSession())?.agentId).toBe(AGENT);
    // and new cookies are never signed with the previous one
    await startSession(AGENT);
    expect(decodeSession(jar.get(SESSION_COOKIE)!, deriveKey(SECRET, "session"), Date.now())).toBeNull();
  });

  it("gives each cookie a key of its own", () => {
    const keys = (["session", "free-asks", "oauth-state"] as const).map((p) => deriveKey(SECRET, p));
    expect(new Set(keys).size).toBe(3);
    expect(keys).not.toContain(SECRET);
  });
});
