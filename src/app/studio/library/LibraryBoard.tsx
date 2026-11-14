"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PRODUCT_NAME, TYPE_NAME, usesFor, type LibraryItem, type LibraryProduct, type LibraryTool, type LibraryType } from "@/lib/scene-library/catalog";
import { filterLibrary, type LibraryFilter, type LibraryState } from "@/lib/scene-library/filter";
import { cleanMarks, hasMark, pressMark, withMark, type Marks } from "@/lib/scene-library/mark-state";
import type { MarkKind, Toggled } from "@/lib/scene-library/marks";
import { afterDecide, afterSent, uploadsFor, withoutUpload, type UploadSet } from "@/lib/scene-library/upload-flow";
import type { UploadView } from "@/lib/scene-library/upload-rules";
import type { Sent } from "@/lib/scene-library/uploads";
import { decideLibraryUpload, removeLibraryUpload, toggleLibraryMark } from "./actions";
import { MyFiles, ReviewQueue, UploadCard } from "./UploadList";
import { UploadTab } from "./UploadTab";
import { MegaphoneIcon, PenIcon, QuoteIcon, SearchIcon, SlidersIcon } from "../ui/icons";

/**
 * คลังแอนิเมชัน's board, as the owner-approved mockup v5 draws its หน้าเมนู (2026-11-14): tabs
 * เลือกดู / ของฉัน / อยากได้มากสุด (the owner's), a search and three chip rows, a card per piece, and the
 * detail above the cards when a preview is pressed. Phase 3 adds the members' uploads: tabs อัปโหลด / ของฉัน's
 * ไฟล์ที่ฉันส่ง / คิวตรวจ (the owner's), and the shared parts and styles as cards (UploadTab, UploadList).
 *
 * ★ and อยากได้ change at once and follow the server's answer; a refusal or a failed call puts the mark
 * back with a line under the card, and the button waits while its press is on its way. With the marks
 * unreadable (`marksFailed`) there is no ★ and no vote, and ของฉัน stays only when the uploads can be read
 * (for ไฟล์ที่ฉันส่ง); the page says why above the board.
 */

type Tab = "browse" | "upload" | "mine" | "queue" | "top";
type TypeChip = LibraryFilter["type"] | "upload";
type Chips = Omit<LibraryFilter, "type"> & { type: TypeChip };
type Done = { ok: true } | { ok: false; error: string };
type Verdict = "ok" | "no" | "queue" | "closed";

/** the forms by the names the menu gives them */
const TOOL_NAME: Record<LibraryTool, string> = { "quote-video": "วิดีโอนำเสนอ", "story-clip": "คลิปเล่าเรื่อง", "prompt-story": "คลิปตามโจทย์" };
const TYPES: [TypeChip, string][] = [["any", "ทั้งหมด"], ...(Object.entries(TYPE_NAME) as [LibraryType, string][])];
/** the product chips: catalog.ts's names, its `all` on the chip that shows every product */
const PRODUCTS: [LibraryFilter["product"], string][] = [
  ["any", PRODUCT_NAME.all],
  ...(["health", "life", "saving"] as const).map((p): [Exclude<LibraryProduct, "all">, string] => [p, PRODUCT_NAME[p]]),
];
const STATES: [LibraryState, string][] = [["ready", "ใช้ได้แล้ว"], ["soon", "เร็วๆ นี้"], ["all", "ทั้งหมด"]];
const TYPE_MARK: Record<LibraryType, (p: { className?: string }) => React.ReactNode> = { format: QuoteIcon, device: SlidersIcon, look: PenIcon, fx: MegaphoneIcon };

const chipCls = (on: boolean) =>
  `inline-flex min-h-tap shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-panel)]"}`;
const useCls = "inline-flex min-h-tap items-center justify-center rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)]";
const voteCls = (on: boolean) =>
  `inline-flex min-h-tap items-center justify-center rounded-lg border px-2 text-sm text-[var(--ct-warn-ink)] disabled:opacity-60 ${on ? "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)]" : "border-dashed border-[var(--ct-warn-line)]"}`;
