import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// the sections call server actions only on a click; rendering never reaches them
vi.mock("@/app/admin/ai/actions", () => ({
  checkKeys: vi.fn(), saveApiKey: vi.fn(), saveRenderKey: vi.fn(), setProviderEnabled: vi.fn(),
  saveSettings: vi.fn(), resetSpend: vi.fn(), setModelEnabled: vi.fn(),
}));

const { KeysSection, BudgetSection, RatesSection } = await import("@/app/admin/ai/AiClient");
const { ModelSwitches } = await import("@/app/admin/ai/ModelSwitches");
const { SettingsNav } = await import("@/app/admin/ai/kit/SettingsNav");

/** /admin/ai in settings-kit's look (owner chose ข, 2026-11-18, https://claude.ai/artifact/J3GD1YGtWCU9WTiovgeoDP) */
describe("/admin/ai in the settings-kit look", () => {
  const keys = { keys: [{ provider: "anthropic", tail: "4f2a", enabled: true }, { provider: "zai", tail: "22aa", enabled: false }],
    providers: ["anthropic", "openai", "zai", "openrouter"],
    models: [{ id: "m1", provider: "anthropic", kind: "text", model_name: "claude-sonnet-5", enabled: true }],
    video: { keys: [{ provider: "gcp" as const, shown: "advisortool-video · asia-southeast1", enabled: true }] } };

  it("puts the companies with a key first as chips, with their marks, and the rest behind อีก N รายการ", () => {
    const html = renderToStaticMarkup(createElement(KeysSection, keys));
    expect(html).toContain("Anthropic (Claude)");
    expect(html).toContain("Z.ai (GLM)");
    expect(html).toContain("Google Cloud Run");
    expect(html).toContain('aria-label="ปิดอยู่"'); // Z.ai's key is switched off
    expect(html).toContain("อีก 2 รายการ"); // OpenAI and OpenRouter have no key
    expect(html).not.toContain("OpenAI (GPT)");
    expect(html).toContain("<path d="); // a real mark, not only letters
    expect(html).toContain("ทดสอบกุญแจทั้งหมด");
    expect(html).not.toContain("4f2a"); // the tail is in the card, not on the page
  });

  it("keeps the budget, its reset and the premium tables", () => {
    const budget = renderToStaticMarkup(createElement(BudgetSection, {
      settings: { small_model: null, large_model: null, monthly_budget_thb: 0, content_budget_thb: null, spend_reset_at: null },
      spentThisMonth: 12, content: { spent: 1, cap: 300, fallback: 300 },
    }));
    expect(budget).toContain("ระบบหยุดเรียก AI ทั้งหมด"); // a stored 0 still reads as a ฿0 ceiling
    expect(budget).toContain("รีเซ็ตยอด");
    const rates = renderToStaticMarkup(createElement(RatesSection, { rates: { version: "2569-1", expiresOn: "2026-12-31", daysLeft: 12, expired: false } }));
    expect(rates).toContain("เหลืออีก 12 วัน");
  });

  it("switches a model off as a switch per row", () => {
    const html = renderToStaticMarkup(createElement(ModelSwitches, { models: keys.models }));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("claude-sonnet-5");
  });

  it("shows the first section and hides the others until chosen", () => {
    const html = renderToStaticMarkup(createElement(SettingsNav, { sections: [
      { id: "keys", group: "คีย์และโมเดล", title: "กุญแจของค่าย AI", node: "KEYS" },
      { id: "rates", group: "ข้อมูล", title: "ตารางเบี้ย", node: "RATES" },
    ] }));
    expect(html).toMatch(/id="section-keys" aria-label="กุญแจของค่าย AI">KEYS/);
    expect(html).toMatch(/id="section-rates" hidden="" aria-label="ตารางเบี้ย">RATES/);
  });
});
