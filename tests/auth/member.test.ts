import { describe, expect, it } from "vitest";
import { cleanName, hashPin, normalizePhone, pinProblem, readSignup, verifyPin, weakPin } from "@/lib/auth/member";

describe("normalizePhone", () => {
  it("normalizes the ways a Thai mobile is written", () => {
    for (const raw of ["0812345678", "081-234-5678", "081 234 5678", "(081) 234.5678", "+66812345678", "+66 81-234-5678", "66812345678"]) {
      expect(normalizePhone(raw)).toBe("0812345678");
    }
  });

  it("refuses what is not ten digits starting with 0", () => {
    for (const raw of ["", "081234567", "08123456789", "1812345678", "08123x5678", null, 812345678]) {
      expect(normalizePhone(raw)).toBeNull();
    }
  });
});

describe("the PIN", () => {
  it("is six digits", () => {
    expect(pinProblem("12345")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("1234567")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("12a456")).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem(undefined)).toBe("PIN ต้องเป็นตัวเลข 6 หลัก");
    expect(pinProblem("280419")).toBeNull();
  });

  it("must be typed the same twice when asked twice", () => {
    expect(pinProblem("280419", "280418")).toBe("PIN สองช่องไม่ตรงกัน");
    expect(pinProblem("280419", "280419")).toBeNull();
  });

  it("refuses one digit repeated and runs up or down", () => {
    for (const pin of ["000000", "999999", "012345", "123456", "456789", "987654", "543210"]) {
      expect(weakPin(pin)).toBe(true);
      expect(pinProblem(pin)).toBe("PIN นี้เดาง่ายเกินไป ลองตั้งใหม่");
    }
    for (const pin of ["280419", "112233", "135790"]) expect(weakPin(pin)).toBe(false);
  });

  it("is hashed, and only the same PIN verifies", async () => {
    const stored = await hashPin("280419");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain("280419");
    expect(await verifyPin("280419", stored)).toBe(true);
    expect(await verifyPin("280418", stored)).toBe(false);
    expect(await hashPin("280419")).not.toBe(stored);
  });

  it("does not verify against a hash it cannot read", async () => {
    expect(await verifyPin("280419", "")).toBe(false);
    expect(await verifyPin("280419", "plain$280419")).toBe(false);
    expect(await verifyPin("280419", "scrypt$16384$8$1$AAAA")).toBe(false);
  });

  it("answers false, not a throw, for a hash whose cost scrypt refuses", async () => {
    const salt = Buffer.from("saltsaltsaltsalt").toString("base64");
    const hash = Buffer.alloc(32, 1).toString("base64");
    // N must be a power of two
    expect(await verifyPin("280419", `scrypt$3$8$1$${salt}$${hash}`)).toBe(false);
    // far over the memory limit: refused at once rather than hanging the request
    expect(await verifyPin("280419", `scrypt$${2 ** 30}$8$1$${salt}$${hash}`)).toBe(false);
  });
});

describe("cleanName", () => {
  it("trims, and takes 1 to 60 characters", () => {
    expect(cleanName("  สมชาย ใจดี  ")).toBe("สมชาย ใจดี");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("ก".repeat(61))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe("readSignup", () => {
  const good = { name: "สมชาย", phone: "081-234-5678", pin: "280419", pinAgain: "280419", consent: "on" };

  it("takes a complete form", () => {
    expect(readSignup(good)).toEqual({ ok: true, name: "สมชาย", phone: "0812345678", pin: "280419" });
  });

  it("names the first thing wrong", () => {
    expect(readSignup({ ...good, name: " " })).toEqual({ ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" });
    expect(readSignup({ ...good, phone: "0812" })).toEqual({ ok: false, error: "กรุณากรอกเบอร์มือถือ 10 หลัก" });
    expect(readSignup({ ...good, pinAgain: "280418" })).toEqual({ ok: false, error: "PIN สองช่องไม่ตรงกัน" });
    expect(readSignup({ ...good, pin: "123456", pinAgain: "123456" })).toEqual({ ok: false, error: "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่" });
    expect(readSignup({ ...good, consent: null })).toEqual({ ok: false, error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" });
  });
});
