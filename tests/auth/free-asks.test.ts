import { describe, expect, it } from "vitest";
import { decodeAsks, encodeAsks, FREE_ASKS, inviteToTry } from "@/lib/auth/free-asks";

const KEY = "test-secret";

describe("the free questions' count (owner, 2026-10-01)", () => {
  it("is three", () => {
    expect(FREE_ASKS).toBe(3);
  });

  it("reads back what it wrote", () => {
    for (const n of [0, 1, 2, 3]) expect(decodeAsks(encodeAsks(n, KEY), KEY)).toBe(n);
  });

  it("is none used when there is no cookie yet", () => {
    expect(decodeAsks(undefined, KEY)).toBe(0);
    expect(decodeAsks("", KEY)).toBe(0);
  });

  it("counts a forged or garbled cookie as all used", () => {
    expect(decodeAsks("0.deadbeef", KEY)).toBe(FREE_ASKS);
    expect(decodeAsks(encodeAsks(1, "another-key"), KEY)).toBe(FREE_ASKS);
    expect(decodeAsks("nonsense", KEY)).toBe(FREE_ASKS);
    const signed = encodeAsks(2, KEY);
    expect(decodeAsks(`0${signed.slice(1)}`, KEY)).toBe(FREE_ASKS);
  });
});

describe("the invitation to try Studio on the home page", () => {
  it("shows only to somebody not signed in, while sign-up is open", () => {
    expect(inviteToTry(false, true)).toBe(true);
    expect(inviteToTry(true, true)).toBe(false);
    expect(inviteToTry(false, false)).toBe(false);
    expect(inviteToTry(true, false)).toBe(false);
  });
});
