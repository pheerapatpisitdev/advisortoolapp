"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HOOK_CATEGORY_LABEL, type HookTemplate } from "@/lib/content/hooks";
import { footer, fullText } from "@/lib/content/output";
import type { PiecePerson } from "@/lib/content/people";
import { defaultPoster, posterUrl, THEME_LABEL, THEMES } from "@/lib/content/poster";
import { MAX_PIECES } from "@/lib/content/plan";
import { onPage, publishView } from "@/lib/content/publish-label";
import { anglesFor, FORMAT_SHORT, GOALS, MAX_FACT, MAX_READER, NICHES, type AngleId, type Format, type GoalId, type Length } from "@/lib/content/prompt";
import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { AUTO, AUTO_FLOOR_THB, DEFAULT_PAINTER, DEFAULT_WRITER, OVERHEAD_THB, PAINTERS, WRITERS, painterFor, painterOf, writerOf } from "@/lib/content/models";
import type { ContentItem, ContentStatus } from "@/lib/content/store";
import { contentSpend, contentWorkbench, removeContent, setContentStatus, type DrawBackgroundResult, type GenerateResult } from "./actions";
import { drawPicture, generateRound } from "./draw";
import { PersonPicker, type PersonOption } from "./PersonPicker";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "./ThemeSwatches";
import { ask } from "./ask";
import { PieceCard, PieceSkeleton } from "./PieceCard";
import { PieceEditor } from "./PieceEditor";
import { ScriptCard } from "./ScriptCard";
import { ClaimTools } from "./claim/ClaimTools";
import { RecruitTools } from "./recruit/RecruitTools";
import { CLAIM_HREF, CLAIM_NAME } from "@/lib/content/claim";
import { RECRUIT_HREF, RECRUIT_NAME } from "@/lib/content/recruit";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "./ui/icons";
import { PlainText } from "./ui/editor-fields";
import { FormatPicker, FormSection, LoopToggle, PictureFold, PressBar, pictureSummary, useLoop } from "./ui/form-parts";

/**
 * The content workbench, laid out as the owner's Maryjane project lays out its run page:
 * the tools on the left, the pieces in the middle, the pieces actually used on the right.
 *
 * On a phone the three stack — tools first, because on this page nothing exists until the
 * tools are used; then the pieces; then the used list. The สร้าง button and its price ride
 * along the bottom of the tools (sticky), so the long form never hides them. After a round is
 * written the form folds away and the page scrolls to the pieces.
 *
 * A piece is รอตรวจ, ใช้จริง or in the ถังขยะ, the three tabs of Maryjane's workbench. ทิ้ง moves
 * a piece to the bin with no question; from there it is กู้คืน'd to รอตรวจ, or ลบถาวร deletes it
 * and its pictures after one confirmation. Marking a piece ใช้จริง also teaches the formula
 * library its hook.
 */

interface Props {
  products: { href: string; name: string }[];
  lengths: { id: Length; label: string }[];
  hooks: HookTemplate[];
  initialHook: string | null;
  initial: { items: ContentItem[]; counts: Record<ContentStatus, number>; failed?: boolean };
  initialUsed: ContentItem[];
  spend: { spent: number; cap: number };
  /** a piece to open in the editor on arrival, from the calendar's แก้ไข */
  initialOpen?: ContentItem | null;
  /** the people library, for ใส่บุคคลในภาพ */
  people: PersonOption[];
}

const TABS: { id: ContentStatus; label: string }[] = [
  { id: "draft", label: "รอตรวจ" },
  { id: "used", label: "ใช้จริง" },
  { id: "trashed", label: "ถังขยะ" },
];

/** the models last picked, kept in this browser; a private window simply starts on the defaults */
const PICK_KEY = "content-models";
/** the reader last named: a page usually speaks to one niche, so it is kept for the next visit */
const READER_KEY = "content-reader";
/** the round's person and pose, kept per device like the reader */
const PERSON_KEY = "content-person";
/** the round's poster colour, kept per device like the reader */
const THEME_KEY = "content-poster-theme";
/** the owner's own direction for the round's pictures, kept per device like the reader */
const BRIEF_KEY = "content-picture-brief";
/** what drawBackground translates and keeps of a request */
const MAX_BRIEF = 300;

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;

const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

/** the question before leaving an editor with words not yet saved */
const LEAVE = "ยังไม่ได้บันทึกที่แก้ไว้ ออกเลยไหม?";
/** the history step an open editor adds, so Back closes it (see inHistory) */
const EDITOR_STEP = "studioEditor";

/**
 * A word for the owner at the foot of the screen. Each comes from one place and replaces only
 * that place's last word: a round's error is not overwritten by a picture that failed after
 * it, nor cleared by a status change that went through.
 */
type Toast = { from: "round" | "round-note" | "draw" | "draw-note" | "status" | "delete" | "load" | "copy"; tone: "error" | "notice"; text: string };

/** Drops a query parameter from the address bar without a trip to the server. */
function dropParam(name: string) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* the address keeps it; nothing else depends on it */ }
}

/**
 * The formula picker: a search over every formula, each shown whole. A select cut the long
 * ones to their first words, and with fifty-odd of them the owner could not tell two apart.
 * Radio buttons underneath, so the arrow keys move through them as in any list of choices.
 */
