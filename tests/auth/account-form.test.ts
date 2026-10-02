import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/studio/account/actions", () => ({ renameMe: vi.fn() }));
const { AccountForm } = await import("@/app/studio/account/AccountForm");

const html = renderToStaticMarkup(createElement(AccountForm, { name: "สมชาย", email: "somchai@gmail.com" }));

describe("AccountForm (owner, 2026-10-02)", () => {
  it("shows the Google account the member signs in with", () => {
    expect(html).toContain("somchai@gmail.com");
    expect(html).toContain("บัญชี Google");
  });

  it("changes the name, and has no PIN left to change", () => {
    expect(html).toMatch(/<label[^>]*for="account-name"[^>]*>ชื่อที่แสดง<\/label>/);
    expect(html).not.toContain("PIN");
  });

  it("draws its fields in Studio's palette, which has a dark mode", () => {
    expect(html).toContain("--field-bg:var(--ct-panel)");
  });
});
