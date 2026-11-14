import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * คลังแอนิเมชัน's page and board, drawn on the server for their first markup: who may follow which
 * link, the votes, the owner's tab, and a marks table that cannot be read (not migrated yet).
 */
const state = vi.hoisted(() => ({
  viewer: null as unknown as Viewer,
  gated: [] as string[],
  marks: null as null | { saved: string[]; wanted: string[] },
  counts: null as null | Record<string, number>,
  closed: {} as Record<string, string | null>,
  uploads: { mine: [], shared: [], waiting: [] } as null | { mine: unknown[]; shared: unknown[]; waiting: unknown[] },
  asked: [] as unknown[],
}));

vi.mock("@/lib/auth/viewer", () => ({
  gatePage: async (path: string) => { state.gated.push(path); return state.viewer; },
  requireMember: async () => state.viewer,
}));
vi.mock("@/lib/scene-library/marks", () => ({
  marksOf: async () => { if (!state.marks) throw new Error("relation \"ins_library_marks\" does not exist"); return state.marks; },
  wantCounts: async () => { if (!state.counts) throw new Error("relation \"ins_library_marks\" does not exist"); return state.counts; },
}));
vi.mock("@/lib/scene-library/uploads", () => ({ uploadViews: async (who: unknown) => { state.asked.push(who); return state.uploads; } }));
vi.mock("@/lib/switches/store", () => ({ closedFor: async (_v: unknown, key: string) => state.closed[key] ?? null }));
vi.mock("@/app/studio/library/actions", () => ({ toggleLibraryMark: vi.fn() }));

import { OWNER } from "../helpers/signed-in";
import { LIBRARY, libraryItem, PRODUCT_NAME, storyLibraryHref, type LibraryTool } from "@/lib/scene-library/catalog";
import LibraryPage from "@/app/studio/library/page";
import { LibraryBoard, LibraryCard, LibraryDetail, MostWanted, type DetailProps } from "@/app/studio/library/LibraryBoard";

const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", code: "123456", name: "ตัวแทน", staff: null };
const page = async () => renderToStaticMarkup(await LibraryPage());
const amp = (s: string) => s.replaceAll("&", "&amp;");

beforeEach(() => {
  state.viewer = AGENT;
  state.gated = [];
  state.marks = { saved: [], wanted: [] };
  state.counts = {};
  state.closed = {};
  state.uploads = { mine: [], shared: [], waiting: [] };
  state.asked = [];
});

describe("the page and the members' uploads", () => {
  it("reads the uploads for this viewer, and for the owner as the owner", async () => {
    await page();
    expect(state.asked).toEqual([{ agentId: AGENT.agentId, owner: false }]);
    state.viewer = OWNER;
    await page();
    expect(state.asked[1]).toEqual({ agentId: OWNER.agentId, owner: true });
  });
  it("shows the upload tabs when they can be read", async () => {
    expect(await page()).toContain(">อัปโหลด<");
  });
  it("says so, and leaves the upload tabs out, when they cannot be read", async () => {
    state.uploads = null;
    const html = await page();
    expect(html).toMatch(/role="alert"[^>]*>โหลดไฟล์ที่อัปโหลดไม่สำเร็จ/);
    expect(html).not.toContain(">อัปโหลด<");
    expect(html).not.toContain("คิวตรวจ");
    expect(html).toContain("ค่าห้องต่อคืน");
  });
});

describe("the page", () => {
  it("asks who is calling itself", async () => {
    await page();
    expect(state.gated).toEqual(["/studio/library"]);
  });

  it("gives an agent no way into คลิปตามโจทย์, and the story form's link", async () => {
    const html = await page();
    expect(html).not.toContain("/studio/prompt-story");
    expect(html).toContain(`href="${amp(storyLibraryHref({ topic: "roomcost" }))}"`);
    expect(html).toContain('href="/studio/quote-video"');
  });

  it("a switched-off form takes its links away, and a piece with none left says so", async () => {
    state.closed = { "story-clip": "ปิดปรับปรุง" };
    const html = await page();
    expect(html).not.toContain("/studio/story-clip");
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).toContain('href="/studio/quote-video"');
  });

  it("gives the owner คลิปตามโจทย์ and the อยากได้มากสุด tab; an agent has no such tab", async () => {
    expect(await page()).not.toContain("อยากได้มากสุด");
    state.viewer = OWNER;
    const html = await page();
    expect(html).toContain("/studio/prompt-story?format=drama3");
    expect(html).toContain("อยากได้มากสุด");
  });

  it("draws the viewer's saves", async () => {
    state.marks = { saved: ["room"], wanted: [] };
    const html = await page();
    expect(html).toMatch(/aria-pressed="true" aria-label="บันทึก ค่าห้องต่อคืน"/);
    expect(html).toMatch(/ของฉัน<span[^>]*>1<\/span>/);
  });

  it("with the marks unread but the uploads readable, ของฉัน stays for ไฟล์ที่ฉันส่ง", async () => {
    state.marks = null;
    const html = await page();
    expect(html).toMatch(/role="tab"[^>]*>ของฉัน</);
    expect(html).not.toContain('aria-label="บันทึก ');
  });

  it("still shows the catalogue when the marks cannot be read, saying so for that part alone", async () => {
    state.marks = null;
    state.uploads = null;
    const html = await page();
    expect(html).toMatch(/role="alert"[^>]*>โหลดรายการที่บันทึกและจำนวนคนอยากได้ไม่สำเร็จ/);
    expect(html).toContain("ค่าห้องต่อคืน");
    expect(html).toContain("ใช้แบบนี้");
    expect(html).not.toContain('aria-label="บันทึก ');
    expect(html).not.toContain("ของฉัน");
  });

  it("the same when only the vote counts fail", async () => {
    state.counts = null;
    const html = await page();
    expect(html).toContain("โหลดรายการที่บันทึกและจำนวนคนอยากได้ไม่สำเร็จ");
    expect(html).toContain("ค่าห้องต่อคืน");
    expect(html).not.toContain('aria-label="บันทึก ');
  });
});

