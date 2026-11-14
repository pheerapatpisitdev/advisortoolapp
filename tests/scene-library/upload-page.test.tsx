import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * the owner's upload tabs (spec 2026-11-14-library-owner-only-design.md), drawn on the server for their first
 * markup, and the list's buttons called as functions
 */
vi.mock("@/app/studio/library/actions", () => ({ toggleLibraryMark: vi.fn() }));

import { LIBRARY, type LibraryTool } from "@/lib/scene-library/catalog";
import { type RowState } from "@/lib/scene-library/upload-flow";
import { KIND_HINT, KIND_TELLS, type UploadView } from "@/lib/scene-library/upload-rules";
import { LibraryBoard } from "@/app/studio/library/LibraryBoard";
import { UploadTab } from "@/app/studio/library/UploadTab";
import { MyFiles, UploadCard, UploadList } from "@/app/studio/library/UploadList";

const open = (o: Partial<Record<LibraryTool, boolean>> = {}): Record<LibraryTool, boolean> => ({ "quote-video": true, "story-clip": true, "prompt-story": true, ...o });
const view = (o: Partial<UploadView>): UploadView => ({ id: "11111111-1111-4111-8111-111111111111", kind: "part", name: "ตะกร้าผลไม้", note: "", files: 1, state: "ok", reason: null, mine: true, ...o });
const uploads = (o: Partial<{ mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] }> = {}) => ({ mine: [], shared: [], waiting: [], ...o });
const board = (o: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(LibraryBoard, {
  items: LIBRARY, open: open(), saved: [], uploads: uploads(), ...o,
} as never));
const tabNames = (html: string) => [...html.matchAll(/role="tab"[^>]*>([^<]+)/g)].map((m) => m[1]);
const idle: RowState = { removing: null, refusing: null, reason: null };

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
const text = (n: ReactNode): string => Array.isArray(n) ? n.map(text).join("") : isValidElement<{ children?: ReactNode }>(n) ? text(n.props.children) : typeof n === "string" || typeof n === "number" ? String(n) : "";
const button = (tree: ReactNode, label: string) => elements(tree).find((e) => e.type === "button" && text(e.props.children as ReactNode) === label);
const press = (tree: ReactNode, label: string) => (button(tree, label)!.props.onClick as () => void)();

describe("the tabs", () => {
  it("the owner: เลือกดู · อัปโหลด · ของฉัน, whatever lists the board holds", () => {
    expect(tabNames(board())).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน"]);
    expect(tabNames(board({ uploads: uploads({ waiting: [view({ state: "wait" })] }) }))).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน"]);
  });
  it("uploads: null leaves อัปโหลด, the file chip and the file cards out", () => {
    const html = board({ uploads: null });
    expect(tabNames(html)).toEqual(["เลือกดู", "ของฉัน"]);
    expect(html).not.toContain("ไฟล์ของฉัน");
  });
  it("a board that is not told about uploads behaves as before", () => {
    expect(tabNames(board({ uploads: undefined }))).toEqual(["เลือกดู", "ของฉัน"]);
  });
});

describe("เลือกดู with the owner's files", () => {
  const shared = [
    view({ id: "22222222-2222-4222-8222-222222222222", kind: "part", name: "ตะกร้าผลไม้" }),
    view({ id: "33333333-3333-4333-8333-333333333333", kind: "style", name: "สีพาสเทล" }),
  ];
  it("has the chip ไฟล์ของฉัน after ลูกเล่น, and no ไฟล์จากสมาชิก", () => {
    const html = board({ uploads: uploads({ shared }) });
    expect(html).toMatch(/aria-pressed="false"[^>]*>ลูกเล่น<\/button><button[^>]*aria-pressed="false"[^>]*>ไฟล์ของฉัน<\/button>/);
    expect(html).not.toContain("สมาชิก");
  });
  it("draws a card per shared file after the catalogue's, and counts them in the line", () => {
    const without = board({ uploads: uploads() });
    const html = board({ uploads: uploads({ shared }) });
    const n = Number(without.match(/>(\d+) รายการ</)![1]);
    expect(html).toContain(`>${n + 2} รายการ<`);
    expect(html).toContain('src="/api/library-upload?id=22222222-2222-4222-8222-222222222222&amp;n=0"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("ตะกร้าผลไม้");
    expect(html.indexOf("สีพาสเทล")).toBeGreaterThan(html.indexOf("ค่าห้องต่อคืน"));
  });
});

describe("an upload card", () => {
  const card = (v: UploadView, o: Record<string, boolean> = {}) => renderToStaticMarkup(createElement(UploadCard, { view: v, open: open(o) }));
  it("a part opens คลิปตามโจทย์ with asset=, a style with ref=", () => {
    expect(card(view({ id: "p1", kind: "part" }))).toContain('href="/studio/prompt-story?asset=p1"');
    expect(card(view({ id: "s1", kind: "style" }))).toContain('href="/studio/prompt-story?ref=s1"');
  });
  it("shows the kind and ไฟล์ของฉัน as tags, the picture on --ct-ground", () => {
    const html = card(view({ kind: "style" }));
    expect(html).toContain(">ภาพสไตล์</span>");
    expect(html).toContain(">ไฟล์ของฉัน</span>");
    expect(html).not.toContain("จากสมาชิก");
    expect(html).toMatch(/aspect-\[4\/3\][^"]*object-contain|object-contain[^"]*aspect-\[4\/3\]/);
    expect(html).toContain("bg-[var(--ct-ground)]");
    expect(html).toContain("ใช้แบบนี้");
  });
  it("says ยังไม่เปิดให้ใช้ when คลิปตามโจทย์ is switched off", () => {
    const html = card(view({}), { "prompt-story": false });
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).not.toContain("/studio/prompt-story");
  });
});

