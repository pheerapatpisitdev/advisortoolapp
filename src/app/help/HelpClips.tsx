"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clipCover, clipFile, clipLength, HELP_GROUPS, helpClip } from "@/lib/help/clips";

/**
 * The list of clips, and the one being played in its place. Which one is open is the page's
 * hash, so /help#topup from the wallet opens that clip and the phone's back button closes it.
 */
export function HelpClips() {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setOpen(helpClip(window.location.hash.slice(1))?.id ?? null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const clip = open ? helpClip(open) : undefined;
  if (clip) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <h2 className="text-lg font-semibold">{clip.title}</h2>
        {/* keyed, so a second clip opened from the first does not keep the first one's player */}
        <video
          key={clip.id} controls playsInline autoPlay preload="metadata" poster={clipCover(clip.id)}
          className="mx-auto aspect-[9/16] max-h-[66dvh] max-w-full rounded-xl bg-black"
        >
          <source src={clipFile(clip.id)} type="video/mp4" />
        </video>
        {clip.go && (
          <Link href={clip.go.href} className="rounded-lg bg-[var(--hm-solid)] px-4 py-2.5 text-center font-semibold text-[var(--hm-solid-ink)]">
            {clip.go.label}
          </Link>
        )}
        <a href="#" onClick={(e) => { e.preventDefault(); history.pushState(null, "", window.location.pathname); setOpen(null); }}
          className="rounded-lg border border-[var(--hm-accent)] px-4 py-2.5 text-center font-semibold text-[var(--hm-accent)]">
          กลับไปดูคลิปอื่น
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {HELP_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[var(--hm-mute)]">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.clips.map((c) => (
              <a key={c.id} href={`#${c.id}`}
                className="flex gap-3 rounded-xl border border-[var(--hm-hair)] bg-[var(--hm-panel)] p-2.5 transition-colors hover:border-[var(--hm-accent)]">
                <span className="relative block h-32 w-[4.5rem] flex-none overflow-hidden rounded-lg bg-[var(--hm-solid)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a 16 KB cover off /public */}
                  <img src={clipCover(c.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 m-auto grid h-9 w-9 place-items-center rounded-full bg-[var(--hm-solid)]/90 text-[var(--hm-solid-ink)]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1 py-1">
                  <span className="font-semibold leading-snug">{c.title}</span>
                  <span className="text-sm text-[var(--hm-mute)]">{c.about}</span>
                  <span className="mt-auto w-fit rounded-full bg-[var(--bot-sand-soft)] px-2.5 text-xs font-semibold leading-6 text-[var(--bot-sand-ink)]">{clipLength(c.seconds)} นาที</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
