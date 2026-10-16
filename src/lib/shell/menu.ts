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
  | "woman"
  | "mic"
  | "wallet"
  | "image"
  | "back"
  | "flag"
  | "bot"
  | "badge"
  | "tag"
  | "chart"
  | "gear"
  | "send";

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
      // the agency's own questionnaire: scores first, then which of the plans below, and how
      // much. It was one of two until the owner took the plain planner (/plan) out (2026-10-01).
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
 * The test that checks none of the pages on disk has been left out of the menu counts them
 * here. Derived rather than written twice, so a page added to a section cannot go missing
 * from a list that reads it.
 */
export const SALES_PAGES: MenuLink[] = SALES_SECTIONS.flatMap((s) => s.links);

/** An outside member's pass page, in the account box of every menu a member reads (owner, 2026-10-13). */
const MEMBERSHIP: MenuLink = { href: "/membership", label: "สมาชิก", icon: "key", hue: "#2b736f" };

/** What each customer the agent kept from the Financial Health Check still lacks. */
const FHC_CUSTOMERS: MenuLink = { href: "/fhc/customers", label: "ลูกค้า FHC ของฉัน", icon: "users", hue: "#3d3578" };

/**
 * The two menus: the back office's, and everybody else's.
 *
 * Inside /admin the menu lists the back-office tools and nothing more. It used to carry the
 * whole site as well — the calculator, the assistant, the content workbench and all eleven
 * sales pages under the back office's seven — and the tools the owner opens /admin for were
 * a third of a long column. The owner asked for the back office's menu to hold only the back
 * office (2026-09-23). The rest of the site is one click away on ระบบหลัก, its first line
 * since 2026-10-14.
 *
 * Everywhere else the back office is not in it at all. A gate is a different thing from a
 * sign: naming the pages tells a stranger the shape of the tool and where to knock. What is
 * left is what an agent sends customers anyway — the calculator, the assistant, the sales
 * pages — so a customer standing on one can still reach the others.
 */