const busyKey = (kind: MarkKind, id: string) => `${kind}:${id}`;

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z" />
    </svg>
  );
}

/** the piece's still (9:16), or a plain tile with its type's mark, kept short so a page of them is not empty frames */
function Preview({ item, src }: { item: LibraryItem; src?: string }) {
  const pic = src ?? item.preview;
  const Mark = TYPE_MARK[item.type];
  return pic ? (
    // eslint-disable-next-line @next/next/no-img-element -- a 216×384 still already made to size
    <img src={pic} alt="" width={216} height={384} loading="lazy" decoding="async" className="block aspect-[9/16] w-full rounded-lg bg-[var(--ct-ground)] object-cover" />
  ) : (
    <span className="grid aspect-[3/2] w-full place-content-center justify-items-center gap-2 rounded-lg border border-dashed border-[var(--ct-line)] bg-[var(--ct-ground)] text-[var(--ct-mute)]">
      <Mark className="size-7" />
      <span className="text-xs">{TYPE_NAME[item.type]}</span>
    </span>
  );
}

function Tags({ item }: { item: LibraryItem }) {
  const tag = "rounded-full px-2 text-xs leading-5";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`${tag} border border-[var(--ct-hair)] text-[var(--ct-mute)]`}>{TYPE_NAME[item.type]}</span>
      {item.product !== "all" && <span className={`${tag} bg-[var(--ct-soft)] text-[var(--ct-accent)]`}>{PRODUCT_NAME[item.product]}</span>}
      {!item.ready && <span className={`${tag} bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]`}>เร็วๆ นี้</span>}
    </div>
  );
}

interface CardProps {
  item: LibraryItem;
  open: Record<LibraryTool, boolean>;
  /** null: the marks could not be read, so no ★ and no vote */
  marks: Marks | null;
  busy: ReadonlySet<string>;
  error?: string;
  onOpen: () => void;
  onMark: (kind: MarkKind) => void;
}

export function LibraryCard({ item, open, marks, busy, error, onOpen, onMark }: CardProps) {
  const use = usesFor(item, open)[0];
  const wanted = Boolean(marks && hasMark(marks, "want", item.id));
  const saved = Boolean(marks && hasMark(marks, "save", item.id));
  return (
    <article className="grid content-start gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-2">
      <button type="button" onClick={onOpen} aria-label={`ดูรายละเอียด ${item.name}`} className={`block rounded-lg ${item.ready ? "" : "opacity-60"}`}>
        <Preview item={item} />
      </button>
      <h3 className="text-sm font-semibold leading-snug">{item.name}</h3>
      <Tags item={item} />
      <div className="flex items-center gap-1.5">
        {item.ready
          ? use
            ? <Link href={use.href} className={`${useCls} flex-1`}>ใช้แบบนี้</Link>
            : <span className="flex-1 text-xs text-[var(--ct-mute)]">ยังไม่เปิดให้ใช้</span>
          : marks && (
            <button type="button" disabled={busy.has(busyKey("want", item.id))} aria-pressed={wanted} onClick={() => onMark("want")} className={`${voteCls(wanted)} flex-1`}>
              {`อยากได้ · ${marks.counts[item.id] ?? 0}`}
            </button>
          )}
        {marks && (
          <button
            type="button" disabled={busy.has(busyKey("save", item.id))} aria-pressed={saved} aria-label={`บันทึก ${item.name}`} onClick={() => onMark("save")}
            className={`ml-auto inline-flex min-h-tap w-11 shrink-0 items-center justify-center rounded-lg border disabled:opacity-60 ${saved ? "border-[var(--ct-warn-line)] text-[var(--ct-warn-ink)]" : "border-[var(--ct-hair)] text-[var(--ct-mute)]"}`}
          >
            <StarIcon on={saved} />
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}
    </article>
  );
}

/** the owner's tab: pieces not built yet, by how many want them, most first */
export function MostWanted({ items, counts }: { items: readonly LibraryItem[]; counts: Record<string, number> }) {
  const top = items.filter((i) => !i.ready && (counts[i.id] ?? 0) > 0).sort((a, b) => counts[b.id] - counts[a.id]);
  return (
    <div className="grid gap-3">
      <h2 className="text-base font-semibold">ที่สมาชิกอยากได้มากที่สุด</h2>
      {top.length ? (
        <ol className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
          {top.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{i.name}</span>
                <span className="block text-xs text-[var(--ct-mute)]">{TYPE_NAME[i.type]}</span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--ct-warn-ink)]">{counts[i.id]} คน</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">ยังไม่มีใครกดอยากได้</p>
      )}
    </div>
  );
}

