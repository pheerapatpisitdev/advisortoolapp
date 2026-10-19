"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CopyButton, copyText as toClipboard } from "./CopyButton";
import { VideoButton } from "./VideoButton";
import { THAI_CONTACT, type ContactWords } from "@/lib/ihealthy-words";
import { cleanCustomerName, NAME_MAX, withCustomerName } from "@/lib/customer-name";

/**
 * The way out of the page once a price is on screen: one "ส่งให้ลูกค้า" that opens a panel of
 * what will go — the card, the table, the illnesses, the text, each ticked — and sends them all
 * in one trip to the customer's chat (owner, 2026-10-14, option ก on mockup
 * https://claude.ai/artifact/AhUg4HrF1qMvrYVszxoG63).
 *
 * It replaced four look-alike buttons, one trip each: ส่งการ์ด, บันทึกตาราง…, ส่งให้ลูกค้า (the
 * text only, and on a computer the Facebook Business inbox, where an agent on LINE has nothing)
 * and คัดลอกข้อความ, which on a computer did the same as the one above it.
 *
 * On a phone the pictures and the text go into the system share sheet together, and the text
 * is put on the clipboard as well: Messenger drops text sent beside pictures. A computer has no
 * share sheet worth the name, so there the pictures are downloaded and the text copied.
 *
 * No button leads to the Facebook Page — the owner took them all out (2026-09-23).
 */
type Kind = "card" | "table" | "diseases";
interface Piece { kind: Kind; path: string; filename: string; label: string }
type Status = "idle" | "working" | "sent" | "saved" | "nothing";

/** the compact bar asks the full panel on the same page to open */
const OPEN_EVENT = "send-kit:open";

/**
 * The customer's name typed in the panel, shared with the phone bar's คัดลอก on the same page
 * so both copy the same text. Cleared when the panel leaves the page: the next quote may be
 * somebody else's.
 */
let typedName = "";
const nameListeners = new Set<() => void>();
function setTypedName(value: string) {
  typedName = value;
  nameListeners.forEach((l) => l());
}
function useTypedName(): string {
  return useSyncExternalStore(
    (l) => { nameListeners.add(l); return () => { nameListeners.delete(l); }; },
    () => typedName,
    () => "",
  );
}

/** the text with the customer's name as its first line (owner, 2026-10-19), or as it was */
function namedText(text: string | undefined, name: string | undefined, w: ContactWords["kit"]): string | undefined {
  return text && name ? `${w.forLine(w.addressed(name))}\n\n${text}` : text;
}

export function ContactButtons(
  { copyText, cardPath, tableCardPath, tableLabel, diseaseCardPath, videoHref, compact = false, words }:
    {
      copyText?: string; cardPath?: string; tableCardPath?: string;
      /** what the table is called, for a plan whose table is not a table of values */
      tableLabel?: string;
      /** the contract's illnesses as a picture — the same for every customer, so it needs no quote */
      diseaseCardPath?: string;
      /** วิดีโอนำเสนอ in Studio, started from this quote — shown to signed-in agents only */
      videoHref?: string;
      compact?: boolean;
      /** the buttons' labels in another language; Thai without it */
      words?: ContactWords;
    },
) {
  const w = (words ?? THAI_CONTACT).kit;
  const name = cleanCustomerName(useTypedName());
  const pieces = useMemo(() => [
    cardPath && { kind: "card", path: cardPath, filename: "quote.png", label: w.card },
    tableCardPath && { kind: "table", path: tableCardPath, filename: "value-table.png", label: tableLabel ?? w.table },
    diseaseCardPath && { kind: "diseases", path: diseaseCardPath, filename: "diseases.png", label: w.diseases },
  ].filter((p): p is Piece => Boolean(p)), [cardPath, tableCardPath, diseaseCardPath, tableLabel, w]);

  const shape = compact
    ? "rounded-sm px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-sm px-5 py-3.5 text-center font-medium tracking-wide";
  const main = `${shape} bg-[var(--lg-gold)] text-[var(--lg-ground)] disabled:opacity-50`;
  const quiet = `${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`;

  if (compact) {
    return (
      <div className="flex gap-2 [&>*]:flex-1">
        {(pieces.length > 0 || copyText) && (
          <button type="button" className={main} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>{w.open}</button>
        )}
        {copyText && <CopyButton text={namedText(copyText, name, w)!} compact words={words?.copy} className={quiet} />}
      </div>
    );
  }
  return <Kit pieces={pieces} text={copyText} videoHref={videoHref} w={w} copyWords={words?.copy} main={main} quiet={quiet} shape={shape} />;
}

