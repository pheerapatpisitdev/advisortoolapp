import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/login/actions", () => ({ signIn: vi.fn() }));
const { LoginForm } = await import("@/app/login/LoginForm");

const draw = (signupOpen: boolean, error: string | null = null) =>
  renderToStaticMarkup(createElement(LoginForm, { next: "/studio", signupOpen, error }));

describe("LoginForm's first tab", () => {
  it("is the member's while sign-up is open", () => {
    const html = draw(true);
    expect(html).toContain("ดำเนินการต่อด้วย Google");
    expect(html).not.toContain('id="login-code"');
  });

  it("is the UnitOS agent's while sign-up is off, so nobody is sent to a tab that cannot be joined", () => {
    const html = draw(false);
    expect(html).toContain('id="login-code"');
    expect(html).not.toContain("ดำเนินการต่อด้วย Google");
  });

  it("is the member's whenever Google sent somebody back with a reason, so they read it", () => {
    const html = draw(false, "ยังไม่เปิดรับสมัคร");
    expect(html).toContain("ดำเนินการต่อด้วย Google");
    expect(html).toContain("ยังไม่เปิดรับสมัคร");
  });
});

describe("LoginForm's member tab (owner, 2026-10-02)", () => {
  it("is one Google button, a plain link that works before the page hydrates", () => {
    const html = draw(true);
    expect(html).toMatch(/<a[^>]*href="\/auth\/google\?next=%2Fstudio"[^>]*>[\s\S]*ดำเนินการต่อด้วย Google<\/a>/);
    expect(html).not.toContain("PIN");
    expect(html).not.toContain("เบอร์มือถือ");
  });

  it("tells newcomers the same button signs them up, only while sign-up is open", () => {
    expect(draw(true)).toContain("กดปุ่มเดียวกันนี้เพื่อสมัคร ฟรี 10 รอบ");
    expect(draw(false, "x")).not.toContain("เพื่อสมัคร");
  });
});

describe("LoginForm's look (owner, 2026-10-01)", () => {
  it("never puts Thai words in the widely spaced code box, where the vowels came apart", () => {
    for (const placeholder of draw(false).match(/placeholder="[^"]*"/g) ?? []) {
      expect(placeholder).toBe('placeholder="••••••"');
    }
  });

  it("says under each tab who it is for", () => {
    expect(draw(true)).toContain("บัญชี Google");
    expect(draw(false)).toContain("รหัสเดียวกับที่ใช้เข้า UnitOS");
  });

  it("wears the site's mark and does not repeat เข้าสู่ระบบ as its heading", () => {
    const html = draw(true);
    expect(html).toContain('src="/mark.png"');
    expect(html).toMatch(/<h1[^>]*>ยินดีต้อนรับสู่ advisortool<\/h1>/);
  });
});