function HookPicker({ hooks, value, onChange }: { hooks: HookTemplate[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const chosen = hooks.find((h) => h.id === value) ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // the same fields the formula library searches, and the category's name besides
    return q
      ? hooks.filter((h) => [h.template, h.exampleHook ?? "", HOOK_CATEGORY_LABEL[h.category]].some((t) => t.toLowerCase().includes(q)))
      : hooks;
  }, [hooks, query]);
  const option = (key: string, label: React.ReactNode) => (
    <label key={key || "none"} className={`flex min-h-11 cursor-pointer items-start gap-2.5 px-3 py-2 text-sm leading-snug hover:bg-[var(--ct-ground)] ${value === key ? "bg-[var(--ct-soft)]" : ""}`}>
      <input
        type="radio" name={`${id}-hook`} value={key} checked={value === key} onChange={() => onChange(key)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--ct-solid)]"
      />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
  return (
    <div>
      <span id={`${id}-title`} className="mb-1 block text-sm font-medium">สูตรประโยคเปิด <span className="font-normal text-[var(--ct-mute)]">(ไม่ใช้ก็ได้)</span></span>
      <button
        type="button" aria-expanded={open} aria-controls={`${id}-panel`} aria-describedby={`${id}-title`} onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-start justify-between gap-2 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-left text-sm leading-snug hover:bg-[var(--ct-ground)]"
      >
        <span className="min-w-0 flex-1">{chosen ? `“${chosen.template}”` : "ไม่ใช้สูตร — ให้ AI คิดเอง"}</span>
        <span className="flex shrink-0 items-center gap-1 text-[var(--ct-accent)]">
          {open ? "ปิด" : "เลือก"}
          <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {chosen && (
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">หมวด {HOOK_CATEGORY_LABEL[chosen.category]} · ใช้ไปแล้ว {chosen.useCount} ครั้ง</span>
      )}
      {open && (
        <div id={`${id}-panel`} className="mt-2 overflow-hidden rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)]">
          <div className="border-b border-[var(--ct-hair)] p-2">
            <label htmlFor={`${id}-q`} className="sr-only">ค้นหาสูตรประโยคเปิด</label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ct-mute)]" />
              <input
                id={`${id}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="พิมพ์ค้นหา เช่น ลูก, ภาษี" autoComplete="off" className={`${field} pl-9`}
              />
            </div>
            <p aria-live="polite" className="mt-1 text-xs text-[var(--ct-mute)]">{query.trim() ? `พบ ${shown.length} สูตร` : `ทั้งหมด ${hooks.length} สูตร`}</p>
          </div>
          <div role="radiogroup" aria-labelledby={`${id}-title`} className="max-h-72 divide-y divide-[var(--ct-hair)] overflow-y-auto overscroll-contain">
            {option("", "ไม่ใช้สูตร — ให้ AI คิดเอง")}
            {shown.map((h) => option(h.id, (
              <>
                “{h.template}”
                <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">{HOOK_CATEGORY_LABEL[h.category]} · ใช้ไปแล้ว {h.useCount} ครั้ง</span>
              </>
            )))}
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-[var(--ct-mute)]">ไม่พบสูตรที่มีคำนี้</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContentStudio({ products, lengths, hooks, initialHook, initial, initialUsed, spend: initialSpend, initialOpen, people }: Props) {
  const [href, setHref] = useState(products[0]?.href ?? "");
  const [format, setFormat] = useState<Format>("post");
  /** จากแบบประกัน, รีวิวเคลม or หาทีม: the forms share the pieces, the models and the budget line */
  const [mode, setMode] = useState<"plan" | "claim" | "recruit">("plan");
  const [writer, setWriter] = useState(DEFAULT_WRITER);
  const [painter, setPainter] = useState(DEFAULT_PAINTER);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PICK_KEY) ?? "{}") as { writer?: string; painter?: string };
      if (saved.writer === AUTO || WRITERS.some((w) => w.id === saved.writer)) setWriter(saved.writer!);
      if (saved.painter === AUTO || PAINTERS.some((p) => p.id === saved.painter)) setPainter(saved.painter!);
    } catch { /* storage unavailable: the defaults stand */ }
  }, []);
  const pick = (next: { writer?: string; painter?: string }) => {
    if (next.writer) setWriter(next.writer);
    if (next.painter) setPainter(next.painter);
    try { localStorage.setItem(PICK_KEY, JSON.stringify({ writer, painter, ...next })); } catch { /* not kept */ }
  };
  const [angle, setAngle] = useState<AngleId>("");
  // a pick the form no longer offers (the plan or the format changed) goes back to ให้ AI เลือก
  useEffect(() => {
    if (angle && angle !== "custom" && !anglesFor(format, href).some((a) => a.id === angle)) setAngle("");
  }, [angle, format, href]);
  const [reader, setReaderState] = useState("");
  useEffect(() => {
    try { setReaderState(localStorage.getItem(READER_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const setReader = (next: string) => {
    setReaderState(next);
    try { localStorage.setItem(READER_KEY, next); } catch { /* not kept */ }
  };
  const [theme, setThemeState] = useState<ThemeChoice>("navy");
  useEffect(() => {
    try {
      const kept = localStorage.getItem(THEME_KEY) ?? "";
      if (kept === AUTO_THEME || (THEMES as readonly string[]).includes(kept)) setThemeState(kept as ThemeChoice);
    } catch { /* storage unavailable */ }
  }, []);
  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* not kept */ }
  };
  const [person, setPersonState] = useState<PiecePerson | null>(null);
  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(PERSON_KEY) ?? "null") as PiecePerson | null;
      // someone since removed from the library is not offered back
      if (kept && people.some((p) => p.id === kept.id)) setPersonState(kept);
    } catch { /* storage unavailable */ }
    // the library does not change while the page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setPerson = (next: PiecePerson | null) => {
    setPersonState(next);
    try { localStorage.setItem(PERSON_KEY, JSON.stringify(next)); } catch { /* not kept */ }
  };
  const [brief, setBriefState] = useState("");
  useEffect(() => {
    try { setBriefState(localStorage.getItem(BRIEF_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const setBrief = (next: string) => {
    setBriefState(next);
    try { localStorage.setItem(BRIEF_KEY, next); } catch { /* not kept */ }
  };
  const [goal, setGoal] = useState<GoalId>("");
  const [fact, setFact] = useState("");
  const [custom, setCustom] = useState("");
  const [length, setLength] = useState<Length>("60");
  const [loop, setLoop] = useLoop();
  const [count, setCount] = useState(3);
  const [adAngles, setAdAngles] = useState(2);
  const [adTones, setAdTones] = useState(2);
  const [hookId, setHookId] = useState(initialHook ?? "");
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** one word per source, the newest three on screen */
  const say = (from: Toast["from"], text: string, tone: Toast["tone"] = "error") =>
    setToasts((list) => [...list.filter((t) => t.from !== from), { from, tone, text }].slice(-3));
  const hush = (from: Toast["from"]) => setToasts((list) => (list.some((t) => t.from === from) ? list.filter((t) => t.from !== from) : list));
  const [spend, setSpend] = useState(initialSpend);
  const router = useRouter();
  /**
   * The create form on a phone: folded away after a round, so the pieces are what is on screen —
   * and folded on arrival when pieces are waiting to be read, which otherwise began three
   * screens down under the whole form. Open when there is nothing to read, or a formula was
   * brought from the library to write with. (A desk shows it whatever this says.)
   */
  const [formOpen, setFormOpen] = useState(() => Boolean(initialHook) || (initial.items.length === 0 && !initialOpen));
  const formId = useId();
  /** the ใช้จริง rail below xl shows five until asked for the rest */
  const [allUsed, setAllUsed] = useState(false);

  const [tab, setTab] = useState<ContentStatus>("draft");
  const [plan, setPlan] = useState("");
  const [items, setItems] = useState(initial.items);
  const [counts, setCounts] = useState(initial.counts);
  /** the list could not be read at all — said so, not shown as an empty tab */
  const [loadFailed, setLoadFailed] = useState(Boolean(initial.failed));
  const [loadingMore, setLoadingMore] = useState(false);
  const [used, setUsed] = useState(initialUsed);
  const [editing, setEditing] = useState<string | null>(initialOpen?.id ?? null);
  /** a piece opened from the calendar page (/studio?open=…), which may be in neither tab's list */
  const [opened, setOpened] = useState<ContentItem | null>(initialOpen ?? null);
  /** pieces with a status change or a delete under way — one each, several at once */
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  /** the ใช้จริง rail is every plan's, so its number is too — counts.used follows the filter */
  const [usedTotal, setUsedTotal] = useState(initial.counts.used);
  const [copied, setCopied] = useState<string | null>(null);
  // the "copied" line's timer, stopped if the page is left before it runs
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  /** the open editor holds words not yet saved (PieceEditor says so) */
  const [editorDirty, setEditorDirty] = useState(false);
  const dirtyNow = useRef(false);
  useEffect(() => { dirtyNow.current = editorDirty; }, [editorDirty]);
  const [drawing, setDrawing] = useState<Set<string>>(() => new Set());
  /**
   * How many pieces the round in progress asked for — fixed at the press, not the live
   * picker — and nought when no round is running. Its own state rather than a transition's
   * pending flag: that one stayed on while the pictures were drawing, so a skeleton sat
   * beside the finished card and read as a second piece being made.
   */
  const [making, setMaking] = useState(0);
  const [makingFormat, setMakingFormat] = useState<Format>("post");
  const pending = making > 0;
  /**
   * What is on screen now, for code that finishes long after it started: a round lands
   * twenty seconds after the press, and the closure it began in still sees that moment.
   */
  const view = useRef({ tab, plan, editing, items, used });
  useEffect(() => { view.current = { tab, plan, editing, items, used }; });
  const pieces = useRef<HTMLElement>(null);

  /**
   * The tools column on a desk scrolls inside itself with the สร้าง button pinned at its foot,
   * so the column must end where the window does — from wherever its top is right now. A fixed
   * calc(100dvh − 2rem) held only once the column had stuck: on arrival, under the heading,
   * its foot and the button were below the fold.
   */
  const tools = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = tools.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const top = Math.max(16, el.getBoundingClientRect().top);
      el.style.setProperty("--tools-room", `${Math.max(320, Math.round(window.innerHeight - top - 16))}px`);
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(fit); };
    fit();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
    };
  }, []);

  /**
   * The editor has the middle column to itself: it opened inline among the cards, and the
   * owner saw pieces they were not editing above and below it. Opening scrolls to the top of
   * the column; leaving scrolls back to the card that was open, so the list is where it was.
   */
  const returnTo = useRef<string | null>(null);
  function openEditor(id: string) {
    returnTo.current = id;
    setEditing(id);
  }
  useEffect(() => {
    setEditorDirty(false);
    if (editing) { pieces.current?.scrollIntoView({ block: "start" }); return; }
    // the calendar's แก้ไข arrived as ?open=; once that editor is closed, a reload should not open it again
    dropParam("open");
    if (returnTo.current) document.getElementById(`piece-${returnTo.current}`)?.scrollIntoView({ block: "center" });
    returnTo.current = null;
  }, [editing]);

  /**
   * The phone's back gesture (and the browser's Back) closes the editor rather than leaving
   * Studio. Opening it adds a step to the history, so Back lands on the list — asking first
   * when words are unsaved, and staying if the owner says so. Before this, Back from the
   * editor was a move within the app: no beforeunload, no question, the edits gone.
   * Closing it any other way takes that step back off, so Back from the list leaves as before.
   */
  const inHistory = useRef(false);
  const skipPop = useRef(false);
  const markEditor = (id: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("open", id);
      window.history.pushState({ [EDITOR_STEP]: id }, "", `${url.pathname}${url.search}${url.hash}`);
      inHistory.current = true;
    } catch { /* Back leaves the page, as it did */ }
  };
  useEffect(() => {
    if (editing && !inHistory.current) markEditor(editing);
    if (!editing && inHistory.current) {
      inHistory.current = false;
      skipPop.current = true;
      window.history.back();
    }
  }, [editing]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // our own step taken back off: the step below may be the calendar's ?open= link, and a
      // reload must not open the editor again
      if (skipPop.current) { skipPop.current = false; dropParam("open"); return; }
      const open = view.current.editing;
      const step = (e.state as Record<string, unknown> | null)?.[EDITOR_STEP];
      if (!open || step === open) return;
      inHistory.current = false;
      if (!dirtyNow.current) { closeEditor(); return; }
      void ask(LEAVE, "ออกเลย").then((ok) => { if (ok) closeEditor(); else markEditor(open); });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * Words typed in the editor and not saved are asked about before any link takes the page
   * away — the tabs above, the menu, a link in the editor itself. Caught on the way down
   * (capture), ahead of the link's own handler. Closing or reloading the tab is PieceEditor's
   * own beforeunload, so the browser asks once.
   */
  useEffect(() => {
    if (!editorDirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void ask(LEAVE, "ออกเลย").then((ok) => { if (ok) router.push(`${url.pathname}${url.search}${url.hash}`); });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [editorDirty, router]);

  const nameOf = (h: string) => (h === CLAIM_HREF ? CLAIM_NAME : h === RECRUIT_HREF ? RECRUIT_NAME : products.find((p) => p.href === h)?.name ?? h);
  // gone from the list — deleted, moved to the other tab, filtered out — and the list is back
  const editingItem = editing ? (items.find((x) => x.id === editing) ?? (opened?.id === editing ? opened : undefined)) : undefined;

  /** Throws when the list could not be read, and leaves what is on screen as it was. */
  async function reload(nextTab = tab, nextPlan = plan) {
    const wb = await contentWorkbench({ status: nextTab, planHref: nextPlan || undefined });
    if (wb.failed) throw new Error("workbench not read");
    setItems(wb.items);
    setCounts(wb.counts);
    setLoadFailed(false);
    hush("load");
  }

  /** The next older pieces of the tab, after the forty it opens with. */
  async function loadMore() {
    setLoadingMore(true);
    try {
      const wb = await contentWorkbench({ status: tab, planHref: plan || undefined, offset: items.length });
      if (wb.failed) throw new Error("workbench not read");
      // a piece that moved tab meanwhile shifts the pages by one: never show it twice
      setItems((list) => {
        const seen = new Set(list.map((x) => x.id));
        return [...list, ...wb.items.filter((x) => !seen.has(x.id))];
      });
      setCounts(wb.counts);
    } catch {
      say("load", "โหลดเพิ่มไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    } finally {
      setLoadingMore(false);
    }
  }

  async function generate() {
    if (pending) return;
    // อัตโนมัติ is settled at the press, on the money left then
    const paintWith = painterOf(painter, Math.max(0, spend.cap - spend.spent)).id;
    const pictureBrief = brief.trim();
    const pictureOf = person;
    await runRound(pieceCount, format, () => generateRound({
      href, format, angle, custom, length: format === "script" ? length : null, loop: format === "script" && loop, count,
      hookTemplateId: format === "ad" ? null : hookId || null, adAngles, adTones, writer,
      reader, goal: format === "ad" ? "" : goal, fact: format === "ad" ? "" : fact, theme,
    }), (fresh) => {
      // the painter as it was at the press, even if the owner changes it while waiting
      // the brief too: what the box said at the press, not after. Only a round that finished:
      // one stopped part way (the month's money ran out) leaves its pieces plain — the owner
      // draws them from the editor if still wanted
      if (paintWith !== "none") void drawPictures(fresh.filter((i) => i.format !== "script"), paintWith, pictureBrief, pictureOf);
    });
  }

  /**
   * A round from either form — a plan's or รีวิวเคลม — from the press to its pieces on screen.
   * `finished` runs only for a round that came back whole.
   */
  async function runRound(asked: number, fmt: Format, send: () => Promise<GenerateResult>, finished?: (fresh: ContentItem[]) => void) {
    if (pending) return;
    hush("round");
    setMaking(asked);
    setMakingFormat(fmt);
    hush("round-note");
    try {
      let res: GenerateResult;
      try {
        res = await send();
      } catch {
        /**
         * The connection dropped mid-write — on a phone, usually because the owner switched
         * to another app during the wait. The server carries on and saves the pieces
         * regardless, so they are very likely already under รอตรวจ rather than lost.
         */
        say("round", "การเชื่อมต่อหลุดระหว่างรอ ชิ้นงานอาจสร้างเสร็จแล้ว ดูในแท็บ “รอตรวจ” ก่อนกดสร้างใหม่นะครับ");
        if (!view.current.editing) {
          setTab("draft");
          setPlan("");
          await reload("draft", "").catch(() => {});
        }
        return;
      }
      // a round that stopped part way still saved what it wrote: those join รอตรวจ with the reason shown
      let fresh: ContentItem[];
      if (res.ok) {
        fresh = res.items;
        if (res.missing > 0) say("round", `ได้ ${res.items.length} จาก ${asked} ชิ้น — อีก ${res.missing} ชิ้นเขียนไม่สำเร็จ กดสร้างเพิ่มได้`);
      } else {
        say("round", res.error);
        if (!res.saved || !res.items?.length) return;
        fresh = res.items;
      }
      const now = view.current;
      if (now.editing) {
        /**
         * An editor is open — the owner used the wait. Closing it threw their unsaved
         * words away; the new pieces join the list instead, or wait under รอตรวจ.
         */
        if (now.tab === "draft" && !now.plan) {
          const ids = new Set(fresh.map((i) => i.id));
          setItems((list) => [...fresh, ...list.filter((x) => !ids.has(x.id))]);
          // the list is out of sight behind the editor
          say("round-note", `สร้างเสร็จ ${fresh.length} ชิ้น รออยู่ในรายการ กด “กลับไปรายการ” เพื่อดู`, "notice");
        } else {
          say("round-note", `สร้างเสร็จ ${fresh.length} ชิ้น อยู่ในแท็บ “รอตรวจ”`, "notice");
        }
        // the counts follow the plan filter on screen: a round for another plan is not in them
        if (!now.plan || now.plan === fresh[0]?.planHref) setCounts((c) => ({ ...c, draft: c.draft + fresh.length }));
        setMaking(0);
      } else {
        setTab("draft");
        setPlan("");
        await reload("draft", "").catch(() => {
          // the round's pieces are in hand: shown, rather than lost behind a list that did not load
          setItems(fresh);
          setCounts((c) => ({ ...c, draft: Math.max(c.draft, fresh.length) }));
          say("load", "โหลดรายการทั้งหมดไม่สำเร็จ — แสดงเฉพาะชิ้นที่เพิ่งสร้าง รีเฟรชหน้าเพื่อดูทั้งหมด");
        });
        setMaking(0);
        // a phone: the form folds away so the new pieces are what the screen shows
        if (window.matchMedia("(max-width: 1023.98px)").matches) setFormOpen(false);
        pieces.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // ?hook= from the formula library did its job; a reload should not pick it again
      dropParam("hook");
      if (res.ok) finished?.(fresh);
    } finally {
      setMaking(0);
      // the budget line follows every round, a failed or dropped one included
      void contentSpend().then(setSpend).catch(() => {});
    }
  }

  /**
   * Every new post and ad gets its photograph ordered as soon as its card is up — the owner
   * asked not to press วาดภาพ piece by piece. The cards show their words first and the
   * pictures arrive on their own; one that fails keeps its plain poster and the button.
   */
  async function drawPictures(list: ContentItem[], paintWith: string, request: string, who: PiecePerson | null) {
    if (list.length === 0) return;
    // null rather than left out: a round without a person draws none, whatever a piece held
    const results = await Promise.all(list.map((item) => drawOne(item.id, request, paintWith, false, who)));
    const failed = results.flatMap((r) => (r.ok ? [] : [r.error]));
    if (failed.length > 0) say("draw", `วาดภาพไม่สำเร็จ ${failed.length} ชิ้น (${failed[0]}) — กด “แก้ไข” แล้ววาดใหม่ได้`);
    setSpend(await contentSpend().catch(() => spend));
  }

  /**
   * One picture, from the auto-draw or the editor alike: the card shows it drawing, the
   * editor's button waits even after the editor is closed and opened again — it was live
   * again then, and a second paid picture could be ordered — and the budget line follows.
   */
  async function drawOne(id: string, request: string, paintWith: string, refresh = true, who?: PiecePerson | null): Promise<DrawBackgroundResult> {
    setDrawing((d) => new Set(d).add(id));
    const res = await drawPicture(id, request, paintWith, who);
    // a note is information (a cheaper painter stood in, say), not a failure
    if (res.ok && res.note) say("draw-note", res.note, "notice");
    setDrawing((d) => { const n = new Set(d); n.delete(id); return n; });
    if (res.ok) saved(res.item);
    if (refresh) setSpend(await contentSpend().catch(() => spend));
    return res;
  }

  /**
   * Pieces whose status is being changed right now. A second tap before the first had
   * answered — the busy state is not on screen until the next render — marked the same
   * piece used twice and put it in the ใช้จริง rail twice.
   */
  const moving = useRef(new Set<string>());

  async function changeStatus(item: ContentItem, status: ContentStatus) {
    // ✓ ใช้จริง on a piece opened from the ใช้จริง rail: it is used already
    if (item.status === status) { if (editing === item.id) setEditing(null); return; }
    if (moving.current.has(item.id)) return;
    moving.current.add(item.id);
    mark(item.id, true);
    const res: { ok: boolean; error?: string } = await setContentStatus(item.id, status).catch(() => ({ ok: false })).finally(() => moving.current.delete(item.id));
    mark(item.id, false);
    if (!res.ok) { say("status", res.error || "เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    hush("status");
    if (view.current.editing === item.id) setEditing(null);
    // the copy on screen now, not the one the button was drawn with: an edit saved or a
    // picture landed since, and the rail showed the old words and the plain poster
    const newest = [...view.current.items, ...view.current.used].find((x) => x.id === item.id) ?? item;
    setItems((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1), [status]: c[status] + 1 }));
    setUsedTotal((n) => Math.max(0, n + (status === "used" ? 1 : 0) - (item.status === "used" ? 1 : 0)));
    // one row per piece in the rail, whatever order the updates arrive in
    setUsed((list) => {
      const others = list.filter((x) => x.id !== item.id);
      return status === "used" ? [{ ...newest, status }, ...others] : others;
    });
  }

  async function remove(item: ContentItem) {
    const scheduled = publishView(item.publish).kind === "scheduled";
    const question = scheduled
      ? "ลบชิ้นนี้ถาวร และเอาโพสต์ที่ตั้งเวลาไว้ออกจากเพจด้วย? กู้คืนไม่ได้"
      : "ลบชิ้นนี้ถาวร? ลบแล้วกู้คืนไม่ได้";
    if (!(await ask(question, "ลบถาวร"))) return;
    mark(item.id, true);
    type Removed = Awaited<ReturnType<typeof removeContent>>;
    const dropped: Removed = { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
    let res = await removeContent(item.id).catch(() => dropped);
    // a send that never answered: Facebook may show it, so the owner looks before it is let go
    if (!res.ok && res.confirmDelete) {
      if (!(await ask("โพสต์นี้อาจขึ้นเพจไปแล้ว — เปิดเพจเช็กก่อน ถ้ายังไม่ขึ้นค่อยลบ", "ลบ"))) { mark(item.id, false); return; }
      res = await removeContent(item.id, { force: true }).catch(() => dropped);
    }
    mark(item.id, false);
    if (!res.ok) {
      say("delete", res.error || dropped.error!);
      // someone else changed it meanwhile: the list is out of date
      if (res.error?.startsWith("มีการแก้ชิ้นนี้พร้อมกันอยู่")) await reload().catch(() => {});
      return;
    }
    hush("delete");
    if (view.current.editing === item.id) setEditing(null);
    setItems((list) => list.filter((x) => x.id !== item.id));
    setUsed((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1) }));
    if (item.status === "used") setUsedTotal((n) => Math.max(0, n - 1));
  }

  /**
   * Posted, scheduled or taken back from the editor. A piece on the Page leaves both lists
   * for the calendar (it stays open while being edited, and goes on close); one taken back
   * returns as ใช้จริง.
   */
  function published(next: ContentItem) {
    const before = [...view.current.items, ...view.current.used].find((x) => x.id === next.id);
    saved(next);
    const wasListed = before != null && !onPage(before.publish);
    const listed = !onPage(next.publish);
    if (wasListed === listed && before?.status === next.status) return;
    setCounts((c) => {
      const out = { ...c };
      if (wasListed && before) out[before.status] = Math.max(0, out[before.status] - 1);
      if (listed) out[next.status] += 1;
      return out;
    });
    setUsedTotal((n) => Math.max(0, n - (wasListed && before?.status === "used" ? 1 : 0) + (listed && next.status === "used" ? 1 : 0)));
    setUsed((list) => (listed && next.status === "used" ? [next, ...list.filter((x) => x.id !== next.id)] : list.filter((x) => x.id !== next.id)));
  }

  function saved(next: ContentItem) {
    setItems((list) => list.map((x) => (x.id === next.id ? next : x)));
    setUsed((list) => list.map((x) => (x.id === next.id ? next : x)));
    setOpened((o) => (o?.id === next.id ? next : o));
  }

  async function copy(item: ContentItem) {
    try {
      await navigator.clipboard.writeText(item.format === "ad" ? `${item.output.body}\n\n${footer(item.output)}` : fullText(item.output));
      setCopied(item.id);
      hush("copy");
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(null), 2000);
    } catch {
      say("copy", "คัดลอกไม่ได้ กด “แก้ไข” แล้วเลือกข้อความคัดลอกเองนะครับ");
    }
  }

  function closeEditor() {
    setEditing(null);
    // a piece posted from here is ใช้จริง and on the calendar now: it leaves on the way out
    setItems((list) => list.filter((x) => x.status === view.current.tab && !onPage(x.publish)));
  }

  async function openUsed(item: ContentItem) {
    // the rail sits beside an open editor on a wide screen: opening another piece would drop its words
    if (editorDirty && editing !== item.id && !(await ask(LEAVE, "ออกเลย"))) return;
    if (tab !== "used" || plan) {
      setTab("used");
      setPlan("");
      await reload("used", "").catch(() => say("load", "โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"));
    }
    openEditor(item.id);
  }

  const pieceCount = format === "ad" ? adAngles * adTones : count;
  // what one piece costs with the picks made, the picture included (scripts have none)
  const left = Math.max(0, spend.cap - spend.spent);
  const writes = writerOf(writer, left);
  // a person in the picture is drawn by Gemini whatever was picked, at Gemini's price
  const paints = painterFor(painter, left, Boolean(person));
  const perPiece = writes.thb + OVERHEAD_THB + (format === "script" ? 0 : paints.thb);
  const estimate = (pieceCount * perPiece).toFixed(1);
  const more = Math.floor(left / perPiece);
  const pictureLine = pictureSummary({
    format, writer: writes.short, painter: paints.modelId ? paints.short : null,
    theme: theme === AUTO_THEME ? "โทนสี AI เลือก" : `โทน${THEME_LABEL[theme]}`,
    person: person ? people.find((p) => p.id === person.id)?.name : undefined,
  });

  const usedLink = (
    <Link href="/studio/calendar" className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--ct-accent)] underline underline-offset-2">
      ดูโพสต์ที่ลงเพจ/ตั้งเวลาไว้ในปฏิทิน →
    </Link>
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold">Studio</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">AI เขียนจากข้อมูลจริงของแบบประกัน ตัวเลขทุกตัวมาจากตารางเบี้ย อ่านทวนก่อนโพสต์ทุกครั้ง</p>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px]">
        {/* ---------------------------------- tools ---------------------------------- */}
        {/* a desk: the form scrolls inside its own column; a phone: the page simply runs on */}
        <aside ref={tools} className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:sticky lg:top-4 lg:max-h-[var(--tools-room,calc(100dvh-2rem))] lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 border-b border-[var(--ct-hair)] px-4 pb-3 pt-4">
            <div>
              <h2 className="font-semibold">เครื่องมือ</h2>
              <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เลือกแล้วกดสร้าง ชิ้นงานจะไปอยู่ที่ “รอตรวจ”</p>
            </div>
            <button
              type="button" aria-expanded={formOpen} aria-controls={formId} onClick={() => setFormOpen((o) => !o)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--ct-line)] px-3 text-sm lg:hidden"
            >
              {formOpen ? "ซ่อนการตั้งค่า" : "ตั้งค่าการสร้าง"}
              <ChevronDownIcon className={`size-4 transition-transform ${formOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className={`px-4 pt-4 ${formOpen ? "" : "hidden lg:block"}`}>
            <div role="group" aria-label="สร้างจาก" className="flex gap-1 rounded-lg bg-[var(--ct-soft)] p-1">
              {([["plan", "จากแบบประกัน"], ["claim", CLAIM_NAME], ["recruit", RECRUIT_NAME]] as const).map(([m, label]) => (
                <button
                  key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={`min-h-10 flex-auto whitespace-nowrap rounded-md px-1.5 text-sm ${mode === m ? "bg-[var(--ct-panel)] font-medium shadow-sm" : "text-[var(--ct-mute)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "claim" ? (
            <div id={formId} className={formOpen ? "" : "hidden lg:block"}>
              <ClaimTools
                writer={writer} onWriter={(w) => pick({ writer: w })} painter={painter} onPainter={(p) => pick({ painter: p })}
                people={people} person={person} onPerson={setPerson}
                reader={reader} onReader={setReader} left={left} pending={pending} making={making}
                run={(asked, fmt, send, paintWith, who) => runRound(asked, fmt, send, (fresh) => {
                  // the photograph behind each new claim poster, drawn as a plan round's are
                  if (paintWith !== "none") void drawPictures(fresh.filter((i) => i.format !== "script"), paintWith, "", who);
                })}
              />
            </div>
          ) : mode === "recruit" ? (
            <div id={formId} className={formOpen ? "" : "hidden lg:block"}>
              <RecruitTools
                writer={writer} onWriter={(w) => pick({ writer: w })} painter={painter} onPainter={(p) => pick({ painter: p })}
                people={people} person={person} onPerson={setPerson}
                left={left} pending={pending} making={making}
                run={(asked, fmt, send, paintWith, who) => runRound(asked, fmt, send, (fresh) => {
                  // the photograph behind each new recruit poster, drawn as a plan round's are
                  if (paintWith !== "none") void drawPictures(fresh.filter((i) => i.format !== "script"), paintWith, "", who);
                })}
              />
            </div>
          ) : (
          <>
          <div id={formId} className={`space-y-4 p-4 ${formOpen ? "" : "hidden lg:block"}`}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">แบบประกัน</span>
            <select value={href} onChange={(e) => setHref(e.target.value)} className={field}>
              {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
          </label>

          <FormatPicker value={format} onChange={setFormat} />

          {format === "script" && (
            <div role="group" aria-labelledby={`${formId}-length`}>
              <span id={`${formId}-length`} className="mb-1.5 block text-sm font-medium">ความยาวคลิป</span>
              <div className="flex flex-wrap gap-2">
                {lengths.map((l) => (
                  <button key={l.id} type="button" aria-pressed={length === l.id} onClick={() => setLength(l.id)} className={chip(length === l.id)}>{l.label}</button>
                ))}
              </div>
            </div>
          )}

          {format === "script" && <LoopToggle value={loop} onChange={setLoop} />}

          {format === "ad" && (
            <div className="space-y-3 rounded-lg bg-[var(--ct-ground)] p-3">
              <p className="text-xs leading-relaxed text-[var(--ct-mute)]">
                ได้โฆษณาหลายแบบในรอบเดียว: แต่ละ “มุมขาย” เขียนด้วยหลาย “น้ำเสียง” เอาไปยิงเทียบกันใน Ads Manager ว่าแบบไหนได้ผล
              </p>
              <div role="group" aria-labelledby={`${formId}-angles`}>
                <span id={`${formId}-angles`} className="mb-1.5 block text-sm font-medium">มุมขาย</span>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_ANGLES }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={adAngles === n} onClick={() => setAdAngles(n)} className={`${chip(adAngles === n)} min-w-11`}>{n}</button>
                  ))}
                </div>
              </div>
              <div role="group" aria-labelledby={`${formId}-tones`}>
                <span id={`${formId}-tones`} className="mb-1.5 block text-sm font-medium">น้ำเสียงต่อมุม</span>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_TONES }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={adTones === n} onClick={() => setAdTones(n)} className={`${chip(adTones === n)} min-w-11`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <FormSection title="เรื่องที่เล่า">
          <div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
              <select value={angle} onChange={(e) => setAngle(e.target.value as AngleId)} className={field}>
                <option value="">ให้ AI เลือก</option>
                {anglesFor(format, href).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                <option value="custom">พิมพ์เอง…</option>
              </select>
            </label>
            {angle === "custom" && (
              <label className="mt-2 block">
                <span className="sr-only">มุมที่อยากเล่า (พิมพ์เอง)</span>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} placeholder="เช่น ทำไมยิ่งอายุมากยิ่งซื้อยาก" className={field} />
              </label>
            )}
            {format !== "ad" && !angle && count > 1 && <span className="mt-1 block text-xs text-[var(--ct-mute)]">แต่ละชิ้นเล่าคนละมุม</span>}
          </div>

          <div role="group" aria-labelledby={`${formId}-reader`}>
            <span id={`${formId}-reader`} className="mb-1.5 block text-sm font-medium">คนอ่านคือใคร <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={reader === ""} onClick={() => setReader("")} className={chip(reader === "")}>ทุกคน</button>
              {NICHES.map((n) => (
                <button key={n} type="button" aria-pressed={reader === n} onClick={() => setReader(n)} className={chip(reader === n)}>{n}</button>
              ))}
            </div>
            <label className="mt-2 block">
              <span className="sr-only">คนอ่าน (พิมพ์เอง)</span>
              <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="หรือพิมพ์เอง เช่น พยาบาลกะดึก" className={field} />
            </label>
          </div>

          {format !== "ad" && (
            <>
            <div role="group" aria-labelledby={`${formId}-goal`}>
              <span id={`${formId}-goal`} className="mb-1.5 block text-sm font-medium">อ่านจบแล้วอยากให้ทำอะไร</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={goal === ""} onClick={() => setGoal("")} className={chip(goal === "")}>ให้ AI เลือก</button>
                {GOALS.map((g) => (
                  <button key={g.id} type="button" aria-pressed={goal === g.id} onClick={() => setGoal(g.id)} className={chip(goal === g.id)}>{g.label}</button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">เรื่องจริงจากคุณ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <textarea value={fact} onChange={(e) => setFact(e.target.value)} maxLength={MAX_FACT} rows={3}
                placeholder="เช่น เดือนที่แล้วลูกค้าเคลมค่ารักษาไป 8 หมื่น ตอนแรกเขาเกือบไม่ทำ — ไม่ต้องใส่ชื่อลูกค้า"
                className={field} />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">AI จะเล่าเป็นเรื่องจริงเฉพาะที่พิมพ์ไว้ ไม่เติมรายละเอียดเอง</span>
            </label>

            <HookPicker hooks={hooks} value={hookId} onChange={setHookId} />
            </>
          )}
          </FormSection>

          <PictureFold summary={pictureLine}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">โมเดลเขียน</span>
            <select value={writer} onChange={(e) => pick({ writer: e.target.value })} className={field}>
              <option value={AUTO}>อัตโนมัติ</option>
              {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · ฿{w.thb.toFixed(2)} ต่อชิ้น</option>)}
            </select>
            <span className="mt-1 block text-xs text-[var(--ct-mute)]">
              {writer === AUTO
                ? `ตอนนี้ใช้ ${writes.short} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะสลับเป็นแบบประหยัดเอง`
                : `${writes.short} · ราคาต่อชิ้น`}
            </span>
          </label>

          {format !== "script" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">ภาพประกอบ</span>
              <select value={painter} onChange={(e) => pick({ painter: e.target.value })} className={field}>
                <option value={AUTO}>อัตโนมัติ</option>
                {PAINTERS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.thb > 0 ? ` · ฿${p.thb.toFixed(2)} ต่อภาพ` : ""}</option>)}
              </select>
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">
                {painter === AUTO
                  ? `ตอนนี้${paints.modelId ? `วาดด้วย ${paints.short}` : "ไม่วาดภาพ"} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะหยุดวาดเอง`
                  : painter === "none" ? "ใช้โปสเตอร์สีพื้น วาดทีหลังได้ในหน้าแก้ไข" : `${paints.short} · ราคาต่อภาพ วาดให้ทุกชิ้นหลังเขียนเสร็จ`}
              </span>
            </label>
          )}

          {format !== "script" && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
              <ThemeSwatches value={theme} onChange={setTheme} allowAuto />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">
                {theme === AUTO_THEME ? "แต่ละชิ้นอาจได้คนละโทน ภาพ AI วาดตามโทนของชิ้นนั้น" : "ใช้กับทุกชิ้นในรอบนี้ และภาพ AI จะวาดในโทนเดียวกัน"} · เปลี่ยนทีละชิ้นได้ในหน้าแก้ไข
              </span>
            </div>
          )}

          {format !== "script" && painter !== "none" && (
            <div>
              <PersonPicker people={people} value={person} onChange={setPerson} />
              {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ซึ่งรักษาหน้าคนได้ดีที่สุด ราวภาพละ ฿2.4 · ชุดและสถานที่พิมพ์ในบรีฟภาพด้านล่าง</span>}
            </div>
          )}

          {/* the owner's free direction for every picture of the round, on top of the fixed rules */}
          {format !== "script" && painter !== "none" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">บรีฟภาพเพิ่มเติม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <textarea
                value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={MAX_BRIEF} rows={3}
                placeholder="เช่น โทนอบอุ่นแบบภาพยนตร์ ครอบครัวในสวนตอนเย็น มุมกว้าง ไม่เอาภาพในโรงพยาบาล"
                className={field}
              />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">ใช้กับภาพทุกชิ้นในรอบนี้ ภาพจะยังไม่มีตัวหนังสือและเว้นที่ให้ข้อความเสมอ · {brief.length}/{MAX_BRIEF}</span>
            </label>
          )}
          </PictureFold>
          </div>

          {/* the press, its count and its price stay in reach however long the form runs:
              pinned to the foot of the column on a desk, to the foot of the screen on a phone */}
          <PressBar
            count={count} max={MAX_PIECES} onCount={format === "ad" ? undefined : setCount}
            unit={format === "ad" ? "แบบ" : "ชิ้น"} onPress={generate} disabled={pending || !href}
            label={pending
              ? `กำลังเขียน ${making} ${makingFormat === "ad" ? "แบบ" : "ชิ้น"}… (ราว 20–40 วินาที)`
              : format === "ad" ? `สร้างโฆษณา ${pieceCount} แบบ` : `สร้าง ${count} ชิ้น`}
            note={`ราว ฿${estimate} · สร้างได้อีกราว ${more} ชิ้น · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)} จาก ฿${spend.cap}`}
          />
          </>
          )}
        </aside>

        {/* ---------------------------------- pieces ---------------------------------- */}
        <section ref={pieces} className="studio-desk @container min-w-0 scroll-mt-4 space-y-3 rounded-xl border border-[var(--ct-hair)] p-3 lg:row-span-2 lg:min-h-[70dvh] lg:self-stretch xl:row-span-1">
          {editingItem ? (
            <>
              {pending && (
                <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
                  <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                  กำลังสร้าง {making} {makingFormat === "ad" ? "แบบ" : "ชิ้น"} อยู่เบื้องหลัง — แก้ชิ้นนี้ต่อได้เลย
                </p>
              )}
              <PieceEditor
                key={editingItem.id}
                item={editingItem}
                drawing={drawing.has(editingItem.id)}
                productName={nameOf(editingItem.planHref)}
                onSaved={saved}
                onDraw={(request, paintWith, who) => drawOne(editingItem.id, request, paintWith, true, who)}
                people={people}
                onStatus={(s) => changeStatus(editingItem, s)}
                onPublished={published}
                onDirtyChange={setEditorDirty}
                onClose={closeEditor}
              />
            </>
          ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="สถานะชิ้นงาน" className="inline-flex items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  onClick={() => { setTab(t.id); setEditing(null); reload(t.id, plan).catch(() => say("load", "โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); }}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm ${tab === t.id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
                >
                  {t.label} <span className="tabular-nums">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            <label>
              <span className="sr-only">กรองตามแบบประกัน</span>
              <select
                value={plan}
                onChange={(e) => { setPlan(e.target.value); setEditing(null); reload(tab, e.target.value).catch(() => say("load", "โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); }}
                className="min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 py-1.5 text-sm"
              >
                <option value="">ทุกแบบ</option>
                {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
                <option value={CLAIM_HREF}>{CLAIM_NAME}</option>
                <option value={RECRUIT_HREF}>{RECRUIT_NAME}</option>
              </select>
            </label>
          </div>
          {tab === "used" && (
            <p className="text-xs text-[var(--ct-mute)]">ชิ้นที่ใช้แล้วแต่ยังไม่ได้ลงเพจจากระบบ — ชิ้นที่ลงเพจหรือตั้งเวลาแล้วอยู่ในปฏิทินโพสต์</p>
          )}
          {tab === "trashed" && (
            <p className="text-xs text-[var(--ct-mute)]">ชิ้นที่ทิ้งไว้ กด “กู้คืน” เพื่อเอากลับไปรอตรวจ หรือ “ลบถาวร” เพื่อลบทิ้งพร้อมภาพ</p>
          )}

          {pending && (
            <div role="status" className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
                <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                กำลังสร้าง {making} {makingFormat === "ad" ? "แบบ" : "ชิ้น"}…
              </p>
              <div className="grid gap-4 @xl:grid-cols-2">
                {Array.from({ length: making }, (_, i) => <PieceSkeleton key={i} />)}
              </div>
              <p className="text-xs text-[var(--ct-mute)]">
                เปิดหน้านี้ไว้จนภาพขึ้นครบ — ถ้าออกไปก่อน ข้อความยังเก็บไว้ที่ “รอตรวจ” แต่ต้องกดวาดภาพเอง
              </p>
            </div>
          )}

          {items.length === 0 && !pending ? (
            <div className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">
              {loadFailed ? (
                <p>
                  โหลดรายการไม่สำเร็จ —{" "}
                  <button
                    type="button" className="inline-flex min-h-11 items-center font-medium text-[var(--ct-accent)] underline"
                    onClick={() => { reload().catch(() => say("load", "โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); }}
                  >
                    ลองใหม่
                  </button>
                </p>
              ) : tab === "draft" ? (
                <p>ยังไม่มีชิ้นงานรอตรวจ — เลือกแบบประกันแล้วกดสร้างได้เลย</p>
              ) : tab === "trashed" ? (
                <p>ถังขยะว่าง</p>
              ) : (
                <>
                  <p>ยังไม่มีชิ้นที่ใช้แล้วแต่ยังไม่ได้ลงเพจ</p>
                  <p className="mt-1">{usedLink}</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 @xl:grid-cols-2">
              {items.map((item, i) => (
                // the id is where leaving the editor scrolls back to; a grid of one so the card still fills its row
                <div key={item.id} id={`piece-${item.id}`} className="grid scroll-mt-4">
                {item.format === "script" ? (
                  <ScriptCard
                    item={item}
                    index={i}
                    busy={busy.has(item.id)}
                    onEdit={() => openEditor(item.id)}
                    onStatus={(s) => changeStatus(item, s)}
                    onDelete={() => remove(item)}
                    onCopy={() => copy(item)}
                  />
                ) : (
                  <PieceCard
                    item={item}
                    index={i}
                    productName={nameOf(item.planHref)}
                    busy={busy.has(item.id)}
                    drawing={drawing.has(item.id)}
                    onEdit={() => openEditor(item.id)}
                    onStatus={(s) => changeStatus(item, s)}
                    onDelete={() => remove(item)}
                    onCopy={() => copy(item)}
                  />
                )}
                </div>
              ))}
            </div>
          )}
          {/* the tab opens with forty; the count above says how many there are */}
          {items.length > 0 && items.length < counts[tab] && (
            <div className="flex justify-center">
              <button
                type="button" onClick={loadMore} disabled={loadingMore}
                className="min-h-11 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-5 text-sm text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50"
              >
                {loadingMore ? "กำลังโหลด…" : `โหลดเพิ่ม · แสดง ${items.length} จาก ${counts[tab]}`}
              </button>
            </div>
          )}
          </>
          )}
          {copied && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-[var(--ct-mute)]">
              <CheckIcon className="size-4 text-[var(--ct-accent)]" />คัดลอกแล้ว
            </p>
          )}
        </section>

        {/* ------------------------------- used rail ------------------------------- */}
        <aside className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:col-start-1 lg:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1">
          <div className="border-b border-[var(--ct-hair)] p-4 pb-2">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold">ใช้จริง</h2>
                <p className="mt-0.5 text-xs text-[var(--ct-mute)]">ชิ้นที่ใช้แล้วแต่ยังไม่ได้ลงเพจจากระบบ</p>
              </div>
              <span className="text-2xl tabular-nums text-[var(--ct-accent)]">{usedTotal}</span>
            </div>
            {usedLink}
          </div>
          {used.length === 0 ? (
            <p className="m-4 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-xs text-[var(--ct-mute)]">
              กด “ใช้จริง” ที่ชิ้นงาน แล้วจะย้ายมาอยู่ตรงนี้ — ระบบจะจำประโยคเปิดไว้เป็นสูตรใหม่ และไม่เขียนซ้ำ
            </p>
          ) : (
            <>
            {/* one scroll for the page below xl; the rail scrolls on its own only where it sits sticky beside the pieces */}
            <ul className="divide-y divide-[var(--ct-hair)] xl:max-h-[60dvh] xl:overflow-y-auto">
              {used.slice(0, 20).map((u, i) => (
                <li key={u.id} className={i >= 5 && !allUsed ? "hidden xl:block" : undefined}>
                  <button type="button" onClick={() => openUsed(u)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--ct-ground)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the card's own poster, from the browser cache */}
                    <img
                      src={posterUrl(u.output.poster ?? defaultPoster(u.output.hooks[0], nameOf(u.planHref)))}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)] object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-[var(--ct-mute)]">{nameOf(u.planHref)} · {FORMAT_SHORT[u.format]}</span>
                      <span className="line-clamp-2 text-sm">{u.output.hooks[0]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {Math.min(used.length, 20) > 5 && (
              <button
                type="button" aria-expanded={allUsed} onClick={() => setAllUsed((a) => !a)}
                className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-[var(--ct-hair)] text-sm text-[var(--ct-accent)] xl:hidden"
              >
                {allUsed ? "ย่อรายการ" : `ดูทั้งหมด (${Math.min(used.length, 20)})`}
                <ChevronDownIcon className={`size-4 transition-transform ${allUsed ? "rotate-180" : ""}`} />
              </button>
            )}
            </>
          )}
        </aside>
      </div>

      {toasts.length > 0 && (
        // above the phone's pinned สร้าง bar; a desk has it in the column, so the foot is free
        <div className="pointer-events-none fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md flex-col gap-2 lg:bottom-4">
          {toasts.map((t) => (
            <div
              key={t.from}
              role={t.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex items-start gap-1 rounded-lg border py-1 pl-3 pr-1 text-sm shadow-lg ${t.tone === "error"
                ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
                : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)]"}`}
            >
              <p className="flex-1 py-2.5"><PlainText text={t.text} /></p>
              <button type="button" onClick={() => hush(t.from)} aria-label="ปิด" className="flex size-11 shrink-0 items-center justify-center rounded-md">
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