const open = (o: Partial<Record<LibraryTool, boolean>> = {}): Record<LibraryTool, boolean> => ({ "quote-video": true, "story-clip": true, "prompt-story": false, ...o });
const unbuilt = LIBRARY.filter((i) => !i.ready);
const card = (id: string, props: Partial<Parameters<typeof LibraryCard>[0]> = {}) => renderToStaticMarkup(createElement(LibraryCard, {
  item: libraryItem(id)!, open: open(), marks: { saved: [], wanted: [], counts: {} }, busy: new Set<string>(), onOpen: () => {}, onMark: () => {}, ...props,
}));

describe("the board", () => {
  it("says so when the filter leaves nothing", () => {
    const html = renderToStaticMarkup(createElement(LibraryBoard, { items: unbuilt.slice(0, 3), open: open(), saved: [], wanted: [], counts: {}, owner: false }));
    expect(html).toContain("ไม่พบรายการที่ตรงกับตัวกรอง ลองเลือก “ทั้งหมด”");
  });

  it("an unbuilt piece shows its votes and the viewer's own", () => {
    const html = card(unbuilt[0].id, { marks: { saved: [], wanted: [unbuilt[0].id], counts: { [unbuilt[0].id]: 3 } } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>อยากได้ · 3</);
    expect(html).toContain("เร็วๆ นี้");
    expect(html).not.toContain("ใช้แบบนี้");
  });

  it("a ready piece has a use and never a vote, whatever rows say", () => {
    const html = card("room", { marks: { saved: [], wanted: ["room"], counts: { room: 5 } } });
    expect(html).toContain(`href="${amp(storyLibraryHref({ topic: "roomcost" }))}"`);
    expect(html).toContain("ใช้แบบนี้");
    expect(html).not.toContain("อยากได้");
  });

  it("a ready piece the viewer cannot open says ยังไม่เปิดให้ใช้ and takes no vote", () => {
    const html = card("drama3");
    expect(html).toContain("ยังไม่เปิดให้ใช้");
    expect(html).not.toContain("/studio/prompt-story");
    expect(html).not.toContain("อยากได้");
  });

  it("holds a button still while its press is on its way", () => {
    const id = unbuilt[0].id;
    const html = card(id, { busy: new Set([`want:${id}`]) });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>อยากได้ · 0</);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="บันทึก /);
  });

  it("shows the error line under the card", () => {
    expect(card("room", { error: "บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ" })).toMatch(/role="alert"[^>]*>บันทึกไม่สำเร็จ ลองกดอีกครั้งนะครับ</);
  });

  it("draws the product chips and tags in catalog.ts's words", () => {
    const html = renderToStaticMarkup(createElement(LibraryBoard, { items: LIBRARY, open: open(), saved: [], wanted: [], counts: {}, owner: false }));
    for (const name of Object.values(PRODUCT_NAME)) expect(html, name).toMatch(new RegExp(`aria-pressed="(true|false)"[^>]*>${name}</button>`));
    // a health device's tag
    expect(card("room")).toContain(`>${PRODUCT_NAME.health}</span>`);
  });

  it("the owner's list: unfinished pieces by votes, most first, ready ones left out", () => {
    const [a, b] = unbuilt;
    const html = renderToStaticMarkup(createElement(MostWanted, { items: LIBRARY, counts: { [a.id]: 2, [b.id]: 9, room: 50 } }));
    expect(html.indexOf(b.name)).toBeGreaterThan(-1);
    expect(html.indexOf(b.name)).toBeLessThan(html.indexOf(a.name));
    expect(html).not.toContain("ค่าห้องต่อคืน");
    expect(html).toContain("9 คน");
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
    item: libraryItem("room")!, open: open(), marks: { saved: [], wanted: [], counts: {} }, busy: new Set<string>(), look: "paper",
    onLook: () => {}, onClose: () => {}, onMark: () => {}, innerRef: null, ...o,
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

  it("an unbuilt piece says เร็วๆ นี้ with its votes, or plain เร็วๆ นี้ with the marks unread", () => {
    const id = unbuilt[0].id;
    const html = detail({ item: unbuilt[0], marks: { saved: [], wanted: [], counts: { [id]: 4 } } });
    expect(html).toContain("เร็วๆ นี้ มีสมาชิก 4 คนอยากได้ ยิ่งคนอยากได้มาก แอดมินยิ่งทำก่อน");
    expect(html).not.toContain("ยังไม่เปิด");
    const unread = detail({ item: unbuilt[0], marks: null });
    expect(unread).toMatch(/<p[^>]*>เร็วๆ นี้<\/p>/);
    expect(unread).not.toContain("ยังไม่เปิด");
  });

  it("a ready piece the viewer cannot open still says ยังไม่เปิดให้ใช้", () => {
    expect(detail({ open: open({ "story-clip": false }) })).toContain("ยังไม่เปิดให้ใช้");
  });
});
