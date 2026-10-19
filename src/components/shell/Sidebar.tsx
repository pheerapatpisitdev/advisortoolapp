"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/login/actions";
import { ToolLogo } from "./ToolLogo";
import { accountLinks, isCurrent, menuGroups, RAIL_KEY, type MenuGroup, type MenuIcon, type Who } from "@/lib/shell/menu";

/** the name at the top of the menu, and where it leads */
export type Brand = { href: string; label: string };

/**
 * The menu, beside the page on a desk and over it on a phone.
 *
 * Both are used about equally, so neither is the afterthought. Past 1024px it is simply
 * there, 240px of it, and the page is inset by the same amount. Below that it is behind a
 * button, because 240px of a 375px screen is most of the screen.
 *
 * Every colour of the menu's own furniture — its ground, its ink, its rules — is a
 * `--shell-*` variable and not one is written here. The six sales pages run from near-black
 * to warm cream under one class name, and a literal picked to look right on one of them is
 * invisible on another — which is a mistake this project has already made twice, and which
 * `HomeButton` carries a note about for the same reason.
 *
 * The one thing that does carry a colour is each item's chip, and `menu.ts` explains why that
 * is safe: the hue fills a surface of its own rather than being laid on the page's ground.
 * The relief — the lift under the finger, the press, the lit item's tint — is drawn by
 * `.shell-btn` in `globals.css` out of neutral black and white at low opacity, which is the
 * only kind of shading that reads on a near-black page and a cream one both.
 */

function Mark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mark.png" alt="" width={22} height={28} className="h-7 w-auto shrink-0" />
  );
}

/**
 * The drawings, on one 24-grid in one weight.
 *
 * They are decoration and are marked as such: the label beside each one is what the menu
 * actually says, so nothing is lost to somebody reading with their ears, and nothing here
 * has to clear a contrast bar on its own.
 */
