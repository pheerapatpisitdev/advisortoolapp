import { describe, expect, it } from "vitest";
import { superFromRow } from "@/lib/auth/google-super";

describe("whether a Google account is the Super Admin (owner, 2026-10-15)", () => {
  const row = { id: "s1", email: "boss@gmail.com", google_sub: null, revoked_at: null };

  it("turns away an address nobody listed", () => {
    expect(superFromRow(null, { sub: "g-1" })).toEqual({ ok: false, error: "denied" });
  });

  it("lets a listed address in, tying it to this Google account the first time", () => {
    expect(superFromRow(row, { sub: "g-1" })).toEqual({ ok: true, id: "s1", bind: true });
    expect(superFromRow({ ...row, google_sub: "g-1" }, { sub: "g-1" })).toEqual({ ok: true, id: "s1", bind: false });
  });

  it("turns away another Google account that now holds the same address", () => {
    expect(superFromRow({ ...row, google_sub: "g-1" }, { sub: "g-2" })).toEqual({ ok: false, error: "denied" });
  });

  it("turns away a revoked Super Admin", () => {
    expect(superFromRow({ ...row, revoked_at: "2026-10-15T00:00:00Z" }, { sub: "g-1" })).toEqual({ ok: false, error: "denied" });
  });
});
