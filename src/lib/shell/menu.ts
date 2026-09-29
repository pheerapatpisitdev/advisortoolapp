/**
 * Everywhere this system can be reached from, in one list.
 *
 * Until now it was three lists that did not know about each other: the back office's own row
 * of links, the calculator's row of sales pages, and a single "way home" button on each sales
 * page. Somebody who had not built it could not tell from any one of them what else there
 * was — which is the second of the four things the owner asked to fix.
 *
 * The owner chose for this menu to appear on every page, including the sales pages a customer
 * reaches from an advertisement, after being told that means a customer sees CRM and API in
 * it. That decision lives here rather than in a condition: what changes with a session is
 * only the way out, because a sign-out button shown to somebody who never signed in is not a
 * preference, it is a button that does nothing.
 */

/** The drawings the menu has. One per kind of work, not one per link — see `icon` below. */
export type MenuIcon =
  | "grid"
  | "calc"
  | "spark"
  | "users"
  | "key"
  | "chat"
  | "megaphone"
  | "plug"
  | "shield"
  | "home"
  | "umbrella"
  | "gem"
  | "shieldCheck"
  | "heart"
  | "building"
  | "clock"
  | "pulse"
  | "ribbon"
  | "pen"
  | "studio"
  | "calendar"
  | "quote"
  | "woman";

export interface MenuLink {
  href: string;
  label: string;
  /** which drawing sits on its chip */
  icon: MenuIcon;
  /**
   * The item's own colour.
   *
   * This is the one place in the shell where a colour is written down, and the exception is
   * narrow on purpose. Every other colour here is a `--shell-*` variable because the same
   * menu is worn by six sales pages running from near-black to warm cream, and a literal
   * picked to look right on one of them vanishes on another — a mistake this project has
   * made twice.
   *
   * A hue is safe from that because it is never laid on the page's ground: it fills a chip
   * of its own, the chip carries white ink, and the chip's edge is drawn by the relief in
   * `globals.css` rather than by the difference between the hue and whatever is behind it.
   * What it buys is recognition — after a week the agent reaches for one of these without
   * reading the word.
   *
   * These used to be a full spectrum, one hue per item picked to lean toward the page it
   * opened. That worked when six sales pages ran from near-black to warm cream and the menu
   * was the only thing tying them together. The application is one palette now, and a
   * sixteen-colour rainbow down the side of a navy-and-sand page is the loudest thing on it.
   *
   * So they are one arc instead of a spectrum: teal at the top of the menu through the
   * palette's own navy in the middle to plum at the bottom, in the order the menu is read.
   * Nothing warm, because warm is the sand's, and the sand means something. Every chip still
   * has its own colour and its own place on the arc, every one carries white at 4.7:1 or
   * better, and the sidebar as a whole now reads as one object rather than as a paintbox.
   *
   * Assigned by position rather than by subject, so adding a link means re-cutting the arc
   * rather than choosing a colour — which is the point: no one here is picking colours.
   */
  hue: string;
  /** True only for links that leave this application. */
  external?: boolean;
}

export interface MenuGroup {
  title?: string;
  links: MenuLink[];
}

/**
 * The eleven sales pages, in the five kinds of cover the agency sells.
 *
 * Grouped because eleven names in one column is a list to be read through, and an agent
 * reaching for a page is not reading — they know whether the customer in front of them is
 * asking about dying, about being ill, about a hospital bill, about retiring, or about their
 * staff. The headings answer that before the names are read at all.
 *
 * A plan sits under what it is bought for, not under what it is built from. มรดกเพื่อครอบครัว
 * is a life contract with a critical-illness rider on it and iShield is a whole life policy,
 * and nobody buys either for the life cover: they buy the money that arrives on the day of a
 * diagnosis. Filing them under ประกันชีวิต would be filing them where nobody would look.
 *
 * Written out rather than generated from the plan registry, which is what the design said
 * before the two were compared: there are eight pages and six plans, `/legacy` is a way of
 * selling Life Protect rather than a plan of its own, iSmart has no page at all, and
 * `/group-insurance` is not a life plan and is not in the registry. A list generated from
 * the registry would therefore invent a link to nowhere and miss three that exist.
 *
 * Each one's hue leans toward the page it opens — copper for iShield, gold for the legacy
 * bundle, the corporate navy for group insurance — so the menu and the page an agent lands
 * on are plainly the same thing.
 */