describe("อัปโหลด", () => {
  const form = (o: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(UploadTab, { send: vi.fn(), onSent: vi.fn(), ...o } as never));
  it("says the owner's files go in at once, and nothing about a count", () => {
    const html = form();
    expect(html).toContain("ไฟล์ของเจ้าของเข้าคลังทันที ไม่ต้องรอตรวจ");
    expect(html).not.toContain("คุณส่งแล้ว");
    expect(html).not.toContain("จาก 20");
  });
  it("offers two kinds only: ชิ้นส่วนภาพ and ภาพสไตล์, no คำขอชิ้นใหม่", () => {
    const html = form();
    expect([...html.matchAll(/<button type="button" aria-pressed="(?:true|false)"[^>]*><span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(["ชิ้นส่วนภาพ", "ภาพสไตล์"]);
    expect(html).toContain(KIND_TELLS.part);
    expect(html).toContain(KIND_TELLS.style);
    expect(html).not.toContain("คำขอชิ้นใหม่");
    expect(html).not.toContain(KIND_TELLS.ask);
    expect(html).not.toContain("ส่งคำขอ");
  });
  it("shows the hint, one file box, the fields and the send button; no rights box", () => {
    const html = form();
    expect(html).toContain(KIND_HINT.part);
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).not.toContain("multiple");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("ได้รับอนุญาตให้ใช้");
    expect(html).toContain("ชื่อที่จะแสดงในคลัง");
    expect(html).toContain("ใช้กับฉากแบบไหน (ไม่บังคับ)");
    expect(html).toContain("ส่งเข้าคลัง");
  });
  it("a style shows its own hint", () => {
    expect(form({ initialKind: "style" })).toContain(KIND_HINT.style);
  });
  it("every control is at least min-h-tap", () => {
    const html = form();
    for (const tag of html.match(/<(button|input|textarea)\b[^>]*>/g) ?? []) {
      if (/type="hidden"/.test(tag)) continue;
      expect(tag, tag).toContain("min-h-tap");
    }
  });
});

describe("ของฉัน: ไฟล์ของฉัน", () => {
  const rows = [
    view({ id: "a", state: "ok", note: "มีโน้ต" }),
    view({ id: "b", kind: "style", state: "gone", name: "สีพาสเทล" }),
  ];
  const html = renderToStaticMarkup(createElement(MyFiles, { rows, onRemove: vi.fn(), onHide: vi.fn(), onShow: vi.fn() }));
  it("counts them in the heading", () => expect(html).toContain("ไฟล์ของฉัน (2)"));
  it("says each file's state, its kind and note, with a thumbnail", () => {
    expect(html).toContain(">อยู่ในคลัง<");
    expect(html).not.toContain("ใช้ร่วมแล้ว");
    expect(html).toContain(">ถอนออกแล้ว<");
    expect(html).toContain("มีโน้ต");
    expect(html).toContain("ชิ้นส่วนภาพ");
    expect(html).toContain("/api/library-upload?id=a&amp;n=0");
  });
  it("an ok file has ถอนออกจากคลัง and ลบ; a withdrawn one นำกลับเข้าคลัง and ลบ", () => {
    expect(html.match(/>ถอนออกจากคลัง</g)).toHaveLength(1);
    expect(html.match(/>นำกลับเข้าคลัง</g)).toHaveLength(1);
    expect(html.match(/>ลบ</g)).toHaveLength(2);
    expect(html.indexOf(">ถอนออกจากคลัง<")).toBeLessThan(html.indexOf("สีพาสเทล"));
    expect(html.indexOf(">นำกลับเข้าคลัง<")).toBeGreaterThan(html.indexOf("สีพาสเทล"));
  });
  it("no reasons panel anywhere", () => {
    expect(html).not.toContain("อาจติดลิขสิทธิ์");
    expect(html).not.toContain("เหตุผล");
  });
  it("every control is at least min-h-tap", () => {
    for (const tag of html.match(/<button\b[^>]*>/g) ?? []) expect(tag, tag).toContain("min-h-tap");
  });
  it("says so when there is no file", () => {
    const none = renderToStaticMarkup(createElement(MyFiles, { rows: [], onRemove: vi.fn(), onHide: vi.fn(), onShow: vi.fn() }));
    expect(none).toContain("ไฟล์ของฉัน (0)");
    expect(none).toContain("ยังไม่มีไฟล์ อัปโหลดได้ที่แท็บอัปโหลด");
  });

  const list = (ui: RowState, row: UploadView, o: Record<string, unknown> = {}) => UploadList({ rows: [row], ui, dispatch: () => {}, ...o } as never);
  it("ถอนออกจากคลัง calls hide(id) at once, no reason asked", () => {
    const hid: string[] = []; const calls: unknown[] = [];
    press(list(idle, rows[0], { onHide: (id: string) => hid.push(id), dispatch: (a: unknown) => calls.push(a) }), "ถอนออกจากคลัง");
    expect(hid).toEqual(["a"]);
    expect(calls).toEqual([]);
  });
  it("นำกลับเข้าคลัง calls show(id) at once", () => {
    const shown: string[] = [];
    press(list(idle, rows[1], { onShow: (id: string) => shown.push(id) }), "นำกลับเข้าคลัง");
    expect(shown).toEqual(["b"]);
  });
  it("ลบ asks once in the row: the first press only dispatches the question", () => {
    const calls: unknown[] = []; const removed: string[] = [];
    press(list(idle, rows[0], { dispatch: (a: unknown) => calls.push(a), onRemove: (id: string) => removed.push(id) }), "ลบ");
    expect(calls).toEqual([{ type: "ask-remove", id: "a" }]);
    expect(removed).toEqual([]);
  });
  it("asked, the row says ลบไฟล์นี้? with ยืนยัน and ยกเลิก, and nothing else; only ยืนยัน removes", () => {
    const calls: unknown[] = []; const removed: string[] = [];
    const tree = list({ ...idle, removing: "a" }, rows[0], { dispatch: (a: unknown) => calls.push(a), onRemove: (id: string) => removed.push(id) });
    expect(text(tree)).toContain("ลบไฟล์นี้?");
    expect(button(tree, "ลบ")).toBeUndefined();
    expect(button(tree, "ถอนออกจากคลัง")).toBeUndefined();
    press(tree, "ยกเลิก");
    expect(calls).toEqual([{ type: "cancel" }]);
    expect(removed).toEqual([]);
    press(tree, "ยืนยัน");
    expect(removed).toEqual(["a"]);
  });
  it("a busy row holds every button", () => {
    for (const r of rows) {
      const tree = list(idle, r, { busy: new Set([r.id]) });
      const buttons = elements(tree).filter((e) => e.type === "button");
      expect(buttons.length).toBe(2);
      for (const b of buttons) expect(b.props.disabled).toBe(true);
    }
    expect(button(list({ ...idle, removing: "a" }, rows[0], { busy: new Set(["a"]) }), "ยืนยัน")!.props.disabled).toBe(true);
  });
  it("a waiting or refused file (from before) has ลบ alone", () => {
    for (const state of ["wait", "no"] as const) {
      const tree = list(idle, view({ id: "w", state }));
      expect(elements(tree).filter((e) => e.type === "button").map((e) => text(e.props.children as ReactNode))).toEqual(["ลบ"]);
    }
  });
  it("shows a refusal under the row", () => {
    const tree = list(idle, rows[0], { errors: { a: "ไฟล์นี้ตรวจไปแล้ว" } });
    expect(text(tree)).toContain("ไฟล์นี้ตรวจไปแล้ว");
    expect(elements(tree).some((e) => e.props.role === "alert")).toBe(true);
  });
});
