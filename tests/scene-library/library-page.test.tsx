import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * คลังแอนิเมชัน's page and board, drawn on the server for their first markup: the owner's alone (spec
 * 2026-11-14-library-owner-only-design.md), anyone else told it is closed with nothing read; who may follow
 * which link, no votes, and a marks table that cannot be read (not migrated yet).
 */
const state = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  gated: [] as string[],
  marks: null as null | { saved: string[]; wanted: string[] },
  closed: {} as Record<string, string | null>,
  uploads: { mine: [], shared: [], waiting: [] } as null | { mine: unknown[]; shared: unknown[]; waiting: unknown[] },
  asked: [] as unknown[],
  reads: [] as string[],
}));

vi.mock("@/lib/auth/viewer", () => ({
  gatePage: async (path: string) => { state.gated.push(path); return state.viewer; },
  requireMember: async () => state.viewer,
}));
vi.mock("@/lib/scene-library/marks", () => ({
  marksOf: async () => { state.reads.push("marks"); if (!state.marks) throw new Error("relation \"ins_library_marks\" does not exist"); return state.marks; },
  wantCounts: async () => { state.reads.push("counts"); return {}; },
}));
vi.mock("@/lib/scene-library/uploads", () => ({ uploadViews: async (who: unknown) => { state.reads.push("uploads"); state.asked.push(who); return state.uploads; } }));
vi.mock("@/lib/switches/store", () => ({ closedFor: async (_v: unknown, key: string) => { state.reads.push(`switch ${key}`); return state.closed[key] ?? null; } }));
vi.mock("@/app/studio/library/actions", () => ({ toggleLibraryMark: vi.fn() }));

import { OWNER, SUPER } from "../helpers/signed-in";
import { LIBRARY, libraryItem, PRODUCT_NAME, storyLibraryHref, type LibraryTool } from "@/lib/scene-library/catalog";
import LibraryPage from "@/app/studio/library/page";
import { LibraryBoard, LibraryCard, LibraryDetail, type DetailProps } from "@/app/studio/library/LibraryBoard";

const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", code: "123456", name: "ตัวแทน", staff: null };
const ADMIN: Viewer = { ...AGENT, staff: { owner: false, publish: true, connect: true, admin: true } };
const DEMO: Viewer = { ...OWNER, kind: "demo", agentId: "00000000-0000-4000-8000-000000012345", code: "012345", name: "ลูกค้าทดลองใช้", staff: null };
const MEMBER: Viewer = { ...AGENT, kind: "member", staff: null };
const page = async () => renderToStaticMarkup(await LibraryPage());
const amp = (s: string) => s.replaceAll("&", "&amp;");
const tabNames = (html: string) => [...html.matchAll(/role="tab"[^>]*>([^<]+)/g)].map((m) => m[1]);

beforeEach(() => {
  state.viewer = OWNER;
  state.gated = [];
  state.marks = { saved: [], wanted: [] };
  state.closed = {};
  state.uploads = { mine: [], shared: [], waiting: [] };
  state.asked = [];
  state.reads = [];
});

describe("anyone but the owner", () => {
  for (const [who, viewer] of [["an agent", AGENT], ["an admin who is not the owner", ADMIN], ["a member", MEMBER], ["the demo account", DEMO]] as const) {
    it(`${who} is told it is closed, with the two links, and nothing is read`, async () => {
      state.viewer = viewer;
      const html = await page();
      expect(state.gated).toEqual(["/studio/library"]);
      expect(html).toContain("คลังแอนิเมชัน");
      expect(html).toMatch(/<p[^>]*>ฟังก์ชันนี้ปิดใช้งานอยู่ ทำคลิปได้ที่ <a href="\/studio\/story-clip">คลิปเล่าเรื่อง<\/a> หรือ <a href="\/studio\/quote-video">วิดีโอนำเสนอ<\/a><\/p>/);
      expect(html).not.toContain('role="tab"');
      expect(html).not.toContain("ค่าห้องต่อคืน");
      expect(state.reads).toEqual([]);
    });
  }
  it("the closed line looks like คลิปตามโจทย์'s", async () => {
    state.viewer = AGENT;
    expect(await page()).toContain('class="mt-3 max-w-md rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 text-sm"');
  });
});