interface BoardProps {
  items: LibraryItem[];
  open: Record<LibraryTool, boolean>;
  saved: string[];
  wanted: string[];
  counts: Record<string, number>;
  owner: boolean;
  marksFailed?: boolean;
  /** the viewer is the shared demo account: its votes are left out of every count, so its own press does not move one */
  demo?: boolean;
  /** the members' uploads; null when the table cannot be read (no upload tabs, no upload cards), undefined before phase 3's page */
  uploads?: UploadSet | null;
  /** the server's toggle; a stand-in where nothing may be written */
  toggle?: (item: string, kind: MarkKind) => Promise<Toggled>;
  /** the upload route, the owner's verdict, the sender's delete; stand-ins where nothing may be written */
  send?: (form: FormData) => Promise<Sent>;
  decide?: (id: string, verdict: Verdict, reason?: string) => Promise<Done>;
  remove?: (id: string) => Promise<Done>;
}

/** the route's POST; a reply that is not ours reads as a failed send */
async function postUpload(form: FormData): Promise<Sent> {
  const res = await fetch("/api/library-upload", { method: "POST", body: form });
  const out = (await res.json().catch(() => null)) as Sent | null;
  return out && typeof out.ok === "boolean" ? out : { ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" };
}

export function LibraryBoard({
  items, open, saved, wanted, counts, owner, marksFailed = false, demo = false, uploads = null,
  toggle = toggleLibraryMark, send = postUpload,
  decide = (id, verdict, reason) => decideLibraryUpload(id, verdict, reason),
  remove = (id) => removeLibraryUpload(id),
}: BoardProps) {
  const [marks, setMarks] = useState<Marks>(() => cleanMarks(items, { saved, wanted, counts }));
  // the marks as they are this moment, for a press that starts before React has drawn the last one
  const now = useRef(marks);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("browse");
  const [filter, setFilter] = useState<Chips>({ q: "", type: "any", product: "any", state: "ready" });
  const [ups, setUps] = useState<UploadSet | null>(uploads);
  const [sel, setSel] = useState<string | null>(null);
  const [look, setLook] = useState("paper");
  const searchId = useId();
  const detailRef = useRef<HTMLElement>(null);

  const shown = useMemo(() => (filter.type === "upload" ? [] : filterLibrary(items, { ...filter, type: filter.type })), [items, filter]);
  const shownUploads = useMemo(() => (ups ? uploadsFor(ups.shared, filter) : []), [ups, filter]);
  const selected = sel ? items.find((i) => i.id === sel) : undefined;
  const mine = marksFailed ? null : marks;

  useEffect(() => {
    if (!sel) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [sel]);

  const apply = (kind: MarkKind, id: string, on: boolean) => {
    now.current = withMark(now.current, kind, id, on, !demo);
    setMarks(now.current);
  };

  async function press(id: string, kind: MarkKind) {
    const key = busyKey(kind, id);
    if (busy.has(key)) return;
    setBusy((b) => new Set(b).add(key));
    setErrors((e) => {
      const rest = { ...e };
      delete rest[id];
      return rest;
    });
    const error = await pressMark(toggle, id, kind, now.current, apply);
    if (error) setErrors((e) => ({ ...e, [id]: error }));
    setBusy((b) => {
      const next = new Set(b);
      next.delete(key);
      return next;
    });
  }

  const openItem = (id: string) => {
    setSel(id);
    setLook("paper");
  };
  const card = (i: LibraryItem) => (
    <LibraryCard key={i.id} item={i} open={open} marks={mine} busy={busy} error={errors[i.id]} onOpen={() => openItem(i.id)} onMark={(k) => press(i.id, k)} />
  );
  const set = <K extends keyof Chips>(k: K, v: Chips[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const chips = <K extends "type" | "product" | "state">(k: K, label: string, opts: [Chips[K], string][]) => (
    // one row each, scrolled sideways on a phone, so the cards are not pushed below the fold
    <div role="group" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] sm:flex-wrap">
      {opts.map(([v, name]) => (
        <button key={String(v)} type="button" aria-pressed={filter[k] === v} onClick={() => set(k, v)} className={chipCls(filter[k] === v)}>{name}</button>
      ))}
    </div>
  );

  const onSent = (row: UploadView) => {
    setUps((u) => (u ? afterSent(u, row, owner).ups : u));
    // a member lands on ของฉัน; the owner stays, with "ส่งแล้ว"
    if (afterSent({ mine: [], shared: [], waiting: [] }, row, owner).tab) setTab("mine");
  };
  const onRemove = async (id: string): Promise<Done> => {
    const done = await remove(id);
    if (done.ok) setUps((u) => (u ? withoutUpload(u, id) : u));
    return done;
  };
  const onDecide = async (id: string, verdict: Verdict, reason?: string): Promise<Done> => {
    const done = await decide(id, verdict, reason);
    // ok applies the verdict; someone having decided it first only drops it from the queue (the list keeps its message under the row)
    setUps((u) => (u ? afterDecide(u, id, verdict, reason, done) : u));
    return done;
  };

  const tabs: [Tab, string, number?][] = [
    ["browse", "เลือกดู"],
    ...(ups ? [["upload", "อัปโหลด"] as [Tab, string]] : []),
    ...(mine || ups ? [["mine", "ของฉัน", mine?.saved.length] as [Tab, string, number | undefined]] : []),
    ...(ups && owner ? [["queue", "คิวตรวจ", ups.waiting.length] as [Tab, string, number]] : []),
    ...(mine && owner ? [["top", "อยากได้มากสุด"] as [Tab, string]] : []),
  ];

  const detail = selected && (
    <LibraryDetail
      item={selected} open={open} marks={mine} busy={busy} error={errors[selected.id]} look={look} onLook={setLook}
      onClose={() => setSel(null)} onMark={(k) => press(selected.id, k)} innerRef={detailRef}
    />
  );

  return (
    <div className="mt-4 grid gap-4">
      <div role="tablist" aria-label="แท็บคลังแอนิเมชัน" className="flex gap-1 overflow-x-auto border-b border-[var(--ct-hair)] [scrollbar-width:none]">
        {tabs.map(([k, name, n]) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setSel(null); }}
            className={`inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm ${tab === k ? "border-[var(--ct-accent)] font-semibold text-[var(--ct-accent)]" : "border-transparent text-[var(--ct-mute)]"}`}
          >
            {name}{n ? <span className="rounded-full bg-[var(--ct-soft)] px-1.5 text-xs text-[var(--ct-accent)]">{n}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="grid min-w-0 gap-4">
        {tab === "browse" && (
          <>
            <div>
              <label htmlFor={searchId} className="sr-only">ค้นหาในคลังแอนิเมชัน</label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ct-mute)]" />
                <input
                  id={searchId} type="search" value={filter.q} onChange={(e) => set("q", e.target.value)} placeholder="ค้นหา เช่น ค่าห้อง ละครสั้น แสงอุ่น"
                  className="min-h-tap w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--ct-accent)]"
                />
              </div>
            </div>
            <div className="grid gap-2">
              {chips("type", "ประเภท", ups ? [...TYPES, ["upload", "ไฟล์จากสมาชิก"]] : TYPES)}
              {chips("product", "สินค้า", PRODUCTS)}
              {chips("state", "สถานะ", STATES)}
            </div>
            {detail}
            {shown.length + shownUploads.length ? (
              <>
                <p className="text-xs text-[var(--ct-mute)]" aria-live="polite">{shown.length + shownUploads.length} รายการ</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.map(card)}
                  {shownUploads.map((v) => <UploadCard key={v.id} view={v} open={open} />)}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">ไม่พบรายการที่ตรงกับตัวกรอง ลองเลือก “ทั้งหมด”</p>
            )}
          </>
        )}

        {tab === "upload" && ups && <UploadTab sent={ups.mine.length} owner={owner} demo={demo} send={send} onSent={onSent} />}

        {tab === "mine" && (mine || ups) && (
          <>
            {mine && (
              <>
                {detail}
                <h2 className="text-base font-semibold">ที่บันทึกไว้ ({mine.saved.length})</h2>
                {mine.saved.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {mine.saved.map((id) => items.find((i) => i.id === id)).filter((i): i is LibraryItem => Boolean(i)).map(card)}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ct-mute)]">กด ★ บนการ์ดเพื่อเก็บไว้ใช้บ่อย</p>
                )}
                <p className="text-sm text-[var(--ct-mute)]">กดอยากได้ไว้ {mine.wanted.length} ชิ้น</p>
              </>
            )}
            {ups && <MyFiles rows={ups.mine} onRemove={onRemove} />}
          </>
        )}

        {tab === "queue" && ups && owner && <ReviewQueue rows={ups.waiting} onDecide={onDecide} />}

        {tab === "top" && mine && owner && <MostWanted items={items} counts={mine.counts} />}
      </div>
    </div>
  );
}

