import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** the library's upload tabs, drawn on the server for their first markup, and the list's buttons called as functions */
vi.mock("@/app/studio/library/actions", () => ({ toggleLibraryMark: vi.fn() }));

import { LIBRARY, type LibraryTool } from "@/lib/scene-library/catalog";
import { type RowState } from "@/lib/scene-library/upload-flow";
import { KIND_HINT, KIND_TELLS, REASONS, RIGHTS_LINE, type UploadView } from "@/lib/scene-library/upload-rules";
import { LibraryBoard } from "@/app/studio/library/LibraryBoard";
import { UploadTab } from "@/app/studio/library/UploadTab";
import { MyFiles, ReviewQueue, UploadCard, UploadList } from "@/app/studio/library/UploadList";

const open = (o: Partial<Record<LibraryTool, boolean>> = {}): Record<LibraryTool, boolean> => ({ "quote-video": true, "story-clip": true, "prompt-story": true, ...o });
const view = (o: Partial<UploadView>): UploadView => ({ id: "11111111-1111-4111-8111-111111111111", kind: "part", name: "ตะกร้าผลไม้", note: "", files: 1, state: "wait", reason: null, mine: true, ...o });
const uploads = (o: Partial<{ mine: UploadView[]; shared: UploadView[]; waiting: UploadView[] }> = {}) => ({ mine: [], shared: [], waiting: [], ...o });
const board = (o: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(LibraryBoard, {
  items: LIBRARY, open: open(), saved: [], wanted: [], counts: {}, owner: false, uploads: uploads(), ...o,
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

describe("the tabs", () => {
  it("a member: เลือกดู · อัปโหลด · ของฉัน", () => {
    expect(tabNames(board())).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน"]);
  });
  it("the owner: also คิวตรวจ with the waiting count, and อยากได้มากสุด, in that order", () => {
    const html = board({ owner: true, uploads: uploads({ waiting: [view({ id: "a" }), view({ id: "b" })] }) });
    expect(tabNames(html)).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน", "คิวตรวจ", "อยากได้มากสุด"]);
    expect(html).toMatch(/คิวตรวจ<span[^>]*>2<\/span>/);
  });
  it("a member never sees คิวตรวจ, even holding a waiting list", () => {
    expect(tabNames(board({ uploads: uploads({ waiting: [view({})] }) }))).not.toContain("คิวตรวจ");
  });
  it("uploads: null leaves the two new tabs, the new type chip and the new cards out", () => {
    const html = board({ uploads: null, owner: true });
    expect(tabNames(html)).toEqual(["เลือกดู", "ของฉัน", "อยากได้มากสุด"]);
    expect(html).not.toContain("ไฟล์จากสมาชิก");
  });
  it("a board that is not told about uploads behaves as before", () => {
    expect(tabNames(board({ uploads: undefined }))).toEqual(["เลือกดู", "ของฉัน"]);
  });
});

describe("เลือกดู with uploads", () => {
  const shared = [
    view({ id: "22222222-2222-4222-8222-222222222222", kind: "part", name: "ตะกร้าผลไม้", state: "ok", mine: false }),
    view({ id: "33333333-3333-4333-8333-333333333333", kind: "style", name: "สีพาสเทล", state: "ok", mine: false }),
  ];
  it("has the chip ไฟล์จากสมาชิก after ลูกเล่น", () => {
    const html = board({ uploads: uploads({ shared }) });
    expect(html).toMatch(/aria-pressed="false"[^>]*>ลูกเล่น<\/button><button[^>]*aria-pressed="false"[^>]*>ไฟล์จากสมาชิก<\/button>/);
  });
  it("draws a card per shared file after the catalogue's, and counts them in the line", () => {
    const without = board({ uploads: uploads() });
    const html = board({ uploads: uploads({ shared }) });
    const n = Number(without.match(/>(\d+) รายการ</)![1]);
    expect(html).toContain(`>${n + 2} รายการ<`);
    expect(html).toContain('src="/api/library-upload?id=22222222-2222-4222-8222-222222222222&amp;n=0"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("ตะกร้าผลไม้");
    expect(html).toContain("จากสมาชิก");
    expect(html.indexOf("สีพาสเทล")).toBeGreaterThan(html.indexOf("ค่าห้องต่อคืน"));
  });
});

describe("an upload card", () => {
  const card = (v: UploadView, o: Record<string, boolean> = {}) => renderToStaticMarkup(createElement(UploadCard, { view: v, open: open(o) }));
  it("a part opens คลิปตามโจทย์ with asset=, a style with ref=", () => {
    expect(card(view({ id: "p1", kind: "part" }))).toContain('href="/studio/prompt-story?asset=p1"');
    expect(card(view({ id: "s1", kind: "style" }))).toContain('href="/studio/prompt-story?ref=s1"');
  });
  it("shows the kind and จากสมาชิก as tags, the picture on --ct-ground", () => {
    const html = card(view({ kind: "style" }));
    expect(html).toContain(">ภาพสไตล์</span>");
    expect(html).toContain(">จากสมาชิก</span>");
    expect(html).toMatch(/aspect-\[4\/3\][^"]*object-contain|object-contain[^"]*aspect-\[4\/3\]/);
    expect(html).toContain("bg-[var(--ct-ground)]");
    expect(html).toContain("ใช้แบบนี้");
  });
  it("says ยังไม่เปิดให้ใช้ when the form is not open to this viewer", () => {
    const html = card(view({}), { "prompt-story": false });
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).not.toContain("/studio/prompt-story");
  });
});

describe("อัปโหลด", () => {
  const form = (o: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(UploadTab, { sent: 3, owner: false, demo: false, send: vi.fn(), onSent: vi.fn(), ...o } as never));
  it("the demo account is told, and gets no form", () => {
    const html = form({ demo: true });
    expect(html).toContain("บัญชีทดลองอัปโหลดไม่ได้");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("ส่งเข้าคลัง");
  });
  it("says how many are sent and what happens after", () => {
    expect(form()).toContain("คุณส่งแล้ว 3 จาก 20 ไฟล์ ไฟล์ใช้ร่วมได้หลังเจ้าของอนุมัติ");
    expect(form({ owner: true })).toContain("ไฟล์ของเจ้าของเข้าคลังทันที ไม่ต้องรอตรวจ");
  });
  it("shows the three kinds, the hint, the file box, the rights line and the send button", () => {
    const html = form();
    expect(html).toContain("ชิ้นส่วนภาพ");
    expect(html).toContain("ภาพสไตล์");
    expect(html).toContain("คำขอชิ้นใหม่");
    for (const t of Object.values(KIND_TELLS)) expect(html).toContain(t);
    expect(html).toContain(KIND_HINT.part);
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toContain(RIGHTS_LINE);
    expect(html).toContain("ส่งเข้าคลัง");
    expect(html).not.toContain("multiple");
  });
  it("an ask takes up to 3 pictures, says ส่งคำขอ, and has no rights box", () => {
    const html = form({ initialKind: "ask" });
    expect(html).toContain("multiple");
    expect(html).toContain("ส่งคำขอ");
    expect(html).toContain(KIND_HINT.ask);
    expect(html).not.toContain(RIGHTS_LINE);
  });
  it("every control is at least min-h-tap", () => {
    const html = form();
    for (const tag of html.match(/<(button|input|textarea)\b[^>]*>/g) ?? []) {
      if (/type="(hidden|checkbox)"/.test(tag)) continue;
      expect(tag, tag).toContain("min-h-tap");
    }
  });
});

describe("ของฉัน: ไฟล์ที่ฉันส่ง", () => {
  const rows = [
    view({ id: "a", state: "wait", note: "มีโน้ต" }),
    view({ id: "b", kind: "ask", state: "wait", name: "ขอชิ้นใหม่", files: 0 }),
    view({ id: "c", state: "ok" }),
    view({ id: "d", state: "no", reason: "อาจติดลิขสิทธิ์" }),
    view({ id: "e", kind: "ask", state: "queue" }),
    view({ id: "f", kind: "ask", state: "closed" }),
  ];
  const html = renderToStaticMarkup(createElement(MyFiles, { rows, onRemove: vi.fn() }));
  it("counts them in the heading", () => expect(html).toContain("ไฟล์ที่ฉันส่ง (6)"));
  it("says every state in words, and the reason when no", () => {
    for (const w of ["รออนุมัติ", "รอเจ้าของดู", "ใช้ร่วมแล้ว", "ไม่ผ่าน", "อยู่ในคิวทำ", "ปิดคำขอ"]) expect(html, w).toContain(w);
    expect(html).toContain("อาจติดลิขสิทธิ์");
    expect(html).toContain("มีโน้ต");
    expect(html).toContain("ชิ้นส่วนภาพ");
  });
  it("draws a thumbnail for a row with files, none for an ask with none", () => {
    expect(html).toContain("/api/library-upload?id=a&amp;n=0");
    expect(html).not.toContain("id=b&amp;n=0");
  });
  it("says so when nothing is sent", () => {
    expect(renderToStaticMarkup(createElement(MyFiles, { rows: [], onRemove: vi.fn() }))).toContain("ไฟล์ที่ฉันส่ง (0)");
  });

  const list = (ui: RowState, o: Record<string, unknown> = {}) => UploadList({ mode: "mine", rows: [rows[0]], ui, dispatch: () => {}, ...o } as never);
  it("ลบ asks once in the row: the first press only dispatches the question", () => {
    const calls: unknown[] = []; const removed: string[] = [];
    const tree = list(idle, { dispatch: (a: unknown) => calls.push(a), onRemove: (id: string) => removed.push(id) });
    (button(tree, "ลบ")!.props.onClick as () => void)();
    expect(calls).toEqual([{ type: "ask-remove", id: "a" }]);
    expect(removed).toEqual([]);
  });
  it("asked, the row says ลบไฟล์นี้? with ยืนยัน and ยกเลิก; only ยืนยัน removes", () => {
    const calls: unknown[] = []; const removed: string[] = [];
    const tree = list({ ...idle, removing: "a" }, { dispatch: (a: unknown) => calls.push(a), onRemove: (id: string) => removed.push(id) });
    expect(text(tree)).toContain("ลบไฟล์นี้?");
    expect(button(tree, "ลบ")).toBeUndefined();
    (button(tree, "ยกเลิก")!.props.onClick as () => void)();
    expect(calls).toEqual([{ type: "cancel" }]);
    expect(removed).toEqual([]);
    (button(tree, "ยืนยัน")!.props.onClick as () => void)();
    expect(removed).toEqual(["a"]);
  });
  it("shows a refusal under the row", () => {
    const tree = list(idle, { errors: { a: "ไม่พบไฟล์นี้" } });
    expect(text(tree)).toContain("ไม่พบไฟล์นี้");
    expect(elements(tree).some((e) => e.props.role === "alert")).toBe(true);
  });
});

describe("คิวตรวจ", () => {
  const rows = [
    view({ id: "a", state: "wait", mine: false, by: "สมชาย", name: "ตะกร้า" }),
    view({ id: "b", kind: "style", state: "wait", mine: false, by: "สมหญิง", name: "สไตล์" }),
    view({ id: "k", kind: "ask", state: "wait", mine: false, by: "ลูกค้า", name: "อยากได้ถุงเงิน", files: 0, note: "ลิงก์" }),
  ];
  const html = renderToStaticMarkup(createElement(ReviewQueue, { rows, onDecide: vi.fn() }));
  it("has the two lists with their counts", () => {
    expect(html).toContain("ไฟล์รออนุมัติ (2)");
    expect(html).toContain("คำขอชิ้นใหม่ (1)");
  });
  it("shows the sender's name here", () => {
    for (const n of ["สมชาย", "สมหญิง", "ลูกค้า"]) expect(html).toContain(n);
  });
  it("a file has อนุมัติ and ไม่ผ่าน; a request has รับเข้าคิวทำ and ปิดคำขอ", () => {
    expect(html).toContain(">อนุมัติ<");
    expect(html).toContain(">ไม่ผ่าน<");
    expect(html).toContain(">รับเข้าคิวทำ<");
    expect(html).toContain(">ปิดคำขอ<");
  });

  const list = (ui: RowState, o: Record<string, unknown> = {}) => UploadList({ mode: "queue", rows: [rows[0]], ui, dispatch: () => {}, ...o } as never);
  it("อนุมัติ calls decide(id, ok) at once", () => {
    const calls: unknown[][] = [];
    (button(list(idle, { onDecide: (...a: unknown[]) => calls.push(a) }), "อนุมัติ")!.props.onClick as () => void)();
    expect(calls).toEqual([["a", "ok"]]);
  });
  it("ไม่ผ่าน only opens the reasons", () => {
    const calls: unknown[] = []; const decided: unknown[] = [];
    (button(list(idle, { dispatch: (a: unknown) => calls.push(a), onDecide: (...a: unknown[]) => decided.push(a) }), "ไม่ผ่าน")!.props.onClick as () => void)();
    expect(calls).toEqual([{ type: "ask-no", id: "a" }]);
    expect(decided).toEqual([]);
  });
  it("the reasons open the four choices; ยืนยันไม่ผ่าน waits for one and then calls decide(id, no, reason)", () => {
    const opened = list({ ...idle, refusing: "a" });
    for (const r of REASONS) expect(text(opened)).toContain(r);
    expect(button(opened, "ยืนยันไม่ผ่าน")!.props.disabled).toBe(true);

    const decided: unknown[][] = []; const picked: unknown[] = [];
    const chosen = list({ ...idle, refusing: "a", reason: "อาจติดลิขสิทธิ์" }, { onDecide: (...a: unknown[]) => decided.push(a), dispatch: (a: unknown) => picked.push(a) });
    const confirm = button(chosen, "ยืนยันไม่ผ่าน")!;
    expect(confirm.props.disabled).toBe(false);
    (confirm.props.onClick as () => void)();
    expect(decided).toEqual([["a", "no", "อาจติดลิขสิทธิ์"]]);
  });
  it("picking a reason dispatches it", () => {
    const picked: unknown[] = [];
    const opened = list({ ...idle, refusing: "a" }, { dispatch: (a: unknown) => picked.push(a) });
    const pick = elements(opened).find((e) => text(e.props.children as ReactNode) === "ภาพไม่ชัดหรือเล็กเกินไป" && typeof e.props.onClick === "function")!;
    (pick.props.onClick as () => void)();
    expect(picked).toEqual([{ type: "pick", reason: "ภาพไม่ชัดหรือเล็กเกินไป" }]);
  });
  it("a request's buttons decide queue and closed", () => {
    const calls: unknown[][] = [];
    const tree = UploadList({ mode: "queue", rows: [rows[2]], ui: idle, dispatch: () => {}, onDecide: (...a: unknown[]) => calls.push(a) } as never);
    (button(tree, "รับเข้าคิวทำ")!.props.onClick as () => void)();
    (button(tree, "ปิดคำขอ")!.props.onClick as () => void)();
    expect(calls).toEqual([["k", "queue"], ["k", "closed"]]);
  });
  it("a row someone decided first shows its message and no buttons", () => {
    const tree = list(idle, { errors: { a: "ไฟล์นี้ตรวจไปแล้ว" }, settled: new Set(["a"]) });
    expect(text(tree)).toContain("ไฟล์นี้ตรวจไปแล้ว");
    expect(button(tree, "อนุมัติ")).toBeUndefined();
    expect(button(tree, "ไม่ผ่าน")).toBeUndefined();
  });
});
