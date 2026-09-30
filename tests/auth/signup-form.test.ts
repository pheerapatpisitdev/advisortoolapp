import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/signup/actions", () => ({ signUp: vi.fn() }));
const { SignupForm } = await import("@/app/signup/SignupForm");

const html = renderToStaticMarkup(createElement(SignupForm, { next: "/" }));

describe("SignupForm's look (owner, 2026-10-01)", () => {
  it("labels every field above it", () => {
    for (const [id, label] of [
      ["signup-name", "ชื่อที่แสดง"], ["signup-phone", "เบอร์มือถือ"],
      ["signup-pin", "ตั้ง PIN 6 หลัก"], ["signup-pin-again", "ยืนยัน PIN"],
    ]) {
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
    }
  });

  it("says which PINs are refused before they are typed", () => {
    expect(html).toContain("ห้ามเลขเรียงหรือเลขซ้ำ เช่น 123456, 000000");
  });

  it("keeps Thai words out of the PIN boxes", () => {
    expect(html.match(/placeholder="••••••"/g)).toHaveLength(2);
  });

  it("wears the site's mark and carries next back to sign-in", () => {
    expect(html).toContain('src="/mark.png"');
    expect(html).toContain('href="/login?next=%2F"');
    expect(html).toContain('name="next" value="/"');
  });
});
