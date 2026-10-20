import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The plan calculators are for members only, trial included (owner, 2026-10-20; mockup
 * QEphNuJbqufEhqVJzRKrcC, ก ก ก). The gate itself is tested with the pass in
 * tests/members/gates.test.ts; here, that every page has it, the printer's pass, the one server
 * action, and the price list the front page shows.
 */

const auth = vi.hoisted(() => ({ viewer: null as unknown, printing: false }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => auth.viewer }));
vi.mock("@/lib/auth/print-pass", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/print-pass")>()),
  printing: async () => auth.printing,
}));

const { CALC_PATHS, isCalcPath } = await import("@/lib/auth/calc-paths");
const { printPassFor, validPrintPass } = await import("@/lib/auth/print-pass");
const { priceWithRiders } = await import("@/app/ihealthy-ultra/actions");
const { frontPricesOf, signupHint } = await import("@/lib/pricing/front");
const { PriceList } = await import("@/components/auth/PriceList");
const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");
const { DEFAULT_REFERRAL_SETTINGS } = await import("@/lib/referrals/referral");

const APP = path.resolve(__dirname, "../../src/app");

afterEach(() => {
  auth.viewer = null;
  auth.printing = false;
  vi.unstubAllEnvs();
});

describe("the calculator pages", () => {
  for (const p of CALC_PATHS.filter((p) => p !== "/fhc")) {
    it(`${p} asks gateCalc for itself first`, () => {
      const page = readFileSync(path.join(APP, p, "page.tsx"), "utf8");
      expect(page).toContain(`await gateCalc("${p}");`);
    });
  }

  it("/fhc keeps its own signed-in gate", () => {
    expect(readFileSync(path.join(APP, "fhc/page.tsx"), "utf8")).toContain('await gatePage("/fhc")');
  });

  it("are known by path, query and trailing parts included", () => {
    expect(isCalcPath("/lifeprotect")).toBe(true);
    expect(isCalcPath("/ihealthy-ultra?age=35&plan=GOLD")).toBe(true);
    expect(isCalcPath("/iShield/")).toBe(true);
    expect(isCalcPath("/fhc/customers")).toBe(true);
    expect(isCalcPath("/privacy")).toBe(false);
    expect(isCalcPath("/lifeprotector")).toBe(false);
    expect(isCalcPath("/api/quote-pdf?page=plb")).toBe(false);
  });
});

describe("the PDF printer's pass", () => {
  it("is good for two minutes and no longer", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "s1");
    const now = Date.parse("2026-10-20T10:00:00Z");
    const pass = printPassFor(now);
    expect(validPrintPass(pass, now)).toBe(true);
    expect(validPrintPass(pass, now + 119_000)).toBe(true);
    expect(validPrintPass(pass, now + 121_000)).toBe(false);
  });

  it("is refused when written by anybody else", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "s1");
    const now = Date.now();
    const pass = printPassFor(now);
    const [exp, sig] = pass.split(".");
    expect(validPrintPass(undefined, now)).toBe(false);
    expect(validPrintPass(`${Number(exp) + 1}.${sig}`, now)).toBe(false);
    expect(validPrintPass(`${exp}.${sig.slice(1)}0`, now)).toBe(false);
    expect(validPrintPass(`${exp}.${sig}.x`, now)).toBe(false);
    // a far-off expiry is refused even when signed: nothing this deploy makes lasts that long
    vi.stubEnv("ADMIN_SESSION_SECRET", "s2");
    expect(validPrintPass(pass, now)).toBe(false);
    expect(validPrintPass(printPassFor(now + 60 * 60 * 1000), now)).toBe(false);
  });
});

describe("priceWithRiders", () => {
  const input = { age: 35, sex: "M", plan: "GOLD", riders: [] } as unknown as Parameters<typeof priceWithRiders>[0];

  it("refuses somebody not signed in", async () => {
    await expect(priceWithRiders(input)).rejects.toThrow("กรุณาเข้าสู่ระบบก่อน");
  });

  it("answers a member, and our PDF printer", async () => {
    auth.viewer = { kind: "member", agentId: "m1" };
    await expect(priceWithRiders(input)).resolves.toBeDefined();
    auth.viewer = null;
    auth.printing = true;
    await expect(priceWithRiders(input)).resolves.toBeDefined();
  });
});

describe("ค่าบริการ on the front page", () => {
  const prod = frontPricesOf({
    pass: { enabled: true, satang: 19900, trialDays: 3, trialCreditSatang: 1500, creditSatang: 5000 },
    referral: { ...DEFAULT_REFERRAL_SETTINGS, enabled: true, days: 3 },
    agentStarterSatang: 1500,
    walletOn: true,
  });
  const html = renderToStaticMarkup(createElement(PriceList, { prices: prod }));

  it("says both packages with the back office's figures", () => {
    expect(html).toContain("สมาชิกทั่วไป");
    expect(html).toContain("ตัวแทน UnitOS");
    expect(html).toContain("฿199");
    expect(html).toContain("3 วัน");
    expect(html).toContain("เครดิต Studio ฿15 ไว้ลองทำโพสต์ รูป คลิป");
    expect(html).toContain("เครดิต Studio ฿50 ทุกครั้งที่ต่ออายุ");
    expect(html).toContain("เครดิตเริ่มต้น Studio ฿15 ครั้งเดียว ไม่มีวันหมดอายุ");
    expect(html).toContain("ชวนเพื่อนสมัคร ได้เพิ่ม 3 วันต่อคน");
    expect(html).toContain("เครื่องคิดเบี้ยทุกแบบประกัน");
  });

  it("lists the top-ups, and no per-item prices (owner took them out)", () => {
    for (const n of ["฿50", "฿100", "฿150", "฿200", "฿500"]) expect(html).toContain(`>${n}<`);
    expect(html).not.toContain("ราคาต่อชิ้น");
    expect(html).not.toContain("วาดรูป");
  });

  it("leaves out what is switched off", () => {
    const off = renderToStaticMarkup(createElement(PriceList, {
      prices: frontPricesOf({ pass: DEFAULT_PASS_SETTINGS, referral: null, agentStarterSatang: null, walletOn: false }),
    }));
    expect(off).toContain("สมัครสมาชิก");
    expect(off).not.toContain("รายเดือน");
    expect(off).not.toContain("เติมเงิน");
    expect(off).not.toContain("เครดิตเริ่มต้น");
  });

  it("tells a newcomer about the trial only while there is one", () => {
    expect(signupHint(prod.member)).toBe("ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร ทดลองฟรี 3 วัน");
    expect(signupHint({ ...prod.member, trialDays: 0 })).toBe("ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร");
    expect(signupHint({ ...prod.member, paid: false })).toBe("ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร");
  });
});