describe("the owner's page", () => {
  it("has three tabs: เลือกดู · อัปโหลด · ของฉัน; no อยากได้มากสุด, no คิวตรวจ", async () => {
    const html = await page();
    expect(tabNames(html)).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน"]);
    expect(html).not.toContain("อยากได้มากสุด");
    expect(html).not.toContain("คิวตรวจ");
    expect(html).not.toContain("ฟังก์ชันนี้ปิดใช้งานอยู่");
  });
  it("the Super Admin counts as the owner", async () => {
    state.viewer = SUPER;
    expect(tabNames(await page())).toEqual(["เลือกดู", "อัปโหลด", "ของฉัน"]);
  });
  it("reads the owner's marks and uploads, and no vote counts", async () => {
    await page();
    expect(state.asked).toEqual([{ agentId: OWNER.agentId }]);
    expect(state.reads).toContain("marks");
    expect(state.reads).not.toContain("counts");
  });
  it("says so, and leaves the upload tab out, when the uploads cannot be read", async () => {
    state.uploads = null;
    const html = await page();
    expect(html).toMatch(/role="alert"[^>]*>โหลดไฟล์ที่อัปโหลดไม่สำเร็จ/);
    expect(tabNames(html)).toEqual(["เลือกดู", "ของฉัน"]);
    expect(html).toContain("ค่าห้องต่อคืน");
  });
  it("gives the owner คลิปตามโจทย์ and the story form's link", async () => {
    const html = await page();
    expect(html).toContain("/studio/prompt-story?format=drama3");
    expect(html).toContain(`href="${amp(storyLibraryHref({ topic: "roomcost" }))}"`);
    expect(html).toContain('href="/studio/quote-video"');
  });
  it("a switched-off form takes its links away, and a piece with none left says so", async () => {
    state.closed = { "story-clip": "ปิดปรับปรุง", "prompt-story": "ปิด" };
    const html = await page();
    expect(html).not.toContain("/studio/story-clip");
    expect(html).not.toContain("/studio/prompt-story");
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).toContain('href="/studio/quote-video"');
  });
  it("draws the owner's saves", async () => {
    state.marks = { saved: ["room"], wanted: [] };
    const html = await page();
    expect(html).toMatch(/aria-pressed="true" aria-label="บันทึก ค่าห้องต่อคืน"/);
    expect(html).toMatch(/ของฉัน<span[^>]*>1<\/span>/);
  });
  it("with the marks unread but the uploads readable, ของฉัน stays for ไฟล์ของฉัน", async () => {
    state.marks = null;
    const html = await page();
    expect(html).toMatch(/role="alert"[^>]*>โหลดรายการที่บันทึกไม่สำเร็จ/);
    expect(html).toMatch(/role="tab"[^>]*>ของฉัน</);
    expect(html).not.toContain('aria-label="บันทึก ');
  });
  it("still shows the catalogue when neither can be read", async () => {
    state.marks = null;
    state.uploads = null;
    const html = await page();
    expect(html).toContain("ค่าห้องต่อคืน");
    expect(html).toContain("ใช้แบบนี้");
    expect(html).not.toContain('aria-label="บันทึก ');
    expect(html).not.toContain("ของฉัน");
  });
});

const open = (o: Partial<Record<LibraryTool, boolean>> = {}): Record<LibraryTool, boolean> => ({ "quote-video": true, "story-clip": true, "prompt-story": false, ...o });
const unbuilt = LIBRARY.filter((i) => !i.ready);
const card = (id: string, props: Partial<Parameters<typeof LibraryCard>[0]> = {}) => renderToStaticMarkup(createElement(LibraryCard, {
  item: libraryItem(id)!, open: open(), marks: { saved: [], wanted: [], counts: {} }, busy: new Set<string>(), onOpen: () => {}, onMark: () => {}, ...props,
}));

