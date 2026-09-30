import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/login/actions", () => ({ memberSignIn: vi.fn(), signIn: vi.fn() }));
const { LoginForm } = await import("@/app/login/LoginForm");

const draw = (signupOpen: boolean) =>
  renderToStaticMarkup(createElement(LoginForm, { next: "/studio", signupOpen, contactUrl: null }));

describe("LoginForm's first tab", () => {
  it("is the member's while sign-up is open", () => {
    const html = draw(true);
    expect(html).toContain('aria-label="PIN 6 หลัก"');
    expect(html).not.toContain('aria-label="รหัสตัวแทน 6 หลัก"');
  });

  it("is the UnitOS agent's while sign-up is off, so nobody is sent to a tab that cannot be joined", () => {
    const html = draw(false);
    expect(html).toContain('aria-label="รหัสตัวแทน 6 หลัก"');
    expect(html).not.toContain('aria-label="PIN 6 หลัก"');
  });
});