export interface DetailProps extends Omit<CardProps, "onOpen"> {
  look: string;
  onLook: (id: string) => void;
  onClose: () => void;
  innerRef: React.Ref<HTMLElement>;
}

/**
 * the larger preview, what it tells, a device's looks, and one way into each form it works in; on a device
 * the links are the shown look's, so the form opens in the look the viewer picked here
 */
export function LibraryDetail({ item, open, marks, busy, error, look, onLook, onClose, onMark, innerRef }: DetailProps) {
  const shownLook = item.looks?.find((l) => l.id === look) ?? item.looks?.[0];
  const uses = usesFor(shownLook ?? item, open);
  const wanted = Boolean(marks && hasMark(marks, "want", item.id));
  return (
    <section ref={innerRef} aria-label={`รายละเอียด ${item.name}`} className="grid gap-4 rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      <div className="w-full max-w-[200px]"><Preview item={item} src={shownLook?.preview} /></div>
      <div className="grid min-w-0 content-start gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="pt-2 text-base font-semibold">{item.name}</h2>
          <button type="button" onClick={onClose} className="inline-flex min-h-tap shrink-0 items-center rounded-lg px-3 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]">ปิด</button>
        </div>
        <p className="text-sm text-[var(--ct-mute)]">{item.tells}</p>
        <Tags item={item} />
        {item.looks && (
          <>
            <p className="text-xs text-[var(--ct-mute)]">ดูในหน้าตา</p>
            <div role="group" aria-label="ดูในหน้าตา" className="flex flex-wrap gap-2">
              {item.looks.map((l) => (
                <button key={l.id} type="button" aria-pressed={shownLook?.id === l.id} onClick={() => onLook(l.id)} className={chipCls(shownLook?.id === l.id)}>{l.name}</button>
              ))}
            </div>
          </>
        )}
        {item.ready ? (
          uses.length ? (
            <>
              <p className="text-xs text-[var(--ct-mute)]">ใช้ได้กับ</p>
              <div className="flex flex-wrap gap-2">
                {uses.map((u) => <Link key={u.tool} href={u.href} className={useCls}>ใช้ใน {TOOL_NAME[u.tool]}</Link>)}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--ct-mute)]">ยังไม่เปิดให้ใช้</p>
          )
        ) : marks ? (
          <>
            <p className="rounded-lg bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">
              เร็วๆ นี้ มีสมาชิก {marks.counts[item.id] ?? 0} คนอยากได้ ยิ่งคนอยากได้มาก แอดมินยิ่งทำก่อน
            </p>
            <div>
              <button type="button" disabled={busy.has(busyKey("want", item.id))} aria-pressed={wanted} onClick={() => onMark("want")} className={voteCls(wanted)}>
                {wanted ? "กดอยากได้แล้ว" : "อยากได้"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--ct-mute)]">เร็วๆ นี้</p>
        )}
        {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}
      </div>
    </section>
  );
}
