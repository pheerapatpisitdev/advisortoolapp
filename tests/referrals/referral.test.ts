import { describe, expect, it } from "vitest";
import { cleanCode, friendStatus, newCode, referralLink, shortName, tally, type FriendView } from "@/lib/referrals/referral";

describe("an invitation code", () => {
  it("is read in any case, as the address bar may have lowered it", () => {
    expect(cleanCode("somcha7")).toBe("SOMCHA7");
    expect(cleanCode(" AB23CD9 ")).toBe("AB23CD9");
  });

  it("is refused when it cannot be one", () => {
    for (const raw of ["", "abc", "a-b-c-d-e", "ABCDEFGHIJKLM", "ส้มตำ1234", null, undefined, 42]) expect(cleanCode(raw)).toBeNull();
  });

  it("is drawn without the letters people misread", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = newCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
      seen.add(c);
    }
    expect(seen.size).toBeGreaterThan(190);
  });

  it("makes the link the card shows", () => {
    expect(referralLink("https://www.advisortool.app/", "SOMCHA7")).toBe("https://www.advisortool.app/r/SOMCHA7");
  });
});

describe("a friend's name on the inviter's card", () => {
  it("is the first name and the first letter of the rest", () => {
    expect(shortName("มานี สุขใจ")).toBe("มานี ส.");
    expect(shortName("  Somchai   Jaidee ")).toBe("Somchai J.");
    expect(shortName("วีระ")).toBe("วีระ");
    expect(shortName("")).toBe("เพื่อน");
    expect(shortName(null)).toBe("เพื่อน");
  });
});

describe("where a friend stands", () => {
  const base = { rewardedAt: null, revokedAt: null, rewardDays: null, rewardSatang: null, pass: null };
  it("reads the reward first, then the friend's own pass", () => {
    expect(friendStatus({ ...base, rewardedAt: "2026-10-10", rewardDays: 3 })).toBe("rewarded");
    expect(friendStatus({ ...base, rewardedAt: "2026-10-10", rewardSatang: 1000 })).toBe("rewarded");
    expect(friendStatus({ ...base, rewardedAt: "2026-10-10", rewardDays: 0 })).toBe("capped");
    expect(friendStatus({ ...base, rewardedAt: "2026-10-10", rewardDays: 3, revokedAt: "2026-10-11" })).toBe("revoked");
    expect(friendStatus({ ...base, pass: "live" })).toBe("trial");
    expect(friendStatus({ ...base, pass: "expired" })).toBe("lapsed");
    expect(friendStatus({ ...base, pass: "none" })).toBe("waiting");
    expect(friendStatus(base)).toBe("waiting");
  });

  it("counts the friends who paid and what they brought", () => {
    const f = (status: FriendView["status"], reward = 0): FriendView => ({ name: "x", status, rewardedAt: null, reward });
    expect(tally([f("rewarded", 3), f("rewarded", 3), f("capped"), f("trial"), f("revoked", 3)])).toEqual({ joined: 5, paid: 3, reward: 6 });
    expect(tally([])).toEqual({ joined: 0, paid: 0, reward: 0 });
  });
});