/**
 * The eleven names are English; the five headings above them are not.
 *
 * Four of these read as Thai transliterations of English names the company already owns —
 * อีซี่ โพรเทค 6 is Easy Protect 6 — and set beside Life Protect x 2, iShield and iHealthy
 * Ultra they made one column look like two conventions. The headings stay Thai because they
 * are not names: they are the question an agent is answering when they reach for a page, and
 * that question is asked in Thai.
 *
 * Family Legacy is the one name here the company did not supply. The bundle is the agency's
 * own and มรดกเพื่อครอบครัว is what it calls it, so the English is this menu's alone — which
 * is why it stops at this menu. Every page, quotation and message still says the Thai name,
 * because that is the name the customer was sold.
 */
export const SALES_SECTIONS: { title: string; links: MenuLink[] }[] = [
  {
    // the customer's own planner: which of the plans below, and how much, from their own figures
    title: "วางแผนประกัน",
    links: [
      { href: "/plan", label: "Insurance Planner", icon: "calc", hue: "#3a2b73" },
      // the agency's own questionnaire: scores first, then the same plan /plan builds
      { href: "/fhc", label: "Financial Health Check", icon: "pulse", hue: "#35306e" },
    ],
  },
  {
    title: "ประกันชีวิต",
    links: [
      { href: "/lifeprotect", label: "Life Protect x 2", icon: "shield", hue: "#412b73" },
      { href: "/plb", label: "Protection Life", icon: "umbrella", hue: "#5c338a" },
      { href: "/easyprotect", label: "Easy Protect 6", icon: "clock", hue: "#5a2b73" },
      { href: "/lifetreasure", label: "Life Treasure", icon: "gem", hue: "#7a338a" },
    ],
  },
  {
    title: "ประกันโรคร้ายแรง",
    links: [
      { href: "/legacy", label: "Family Legacy", icon: "home", hue: "#722b73" },
      { href: "/ishield", label: "iShield", icon: "shieldCheck", hue: "#8a337c" },
      // a rider sold on the smallest Life Protect x 2, which is why it is here and not a plan
      { href: "/ci123", label: "CI 123", icon: "pulse", hue: "#7c2d6e" },
      // the agency's own cancer set, CPR and HIC on a Life Protect x 2 that rises with CPR
      { href: "/cancer", label: "Cancer", icon: "ribbon", hue: "#862f6a" },
    ],
  },
  {
    title: "ประกันสุขภาพ",
    links: [
      { href: "/ihealthy-ultra", label: "iHealthy Ultra", icon: "heart", hue: "#732b5b" },
    ],
  },
  {
    // its own kind: bought for an income after work stops, which none of the three above is
    title: "ประกันบำนาญ",
    links: [
      // the owner's choice: the page's own address, which is also what an agent says out loud
      { href: "/bumnan95", label: "bumnan95", icon: "clock", hue: "#7e2f5d" },
    ],
  },
  {
    title: "ประกันกลุ่ม",
    links: [
      { href: "/group-insurance", label: "Group Insurance", icon: "building", hue: "#8a335e" },
    ],
  },
];

/**
 * The same eleven, flat.
 *
 * `/other-plans` lists them as cards in one grid and has no use for the headings, and the
 * test that checks none of the pages on disk has been left out of the menu counts them here.
 * Derived rather than written twice, so a page added to a section cannot go missing from the
 * grid — which is the way round this went wrong when the list lived inside the calculator.
 */
export const SALES_PAGES: MenuLink[] = SALES_SECTIONS.flatMap((s) => s.links);

