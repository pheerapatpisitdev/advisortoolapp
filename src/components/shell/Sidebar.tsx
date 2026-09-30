"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/login/actions";
import { isCurrent, menuGroups, RAIL_KEY, type MenuGroup, type MenuIcon, type Who } from "@/lib/shell/menu";

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
    // the agent's Studio wallet
    case "wallet":
      return <svg {...common}><path d="M4.5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8l11-3v2.5M16.5 13.5h.01" /></svg>;
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
export function Sidebar({ signedIn, menu, brand, footer, who }: {
  signedIn: boolean;
  menu?: MenuGroup[];
  brand?: Brand;
  footer?: React.ReactNode;
  /** who is signed in: null for nobody; left out on pages that never ask (the sales pages) */
  who?: Who | null;
}) {
  const path = usePathname();
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
  const home = brand ?? { href: "/", label: "advisortool" };

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
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    aria-current={here ? "page" : undefined}
                    title={link.label}
                    className="shell-btn flex items-center gap-2.5 px-2 py-1.5 text-sm no-underline rail:justify-center rail:px-0"
                    style={{
                      // read by .shell-btn and .shell-chip for the tint, the edge and the fill
                      ["--hue" as string]: link.hue,
                      color: here ? "var(--shell-active)" : "var(--shell-ink)",
                      fontWeight: here ? 600 : 400,
                    }}
                  >
                    <span className="shell-chip"><Icon name={link.icon} /></span>
                    <span className="min-w-0 truncate rail:sr-only">{link.label}</span>
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
 * The foot of the menu: who is signed in and the way out, or the way in. Only on the pages
 * that ask who is looking (Studio and the back office) — a customer sent to a sales page by
 * an advertisement has no account here and is not offered one.
 */
function Account({ who, pushDown }: { who: Who | null; pushDown: boolean }) {
  return (
    <div className={`${pushDown ? "mt-auto " : ""}border-t pt-3`} style={{ borderColor: "var(--shell-line)" }}>
      {who ? (
        <div className="flex items-center gap-2 px-2 rail:flex-col rail:px-0">
          <div className="min-w-0 flex-1 rail:sr-only">
            <p className="truncate text-sm font-medium" style={{ color: "var(--shell-ink)" }}>{who.name}</p>
            <p className="truncate text-[0.7rem]" style={{ color: "var(--shell-mute)" }}>ห้อง {who.room}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="shell-btn px-2 py-1 text-xs" style={{ color: "var(--shell-mute)" }} title="ออกจากระบบ">
              ออกจากระบบ
            </button>
          </form>
        </div>
      ) : (
        <Link href="/login" className="shell-btn flex items-center justify-center px-2 py-1.5 text-sm no-underline" style={{ color: "var(--shell-ink)" }}>
          เข้าสู่ระบบ
        </Link>
      )}
    </div>
  );
}
