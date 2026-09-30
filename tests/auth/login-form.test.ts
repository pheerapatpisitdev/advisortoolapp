import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/login/actions", () => ({ memberSignIn: vi.fn(), signIn: vi.fn() }));
const { LoginForm } = await import("@/app/login/LoginForm");

const draw = (signupOpen: boolean, contactUrl: string | null = null) =>
  renderToStaticMarkup(createElement(LoginForm, { next: "/studio", signupOpen, contactUrl }));

describe("LoginForm's first tab", () => {
  it("is the member's while sign-up is open", () => {
    const html = draw(true);
    expect(html).toContain('id="login-pin"');
    expect(html).not.toContain('id="login-code"');
  });

  it("is the UnitOS agent's while sign-up is off, so nobody is sent to a tab that cannot be joined", () => {
    const html = draw(false);
    expect(html).toContain('id="login-code"');
    expect(html).not.toContain('id="login-pin"');
  });
});

describe("LoginForm's look (owner, 2026-10-01)", () => {
  it("labels every field above it, rather than only inside it", () => {
    const html = draw(true);
    expect(html).toMatch(/<label[^>]*for="login-phone"[^>]*>เบอร์มือถือ<\/label>/);
    expect(html).toMatch(/<label[^>]*for="login-pin"[^>]*>PIN 6 หลัก<\/label>/);
    expect(html).toContain('placeholder="เช่น 081-234-5678"');
  });

  it("never puts Thai words in the widely spaced PIN box, where the vowels came apart", () => {
    for (const html of [draw(true), draw(false)]) {
      for (const placeholder of html.match(/placeholder="[^"]*"/g) ?? []) {
        if (placeholder.includes("081")) continue;
        expect(placeholder).toBe('placeholder="••••••"');
      }
    }
  });

  it("lets the PIN be shown", () => {
    expect(draw(true)).toContain('aria-label="แสดง PIN"');
  });

  it("says under each tab who it is for", () => {
    expect(draw(true)).toContain("เบอร์มือถือและ PIN ที่ตั้งไว้ตอนสมัคร");
    expect(draw(false)).toContain("รหัสเดียวกับที่ใช้เข้า UnitOS");
  });

  it("offers sign-up as a button of its own while sign-up is open", () => {
    expect(draw(true)).toContain("สมัครใหม่ ฟรี 10 รอบ");
    expect(draw(true)).toContain('href="/signup?next=%2Fstudio"');
    expect(draw(false)).not.toContain("สมัครใหม่");
  });

  it("offers the forgotten-PIN contact only when there is somewhere to send them", () => {
    expect(draw(true)).not.toContain("ลืม PIN");
    const html = draw(true, "https://lin.ee/x");
    expect(html).toContain("ลืม PIN");
    expect(html).toContain('href="https://lin.ee/x"');
  });

  it("wears the site's mark and does not repeat เข้าสู่ระบบ as its heading", () => {
    const html = draw(true);
    expect(html).toContain('src="/mark.png"');
    expect(html).toMatch(/<h1[^>]*>ยินดีต้อนรับสู่ advisortool<\/h1>/);
  });
});