function Icon({ name }: { name: MenuIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-[1.05rem] w-[1.05rem]",
    "aria-hidden": true,
  };
  switch (name) {
    case "grid":
      return <svg {...common}><path d="M4.5 5.5h5v5h-5zM14.5 5.5h5v5h-5zM4.5 13.5h5v5h-5zM14.5 13.5h5v5h-5z" /></svg>;
    case "calc":
      return <svg {...common}><path d="M6.5 3.5h11v17h-11zM9 7.5h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></svg>;
    case "spark":
      return <svg {...common}><path d="M11 4l1.7 4.3L17 10l-4.3 1.7L11 16l-1.7-4.3L5 10l4.3-1.7zM17.5 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" /></svg>;
    case "users":
      return <svg {...common}><path d="M3.5 19.5v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M12.7 8a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0M16.5 14.7a4 4 0 0 1 4 3.8v1M15.4 5.3a3.2 3.2 0 0 1 0 5.4" /></svg>;
    // the page holds the AI providers' keys
    case "key":
      return <svg {...common}><path d="M14.5 13.5a5 5 0 1 0-4-4L4 16v4h4v-2h2v-2h2zM16.5 7.5h.01" /></svg>;
    case "chat":
      return <svg {...common}><path d="M20 11.6c0 3.9-3.6 7-8 7a9 9 0 0 1-2.4-.3L5 20l1.2-3.3A6.6 6.6 0 0 1 4 11.6c0-3.9 3.6-7 8-7s8 3.1 8 7z" /></svg>;
    case "megaphone":
      return <svg {...common}><path d="M4 10.5v3A1.5 1.5 0 0 0 5.5 15H7l9 4.5v-15L7 9H5.5A1.5 1.5 0 0 0 4 10.5zM7 15v4.5M19 10.5a3 3 0 0 1 0 3" /></svg>;
    // MCP is how Claude or ChatGPT plugs into this tool
    case "plug":
      return <svg {...common}><path d="M9 3.5v4M15 3.5v4M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0zM12 16.5v4" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3.5 19 6v5.5c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z" /></svg>;
    case "home":
      return <svg {...common}><path d="M4.5 10.5 12 4.5l7.5 6M6.5 9.6V19.5h11V9.6M10 19.5v-5h4v5" /></svg>;
    case "umbrella":
      return <svg {...common}><path d="M3.5 12a8.5 8.5 0 0 1 17 0zM12 12v6a2 2 0 0 0 4 0M12 3.5v1" /></svg>;
    case "gem":
      return <svg {...common}><path d="M7 4h10l3.5 5.5L12 20 3.5 9.5zM3.5 9.5h17M12 20 9 9.5 12 4l3 5.5z" /></svg>;
    case "shieldCheck":
      return <svg {...common}><path d="M12 3.5 19 6v5.5c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6zM9 11.8l2.2 2.2 4-4.2" /></svg>;
    case "heart":
      return <svg {...common}><path d="M12 19.6S4.5 15.2 4.5 10a3.8 3.8 0 0 1 7.5-1.1A3.8 3.8 0 0 1 19.5 10c0 5.2-7.5 9.6-7.5 9.6z" /></svg>;
    case "building":
      return <svg {...common}><path d="M6.5 20.5V4.5h11v16M4 20.5h16M9.5 8h1.5M13 8h1.5M9.5 11.5h1.5M13 11.5h1.5M10.5 20.5v-4h3v4" /></svg>;
    // CI 123 pays by the stage of an illness, so its mark is a heartbeat
    case "pulse":
      return <svg {...common}><path d="M3.5 12h4l2-5.5 4 11 2-5.5h5" /></svg>;
    // the cancer set: the awareness ribbon, a loop crossing into two tails
    case "ribbon":
      return <svg {...common}><path d="M12 4c-2 0-3 1.5-3 3.2 0 2.3 1.6 4.4 5.8 12.3M12 4c2 0 3 1.5 3 3.2 0 2.3-1.6 4.4-5.8 12.3" /></svg>;
    // the content generator: a pen writing a line
    case "pen":
      return <svg {...common}><path d="M15.5 4.5l4 4L9 19H5v-4zM13 7l4 4M4.5 20.5h15" /></svg>;
    // Studio makes posters and clips, so its mark is a picture with a play button — the pen
    // stayed with ออโต้โพสต์, which had worn it too (owner's pick, 2026-09-27)
    case "studio":
      return <svg {...common}><path d="M4 5.5h16v13H4zM10 9.3v5.4l4.5-2.7z" /></svg>;
    case "calendar":
      return <svg {...common}><path d="M5 6.5h14v13H5zM5 10.5h14M9 4v4M15 4v4" /></svg>;
    case "quote":
      return <svg {...common}><path d="M9.5 7.5C7 8.5 5.5 10.5 5.5 13.5V17h4.5v-4.5H7.5M18.5 7.5c-2.5 1-4 3-4 6V17H19v-4.5h-2.5" /></svg>;
    // Maryjane, Studio's writer: a woman with a fringe and her hair down to her shoulders
    case "woman":
      return <svg {...common}><path d="M12 3.8c3 0 5 2.2 5 5.2 0 3 .4 5 1.8 6.6-1.9.6-3.8.4-5.3-.6M12 3.8c-3 0-5 2.2-5 5.2 0 3-.4 5-1.8 6.6 1.9.6 3.8.4 5.3-.6M9.2 8.6c1.8-.1 3.9-.9 5-2.4M12 6.4a3.3 3.3 0 0 1 0 8.6M12 6.4a3.3 3.3 0 0 0 0 8.6M4.8 21c.8-2.4 3.7-3.8 7.2-3.8s6.4 1.4 7.2 3.8" /></svg>;
    // เปิด-ปิดฟังก์ชัน: a power button
    case "power":
      return <svg {...common}><path d="M12 4v7M7.4 6.9a7 7 0 1 0 9.2 0" /></svg>;
    // the agent's Studio wallet
    case "wallet":
      return <svg {...common}><path d="M4.5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8l11-3v2.5M16.5 13.5h.01" /></svg>;
    // a picture read into a prompt: a frame with a hill and a sun
    case "image":
      return <svg {...common}><path d="M4.5 5.5h15v13h-15zM4.5 15.5l4.5-4.5 4 4 2.5-2.5 4 4M15.5 9.5h.01" /></svg>;
    // the way back to the main system, from Studio and the back office
    case "back":
      return <svg {...common}><path d="M10 6.5 4.5 12l5.5 5.5M5 12h14.5" /></svg>;
    // the back office's own marks since 2026-10-15 (owner chose ข), one per page so none repeats:
    // เพจและช่องทาง, a flag on its pole
    case "flag":
      return <svg {...common}><path d="M6 20.5V4M6 4.5h11l-2.5 4 2.5 4H6" /></svg>;
    // สอนบอท, the bot's face
    case "bot":
      return <svg {...common}><path d="M5.5 8.5h13v10h-13zM12 8.5V5M12 4.5h.01M9.5 13h.01M14.5 13h.01M9.5 16h5M3.5 12.5v2M20.5 12.5v2" /></svg>;
    // ทีมงาน, a staff badge on its clip
    case "badge":
      return <svg {...common}><path d="M6.5 5.5h11v15h-11zM10 3.5h4v3h-4zM12 12.2a2 2 0 1 0 0-.01M9 17.5c.5-1.5 1.6-2.3 3-2.3s2.5.8 3 2.3" /></svg>;
    // ราคาและโปรโมชัน, a price tag
    case "tag":
      return <svg {...common}><path d="M4 4.5h7.5l8.5 8.5-7 7-8.5-8.5zM8 8.5h.01" /></svg>;
    // การใช้งานและค่า AI, bars rising
    case "chart":
      return <svg {...common}><path d="M4.5 19.5h15M7 16.5v-4M11 16.5v-8M15 16.5V10M19 16.5V6" /></svg>;
    // ตั้งค่า AI และระบบ, a gear
    // ประวัติเติมเงิน, a stack of coins
    case "coins":
      return <svg {...common}><path d="M5.5 7c0-1.4 2.9-2.5 6.5-2.5s6.5 1.1 6.5 2.5-2.9 2.5-6.5 2.5S5.5 8.4 5.5 7zM5.5 7v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7M5.5 12v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" /></svg>;
    // LINE OA: a paper plane, for the broadcasts sent from it
    case "send":
      return <svg {...common}><path d="M20.5 3.5 3.5 10.6l6.6 2.8 2.8 6.6 7.6-16.5zM10.1 13.4l4.6-4.6" /></svg>;
    case "gear":
      return <svg {...common}><path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" /></svg>;
    // อีซี่ โพรเทค 6 is sold on the premium having a last year, so its mark is a clock
    case "clock":
      return <svg {...common}><path d="M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM12 8v4.3l3 1.7" /></svg>;
  }
}

