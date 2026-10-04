import Link from "next/link";
import type { HomeCard, HomeTileKey } from "@/lib/content/studio-home";
import { CalendarIcon, MegaphoneIcon, PenIcon, PeopleIcon, QuoteIcon, SlidersIcon } from "./ui/icons";
import { PageAvatar } from "./ui/PageAvatar";

const ICONS: Record<HomeTileKey, (p: { className?: string }) => React.ReactNode> = {
  write: PenIcon,
  ads: MegaphoneIcon,
  calendar: CalendarIcon,
  hooks: QuoteIcon,
  people: PeopleIcon,
  settings: SlidersIcon,
};

/**
 * Studio's front page (/studio): a card per Page, its tools in a row of tiles under it, each
 * tile a link with a word on what is inside. What goes on the cards is decided in
 * src/lib/content/studio-home.ts; this only draws them.
 */
export function StudioHome({ cards }: { cards: HomeCard[] }) {
  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold">Studio</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">เลือกเครื่องมือของเพจที่จะทำงานด้วย</p>
      <div className="mt-6 space-y-5">
        {cards.map((card) => (
          <section key={card.id} aria-labelledby={`card-${card.id}`} className="overflow-hidden rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
            <header className="flex items-center gap-4 p-4 sm:p-6">
              <PageAvatar picture={card.picture} initials={card.initials} />
              <div className="min-w-0">
                <h2 id={`card-${card.id}`} className="truncate text-lg font-semibold">{card.title}</h2>
                <p className="truncate text-sm text-[var(--ct-mute)]">{card.subtitle}</p>
              </div>
            </header>
            {/* the tiles draw their right and bottom hairlines; the card clips the outer ones */}
            <div className="border-t border-[var(--ct-hair)]">
              <ul className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {card.tiles.map((tile) => {
                  const Icon = ICONS[tile.key];
                  return (
                    <li key={tile.key} className="border-b border-r border-[var(--ct-hair)]">
                      <Link href={tile.href} className="flex h-full min-h-24 flex-col justify-center gap-1.5 p-4 hover:bg-[var(--ct-soft)] focus-visible:bg-[var(--ct-soft)] sm:px-5">
                        <span className="flex items-center gap-2 font-medium">
                          <Icon className="size-5 text-[var(--ct-accent)]" />
                          {tile.label}
                        </span>
                        <span className="text-sm text-[var(--ct-mute)]">{tile.status}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
