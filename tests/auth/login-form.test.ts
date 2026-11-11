import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/login/actions", () => ({ signIn: vi.fn() }));
const { LoginForm } = await import("@/app/login/LoginForm");

const draw = (signupOpen: boolean, error: string | null = null) =>
  renderToStaticMarkup(createElement(LoginForm, { next: "/studio", signupOpen, error }));

/** the member tab, open because Google sent somebody back with a reason */
const drawMember = (signupOpen: boolean) => draw(signupOpen, "ลองใหม่อีกครั้ง");

describe("LoginForm's first tab", () => {
  it("is the UnitOS agent's, sign-up open or not (owner, 2026-11-11)", () => {
    for (const open of [true, false]) {
      const html = draw(open);
      expect(html).toContain('id="login-code"');
      expect(html).not.toContain("ดำเนินการต่อด้วย Google");
    }
  });

  it("is the member's whenever Google sent somebody back with a reason, so they read it", () => {
    const html = draw(false, "ยังไม่เปิดรับสมัคร");
    expect(html).toContain("ดำเนินการต่อด้วย Google");
    expect(html).toContain("ยังไม่เปิดรับสมัคร");
  });
});

describe("LoginForm's member tab (owner, 2026-10-02)", () => {
  it("is one Google button, a plain link that works before the page hydrates", () => {
    const html = drawMember(true);
    expect(html).toMatch(/<a[^>]*href="\/auth\/google\?next=%2Fstudio"[^>]*>[\s\S]*ดำเนินการต่อด้วย Google<\/a>/);
    expect(html).not.toContain("PIN");
    expect(html).not.toContain("เบอร์มือถือ");
  });

  it("tells newcomers the same button signs them up, only while sign-up is open", () => {
    expect(drawMember(true)).toContain("กดปุ่มนี้แล้วกรอกข้อมูลสั้นๆ");
    // the trial's own words come from the back office, through the door (src/lib/pricing/front.ts)
    expect(drawMember(true)).not.toContain("10 รอบ");
    expect(draw(false, "x")).not.toContain("เพื่อสมัคร");
  });

  it("says that going on accepts the privacy policy", () => {
    expect(drawMember(true)).toMatch(/ยอมรับ[\s\S]*href="\/privacy"/);
  });
});

describe("LoginForm's look (owner, 2026-10-01)", () => {
  it("never puts Thai words in the widely spaced code box, where the vowels came apart", () => {
    for (const placeholder of draw(false).match(/placeholder="[^"]*"/g) ?? []) {
      expect(placeholder).toBe('placeholder="••••••"');
    }
  });

  it("says under each tab who it is for", () => {
    expect(drawMember(true)).toContain("บัญชี Google");
    expect(draw(false)).toContain("รหัสเดียวกับที่ใช้เข้า UnitOS");
  });

  it("wears the site's mark and does not repeat เข้าสู่ระบบ as its heading", () => {
    const html = drawMember(true);
    expect(html).toContain('src="/mark.png"');
    expect(html).toMatch(/<h1[^>]*>ยินดีต้อนรับสู่ advisortool<\/h1>/);
  });
});

describe("LoginForm without the how-to video (owner, 2026-10-18: removed, option ก)", () => {
  it("shows no video card on either tab", () => {
    for (const open of [true, false]) {
      const html = draw(open);
      expect(html).not.toContain("ดูวิธีสมัครและใช้งาน");
      expect(html).not.toContain("/videos/signup-demo");
    }
  });
});