/**
 * `signedIn` is "this page is the back office", and nothing more since the PIN went. The
 * back office's pages are listed from inside it and from nowhere else: a gate and a sign are
 * different things, and naming the pages on the calculator tells a stranger the shape of
 * the tool.
 */
/**
 * Who is looking, as the sales pages learn it: they are built ahead of time and served to
 * whoever an advertisement sends, so they cannot ask on the server. The menu asks once the
 * page is up (owner chose ข, 2026-10-14), so an agent standing on one has the same menu as on
 * /home. Kept for the tab's life: moving between sales pages does not ask again or flicker.
 */
let seen: Who | null | undefined;

export function Sidebar({ signedIn, menu, brand, footer, who: given }: {
  signedIn: boolean;
  menu?: MenuGroup[];
  brand?: Brand;
  footer?: React.ReactNode;
  /** who is signed in: null for nobody; left out on pages that never ask (the sales pages) */
  who?: Who | null;
}) {
  const path = usePathname();
  const [found, setFound] = useState<Who | null | undefined>(seen);
  useEffect(() => {
    if (given !== undefined || seen !== undefined) return;
    let live = true;
    fetch("/api/shell/who", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { who?: Who | null } | null) => {
        if (!j) return;
        seen = j.who ?? null;
        if (live) setFound(seen);
      })
      .catch(() => { /* the menu a customer sees, which is what it already shows */ });
    return () => { live = false; };
  }, [given]);
  // a page that did not ask, and nobody signed in: no account box, as before
  const who = given !== undefined ? given : found ?? undefined;
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useState(false);

  // the folded menu is decided by <html data-shell>, set before paint by the root layout's
  // script, so the page does not jump; this state only labels the button
  useEffect(() => { setFolded(document.documentElement.dataset.shell === "rail"); }, []);

  const toggleFold = () => {
    const next = !folded;
    setFolded(next);
    if (next) document.documentElement.dataset.shell = "rail";
    else delete document.documentElement.dataset.shell;
    try { localStorage.setItem(RAIL_KEY, next ? "1" : "0"); } catch { /* not kept */ }
  };

  const groups = menu ?? menuGroups(signedIn, who);
  const home = brand ?? { href: "/home", label: "advisortool" };

  // a menu left open across a navigation covers the page that was just asked for
  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    // the page behind a drawer must not scroll under it
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const panel = (
    <nav
      aria-label="เมนูหลัก"
      className="flex h-full w-60 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r px-3 py-4 transition-[width] duration-200 rail:w-16 rail:px-2"
      style={{ background: "var(--shell-bg)", borderColor: "var(--shell-line)", color: "var(--shell-ink)" }}
    >
      <div className="mb-4 flex items-center gap-1 rail:flex-col rail:gap-3">
        <Link href={home.href} title={home.label} className="flex min-w-0 flex-1 items-center gap-2 px-2 no-underline rail:flex-none rail:px-0" style={{ color: "var(--shell-ink)" }}>
          <Mark />
          <span className="text-sm font-semibold rail:sr-only">{home.label}</span>
        </Link>
        {/* the desk only: on a phone the menu is a drawer that closes by itself */}
        <button
          type="button"
          onClick={toggleFold}
          aria-label={folded ? "ขยายเมนู" : "หุบเมนู"}
          title={folded ? "ขยายเมนู" : "หุบเมนู"}
          aria-expanded={!folded}
          className="shell-btn hidden shrink-0 p-1.5 lg:inline-flex"
          style={{ color: "var(--shell-mute)" }}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 rail:rotate-180">
            <path d="M14.5 6.5 9 12l5.5 5.5M19 5v14" />
          </svg>
        </button>
      </div>

      {groups.map((group, i) => (
        <div key={group.title ?? i} className="mb-3">
          {group.title && (
            <p className="mb-1 px-2 text-[0.7rem] font-medium uppercase tracking-wider rail:sr-only" style={{ color: "var(--shell-mute)" }}>
              {group.title}
            </p>
          )}
          <ul className="space-y-1">
            {group.links.map((link) => {
              const here = !link.external && isCurrent(link.href, path);
              // switched off for now (เปิด-ปิดฟังก์ชัน): still listed, marked, so nobody wonders where it went;
              // locked for all but the owner and the Super Admin, who go on trying it (owner, 2026-10-17)
              const closed = who?.closed?.includes(link.href) === true;
              if (closed && !who?.owner) {
                return (
                  <li key={link.href}>
                    <span
                      aria-disabled="true"
                      title={`${link.label} (ปิดชั่วคราว)`}
                      className="flex cursor-not-allowed items-center gap-2.5 px-2 py-1.5 text-sm rail:justify-center rail:px-0"
                      style={{ ["--hue" as string]: link.hue, color: "var(--shell-mute)" }}
                    >
                      {link.logo ? <span className="inline-flex opacity-40"><ToolLogo id={link.logo} /></span> : <span className="shell-chip opacity-40"><Icon name={link.icon} /></span>}
                      <span className="min-w-0 truncate rail:sr-only">{link.label}</span>
                      <span className="shell-closed ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold rail:sr-only">
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                        ปิดชั่วคราว
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    aria-current={here ? "page" : undefined}
                    title={closed ? `${link.label} (ปิดชั่วคราว)` : link.label}
                    className="shell-btn flex items-center gap-2.5 px-2 py-1.5 text-sm no-underline rail:justify-center rail:px-0"
                    style={{
                      // read by .shell-btn and .shell-chip for the tint, the edge and the fill
                      ["--hue" as string]: link.hue,
                      color: here ? "var(--shell-active)" : "var(--shell-ink)",
                      fontWeight: here ? 600 : 400,
                    }}
                  >
                    {link.logo ? <ToolLogo id={link.logo} /> : <span className="shell-chip"><Icon name={link.icon} /></span>}
                    <span className={`min-w-0 truncate rail:sr-only ${closed ? "opacity-60" : ""}`}>{link.label}</span>
                    {closed && <span className="shell-closed ml-auto shrink-0 rounded-full px-2 text-[11px] font-semibold rail:sr-only">ปิดชั่วคราว</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          {i < groups.length - 1 && (
            <hr className="mt-3 border-0 border-t" style={{ borderColor: "var(--shell-line)" }} />
          )}
        </div>
      ))}
      {/* a menu's own furniture below its links (Studio's light and dark); it pushes itself to the foot */}
      {footer}
      {who !== undefined && <Account who={who} pushDown={!footer} />}
    </nav>
  );

  return (
    <>
      {/* the desk: simply there, and out of the way of anything fixed on the page */}
      <div className="shell-desk fixed inset-y-0 left-0 z-30 hidden lg:block print:hidden">{panel}</div>

      {/* the phone: a button, and the menu over the page when it is pressed — never on paper,
          where it printed over the first line of every sheet */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
        aria-expanded={open}
        className="shell-hamburger fixed left-3 top-3 z-30 flex size-11 items-center justify-center rounded-full border backdrop-blur lg:hidden print:hidden"
        style={{ background: "var(--shell-bg)", borderColor: "var(--shell-line)", color: "var(--shell-ink)" }}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="shell-scrim absolute inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative h-full">{panel}</div>
        </div>
      )}
    </>
  );
}

/**
 * The foot of the menu: who is signed in, their own pages, and the way out — or the way in.
 * Not on a page that never asked who is looking and found nobody: a customer sent to a sales
 * page by an advertisement has no account here and is not offered one.
 *
 * The same in all three menus since 2026-10-14 (owner chose ข): บัญชีของฉัน, the wallet or the
 * price list, the membership pass, then ออกจากระบบ.
 */
function Account({ who, pushDown }: { who: Who | null; pushDown: boolean }) {
  const path = usePathname();
  return (
    <div className={`${pushDown ? "mt-auto " : ""}border-t pt-3`} style={{ borderColor: "var(--shell-line)" }}>
      {who ? (
        <>
          <div className="mb-1 min-w-0 px-2 rail:sr-only">
            <p className="truncate text-sm font-medium" style={{ color: "var(--shell-ink)" }}>{who.name}</p>
            <p className="truncate text-[0.7rem]" style={{ color: "var(--shell-mute)" }}>{who.member ? who.room : `ห้อง ${who.room}`}</p>
          </div>
          <ul className="space-y-0.5">
            {accountLinks(who).map((link) => {
              const here = isCurrent(link.href, path);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={here ? "page" : undefined}
                    title={link.label}
                    className="shell-btn flex items-center gap-2.5 px-2 py-1 text-[0.8rem] no-underline rail:justify-center rail:px-0"
                    style={{ ["--hue" as string]: link.hue, color: here ? "var(--shell-active)" : "var(--shell-ink)", fontWeight: here ? 600 : 400 }}
                  >
                    <span className="shell-chip"><Icon name={link.icon} /></span>
                    <span className="min-w-0 truncate rail:sr-only">{link.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <form action={signOut}>
                {/* an icon as well as the words, and in the ink rather than the mute: small grey
                    text at the very foot was read as not being there (owner, 2026-10-10) */}
                <button type="submit" className="shell-btn flex w-full items-center gap-2.5 px-2 py-1 text-[0.8rem] rail:justify-center rail:px-0" style={{ color: "var(--shell-ink)" }} title="ออกจากระบบ">
                  <span className="inline-flex h-[1.65rem] w-[1.65rem] shrink-0 items-center justify-center">
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
                    </svg>
                  </span>
                  <span className="rail:sr-only">ออกจากระบบ</span>
                </button>
              </form>
            </li>
          </ul>
        </>
      ) : (
        <Link href="/" className="shell-btn flex items-center justify-center px-2 py-1.5 text-sm no-underline" style={{ color: "var(--shell-ink)" }}>
          เข้าสู่ระบบ
        </Link>
      )}
    </div>
  );
}