function Kit({ pieces: plain, text: plainText, videoHref, w, copyWords, main, quiet, shape }: {
  pieces: Piece[]; text?: string; videoHref?: string; w: ContactWords["kit"]; copyWords?: ContactWords["copy"];
  main: string; quiet: string; shape: string;
}) {
  const typed = useTypedName();
  /** the name the pictures are drawn with: settled for a moment, so each letter is not a drawing */
  const [settled, setSettled] = useState<string | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setSettled(cleanCustomerName(typed)), 500);
    return () => clearTimeout(t);
  }, [typed]);
  // the next quote may be somebody else's
  useEffect(() => () => setTypedName(""), []);
  // the card and the tables carry the name; the illnesses are the contract's, the same for everyone
  const pieces = useMemo(
    () => plain.map((p) => (p.kind === "diseases" ? p : { ...p, path: withCustomerName(p.path, settled) })),
    [plain, settled],
  );
  const shown = cleanCustomerName(typed);
  const text = namedText(plainText, shown, w);

  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  /** each picture drawn once, by its path; a new quote is a new path */
  const [drawn, setDrawn] = useState<Record<string, { url: string } | "failed">>({});
  const pending = useRef(new Map<string, Promise<Blob>>());
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback((path: string): Promise<Blob> => {
    let p = pending.current.get(path);
    if (!p) {
      p = fetch(path).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
      pending.current.set(path, p);
      p.then((b) => setDrawn((all) => ({ ...all, [path]: { url: URL.createObjectURL(b) } })))
        .catch(() => { pending.current.delete(path); setDrawn((all) => ({ ...all, [path]: "failed" })); });
    }
    return p;
  }, []);

  // the pictures are drawn when the panel opens, not with the page: most readers never send
  useEffect(() => {
    if (open) pieces.forEach((p) => { load(p.path).catch(() => {}); });
  }, [open, pieces, load]);

  // the phone bar's ส่งให้ลูกค้า opens this panel and brings it into view
  useEffect(() => {
    const show = () => {
      setOpen(true);
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    if (status === "idle" || status === "working") return;
    const t = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const chosen = pieces.filter((p) => !off.has(p.kind));
  const withText = Boolean(text) && !off.has("text");
  const toggle = (key: string) => setOff((s) => {
    const next = new Set(s);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  const files = async (list: Piece[]) => Promise.all(list.map(async (p) =>
    new File([await load(p.path)], p.filename, { type: "image/png" })));

  const download = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const send = async () => {
    if (chosen.length === 0 && !withText) return setStatus("nothing");
    setStatus("working");
    // first, while the tap still counts: some apps keep the pictures and drop the words
    if (withText) toClipboard(text!).catch(() => {});
    try {
      const pics = await files(chosen);
      const shared = { ...(pics.length ? { files: pics } : {}), ...(withText ? { text } : {}) };
      if (typeof navigator.share === "function" && (!pics.length || navigator.canShare?.({ files: pics }))) {
        // an agent backing out of the sheet is not a failure and has nothing to report
        await navigator.share(shared).catch(() => {});
        return setStatus("sent");
      }
      pics.forEach(download);
      setStatus("saved");
    } catch {
      // a picture that would not draw: open what there is, the text is already copied
      chosen.forEach((p) => window.open(p.path, "_blank", "noopener,noreferrer"));
      setStatus("idle");
    }
  };

  const save = async () => {
    if (chosen.length === 0) return setStatus("nothing");
    setStatus("working");
    try {
      const pics = await files(chosen);
      // a phone saves a picture from the share sheet ("บันทึกรูปภาพ"); a computer downloads it
      if (navigator.canShare?.({ files: pics })) await navigator.share({ files: pics }).catch(() => {});
      else pics.forEach(download);
    } catch {
      chosen.forEach((p) => window.open(p.path, "_blank", "noopener,noreferrer"));
    }
    setStatus("idle");
  };

  const sendLabel = status === "working" ? w.working
    : status === "sent" ? (withText ? w.sent : "✓")
      : status === "saved" ? w.saved
        : status === "nothing" ? w.nothing
          : w.send(chosen.length, withText);

  const tile = (key: string, label: string, on: boolean, face: ReactNode) => (
    <label key={key} className={`flex min-w-0 cursor-pointer flex-col gap-1.5 rounded border-2 p-1.5 text-xs ${on ? "border-[var(--lg-gold)]" : "border-[var(--lg-panel-line)] opacity-50"}`}>
      <span className="relative block overflow-hidden rounded-sm bg-[var(--lg-ground)]" style={{ aspectRatio: "4 / 5" }}>{face}</span>
      <span className="flex items-center gap-1.5 font-medium">
        <input type="checkbox" checked={on} onChange={() => toggle(key)} className="accent-[var(--lg-gold)]" />
        <span className="min-w-0 break-words leading-tight">{label}</span>
      </span>
    </label>
  );

  return (
    <div ref={box} className="grid gap-2">
      <button type="button" className={main} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{w.open}</button>
      {open && (
        <div className="grid gap-3 rounded-sm border border-[var(--lg-panel-line)] p-3">
          <div className="grid gap-1">
            <label htmlFor="send-kit-name" className="text-sm font-medium">
              {w.name} <span className="font-normal text-[var(--lg-mute)]">{w.nameOptional}</span>
            </label>
            <input
              id="send-kit-name" type="text" value={typed} maxLength={NAME_MAX + 4} autoComplete="off"
              placeholder={w.namePlaceholder} onChange={(e) => setTypedName(e.target.value)}
              className="rounded-sm border border-[var(--lg-panel-line)] bg-transparent px-3 py-2 text-base outline-none focus-visible:border-[var(--lg-gold)]"
            />
            {shown && <span className="text-xs text-[var(--lg-mute)]">{w.nameHint(w.addressed(shown))}</span>}
          </div>
          <span className="text-xs text-[var(--lg-mute)]">{w.choose}</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${pieces.length + (text ? 1 : 0)}, minmax(0, 1fr))` }}>
            {pieces.map((p) => {
              const d = drawn[p.path];
              return tile(p.kind, p.label, !off.has(p.kind),
                d && d !== "failed"
                  // eslint-disable-next-line @next/next/no-img-element -- a drawn blob, not a page asset
                  ? <img src={d.url} alt={p.label} className="absolute inset-0 h-full w-full object-cover object-top" />
                  : <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[0.65rem] text-[var(--lg-mute)]">{d === "failed" ? "—" : w.loading}</span>);
            })}
            {text && tile("text", w.text, withText,
              <span className="absolute inset-0 overflow-hidden whitespace-pre-line p-1.5 leading-snug text-[var(--lg-mute)]" style={{ fontSize: "0.55rem" }}>{text}</span>)}
          </div>
          <button type="button" className={main} onClick={send} disabled={status === "working"} aria-live="polite">{sendLabel}</button>
        </div>
      )}
      {(pieces.length > 0 || text) && (
        <div className="flex gap-2 [&>*]:flex-1">
          {pieces.length > 0 && <button type="button" className={`${quiet} text-sm`} onClick={save}>{w.save}</button>}
          {text && <CopyButton text={text} words={copyWords} className={`${quiet} text-sm`} />}
        </div>
      )}
      {videoHref && <VideoButton href={videoHref} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />}
    </div>
  );
}
