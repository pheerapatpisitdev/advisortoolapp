import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { accountLinks, isCurrent, menuGroups, SALES_PAGES, SALES_SECTIONS, studioMenu } from "@/lib/shell/menu";

/**
 * The menu is the answer to "what is there", so a link in it that goes nowhere is worse than
 * no menu at all — it is the page telling somebody a thing exists when it does not.
 *
 * Checked against the filesystem rather than against a second list, because a second list is
 * the thing that drifts. If a route is renamed, this fails on the rename.
 */

const APP = path.join(process.cwd(), "src/app");
const routeExists = (href: string) => {
  const dir = href === "/" ? APP : path.join(APP, href);
  return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "page.ts"));
};

describe("every place the menu says you can go", () => {
  it("is a page that exists", () => {
    const agent = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false, wallet: true };
    const member = { ...agent, member: true };
    const owner = { ...agent, owner: true, admin: true, publish: true, connect: true, wallet: false, prices: true };
    const account = [agent, member, owner].flatMap((w) => accountLinks(w));
    for (const group of [...menuGroups(true), ...menuGroups(true, owner), ...menuGroups(false), ...menuGroups(false, member), ...studioMenu(), ...studioMenu(agent), ...studioMenu(member), ...studioMenu(owner), { links: account }]) {
      for (const link of group.links) {
        // a link to a part of a page is a link to the page
        const href = link.href.split("#")[0];
        expect(routeExists(href), `${link.label} → ${link.href}`).toBe(true);
      }
    }
  });

  it("names every sales page the site actually has", () => {
    // the pages are what a customer is sent; one missing from here is one the agent cannot
    // find from inside their own tool
    const onDisk = [
      "lifeprotect", "legacy", "plb", "easyprotect", "lifetreasure", "ishield", "ihealthy-ultra",
      "group-insurance", "bumnan95", "ci123", "cancer", "fhc",
    ];
    expect(SALES_PAGES.map((p) => p.href).sort()).toEqual(onDisk.map((s) => `/${s}`).sort());
  });

  /**
   * A sales page is a page of this tool, not a place off it.
   *
   * They used to open in a new tab, on the reading that a sales page is for the customer and
   * the calculator is for the agent. It is the same person: an agent works out a premium on
   * the sales page itself, and every jump left another tab behind until the browser was a row
   * of the same site. The `external` flag stays in the type for a genuinely off-site link;
   * nothing in the menu is one today.
   */
  it("keeps every page in the menu in the same tab", () => {
    const groups = menuGroups(false);
    const sales = groups.filter((g) => SALES_SECTIONS.some((s) => s.title === g.title));
    expect(sales).toHaveLength(SALES_SECTIONS.length);
    expect([...groups, ...menuGroups(true)].flatMap((g) => g.links).some((l) => l.external)).toBe(false);
  });

  /**
   * Eight pages in one column is a list to be read through. An agent reaching for a page
   * knows whether the customer is asking about dying, about being ill, about a hospital bill
   * or about their staff, and the headings answer that before the names are read.
   */
  it("deals the sales pages into the five kinds of cover, losing none", () => {
    // the planner comes first: it is the page for a customer who does not yet know which kind
    expect(SALES_SECTIONS.map((s) => s.title))
      .toEqual(["วางแผนประกัน", "ประกันชีวิต", "ประกันโรคร้ายแรง", "ประกันสุขภาพ", "ประกันบำนาญ", "ประกันกลุ่ม"]);
    expect(SALES_SECTIONS.flatMap((s) => s.links)).toEqual(SALES_PAGES);
    // and no page is filed under two kinds at once
    expect(new Set(SALES_PAGES.map((p) => p.href)).size).toBe(SALES_PAGES.length);
  });

  /**
   * Half these names were Thai transliterations of English the company already owns — อีซี่
   * โพรเทค 6 beside Life Protect x 2 — and one column in two conventions reads as an
   * oversight. The headings are not names and stay Thai: they are the question the agent is
   * answering when they reach for a page.
   */
  it("names every sales page in English, under headings that stay Thai", () => {
    const THAI = /[\u0E00-\u0E7F]/;
    for (const page of SALES_PAGES) {
      expect(page.label, page.href).not.toMatch(THAI);
    }
    for (const section of SALES_SECTIONS) {
      expect(section.title, section.title).toMatch(THAI);
    }
  });

  it("lists no destination twice inside one group", () => {
    for (const group of [...menuGroups(true), ...menuGroups(false), ...studioMenu()]) {
      const hrefs = group.links.map((l) => l.href);
      expect(new Set(hrefs).size, group.title ?? "(untitled)").toBe(hrefs.length);
    }
  });

  /**
   * ประกันภัยกลุ่ม was in two groups on purpose for a while — the agent's own calculator and
   * the page they turn round and show the HR manager. Then the sales pages were dealt into
   * four headings and one of them was ประกันกลุ่ม, so the pair read as a mistake and the
   * owner took the first one out. Every destination is listed once again.
   */
  it("lists every destination exactly once", () => {
    for (const signedIn of [true, false]) {
      const all = menuGroups(signedIn).flatMap((g) => g.links.map((l) => l.href));
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe("which link is lit", () => {
  it("lights the page being looked at, and its children", () => {
    expect(isCurrent("/admin/crm", "/admin/crm")).toBe(true);
    expect(isCurrent("/admin/crm", "/admin/crm/anything")).toBe(true);
    expect(isCurrent("/admin/ai", "/admin/crm")).toBe(false);
  });

  it("does not light the chat on every page in the site", () => {
    // "/" is a prefix of everything, and matching it as one lit the whole menu at once
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/", "/plb")).toBe(false);
    expect(isCurrent("/", "/admin/ai")).toBe(false);
  });

  it("keeps the overview apart from the pages under it", () => {
    expect(isCurrent("/admin", "/admin")).toBe(true);
    expect(isCurrent("/admin", "/admin/ai")).toBe(false);
  });
});

/**
 * What a customer may see, and what only an agent may.
 *
 * The owner first asked for one menu for everybody and was shown what that meant — somebody
 * arriving from an advertisement reading CRM and API — then changed their mind, which is the
 * reason this is a test and not a comment. The back office is not merely gated now; it is not
 * announced.
 *
 * The public half is not an oversight either. The calculator and the sales pages are things
 * an agent sends to customers, so a customer standing on one is meant to be able to reach the
 * others.
 */
describe("what the menu shows to somebody who has not signed in", () => {
  const hrefs = (signedIn: boolean) => menuGroups(signedIn).flatMap((g) => g.links.map((l) => l.href));

  it("keeps every back-office page out of it", () => {
    const out = hrefs(false);
    for (const secret of ["/admin", "/admin/crm", "/admin/ai", "/admin/wallet", "/admin/knowledge", "/admin/messenger", "/admin/ads", "/admin/api"]) {
      expect(out, secret).not.toContain(secret);
    }
  });

  it("still offers the pages a customer is sent to", () => {
    const out = hrefs(false);
    expect(out).toContain("/home");
    expect(out).toContain("/ask");
    expect(out).not.toContain("/other-plans");
    for (const page of SALES_PAGES) expect(out).toContain(page.href);
  });

  /**
   * The owner's rule (2026-09-23): inside /admin the menu is the back office and only the
   * back office. The sales pages, the calculator and the assistant are reached from the mark
   * at the top, which goes home.
   */
  it("gives the back office its own tools and nothing else", () => {
    expect(hrefs(true).sort()).toEqual(
      // /admin/knowledge (สอน AI) left the menu on 2026-09-23 and came back on 2026-09-26, with
      // the daily บทเรียนจากแชท on it. /admin/posting (ออโต้โพสต์) was asked for on 2026-09-25
      // /admin/wallet (กระเป๋าเงินตัวแทน) joined on 2026-09-30 with the Studio wallet
      // /admin/members (สมาชิกทั่วไป) joined on 2026-10-01 with sign-up for people outside UnitOS
      // /admin/welcome (ข้อความต้อนรับ) joined on 2026-10-04: each Page's greeting
      // /admin/teach (ห้องสอนบอท) joined on 2026-10-11: the test chat and taught answers
      // /home (ระบบหลัก) is its first line since 2026-10-14, as it is in Studio's
      ["/home", "/admin", "/admin/crm", "/admin/ai", "/admin/wallet", "/admin/members", "/admin/knowledge", "/admin/teach", "/admin/messenger", "/admin/welcome", "/admin/posting", "/admin/ads", "/admin/api"].sort(),
    );
  });

  it("groups the back office by the job, with the way back first (owner chose ข, 2026-10-14)", () => {
    const owner = { name: "a", room: "r", publish: true, connect: true, admin: true, owner: true };
    const groups = menuGroups(true, owner);
    expect(groups.map((g) => g.title ?? null)).toEqual([null, "ลูกค้าและแชท", "บอท", "การตลาด", "คนและเงิน", "ตั้งค่าระบบ"]);
    expect(groups.map((g) => g.links.map((l) => l.href))).toEqual([
      ["/home", "/admin"],
      ["/admin/crm", "/admin/messenger"],
      ["/admin/welcome", "/admin/knowledge", "/admin/teach"],
      ["/admin/posting", "/admin/ads"],
      ["/admin/team", "/admin/members", "/admin/wallet", "/admin/stats"],
      ["/admin/ai", "/admin/api"],
    ]);
    expect(groups[1].links[0].label).toBe("ลูกค้าจากแชท");
    // an assistant who answers chats: the way back and the inbox, nothing else
    const chats = menuGroups(true, { ...owner, publish: false, admin: false, owner: false });
    expect(chats.flatMap((g) => g.links.map((l) => l.href))).toEqual(["/home", "/admin/messenger"]);
    // an admin who is not the owner: no team and no spend
    const admin = menuGroups(true, { ...owner, owner: false }).flatMap((g) => g.links.map((l) => l.href));
    expect(admin).not.toContain("/admin/team");
    expect(admin).not.toContain("/admin/stats");
  });

  it("gives no agent a way to the back office, the owner's own account included (owner, 2026-10-15)", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const offices = (w: typeof who | null) => [...menuGroups(false, w), ...studioMenu(w ?? undefined)].flatMap((g) => g.links).filter((l) => l.label === "หลังบ้าน").map((l) => l.href);
    expect(offices(null)).toEqual([]);
    expect(offices(who)).toEqual([]);
    expect(offices({ ...who, publish: true })).toEqual([]);
    expect(offices({ ...who, connect: true })).toEqual([]);
    expect(offices({ ...who, admin: true, connect: true })).toEqual([]);
    expect(offices({ ...who, owner: true, admin: true, connect: true, publish: true })).toEqual([]);
  });

  it("gives the Super Admin the back office with no way back to the front (owner, 2026-10-15)", () => {
    const superAdmin = { name: "x@gmail.com", room: "Super Admin", publish: true, connect: true, admin: true, owner: true, super: true };
    const back = menuGroups(true, superAdmin).flatMap((g) => g.links.map((l) => l.href));
    expect(back).not.toContain("/home");
    expect(back).toContain("/admin/wallet");
    expect(back).toContain("/admin/team");
    expect(back).toContain("/admin/stats");
    // on a public page, only the way back to the back office
    expect(menuGroups(false, superAdmin).flatMap((g) => g.links.map((l) => l.href))).toEqual(["/admin"]);
    // no account page, wallet, price list or pass
    expect(accountLinks(superAdmin)).toEqual([]);
  });

  it("names no group a signed-out reader has nothing in", () => {
    // an empty heading is a heading that says something is being kept from you
    for (const group of menuGroups(false)) expect(group.links.length).toBeGreaterThan(0);
  });

  it("puts the agent's own work first: หน้าหลัก, their FHC customers, ถาม AI, Studio (owner chose ข, 2026-10-14)", () => {
    const who = { name: "ก", room: "สมาชิกทั่วไป", publish: false, connect: false, admin: false, owner: false };
    const first = (w: typeof who | null) => menuGroups(false, w)[0];
    expect(first({ ...who, member: true } as typeof who).links.map((l) => l.href)).toEqual(["/home", "/fhc/customers", "/ask", "/studio"]);
    expect(first({ ...who, admin: true }).links.map((l) => l.href)).toEqual(["/home", "/fhc/customers", "/ask", "/studio"]);
    expect(first(null).title).toBe("งานของฉัน");
    // the membership pass is in the account box now, in no menu's list
    const hrefs = (w: typeof who | null) => [...menuGroups(false, w), ...menuGroups(true, w), ...studioMenu(w)].flatMap((g) => g.links.map((l) => l.href));
    for (const w of [who, { ...who, member: true } as typeof who, null]) expect(hrefs(w)).not.toContain("/membership");
  });
});

describe("the account box at the foot of every menu (owner chose ข, 2026-10-14)", () => {
  const base = { name: "ก", room: "r", publish: false, connect: false, admin: false, owner: false };
  const hrefs = (w: Parameters<typeof accountLinks>[0]) => accountLinks(w).map((l) => l.href);

  it("is empty for somebody not signed in", () => {
    expect(accountLinks(null)).toEqual([]);
    expect(accountLinks()).toEqual([]);
  });

  it("gives everyone their account page; a member their pass after the wallet", () => {
    expect(hrefs(base)).toEqual(["/studio/account"]);
    expect(hrefs({ ...base, wallet: true, prices: true })).toEqual(["/studio/account", "/studio/wallet"]);
    expect(hrefs({ ...base, member: true, wallet: true, prices: true })).toEqual(["/studio/account", "/studio/wallet", "/membership"]);
    expect(accountLinks({ ...base, member: true }).find((l) => l.href === "/membership")).toMatchObject({ label: "สมาชิก", icon: "key", hue: "#2b736f" });
  });

  it("gives the wallet to every agent and assistant while it is on; only the owner writes without one (owner, 2026-10-02)", () => {
    const who = { ...base, wallet: true };
    expect(hrefs(who)).toContain("/studio/wallet");
    expect(hrefs({ ...who, publish: true })).toContain("/studio/wallet");
    expect(hrefs({ ...who, connect: true })).toContain("/studio/wallet");
    expect(hrefs({ ...who, admin: true })).toContain("/studio/wallet");
    expect(hrefs({ ...who, owner: true })).not.toContain("/studio/wallet");
    expect(hrefs({ ...base, wallet: false })).not.toContain("/studio/wallet");
    expect(hrefs(base)).not.toContain("/studio/wallet");
  });

  it("lists ราคา only for whoever has no กระเป๋าเงิน: the wallet page holds the prices (owner, 2026-10-13)", () => {
    const who = { ...base, wallet: true, prices: true };
    expect(hrefs(who)).not.toContain("/studio/wallet#prices");
    expect(hrefs({ ...who, owner: true, wallet: false })).toContain("/studio/wallet#prices");
    expect(hrefs({ ...who, owner: true, wallet: false, prices: false })).not.toContain("/studio/wallet#prices");
  });
});

describe("Studio's own menu", () => {
  it("lists Studio's pages under two headings, the way back first (owner chose ข, 2026-10-14)", () => {
    const groups = studioMenu();
    expect(groups.map((g) => g.title ?? null)).toEqual([null, "สร้างงาน", "วางแผนและคลัง"]);
    expect(groups.map((g) => g.links.map((l) => l.href))).toEqual([
      ["/home", "/studio"],
      ["/studio/quote-video", "/studio/write", "/studio/thumbnail", "/studio/describe"],
      ["/studio/calendar", "/studio/hooks", "/studio/people"],
    ]);
    expect(groups[0].links[0]).toMatchObject({ label: "ระบบหลัก", icon: "back" });
  });

  it("keeps the front page for admins and assistants; agents start at the workbench; no back office (owner, 2026-10-15)", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const top = (w: typeof who) => studioMenu(w)[0].links.map((l) => l.href);
    expect(top(who)).toEqual(["/home"]);
    expect(top({ ...who, admin: true, publish: true })).toEqual(["/home", "/studio"]);
    // an assistant has an agent's Studio and the front page to choose among their Pages (owner, 2026-10-02)
    expect(top({ ...who, publish: true })).toEqual(["/home", "/studio"]);
    expect(top({ ...who, publish: true, connect: true })).toEqual(["/home", "/studio"]);
  });

  it("lists ภาพปกคลิป right after Organic Studio, for everyone who has Studio (owner, 2026-10-09; opened to all 2026-10-14)", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const owner = { ...who, owner: true, admin: true, publish: true, connect: true };
    for (const w of [undefined, who, { ...who, member: true }, { ...who, publish: true }, { ...who, admin: true, publish: true, connect: true }, owner]) {
      const links = studioMenu(w as typeof who).flatMap((g) => g.links);
      const at = links.findIndex((l) => l.href === "/studio/write");
      expect(links[at + 1]).toMatchObject({ href: "/studio/thumbnail", label: "ภาพปกคลิป", icon: "image" });
      expect(links.map((l) => l.href)).toContain("/studio/describe");
    }
    const hrefs = studioMenu(owner).flatMap((g) => g.links).map((l) => l.href);
    expect(hrefs.indexOf("/studio/describe")).toBeLessThan(hrefs.indexOf("/studio/ads"));
  });

  it("keeps the wallet, the prices, the pass and the account out of Studio's list: they are in the account box", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false, wallet: true, prices: true, member: true };
    const hrefs = studioMenu(who).flatMap((g) => g.links).map((l) => l.href);
    for (const h of ["/studio/wallet", "/studio/wallet#prices", "/membership", "/studio/account"]) expect(hrefs).not.toContain(h);
  });

  it("lists the ad launch for the owner alone (owner, 2026-10-04)", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const hrefs = (w?: typeof who) => studioMenu(w).flatMap((g) => g.links).map((l) => l.href);
    expect(hrefs({ ...who, owner: true, admin: true, publish: true, connect: true })).toContain("/studio/ads");
    const label = studioMenu({ ...who, owner: true, admin: true, publish: true, connect: true }).flatMap((g) => g.links).find((l) => l.href === "/studio/ads")?.label;
    expect(label).toBe("Ads Studio");
    // an admin who is not the owner, an assistant, a plain agent, a member and a signed-out reader
    expect(hrefs({ ...who, admin: true, publish: true, connect: true })).not.toContain("/studio/ads");
    expect(hrefs({ ...who, publish: true })).not.toContain("/studio/ads");
    expect(hrefs(who)).not.toContain("/studio/ads");
    expect(hrefs({ ...who, member: true } as typeof who)).not.toContain("/studio/ads");
    expect(hrefs()).not.toContain("/studio/ads");
  });

  it("opens no back-office page to an assistant who only posts (owner, 2026-10-02)", () => {
    const who = { name: "a", room: "r", publish: true, connect: false, admin: false, owner: false };
    expect(menuGroups(true, who)).toEqual([]);
    // ออโต้โพสต์ is the Pages' settings, not where a post is made: the admins'
    expect(menuGroups(true, { ...who, admin: true }).flatMap((g) => g.links.map((l) => l.href))).toContain("/admin/posting");
  });

  it("gives every agent วิดีโอนำเสนอ: two free clips, then the wallet (owner, 2026-10-11)", () => {
    const base = { name: "ก", room: "r", publish: false, connect: false, admin: false, owner: false };
    const hrefs = (who: typeof base) => studioMenu(who).flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs(base)).toContain("/studio/quote-video");
    expect(hrefs({ ...base, owner: true })).toContain("/studio/quote-video");
  });


  it("lights the front page only on /studio itself, not on the pages beside it", () => {
    expect(isCurrent("/studio", "/studio")).toBe(true);
    expect(isCurrent("/studio", "/studio/calendar")).toBe(false);
    expect(isCurrent("/studio", "/studio/write")).toBe(false);
    expect(isCurrent("/studio/write", "/studio/write")).toBe(true);
    expect(isCurrent("/studio/calendar", "/studio/calendar")).toBe(true);
  });
});