export function menuGroups(signedIn: boolean, who?: Who | null): MenuGroup[] {
  if (signedIn) {
    /**
     * Eleven pages under six jobs (owner chose ข, 2026-10-15; review
     * https://claude.ai/artifact/VDF2tf4VGA1DSAkJUcVtJm, mockup
     * https://claude.ai/artifact/QN3oQ24fyLBTFnuwZrNs84). It was thirteen: Messenger and
     * ออโต้โพสต์ read the same connection, สอน AI / ห้องสอนบอท / ข้อความต้อนรับ all taught the bot,
     * and the cost of AI was on four pages. Each page has its own mark; none repeats.
     *
     * Every page here is the Super Admin's alone (gatePage "backoffice"), so the list is not
     * filtered by anybody's ticks any more — it was, by admin / connect / owner, until the back
     * office left the agents on 2026-10-15, after which the filter never hid anything.
     */
    return [
      {
        links: [
          // the Super Admin has no front of the app to go back to (owner, 2026-10-15)
          ...(who?.super ? [] : [BACK_HOME]),
          { href: "/admin", label: "ภาพรวม", icon: "grid", hue: "#2b736f" },
        ],
      },
      {
        title: "ลูกค้าและบอท",
        links: [
          // the people who wrote to the Pages; "ลูกค้า FHC ของฉัน" is the agent's own list
          { href: "/admin/crm", label: "ลูกค้าจากแชท", icon: "chat", hue: "#2b6a7a" },
          // which Pages are connected, and whether the bot answers and the workbench posts on each
          { href: "/admin/pages", label: "เพจและช่องทาง", icon: "flag", hue: "#2b5f80" },
          // the LINE account: connection, the bot's switch, broadcasts and the chat menus (owner chose ข, 2026-10-15)
          { href: "/admin/line", label: "LINE OA", icon: "send", hue: "#2b5a83" },
          // try the bot as a customer, teach it, and set what it sends a newcomer
          { href: "/admin/teach", label: "สอนบอท", icon: "bot", hue: "#2b5486" },
        ],
      },
      {
        title: "การตลาด",
        links: [
          { href: "/admin/ads", label: "โฆษณา", icon: "megaphone", hue: "#2e4a86" },
        ],
      },
      {
        title: "ผู้ใช้",
        links: [
          // the assistants: who may post to which Page in Studio
          { href: "/admin/team", label: "ทีมงาน", icon: "badge", hue: "#334084" },
          // members outside UnitOS who signed up themselves (owner, 2026-10-01)
          { href: "/admin/members", label: "สมาชิกทั่วไป", icon: "users", hue: "#3a3784" },
          // everybody's whole history: every transaction and everything made (owner, 2026-10-15)
          { href: "/admin/history", label: "ประวัติผู้ใช้", icon: "clock", hue: "#3d3684" },
          // เสียงของฉัน: the voice slots, the pilot's invites, and the cloned voices to hear (owner, 2026-10-15)
          { href: "/admin/voices", label: "เสียงของตัวแทน", icon: "pulse", hue: "#3f3584" },
        ],
      },
      {
        title: "เงิน",
        links: [
          // the Studio wallets: on or off, the multiplier, a hand on a balance (owner, 2026-09-30)
          { href: "/admin/wallet", label: "กระเป๋าเงิน", icon: "wallet", hue: "#443283" },
          // the price of each piece, the members' pass and ชวนเพื่อน
          { href: "/admin/prices", label: "ราคาและโปรโมชัน", icon: "tag", hue: "#4f2f82" },
        ],
      },
      {
        title: "รายงาน",
        links: [
          // which tools people use, who used them, and what each AI company cost (owner, 2026-10-14)
          { href: "/admin/stats", label: "การใช้งานและค่า AI", icon: "chart", hue: "#5b2e80" },
          // what the AI cost against what people paid for it (owner, 2026-10-15)
          { href: "/admin/ai-profit", label: "กำไรค่า AI", icon: "calc", hue: "#612d7e" },
        ],
      },
      {
        title: "ตั้งค่าระบบ",
        links: [
          // keys, models, the budget, the clip renderers and the premium tables in force
          // (MCP / API, the keys for other systems, went on 2026-10-15: nobody held one)
          { href: "/admin/ai", label: "ตั้งค่า AI และระบบ", icon: "gear", hue: "#682d7c" },
        ],
      },
    ];
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
  // the Super Admin on a public page: the way back to the back office and nothing of the front
  // (owner, 2026-10-15)
  if (who?.super) return [{ links: [{ href: "/admin", label: "หลังบ้าน", icon: "grid", hue: "#2b736f" }] }];
  const office = officeFor(who);
  const groups: MenuGroup[] = [{
    // the agent's own work first, the pages they send customers after it (owner chose ข,
    // 2026-10-14); the membership pass moved to the account box at the foot, with the wallet
    title: "งานของฉัน",
    links: [
      // จัดแบบเอง (/other-plans), the build-it-yourself calculator, was first here until the
      // owner took it out altogether (2026-10-13); every sales page below prices its own plan
      // งานวันนี้ (owner chose option ข, 2026-10-14); the chat it held moved to /ask
      { href: "/home", label: "หน้าหลัก", icon: "home", hue: "#2b4673" },
      // the agent's own Financial Health Check customers (owner, 2026-10-10): their work, not a
      // sales page, so up here rather than under วางแผนประกัน since 2026-10-14
      FHC_CUSTOMERS,
      { href: "/ask", label: "ถาม AI", icon: "spark", hue: "#2b5f73" },
      // for UnitOS agents, who sign in with their code on the way in (owner, 2026-09-27)
      { href: "/studio", label: "Studio", icon: "studio", hue: "#2e5a80" },
      ...(office ? [{ href: office, label: "หลังบ้าน", icon: "grid" as const, hue: "#2b736f" }] : []),
    ],
  }];

  // Sales pages are part of the calculator, so the sidebar keeps the user in the same tab.
  // `external` remains available for a genuinely off-site link added in the future.
  for (const section of SALES_SECTIONS) groups.push({ title: section.title, links: section.links });
  return groups;
}

/**
 * The way to the back office from the front of the app: none since 2026-10-15 (owner). It is
 * the Super Admin's alone, who signs in with the front page's Google button and never sees the front.
 */
function officeFor(who?: Who | null): string | null {
  return who?.super ? "/admin" : null;
}

/**
 * Studio's own menu. Pressing Studio leaves the application's menu behind for this one, so
 * the workbench reads as a place of its own (owner, 2026-09-27) — its pages down the side
 * where the tab row used to be, and one way back out. New Studio tools are added here.
 *
 * Under two headings since 2026-10-14 (owner chose ข): what makes a piece, and what plans and
 * keeps them. The wallet, the price list, the pass and the account went to the account box at
 * the foot (`accountLinks`), the way back to the top, where the back office has it too.
 */
export function studioMenu(who?: Who | null): MenuGroup[] {
  // staff get a way to the back office, landing on the first page of it they may open
  const office = officeFor(who);
  const top: MenuLink[] = [
    BACK_HOME,
    ...(office ? [{ href: office, label: "หลังบ้าน", icon: "grid" as const, hue: "#2b736f" }] : []),
    // the front page: a card per Page with these tools under it, for the admins and the
    // assistants, who choose among their own Pages there (owner, 2026-09-28, kept 2026-10-02);
    // every other agent's Studio starts at the workbench
    ...(!who || who.admin || who.publish ? [{ href: "/studio", label: "หน้ารวม", icon: "grid" as const, hue: "#2b736f" }] : []),
  ];
  const make: MenuLink[] = [
    // a narrated clip of a quote (owner, 2026-10-11): every agent's, two free then the wallet
    { href: "/studio/quote-video", label: "วิดีโอนำเสนอ", icon: "spark", hue: "#2e5a80" },
    // a cartoon story clip, why insurance at all (owner, 2026-10-15): every agent's, paid like the one above
    { href: "/studio/story-clip", label: "คลิปเล่าเรื่อง", icon: "woman", hue: "#2e5a80" },
    // a clip from the agent's own brief, script edited before it is paid for (owner, 2026-10-16): paid like the one above
    { href: "/studio/prompt-story", label: "คลิปตามโจทย์", icon: "quote", hue: "#2e5a80" },
    // the agent's own cloned voice for those clips (owner, 2026-10-15): the owner's alone since 2026-10-16
    ...(who?.owner ? [{ href: "/studio/voice", label: "เสียงของฉัน", icon: "mic" as const, hue: "#2e5a80" }] : []),
    // the writer: Maryjane from 2026-09-27, Organic Studio from 2026-09-28 (owner)
    { href: "/studio/write", label: "Organic Studio", icon: "pen", hue: "#2e5a80" },
    // video covers (owner, 2026-10-09): every agent's and member's since 2026-10-14, paid as a picture
    { href: "/studio/thumbnail", label: "ภาพปกคลิป", icon: "image", hue: "#2e5a80" },
    // a picture read into a drawing prompt (owner, 2026-10-08): every agent's, the cost is theirs
    { href: "/studio/describe", label: "ถอดรูปเป็น prompt", icon: "image", hue: "#302f79" },
    // puts an ad piece on Facebook as a paused ad: spends the owner's ad account, so the owner's alone (2026-10-04)
    ...(who?.owner ? [{ href: "/studio/ads", label: "Ads Studio", icon: "megaphone" as const, hue: "#352f80" }] : []),
  ];
  const keep: MenuLink[] = [
    // the calendar is every agent's: a Page's for the staff who post to it (owner, 2026-09-27), a
    // plan for everyone else (2026-09-30)
    { href: "/studio/calendar", label: "ปฏิทินโพสต์", icon: "calendar", hue: "#2e4a7a" },
    { href: "/studio/hooks", label: "คลังสูตรประโยคเปิด", icon: "quote", hue: "#302f79" },
    { href: "/studio/people", label: "คลังบุคคล", icon: "users", hue: "#352f80" },
  ];
  return [{ links: top }, { title: "สร้างงาน", links: make }, { title: "วางแผนและคลัง", links: keep }];
}

/** The first line of Studio's menu and the back office's: back to where the agent's day starts. */
const BACK_HOME: MenuLink = { href: "/home", label: "ระบบหลัก", icon: "back", hue: "#2b5f73" };

/**
 * The account box at the foot of every menu, the same in all three (owner chose ข, 2026-10-14).
 * Until then the account page was in Studio's menu alone, the pass in two menus and the wallet
 * in one, so a member who wanted to change their name had to know to open Studio first.
 */
export function accountLinks(who?: Who | null): MenuLink[] {
  if (!who) return [];
  // the Super Admin's box is their address and ออกจากระบบ, which the box draws itself (2026-10-15)
  if (who.super) return [];
  // the wallet is listed only while the owner has it on (who.wallet is worked out once on the
  // server, false for the owner): an agent is not sent to a page that says it is switched off
  const noWallet = who.owner || who.wallet !== true;
  return [
    // a member's own name and PIN; UnitOS agents manage theirs in UnitOS (owner, 2026-10-01);
    // everyone's contact details for the วิดีโอนำเสนอ (owner, 2026-10-11)
    { href: "/studio/account", label: "บัญชีของฉัน", icon: "key", hue: "#2e4a7a" },
    // an agent's own wallet, to write past the free rounds (owner, 2026-09-30); assistants have
    // one too (2026-10-02), only the owner writes without one
    ...(!noWallet ? [{ href: "/studio/wallet", label: "กระเป๋าเงิน", icon: "wallet" as const, hue: "#2b736f" }] : []),
    // ราคา only for whoever has no กระเป๋าเงิน (the owner): the wallet page holds the prices,
    // two items to one page read as a duplicate (owner, 2026-10-13)
    ...(noWallet && who.prices === true ? [{ href: "/studio/wallet#prices", label: "ราคา", icon: "wallet" as const, hue: "#2b736f" }] : []),
    // a member's 30-day pass: its end, the rounds left, renewing (owner, 2026-10-13)
    ...(who.member ? [MEMBERSHIP] : []),
  ];
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
  /** the owner has the wallet on and this is not the owner (owner, 2026-09-30; assistants 2026-10-02) */
  wallet?: boolean;
  /** the wallet is on, so the price list is in the menu — the owner's too (owner, 2026-10-12) */
  prices?: boolean;
  /** a member outside UnitOS (owner, 2026-10-01): their account page, and no room to name */
  member?: boolean;
  /** the Super Admin (owner, 2026-10-15): the back office only, no way back to the front */
  super?: boolean;
}


/**
 * Whether a link is the page being looked at.
 *
 * "/" has to be exact or it marks itself current on every page in the site; everything else
 * matches its own subtree, so /admin/crm stays lit while a tab inside it is open.
 */
export function isCurrent(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  // an overview with its pages beside it in the same menu: lit only on itself
  // the check beside the list of customers it filled
  if (href === "/admin" || href === "/studio" || href === "/fhc") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/**
 * The desk menu folded to its icons, kept per device. Here and not in the Sidebar because the
 * root layout reads it too, before paint, and a constant exported from a client module
 * reaches a server one as a reference rather than a string.
 */
export const RAIL_KEY = "shell-rail";