describe("the board", () => {
  it("says so when the filter leaves nothing", () => {
    const html = renderToStaticMarkup(createElement(LibraryBoard, { items: unbuilt.slice(0, 3), open: open(), saved: [] }));
    expect(html).toContain("ไม่พบรายการที่ตรงกับตัวกรอง ลองเลือก “ทั้งหมด”");
  });

  it("an unbuilt piece says เร็วๆ นี้ and has no อยากได้ button and no count, whatever rows say", () => {
    const html = card(unbuilt[0].id, { marks: { saved: [], wanted: [unbuilt[0].id], counts: { [unbuilt[0].id]: 3 } } });
    expect(html).toContain("เร็วๆ นี้");
    expect(html).not.toContain("อยากได้");
    expect(html).not.toContain("· 3");
    expect(html).not.toContain("ใช้แบบนี้");
    // ★ stays
    expect(html).toContain(`aria-label="บันทึก ${unbuilt[0].name}"`);
  });

  it("no card on the board carries a vote", () => {
    const html = renderToStaticMarkup(createElement(LibraryBoard, { items: LIBRARY, open: open(), saved: [] }));
    expect(html).not.toContain("อยากได้");
  });

  it("a ready piece has a use and never a vote", () => {
    const html = card("room", { marks: { saved: [], wanted: ["room"], counts: { room: 5 } } });
    expect(html).toContain(`href="${amp(storyLibraryHref({ topic: "roomcost" }))}"`);
    expect(html).toContain("ใช้แบบนี้");
    expect(html).not.toContain("อยากได้");
  });

  it("a ready piece whose form is closed says ยังไม่เปิดให้ใช้", () => {
    const html = card("drama3");
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).not.toContain("/studio/prompt-story");
  });

  it("holds ★ still while its press is on its way", () => {
    expect(card("room", { busy: new Set(["save:room"]) })).toMatch(/<button[^>]*disabled=""[^>]*aria-label="บันทึก ค่าห้องต่อคืน"/);
    expect(card("room")).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="บันทึก /);
  });

  it("shows the error line under the card", () => {
    expect(card("room", { error: "บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ" })).toMatch(/role="alert"[^>]*>บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ</);
  });

  it("draws the product chips and tags in catalog.ts's words", () => {
    const html = renderToStaticMarkup(createElement(LibraryBoard, { items: LIBRARY, open: open(), saved: [] }));
    for (const name of Object.values(PRODUCT_NAME)) expect(html, name).toMatch(new RegExp(`aria-pressed="(true|false)"[^>]*>${name}</button>`));
    // a health device's tag
    expect(card("room")).toContain(`>${PRODUCT_NAME.health}</span>`);
  });
});

/** the elements a drawn tree holds, children first-class (the detail's own markup; its parts are not expanded) */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

describe("the detail", () => {
  const props = (o: Partial<DetailProps> = {}): DetailProps => ({
    item: libraryItem("room")!, open: open(), look: "paper", onLook: () => {}, onClose: () => {}, innerRef: null, ...o,
  });
  const detail = (o: Partial<DetailProps> = {}) => renderToStaticMarkup(createElement(LibraryDetail, props(o)));
  const storyHref = (html: string) => html.match(/href="(\/studio\/story-clip[^"]*)"/)?.[1].replaceAll("&amp;", "&");

  it("choosing a look changes the story link's look=", () => {
    let chosen = "paper";
    const tree = LibraryDetail(props({ onLook: (id) => { chosen = id; } }));
    const chip = elements(tree).find((e) => e.type === "button" && e.props.children === "การ์ตูนลายเส้น")!;
    expect(chip.props["aria-pressed"]).toBe(false);
    (chip.props.onClick as () => void)();
    expect(chosen).toBe("line");

    expect(storyHref(detail())).toBe("/studio/story-clip?topic=roomcost&look=paper");
    expect(storyHref(detail({ look: chosen }))).toBe("/studio/story-clip?topic=roomcost&look=line");
    expect(storyHref(detail({ look: "plot" }))).toBe("/studio/story-clip?topic=roomcost&look=plot");
  });

  it("the คลิปตามโจทย์ link follows the look too, แสงอุ่น as the form names it", () => {
    const html = detail({ look: "minimal", open: open({ "prompt-story": true }) });
    expect(html).toContain('href="/studio/prompt-story?style=warm"');
    expect(html).toContain(`href="${amp(storyLibraryHref({ topic: "roomcost", look: "minimal" }))}"`);
  });

  it("a piece with no looks keeps its own links", () => {
    expect(storyHref(detail({ item: libraryItem("look-line")! }))).toBe("/studio/story-clip?look=line");
  });

  it("an unbuilt piece says only เร็วๆ นี้: no vote line, no button", () => {
    const html = detail({ item: unbuilt[0] });
    expect(html).toMatch(/<p[^>]*>เร็วๆ นี้<\/p>/);
    expect(html).not.toContain("อยากได้");
    expect(html).not.toContain("มีสมาชิก");
    expect(html).not.toContain("ยังไม่เปิด");
  });

  it("a ready piece whose form is closed still says ยังไม่เปิดให้ใช้", () => {
    expect(detail({ open: open({ "story-clip": false }) })).toContain("ยังไม่เปิดให้ใช้");
  });
});