/**
 * The two menus: the back office's, and everybody else's.
 *
 * Inside /admin the menu lists the back-office tools and nothing more. It used to carry the
 * whole site as well — the calculator, the assistant, the content workbench and all eleven
 * sales pages under the back office's seven — and the tools the owner opens /admin for were
 * a third of a long column. The owner asked for the back office's menu to hold only the back
 * office (2026-09-23). The rest of the site is one click away on the mark at the top, which
 * goes home.
 *
 * Everywhere else the back office is not in it at all. A gate is a different thing from a
 * sign: naming the pages tells a stranger the shape of the tool and where to knock. What is
 * left is what an agent sends customers anyway — the calculator, the assistant, the sales
 * pages — so a customer standing on one can still reach the others.
 */
export function menuGroups(signedIn: boolean, who?: Who | null): MenuGroup[] {
  if (signedIn) {
    const groups: MenuGroup[] = [
      {
        links: [
          { href: "/admin", label: "ภาพรวม", icon: "grid", hue: "#2b736f" },
          { href: "/admin/crm", label: "ลูกค้า", icon: "users", hue: "#33638a" },
        ],
      },
      {
        title: "ผู้ช่วย AI",
        links: [
          { href: "/admin/ai", label: "ตั้งค่า AI", icon: "key", hue: "#2b4673" },
          // back in the menu on 2026-09-26 (owner): the daily บทเรียนจากแชท waits here for ใช้
          { href: "/admin/knowledge", label: "สอน AI", icon: "spark", hue: "#2e4a7a" },
        ],
      },
      {
        title: "ช่องทาง",
        links: [
          { href: "/admin/messenger", label: "Messenger", icon: "chat", hue: "#2b2e73" },
          // the same Page connection, seen from the content workbench: can it post, what went up
          { href: "/admin/posting", label: "ออโต้โพสต์", icon: "pen", hue: "#302f79" },
          // the advertising account sits next to the inbox it fills
          { href: "/admin/ads", label: "ADS", icon: "megaphone", hue: "#352f80" },
          { href: "/admin/api", label: "MCP", icon: "plug", hue: "#3e338a" },
        ],
      },
    ];
    if (!who) return groups;
    // the owner's list of assistants, and nobody else's business
    if (who.owner) groups.push({ links: [{ href: "/admin/team", label: "ทีมงาน", icon: "users", hue: "#472f8a" }] });
    // an assistant sees the doors they may open; a sign on a locked door is still a sign
    return groups
      .map((g) => ({ ...g, links: g.links.filter((l) => who[BACK_OFFICE_PERM[l.href] ?? "owner"]) }))
      .filter((g) => g.links.length > 0);
  }

  /**
   * ประกันภัยกลุ่ม used to be here as well as under its own heading below.
   *
   * It earned the repeat: it is the agent's own calculator — several groups of employees, a
   * total, a quotation — and it is what gets turned round and shown to the HR manager. The
   * owner was asked which of the two it was and answered both.
   *
   * Then the sales pages were dealt into the four kinds of cover, and one of those headings
   * is ประกันกลุ่ม. Two links a few lines apart, one called ประกันกลุ่ม and one called
   * ประกันภัยกลุ่ม, read as a mistake however well meant — so the owner took this one out.
   * The page is still both things; it is now reached from one place.
   */
  const groups: MenuGroup[] = [{
    title: "งานขาย",
    links: [
      // "จัดแบบเอง" rather than "คำนวณเบี้ย": every sales page in this menu works out a
      // premium too, so naming this one after the arithmetic said nothing about what is
      // different here — which is that the agent builds the arrangement themselves, plan by
      // rider, instead of being walked through one plan's own questions.
      { href: "/other-plans", label: "จัดแบบเอง", icon: "calc", hue: "#327d86" },
      { href: "/", label: "ถาม AI", icon: "spark", hue: "#2b5f73" },
      // for UnitOS agents, who sign in with their code on the way in (owner, 2026-09-27)
      { href: "/studio", label: "Studio", icon: "studio", hue: "#2e5a80" },
    ],
  }];

  // Sales pages are part of the calculator, so the sidebar keeps the user in the same tab.
  // `external` remains available for a genuinely off-site link added in the future.
  for (const section of SALES_SECTIONS) {
    groups.push({ title: section.title, links: section.links });
  }
  return groups;
}

