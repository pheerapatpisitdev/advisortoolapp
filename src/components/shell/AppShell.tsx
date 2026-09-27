import type { MenuGroup, Who } from "@/lib/shell/menu";
import { Sidebar, type Brand } from "./Sidebar";

/**
 * The menu, and the room left for it.
 *
 * `signedIn` is passed in, and only the back office's layout passes `true`. It used to mean a
 * session; since the PIN went (2026-09-22) it means only "list the back office's pages in
 * the menu", which the calculator and the sales pages — built ahead of time and served from
 * the edge to whoever an advertisement sends — should not do.
 *
 * The wrapper is not decoration. `globals.css` gives every direct child of `.theme-legacy`
 * `position: relative; z-index: 1`, and that selector beats a Tailwind utility on
 * specificity — so a `fixed` child placed there is laid out relative anyway and becomes a
 * full-width band across the top of all six sales pages. The plain `relative` div takes that
 * rule instead, and costs no height because everything inside it is fixed. `HomeButton`
 * solved the same problem the same way, and this replaces it.
 *
 * `menu` and `brand` put a section's own menu in the application's place — Studio's, today.
 */
export function AppShell({ children, signedIn = false, menu, brand, footer, who }: {
  children: React.ReactNode;
  signedIn?: boolean;
  menu?: MenuGroup[];
  brand?: Brand;
  /** drawn at the foot of the menu, under its links */
  footer?: React.ReactNode;
  /** who is signed in, from the layout's session check; left out where nobody is asked */
  who?: Who | null;
}) {
  return (
    <>
      {/* the page first, the menu after it, for the painting order the note above describes */}
      <div className="shell-inset">{children}</div>
      <div className="relative">
        <Sidebar signedIn={signedIn} menu={menu} brand={brand} footer={footer} who={who} />
      </div>
    </>
  );
}
