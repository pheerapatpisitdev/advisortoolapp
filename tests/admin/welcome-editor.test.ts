import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/admin/welcome/actions", () => ({ saveWelcomeAction: vi.fn(), resetWelcomeAction: vi.fn() }));
const { WelcomeEditor } = await import("@/app/admin/welcome/WelcomeEditor");
const { MENU_TEXT } = await import("@/lib/assistant/choose");

type Props = Parameters<typeof WelcomeEditor>[0];
const draw = (p: Partial<Props>) => renderToStaticMarkup(createElement(WelcomeEditor, {
  pageId: "1", pageName: "เพจทดสอบ", saved: null,
  initial: { mode: "menu", text: MENU_TEXT, pictures: [] }, ...p,
}));

describe("the welcome editor", () => {
  it("shows a Page on the built-in menu with its words, its fixed buttons, and no reset", () => {
    const html = draw({});
    expect(html).toContain("ใช้ค่าเริ่มต้น");
    expect(html).toContain("💰 Life Protect");
    expect(html).not.toContain("คืนค่าเดิม");
    // the preview reads as the customer does, without the particle
    expect(html).toContain("สวัสดี 🙏 ที่เราดูแลมี 3 แบบ");
  });

  it("shows a one-plan Page with its plan, its pictures in order, and a reset", () => {
    const one = { mode: "one_plan" as const, product: "ishield" as const, text: "สวัสดีครับ", pictures: ["/welcome/a.jpg", "/welcome/b.jpg"] };
    const html = draw({ initial: one, saved: { ...one, updatedAt: "2026-10-04T10:00:00Z" } });
    expect(html).toContain("แก้ล่าสุด");
    expect(html).toMatch(/<option value="ishield" selected="">/);
    expect(html.indexOf("/welcome/a.jpg")).toBeLessThan(html.indexOf("/welcome/b.jpg"));
    expect(html).toContain("คืนค่าเดิม");
    expect(html).toContain("(2/5)");
  });
});