/**
 * Studio's own menu. Pressing Studio leaves the application's menu behind for this one, so
 * the workbench reads as a place of its own (owner, 2026-09-27) — its pages down the side
 * where the tab row used to be, and one way back out. New Studio tools are added here.
 */
export function studioMenu(who?: Who | null): MenuGroup[] {
  const links: MenuLink[] = [
    // the front page: a card per Page with these tools under it, for admins (owner, 2026-09-28)
    { href: "/studio", label: "หน้ารวม", icon: "grid", hue: "#2b736f" },
    // the writer: Maryjane from 2026-09-27, Organic Studio from 2026-09-28 (owner)
    { href: "/studio/write", label: "Organic Studio", icon: "pen", hue: "#2e5a80" },
    { href: "/studio/calendar", label: "ปฏิทินโพสต์", icon: "calendar", hue: "#2e4a7a" },
    { href: "/studio/hooks", label: "คลังสูตรประโยคเปิด", icon: "quote", hue: "#302f79" },
    { href: "/studio/people", label: "คลังบุคคล", icon: "users", hue: "#352f80" },
  ];
  // the calendar is the Page's, so it is for the staff who post to it (owner, 2026-09-27);
  // the front page is the admins' and the posting staff's, who pick among their own Pages there
  // (2026-09-29) — every other agent's Studio starts at the workbench
  const hidden = new Set([...(who && !who.publish ? ["/studio/calendar"] : []), ...(who && !who.admin && !who.publish ? ["/studio"] : [])]);
  const shown = links.filter((l) => !hidden.has(l.href));
  const back: MenuLink[] = [{ href: "/", label: "กลับระบบหลัก", icon: "home", hue: "#2b5f73" }];
  // staff get a way to the back office, landing on the first page of it they may open
  const office = !who ? null : who.admin ? "/admin" : who.connect ? "/admin/messenger" : who.publish ? "/admin/posting" : null;
  if (office) back.unshift({ href: office, label: "หลังบ้าน", icon: "grid", hue: "#2b736f" });
  return [{ title: "Studio", links: shown }, { links: back }];
}

/**
 * Who is looking at the menu, reduced to what the menu needs: a name to show at its foot and
 * which doors to list. Built on the server from the session (src/lib/auth/viewer.ts) and
 * handed down, because the menu is drawn in the browser and must not decide anything itself —
 * every door it lists is checked again where it opens.
 */
export interface Who {
  name: string;
  room: string;
  publish: boolean;
  connect: boolean;
  admin: boolean;
  owner: boolean;
}

/** What each back-office page asks of the person opening it, as agreed on 2026-09-27. */
const BACK_OFFICE_PERM: Record<string, keyof Omit<Who, "name" | "room">> = {
  "/admin": "admin",
  "/admin/crm": "admin",
  "/admin/ai": "admin",
  "/admin/knowledge": "admin",
  "/admin/messenger": "connect",
  "/admin/posting": "publish",
  "/admin/ads": "admin",
  "/admin/api": "admin",
  "/admin/team": "owner",
};

/**
 * Whether a link is the page being looked at.
 *
 * "/" has to be exact or it marks itself current on every page in the site; everything else
 * matches its own subtree, so /admin/crm stays lit while a tab inside it is open.
 */
export function isCurrent(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  // an overview with its pages beside it in the same menu: lit only on itself
  if (href === "/admin" || href === "/studio") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/**
 * The desk menu folded to its icons, kept per device. Here and not in the Sidebar because the
 * root layout reads it too, before paint, and a constant exported from a client module
 * reaches a server one as a reference rather than a string.
 */
export const RAIL_KEY = "shell-rail";
