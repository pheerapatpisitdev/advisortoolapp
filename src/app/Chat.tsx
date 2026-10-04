"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askCopilot } from "./actions";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";
import type { GuideItem } from "@/lib/copilot/guide";
import { withoutParticles } from "@/lib/assistant/voice";
import { trackMeta } from "@/components/meta/track";

/**
 * The two pieces of markdown a model reaches for, drawn rather than printed — and a bare
 * address, which is a link whether or not anybody wrote it as one.
 *
 * Not a markdown library: the answers here are short Thai paragraphs with the occasional
 * bolded rule and the occasional link, and a parser for the whole language would be a
 * dependency earning its keep on two characters. Anything else the model writes is left
 * exactly as it typed it.
 *
 * Links used to be drawn only when they led back into this site. An address anywhere else
 * came out as its label alone, or as plain text — and the application form is somewhere else,
 * so the one message that turns a quotation into a sale was a line nobody could press.
 */
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g;
const OUTSIDE = /^https?:\/\//;

function Away({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all font-medium underline underline-offset-2">
      {children}
    </a>
  );
}

function Rich({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {text.split(INLINE).map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          if (link[2].startsWith("/")) {
            return <Link key={i} href={link[2]} className="font-medium underline underline-offset-2">{link[1]}</Link>;
          }
          return OUTSIDE.test(link[2])
            ? <Away key={i} href={link[2]}>{link[1]}</Away>
            : <span key={i}>{link[1]}</span>;
        }
        if (OUTSIDE.test(part)) return <Away key={i} href={part}>{part}</Away>;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** shown under an answer so the reader knows which model wrote it */
  model?: string;
  /** the figure came from the engine, which is worth saying out loud */
  priced?: boolean;
  /** the quotation as the engine drew it — the same picture the bot sends a customer */
  cards?: string[];
  /** what to offer next, as buttons, when the answer leads somewhere in particular */
  guide?: GuideItem[];
  /** the quotes' PDFs, each opened in a tab from its own link under the answer */
  pdfs?: string[];
  /** the question that got no answer, so "ลองอีกครั้ง" can ask it again without retyping */
  retry?: string;
}

/**
 * The conversation as the model should see it: without the questions that got no answer.
 *
 * An apology for being busy is not something anybody said about insurance, and a retried
 * question left in twice reads to the model as the customer asking the same thing again.
 */
function historyOf(turns: Turn[]): ChatMessage[] {
  return turns
    .filter((t, i) => !t.retry && !(t.role === "user" && turns[i + 1]?.retry))
    .map((t) => ({ role: t.role, content: t.text }));
}

/**
 * A row of questions to press.
 *
 * Under the last answer only. The page used to open with a set of them too — example
 * questions to start from — and the owner took those off (2026-10-01): the box you type in
 * is the whole of the opening.
 */
function Chips(
  { items, onPick, disabled }: { items: GuideItem[]; onPick: (ask: string) => void; disabled?: boolean },
) {
  return (
    <div className="flex flex-wrap gap-2 short:gap-1.5">
      {items.map((g) => (
        <button
          key={g.ask} type="button" disabled={disabled} onClick={() => onPick(g.ask)}
          title={g.ask}
          className="rounded-full border border-[var(--hm-line)] bg-[var(--hm-panel)] px-3 py-1.5 text-sm text-[var(--hm-ink)] hover:border-[var(--hm-line-strong)] hover:bg-[var(--hm-ground)] disabled:opacity-40"
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

export function Chat({ invite = false }: { invite?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  /**
   * What the pricing brain knows about the person being quoted, held here between questions.
   *
   * It lives in the page rather than a table because a quotation is one sitting: "ชาย 35",
   * then "ทุน 1 ล้าน", then "แล้วจ่าย 10 ปีล่ะ" is three messages about one person, and none
   * of them is worth keeping once the tab is closed.
   */
  const [slots, setSlots] = useState<AnySlots | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /** the scrolling part of the chat box, and the question the newest answer replies to */
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef<HTMLDivElement>(null);

  /**
   * Start again, and mean it.
   *
   * The visible half is the conversation; the half that has to go with it is `slots` — what
   * the pricing brain worked out about whoever was being quoted. Clearing the bubbles and
   * leaving that behind is the worse bug of the two: the screen looks new, and the next
   * question is answered about the last customer's age and sum without saying so.
   *
   * An agent showing this to one person after another is the reason it exists.
   */
  function startOver() {
    setTurns([]);
    setSlots(null);
    setDraft("");
  }

  /**
   * Where the box scrolls to.
   *
   * A question just sent goes to the bottom, so it is seen landing with the dots under it. An
   * answer goes to its own beginning — to the question it answers, then the answer's first
   * line. Scrolling to the end of an answer used to land a quotation somewhere in its middle:
   * the price is at the top, the card at the bottom loads after the scroll has been measured,
   * and the reader arrived between the two with neither on the screen.
   */
  useEffect(() => {
    const box = scrollRef.current;
    const last = turns[turns.length - 1];
    if (!box || !last) return;
    if (last.role === "user") {
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
      return;
    }
    const asked = askedRef.current;
    if (!asked) return;
    const top = box.scrollTop + asked.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
    box.scrollTo({ top, behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const asked = question.trim();
    if (!asked || busy) return;
    if (turns.length === 0) trackMeta("Contact");
    setDraft("");
    setBusy(true);
    // the model sees the conversation as it was before this question, which is what the
    // action expects; the screen gets the question straight away so nothing looks dropped
    const history = historyOf(turns);
    setTurns((t) => [...t, { role: "user", text: asked }]);
    try {
      const reply = await askCopilot(asked, history, slots);
      if (reply.slots !== undefined) setSlots(reply.slots);
      if (reply.priced) trackMeta("Quote");
      setTurns((t) => [...t, {
        role: "assistant", text: reply.text, model: reply.model,
        priced: reply.priced, cards: reply.cards, guide: reply.guide, pdfs: reply.pdfs,
        ...(reply.failed ? { retry: asked } : {}),
      }]);
    } catch {
      setTurns((t) => [...t, {
        role: "assistant", text: "ขออภัยครับ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ", retry: asked,
      }]);
    } finally {
      setBusy(false);
    }
  }

  const talking = turns.length > 0;
  /** the newest question that has an answer under it, which is where an answer scrolls to */
  const answered = turns.length >= 2 && turns[turns.length - 1].role === "assistant" ? turns.length - 2 : -1;

  return (
    <main className={`flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 ${talking ? "max-lg:pt-11" : ""}`}>
      {/**
        * On a phone, before anything is asked, the heading sits beside the menu button rather
        * than under it, rather than leaving that row empty above it. Once there is a
        * conversation the row goes back to the button and to เริ่มใหม่ opposite it.
        */}
      <header className={`flex shrink-0 items-start justify-between gap-3 pt-1 ${talking ? "" : "max-lg:pl-12"}`}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mark.png" alt="" width={32} height={40}
            // not on a phone, where every answer already carries it and the heading needs the width
            className="mt-0.5 h-10 w-auto shrink-0 max-lg:hidden"
          />
        <div>
          {/* Smaller on a phone once there is a conversation: at full size, with the button
              beside it, it broke into four lines and left the chat half the screen. */}
          <h1 className={`${talking ? "text-base" : "text-xl short:text-lg short:leading-snug"} font-semibold tracking-tight sm:text-2xl`}>
            ถามอะไรก็ได้ที่อยากถาม เกี่ยวกับผลิตภัณฑ์ภายใต้บริษัท{" "}
            {/* the company name kept on one line: Thai wraps anywhere, and it split as กรุงไทยแอก / ซ่า */}
            <span className="whitespace-nowrap">กรุงไทย-แอกซ่า ประกันชีวิต</span>
          </h1>
          <p className={`mt-1 text-sm text-[var(--hm-mute)] ${talking ? "max-sm:hidden" : ""}`}>
            ถามเงื่อนไขก็ได้ ขอเบี้ยก็ได้ — เบี้ยคิดจากตารางจริง ตัวเดียวกับที่บอทและหน้าขายใช้ ·{" "}
            <Link href="/other-plans" className="underline underline-offset-2">แบบประกันอื่นๆ</Link>
          </p>
          {/* for somebody not signed in, while sign-up is open (owner, 2026-10-01): the way to try
              Studio, and to keep asking past the free questions — gone once there is a conversation,
              which needs the height */}
          {invite && !talking && (
            <Link
              href="/signup?next=/"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--hm-line)] bg-[var(--hm-panel)] px-3.5 py-1.5 text-sm text-[var(--hm-ink)] no-underline hover:border-[var(--hm-line-strong)]"
            >
              <span aria-hidden>✨</span>
              <span>ลอง Studio ช่วยเขียนคอนเทนต์ ฟรี 10 รอบ — <span className="font-medium underline underline-offset-2">สมัครใน 1 นาที</span></span>
            </Link>
          )}
        </div>
        </div>
        {/* only once there is something to clear: a button that undoes nothing is a button
            somebody has to think about every time they look at the page */}
        {/* On a phone it sits in the row the menu button already takes, top right, rather
            than beside the heading, where it squeezed the heading into four lines. */}
        {talking && (
          <button
            type="button" onClick={startOver} disabled={busy}
            className="z-30 shrink-0 rounded-full border border-[var(--hm-line)] bg-[var(--hm-panel)] px-3.5 py-2 text-sm text-[var(--hm-ink)] hover:border-[var(--hm-line-strong)] disabled:opacity-40 max-lg:fixed max-lg:right-3 max-lg:top-3 lg:bg-transparent lg:px-3 lg:py-1.5 lg:text-xs lg:text-[var(--hm-mute)]"
          >
            เริ่มใหม่
          </button>
        )}
      </header>

      {/**
        * The chat box.
        *
        * One frame holding the conversation and the thing you type into, instead of a page
        * that scrolls with the field stuck to the bottom of the window by a gradient. On a
        * desktop screen that layout left half the page empty between the opening card and a
        * stranded input, which reads as a page that has not finished loading.
        *
        * The interior keeps the ground colour rather than the panel: every answer is a panel
        * bubble, and a panel inside a panel is a bubble with no edge.
        */}
      <section
        className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--hm-hair)] bg-[var(--hm-ground)] shadow-[0_1px_2px_rgba(54,33,31,0.05),0_18px_36px_-20px_rgba(54,33,31,0.35)] ${
          /**
           * Empty, the box is only as tall as what is in it, sitting in the middle of the
           * screen. Stretching it to the full height before anyone has said anything is what
           * put a field to type in at the bottom of an empty page — the thing the owner was
           * looking at when they asked for a chat box. It takes the height when there is a
           * conversation to hold, which is when height is worth having.
           */
          turns.length === 0 ? "my-auto max-h-full" : "min-h-0 flex-1"
        }`}
      >
      <div
        ref={scrollRef}
        // read out as it grows, so an answer is heard arriving and not only seen
        role="log" aria-live="polite" aria-busy={busy}
        className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-3 sm:p-4 ${talking ? "" : "hidden"}`}
      >
        {turns.map((t, i) => (
          <div
            key={i} ref={i === answered ? askedRef : undefined}
            className={t.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}
          >
            {/* The mark beside what the assistant says, and nothing beside what the reader
                says — an avatar on both sides is two faces in a conversation with one.
                Decorative, so it carries no alt text for a screen reader to read out on
                every single turn. */}
            {t.role === "assistant" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/mark.png" alt="" width={22} height={28}
                className="mt-1 h-7 w-auto shrink-0"
              />
            )}
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--hm-solid)] px-4 py-2.5 text-sm text-[var(--hm-solid-ink)]"
                  : "min-w-0 max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--hm-line)] bg-[var(--hm-panel)] px-4 py-3 text-sm leading-relaxed text-[var(--hm-ink)]"
              }
            >
              {t.role === "assistant" ? <Rich text={withoutParticles(t.text)} /> : <p className="whitespace-pre-wrap">{t.text}</p>}
              {/* the picture the engine drew, which is the thing an agent forwards to a
                  customer — drawn server-side from the same figures the words above carry */}
              {t.cards?.map((card) => (
                <a key={card} href={card} target="_blank" rel="noreferrer" className="mt-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card} alt="การ์ดสรุปเบี้ยประกัน" loading="lazy"
                    className="w-full rounded-lg border border-[var(--hm-line)]"
                  />
                  <span className="mt-1.5 block text-xs text-[var(--hm-mute)]">แตะเพื่อเปิดรูปเต็ม แล้วบันทึกไปส่งลูกค้าได้</span>
                </a>
              ))}
              {/* offered under the last answer only: older rows are history, and a page of
                  live buttons down its whole length is a page nobody can read */}
              {t.role === "assistant" && t.guide?.length && i === turns.length - 1 && (
                <div className="mt-3 border-t border-[var(--hm-hair)] pt-3">
                  <p className="mb-2 text-xs text-[var(--hm-mute)]">ถามต่อได้เลย</p>
                  <Chips items={t.guide} onPick={ask} disabled={busy} />
                </div>
              )}
              {/**
                * Only the line that means something to whoever is reading.
                *
                * Every answer used to be signed with the model that wrote it — "ตอบโดย
                * gemini-3.1-flash-lite" — which was worth seeing while this page was the
                * agent's own bench and they were choosing between models. To a customer it is
                * a stranger's name under a sentence about their own money.
                *
                * What stays is the claim a customer has a use for: this figure came out of the
                * company's rate tables and not out of a model. The model's name comes off even
                * there, because the point of the line is the opposite — that no model touched
                * the number.
                */}
              {/* the line that earns the figure its trust, so it is read and not squinted at */}
              {t.role === "assistant" && t.priced && (
                <p className="mt-2.5 text-xs font-medium text-[var(--hm-live)]">
                  {"✓ คิดจากตารางเบี้ยจริง"}
                </p>
              )}
              {/* a couple's two files are numbered in the order the quotes were given */}
              {t.pdfs && t.pdfs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.pdfs.map((pdf, n) => (
                    <a
                      key={pdf} href={pdf} target="_blank" rel="noopener noreferrer"
                      className="inline-block rounded-full bg-[var(--hm-solid)] px-4 py-2 text-sm font-medium text-[var(--hm-solid-ink)]"
                    >
                      {t.pdfs!.length > 1 ? `ดาวน์โหลด PDF (${n + 1})` : "ดาวน์โหลด PDF"}
                    </a>
                  ))}
                </div>
              )}
              {/* the question that got no answer, one press from being asked again — on the
                  newest answer only, since an older one has been asked past already */}
              {t.retry && i === turns.length - 1 && (
                <button
                  type="button" onClick={() => ask(t.retry!)} disabled={busy}
                  className="mt-3 rounded-full bg-[var(--hm-solid)] px-4 py-2 text-sm font-medium text-[var(--hm-solid-ink)] disabled:opacity-40"
                >
                  ลองอีกครั้ง
                </button>
              )}
            </div>
          </div>
        ))}

        {/**
          * Waiting, drawn as the assistant's turn: the mark, a bubble, and dots that move.
          *
          * An answer takes five to ten seconds, and a line of grey text that does not change
          * for that long reads as a page that has stopped. Still for anybody who has asked
          * their device for less motion.
          */}
        {busy && (
          <div className="flex items-start gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" width={22} height={28} className="mt-1 h-7 w-auto shrink-0" />
            <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-[var(--hm-line)] bg-[var(--hm-panel)] px-4 py-3">
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay} style={{ animationDelay: `${delay}ms` }}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--hm-accent)] motion-reduce:animate-none"
                  />
                ))}
              </span>
              <span className="text-sm text-[var(--hm-mute)]">กำลังค้นในระบบ…</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        className={`flex shrink-0 gap-2 bg-[var(--hm-panel)] p-3 ${talking ? "border-t border-[var(--hm-hair)]" : ""}`}
      >
        <input
          /* not disabled while an answer is on its way: a disabled field loses its focus, and
             on a phone that folds the keyboard away after every question sent. Only the
             button waits — `ask` ignores a second question until the first is answered. */
          value={draft} onChange={(e) => setDraft(e.target.value)}
          maxLength={500} autoComplete="off" enterKeyHint="send"
          placeholder="พิมพ์คำถามเรื่องแบบประกัน…"
          aria-label="คำถามของคุณ"
          /* the ground, because the strip it sits on is the panel — a field the colour of
             the thing behind it is a field with only a hairline to say where it is */
          className="flex-1 rounded-xl border border-[var(--hm-line)] bg-[var(--hm-ground)] px-4 py-3 text-sm outline-none placeholder:text-[var(--hm-mute)] focus:border-[var(--hm-accent)]"
        />
        <button
          type="submit" disabled={busy || !draft.trim()}
          className="rounded-xl bg-[var(--hm-solid)] px-5 py-3 text-sm font-medium text-[var(--hm-solid-ink)] disabled:opacity-40"
        >
          ถาม
        </button>
      </form>
      </section>

      <p className="shrink-0 text-center text-xs text-[var(--hm-mute)]">
        เบี้ยเป็นตัวเลขประมาณการจากตารางของบริษัท ไม่ใช่ใบเสนอราคา ·{" "}
        <Link href="/privacy" className="underline">ความเป็นส่วนตัว</Link>
      </p>
    </main>
  );
}
