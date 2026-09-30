import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/studio/account/actions", () => ({ changePin: vi.fn(), renameMe: vi.fn() }));
const { AccountForm } = await import("@/app/studio/account/AccountForm");

const html = renderToStaticMarkup(createElement(AccountForm, { name: "สมชาย", phone: "0812345678" }));

describe("AccountForm's look (owner, 2026-10-01)", () => {
  it("labels every field above it", () => {
    for (const [id, label] of [
      ["account-name", "ชื่อที่แสดง"], ["account-old-pin", "PIN เดิม"],
      ["account-pin", "PIN ใหม่"], ["account-pin-again", "ยืนยัน PIN ใหม่"],
    ]) {
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
    }
  });

  it("keeps Thai words out of the PIN boxes, and lets each be shown", () => {
    expect(html.match(/placeholder="••••••"/g)).toHaveLength(3);
    expect(html.match(/aria-label="แสดง PIN"/g)).toHaveLength(3);
  });

  it("draws its fields in Studio's palette, which has a dark mode", () => {
    expect(html).toContain("--field-bg:var(--ct-panel)");
  });
});
