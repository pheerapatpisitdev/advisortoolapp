import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** บรีฟภาพเพิ่มเติม on every form that draws pictures, not only แบบประกัน's (owner, 2026-10-01) */

vi.mock("@/app/studio/draw", () => ({ recruitRound: vi.fn(), knowledgeRound: vi.fn(), draftRound: vi.fn(), claimRound: vi.fn() }));
vi.mock("@/app/studio/actions", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/studio/write",
  useSearchParams: () => new URLSearchParams(),
}));

const { ClaimTools } = await import("@/app/studio/claim/ClaimTools");
const { RecruitTools } = await import("@/app/studio/recruit/RecruitTools");
const { KnowledgeTools } = await import("@/app/studio/knowledge/KnowledgeTools");
const { DraftTools } = await import("@/app/studio/draft/DraftTools");

const common = {
  writer: "auto", onWriter: () => {}, painter: "auto", onPainter: () => {},
  people: [], person: null, onPerson: () => {}, logo: { spot: null, onSpot: () => {} },
  left: 100, rounds: null, pending: false, making: 0, run: async () => {},
  reader: "", onReader: () => {},
  brief: "ครอบครัวในสวนตอนเย็น", onBrief: () => {},
};

const FORMS: [string, FunctionComponent<typeof common>][] = [
  ["รีวิวเคลม", ClaimTools as unknown as FunctionComponent<typeof common>],
  ["หาทีม", RecruitTools as unknown as FunctionComponent<typeof common>],
  ["ความรู้", KnowledgeTools as unknown as FunctionComponent<typeof common>],
  ["เขียนเอง", DraftTools as unknown as FunctionComponent<typeof common>],
];

describe("บรีฟภาพเพิ่มเติม", () => {
  it.each(FORMS)("is on the %s form, holding the shared brief", (_name, Form) => {
    const html = renderToStaticMarkup(createElement(Form, common));
    expect(html).toContain("บรีฟภาพเพิ่มเติม");
    expect(html).toMatch(/<textarea[^>]*>ครอบครัวในสวนตอนเย็น<\/textarea>/);
  });

  it.each(FORMS)("is not on the %s form when no picture is drawn", (_name, Form) => {
    const html = renderToStaticMarkup(createElement(Form, { ...common, painter: "none" }));
    expect(html).not.toContain("บรีฟภาพเพิ่มเติม");
  });

  it("says on รีวิวเคลม that it steers the picture behind the papers, not the words", () => {
    const html = renderToStaticMarkup(createElement(FORMS[0][1], common));
    expect(html).toContain("ภาพพื้นหลังหลังเอกสาร");
    expect(html).not.toContain("AI วาดทั้งโปสเตอร์รวมตัวหนังสือ");
  });
});
