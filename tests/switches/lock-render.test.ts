import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// a switched-off tool is locked (owner, 2026-10-17: "ปิดแล้วล็อกไม่ต้องให้เข้าไปได้เลย")
vi.mock("next/navigation", () => ({ usePathname: () => "/studio/write" }));
vi.mock("@/lib/switches/store", () => ({ closedNotice: vi.fn() }));

const { Sidebar } = await import("@/components/shell/Sidebar");
const { LockedPage } = await import("@/components/ClosedNotice");
const { studioMenu } = await import("@/lib/shell/menu");

const agent = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false, closed: ["/studio/quote-video"] };
const draw = (who: typeof agent) => renderToStaticMarkup(createElement(Sidebar, { signedIn: true, menu: studioMenu(who), who }));

describe("the menu while วิดีโอนำเสนอ is off", () => {
  it("lists it for an agent as words they cannot press, marked ปิดชั่วคราว", () => {
    const html = draw(agent);
    expect(html).not.toContain('href="/studio/quote-video"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("ปิดชั่วคราว");
    // the tools that are on are links as before
    expect(html).toContain('href="/studio/story-clip"');
  });

  it("keeps it a link for the owner, who tries it before it is back on", () => {
    const html = draw({ ...agent, owner: true });
    expect(html).toContain('href="/studio/quote-video"');
    expect(html).not.toContain('aria-disabled="true"');
  });
});

describe("the locked page", () => {
  it("is the lock, the tool's name and the Super Admin's words, with a way back", () => {
    const html = renderToStaticMarkup(createElement(LockedPage, { feature: "quote-video", message: "ระบบเสียงพากย์ขัดข้อง" }));
    expect(html).toContain("วิดีโอนำเสนอ ปิดชั่วคราว");
    expect(html).toContain("ระบบเสียงพากย์ขัดข้อง");
    expect(html).toContain('href="/studio"');
    const ask = renderToStaticMarkup(createElement(LockedPage, { feature: "ask", message: "x", back: { href: "/home", label: "กลับหน้าหลัก" } }));
    expect(ask).toContain("ถาม AI ปิดชั่วคราว");
    expect(ask).toContain('href="/home"');
  });
});
