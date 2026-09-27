"use client";
import { useEffect, useRef, useState } from "react";
import { atFold, FOLD, footer, fullText } from "@/lib/content/output";
import { defaultPoster, posterUrl, type PosterSpec } from "@/lib/content/poster";
import type { Fix } from "@/lib/content/proofread";
import { FORMAT_LABEL } from "@/lib/content/prompt";
import { AD_LIMITS } from "@/lib/content/ads";
import type { ContentItem } from "@/lib/content/store";
import { onPage, publishView } from "@/lib/content/publish-label";
import { applyFix } from "@/lib/content/apply-fix";
import { proofreadPiece, saveContentEdits, type DrawBackgroundResult } from "./actions";
import type { PiecePerson } from "@/lib/content/people";
import type { PersonOption } from "./PersonPicker";
import { PosterPanel } from "./PosterPanel";
import { PublishPanel } from "./PublishPanel";
import { ClaimPaperCheck } from "./claim/ClaimPaperCheck";
import { ask } from "./ask";
import { AlertIcon, BackIcon, CheckIcon, LockIcon } from "./ui/editor-icons";
import { ChevronLeftIcon, ChevronRightIcon } from "./ui/icons";
import { AutoTextarea, errorNote, Note, okNote, type NoteState } from "./ui/editor-fields";
import { FeedPreview } from "./ui/FeedPreview";

/**
 * One piece opened across the workbench: every part editable, the checks beside it.
 *
 * The checks sit beside the words rather than inside them: amounts the tables never had, words
 * on the owner's list, Facebook's rules, and the proofreader's suggestions. The last two kinds
 * that carry a fix are one click to accept. Nothing changes without that click, and the checks
 * are run again on every save, because an edit can add a number as easily as a model can.
 *
 * What the checks found is summed up under the title, so it is seen before any scrolling; each
 * line there jumps to its details. A piece on the Page is shown, not edited — Facebook keeps
 * its own copy — and a piece Facebook is holding is edited here and sent again for its time.
 */

interface Draft {
  hooks: string[];
  body: string;
  closing: string;
  tags: string;
  poster: PosterSpec;
}

const draftOf = (item: ContentItem, productName: string): Draft => ({
  hooks: [...item.output.hooks],
  body: item.output.body,
  closing: item.output.closing,
  tags: item.output.hashtags.join(" "),
  poster: item.output.poster ?? defaultPoster(item.output.hooks[0], productName),
});

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--ct-accent)] read-only:bg-[var(--ct-ground)]";
const smallBtn = "min-h-11 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-panel)] px-3 py-1.5 text-sm";
const primary = "min-h-11 rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50";
const secondary = "min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-2 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

const ON_PAGE_NOTE = "ชิ้นนี้ขึ้นเพจแล้ว แก้ที่นี่ไม่มีผลกับเพจ — แก้ในเพจโดยตรง";

interface Props {
  item: ContentItem;
  productName: string;
  /** the page is drawing this piece's photograph already */
  drawing?: boolean;
  onSaved: (item: ContentItem) => void;
  /** orders a picture through the page, which shows it drawing on the card and in here */
  onDraw: (request: string, painter: string, person: PiecePerson | null) => Promise<DrawBackgroundResult>;
  people: PersonOption[];
  /** may return the move's promise, so ใช้จริง stays busy until it is done */
  onStatus: (status: ContentItem["status"]) => void | Promise<unknown>;
  /** posted, scheduled or taken back: the piece as it now stands */
  onPublished: (item: ContentItem) => void;
  onClose: () => void;
  /**
   * Told whenever the editor starts or stops holding unsaved words (and false when it closes),
   * so the page around it can ask before its own links leave. The editor already asks before
   * its own back buttons, and the browser asks before the tab closes or reloads.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** a day the calendar sent the owner to write for, offered first in the ลงเพจ box */
  suggestDay?: string | null;
  /** where this piece stands in the list, and the pieces either side of it */
  nav?: { position: number; total: number; prev?: () => void; next?: () => void };
}

export function PieceEditor({ item, productName, drawing, onSaved, onDraw, onStatus, onPublished, onClose, people, onDirtyChange, suggestDay, nav }: Props) {
  const [feed, setFeed] = useState(false);
  /**
   * The editor takes the keys when it opens. Its opener, the card's button, went with the list,
   * focus fell to the page, and a keyboard started again from the menu; a reader heard nothing.
   * The title is where it lands — what is open, before any field.
   */
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const [draft, setDraft] = useState<Draft>(() => draftOf(item, productName));
  const [hook, setHook] = useState(0);
  const [fixes, setFixes] = useState<Fix[] | null>(item.flags.fixes);
  const [proofing, setProofing] = useState(false);
  const [proofNote, setProofNote] = useState<string>();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  /** stickers laid on the claim papers and not yet ticked ตรวจแล้ว: unsaved as much as words are */
  const [stickersPending, setStickersPending] = useState(false);
  const unsaved = dirty || stickersPending;
  /**
   * A post or a cancel on its way to Facebook. Leaving meanwhile unmounted the ลงเพจ box: its
   * answer — posted, refused — was said to nobody, and the card stayed in รอตรวจ looking unsent
   * until a reload. The editor now stays put until the answer is in.
   */
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  // the owner chose the plain colour over a photograph; until then a save keeps the photograph
  const [plain, setPlain] = useState(false);
  // bumped on every edit, so a save can tell whether the owner typed while it was out
  const edits = useRef(0);

  const view = publishView(item.publish);
  // on the Page, or on its way: the server refuses edits, so the editor offers none
  const locked = view.kind === "posting" || view.kind === "published";
  // Facebook is holding it: words may change (the held post is replaced), the picture may not
  const held = view.kind === "scheduled";
  const pictureLocked = onPage(item.publish);

  /**
   * A photograph that lands while the editor is open joins the draft. Without this the draft
   * still held the poster from before it, and the next save wrote that back — a paid picture
   * dropped by pressing บันทึก.
   */
  const landed = item.output.poster?.background;
  useEffect(() => {
    if (landed && !plain) setDraft((d) => (d.poster.background === landed ? d : { ...d, poster: { ...d.poster, background: landed } }));
  }, [landed, plain]);

  // รีวิวเคลม papers replaced by the owner's check join the draft the same way
  const papers = item.output.poster?.documents;
  const papersKey = papers?.map((p) => p.path).join("|") ?? "";
  useEffect(() => {
    if (papers?.length) setDraft((d) => (d.poster.documents?.map((p) => p.path).join("|") === papersKey ? d : { ...d, poster: { ...d.poster, documents: papers } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the paths, not the array's identity
  }, [papersKey]);

  // the proofreader runs on first opening and is kept: one small call per piece, ever — and
  // none for a piece already on the Page, whose words can no longer change here
  useEffect(() => {
    if (item.flags.fixes || locked) return;
    let live = true;
    setProofing(true);
    proofreadPiece(item.id)
      .then((r) => { if (!live) return; setFixes(r.fixes); setProofNote(r.error); })
      .catch(() => {})
      .finally(() => { if (live) setProofing(false); });
    return () => { live = false; };
  }, [item.id, item.flags.fixes, locked]);

  // unsaved words: the browser asks before the tab closes or reloads
  useEffect(() => {
    if (!unsaved) return;
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [unsaved]);

  // and the page around the editor is told, for its own links
  const tell = useRef(onDirtyChange);
  useEffect(() => { tell.current = onDirtyChange; }, [onDirtyChange]);
  useEffect(() => { tell.current?.(unsaved || sending); }, [unsaved, sending]);
  useEffect(() => () => tell.current?.(false), []);

  const edit = (next: Draft) => {
    if (locked) return;
    edits.current += 1;
    setDraft(next);
    setDirty(true);
    setNote(null);
  };
  const accept = (fix: { find: string; replace: string }) => {
    const { draft: next, changed } = applyFix(draft, fix);
    // put away either way: fixed now, or not in the words any more (fixed by hand)
    setApplied((s) => new Set(s).add(fix.find));
    if (changed) edit(next);
    else setNote(okNote(`ไม่พบ “${fix.find}” ในข้อความแล้ว`));
  };

  const outputOf = (d: Draft) => ({
    ...item.output,
    hooks: d.hooks, body: d.body, closing: d.closing,
    hashtags: d.tags.split(/\s+/).filter(Boolean),
    poster: d.poster,
  });
  const output = outputOf(draft);
  const isAd = item.format === "ad";
  const isPost = item.format === "post";
  // an ad is pasted into Ads Manager field by field; its primary text carries the regulator's line
  const text = isAd ? `${draft.body}\n\n${footer(output)}` : fullText(output, hook);
  const fold = atFold(isAd ? draft.body : text);

  /**
   * The edits, kept and checked again. New amounts on a held post are asked about before it is
   * sent again. What comes back replaces what is on screen — its picture may be newer, and a
   * held post comes back with a new post id — unless the owner typed on while it was saving.
   */
  async function save(): Promise<boolean> {
    if (!dirty) return true;
    if (locked) { setNote(errorNote(ON_PAGE_NOTE)); return false; }
    setSaving(true);
    setNote(null);
    const sent = draft;
    const at = edits.current;
    try {
      let confirmNumbers = false;
      for (;;) {
        const res = await saveContentEdits(item.id, outputOf(sent), { plain, confirmNumbers }).catch(() => null);
        if (!res) { setNote(errorNote("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); return false; }
        if (res.ok) {
          onSaved(res.item);
          setPlain(false);
          if (edits.current === at) {
            setDraft(draftOf(res.item, productName));
            setDirty(false);
          } else {
            // words typed meanwhile stay, still unsaved; the picture on file joins them
            const background = res.item.output.poster?.background;
            setDraft((d) => ({ ...d, poster: { ...d.poster, background } }));
          }
          setNote(okNote(held ? "บันทึกแล้ว — ส่งฉบับแก้ไปแทนโพสต์ที่ตั้งเวลาไว้แล้ว" : "บันทึกแล้ว — ตรวจตัวเลขและกฎใหม่แล้ว"));
          return true;
        }
        if (res.confirmNumbers?.length && !confirmNumbers) {
          const go = await ask(`${res.error}: ${res.confirmNumbers.join(", ")}\n\nตรวจแล้วว่าถูกต้อง และยังจะบันทึกไหม?`, "บันทึกต่อ");
          if (!go) { setNote(errorNote("ยังไม่ได้บันทึก — ตัวเลขใหม่ยังไม่ได้ยืนยัน")); return false; }
          confirmNumbers = true;
          continue;
        }
        setNote(errorNote(res.error));
        return false;
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * The clipboard first, straight from the tap — iPhone Safari refuses a write that waits on
   * the network — then the save; a save that fails says so instead of "คัดลอกแล้ว".
   */
  async function copy(what = text, label = "คัดลอกแล้ว วางในเฟซบุ๊กได้เลย") {
    let copied = true;
    await navigator.clipboard.writeText(what).catch(() => { copied = false; });
    const kept = await save();
    if (!kept) return; // save() has put its error in the note
    setNote(copied ? okNote(label) : errorNote("คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเองนะครับ"));
  }

  async function markUsed() {
    setMarking(true);
    try {
      if (await save()) await onStatus("used");
    } finally {
      setMarking(false);
    }
  }

  /** unsaved words are asked about, not dropped */
  const mayLeave = async () => {
    if (sending) { setNote(errorNote("กำลังส่งขึ้นเพจ รอให้เสร็จก่อนนะครับ")); return false; }
    return !unsaved || ask(
    stickersPending && !dirty ? "สติ๊กเกอร์ที่แปะเพิ่มยังไม่ได้บันทึก (กด “ตรวจแล้ว” ก่อน) ออกเลยไหม?" : "ยังไม่ได้บันทึกที่แก้ไว้ ออกเลยไหม?",
    "ออกเลย",
  );
  };

  /** back to the list */
  async function leave() {
    if (await mayLeave()) onClose();
  }

  /** the piece before or after, asking about unsaved words as leaving does */
  async function go(to?: () => void) {
    if (to && (await mayLeave())) to();
  }

  /** read through a round in one go: this one kept, and on to the next */
  async function saveAndNext() {
    if (!nav?.next) return;
    if (!(await save())) return;
    // the words are kept; stickers are kept only by ตรวจแล้ว
    if (stickersPending && !(await ask("สติ๊กเกอร์ที่แปะเพิ่มยังไม่ได้บันทึก (กด “ตรวจแล้ว” ก่อน) ไปชิ้นถัดไปเลยไหม?", "ไปต่อ"))) return;
    nav.next();
  }

  // the keys a desk expects: ⌘S / Ctrl+S keeps the words, Esc goes back to the list (not from
  // inside a field, where Esc is the field's, nor under a dialog, where it is the dialog's)
  const keys = useRef({ save, leave });
  useEffect(() => { keys.current = { save, leave }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void keys.current.save(); return; }
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open], [role=dialog]")) return;
      const at = document.activeElement;
      if (at instanceof HTMLElement && at.closest("input, textarea, select, [contenteditable]")) return;
      void keys.current.leave();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /*
   * The checks ran on the last save; the words on screen may have moved on. A finding whose
   * words are no longer there goes as the owner types — a number they just deleted stayed
   * flagged until บันทึก — and while there are edits the checks say they are of the last save,
   * since a number just typed is found only when it is saved. The numbers are kept as they
   * were written ("89 บาท"), so they are found in the text as they are.
   */
  const onScreen = [...draft.hooks, draft.body, draft.closing, draft.tags, ...draft.poster.blocks.map((b) => b.text)].join("\n");
  const flags = item.flags;
  const policy = (flags.policy ?? []).filter((f) => !f.match || onScreen.includes(f.match));
  const openFixes = locked ? [] : (fixes ?? []).filter((f) => !applied.has(f.find) && onScreen.includes(f.find));
  const words = flags.words.filter((w) => !applied.has(w.word) && onScreen.includes(w.word));
  const numbers = flags.numbers.filter((n) => onScreen.includes(n));
  const anything = numbers.length > 0 || words.length > 0 || policy.length > 0 || proofing || openFixes.length > 0 || Boolean(proofNote);
  const editorRoot = useRef<HTMLElement>(null);

  /** the words in the field they are in, selected and in view — the lists said what, not where */
  function locate(fragment: string) {
    const fields = editorRoot.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input[type=text], input:not([type])") ?? [];
    for (const f of fields) {
      const at = f.value.indexOf(fragment);
      if (at < 0) continue;
      f.focus();
      f.setSelectionRange(at, at + fragment.length);
      f.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
  }
  const checksId = `checks-${item.id}`;
  const blocks = policy.filter((f) => f.severity === "block").length;
  const summary = ([
    ["ผิดกฎ Facebook", blocks, "alert"],
    ["เสี่ยงผิดกฎ Facebook", policy.length - blocks, "warn"],
    ["ตัวเลขไม่ตรงตาราง", numbers.length, "warn"],
    ["คำต้องระวัง", words.length, "warn"],
    ["AI เสนอแก้คำ", openFixes.length, "warn"],
  ] as const).filter(([, n]) => n > 0);
  const busy = saving || marking || sending;

  return (
    <section ref={editorRoot} className="rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 pt-14 lg:pt-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={leave} title="กลับไปรายการ (Esc)" className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
          <BackIcon className="size-4" />
          กลับไปรายการ
        </button>
        {nav && nav.total > 1 && (
          <div className="flex items-center gap-1 text-sm text-[var(--ct-mute)]">
            <button type="button" onClick={() => go(nav.prev)} disabled={!nav.prev} aria-label="ชิ้นก่อนหน้า" title="ชิ้นก่อนหน้า" className="flex size-11 items-center justify-center rounded-lg hover:bg-[var(--ct-soft)] disabled:opacity-30">
              <ChevronLeftIcon className="size-5" />
            </button>
            <span className="tabular-nums">{nav.position}/{nav.total}</span>
            <button type="button" onClick={() => go(nav.next)} disabled={!nav.next} aria-label="ชิ้นถัดไป" title="ชิ้นถัดไป" className="flex size-11 items-center justify-center rounded-lg hover:bg-[var(--ct-soft)] disabled:opacity-30">
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-2">
        <h2 ref={title} tabIndex={-1} className="text-base font-semibold outline-none">{productName} · {FORMAT_LABEL[item.format]}</h2>
        {item.output.angle && <p className="mt-0.5 text-xs text-[var(--ct-mute)]">มุม: {item.output.angle}</p>}
      </div>

      {/* what the checks found, before any scrolling; each line jumps to its details */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
        {summary.length > 0 ? (
          <>
            <span className="mr-0.5 text-[var(--ct-mute)]">ต้องตรวจก่อนใช้:</span>
            {summary.map(([label, n, tone]) => (
              <a
                key={label} href={`#${checksId}`}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-medium ${tone === "alert"
                  ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
                  : "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}
              >
                {tone === "alert" && <AlertIcon className="size-4" />}
                {label} {n}
              </a>
            ))}
          </>
        ) : proofing ? (
          <span className="text-[var(--ct-mute)]">กำลังตรวจภาษา…</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[var(--ct-mute)]"><CheckIcon className="size-4" />ตรวจแล้ว ไม่พบจุดต้องแก้</span>
        )}
      </div>

      {locked && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm font-medium text-[var(--ct-warn-ink)]">
          <LockIcon className="mt-0.5 size-4" />
          <span>{ON_PAGE_NOTE}</span>
        </p>
      )}

      {Boolean(item.output.poster?.documents?.length) && item.output.paperChecked === false && !locked && (
        <ClaimPaperCheck item={item} onChecked={onSaved} onPending={setStickersPending} />
      )}

      {item.format !== "script" && <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium">รูปโพสต์</p>
        <PosterPanel
          back={`/studio?open=${item.id}`}
          value={draft.poster}
          onChange={(poster) => {
            if (draft.poster.background && !poster.background) setPlain(true);
            if (poster.background) setPlain(false);
            edit({ ...draft, poster });
          }}
          busy={drawing}
          people={people}
          person={item.output.person ?? null}
          pictureLocked={pictureLocked}
          readOnly={locked}
          confirmLeave={mayLeave}
          onDraw={async (request, painter, person) => {
            // The picture is drawn for the poster on file: calm where its words sit, in its
            // colours. A layout or colour changed here and not saved was drawn for as it was —
            // the words moved to the top over the busy half of a paid picture. So it is kept first.
            if (dirty && !(await save())) return "บันทึกการแก้ไขไม่สำเร็จ เลยยังไม่ได้วาดภาพ";
            const res = await onDraw(request, painter, person);
            if (!res.ok) return res.error;
            // the picture is saved already; only the background joins the draft, so poster
            // words the owner has typed but not yet saved are kept
            const background = res.item.output.poster?.background;
            setPlain(false);
            setDraft((d) => ({ ...d, poster: { ...d.poster, background } }));
            return null;
          }}
        />
      </div>}

      {isAd ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--ct-mute)]">3 ช่องนี้ตรงกับช่องใน Facebook Ads Manager — กดคัดลอกทีละช่องไปวางได้เลย</p>
          {([
            ["ข้อความหลัก (Primary text)", draft.body, (v: string) => edit({ ...draft, body: v }), null, 8],
            ["พาดหัว (Headline) — ใต้ภาพ ข้างปุ่ม", draft.hooks[0] ?? "", (v: string) => edit({ ...draft, hooks: [v] }), AD_LIMITS.headline, 1],
            ["คำอธิบาย (Description)", draft.closing, (v: string) => edit({ ...draft, closing: v }), AD_LIMITS.description, 1],
          ] as const).map(([label, value, set, limit, rows], i) => {
            const n = [...value].length;
            const fieldId = `ad-${item.id}-${i}`;
            return (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm font-medium">
                  <label htmlFor={fieldId}>{label}</label>
                  <span className="flex items-center gap-2">
                    {limit && <span className={`text-xs font-normal ${n > limit ? "text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>{n}/{limit}</span>}
                    <button
                      type="button" disabled={busy} aria-label={`คัดลอก${label}`}
                      onClick={() => copy(label.startsWith("ข้อความหลัก") ? text : value, "คัดลอกแล้ว วางใน Ads Manager ได้เลย")}
                      className="min-h-11 rounded-lg border border-[var(--ct-line)] px-3 text-sm font-normal hover:bg-[var(--ct-soft)] disabled:opacity-50"
                    >
                      คัดลอก
                    </button>
                  </span>
                </div>
                {rows > 1
                  ? <AutoTextarea id={fieldId} value={value} minRows={rows} readOnly={locked} onChange={(e) => set(e.target.value)} className={field} />
                  : <input id={fieldId} value={value} readOnly={locked} onChange={(e) => set(e.target.value)} className={`${field} min-h-11`} />}
              </div>
            );
          })}
        </div>
      ) : (
        <>
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium">ประโยคเปิด{draft.hooks.length > 1 ? " — เลือก 1 แบบ" : ""}</legend>
          <div className="space-y-2">
            {draft.hooks.map((h, i) => (
              <label key={i} className={`flex gap-2 rounded-lg border p-2 ${hook === i ? "border-[var(--ct-accent)] bg-[var(--ct-soft)]" : "border-[var(--ct-hair)]"}`}>
                {draft.hooks.length > 1 && <input type="radio" name={`hook-${item.id}`} checked={hook === i} onChange={() => setHook(i)} className="mt-2.5 size-5" />}
                <AutoTextarea
                  value={h} minRows={2} aria-label={`ประโยคเปิดแบบที่ ${i + 1}`} readOnly={locked}
                  onChange={(e) => edit({ ...draft, hooks: draft.hooks.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="w-full bg-transparent text-sm font-medium leading-relaxed outline-none"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium">เนื้อหา</span>
          <AutoTextarea value={draft.body} minRows={item.format === "script" ? 14 : 10} readOnly={locked} onChange={(e) => edit({ ...draft, body: e.target.value })} className={field} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">ประโยคปิด</span>
          <AutoTextarea value={draft.closing} minRows={2} readOnly={locked} onChange={(e) => edit({ ...draft, closing: e.target.value })} className={field} />
          {item.output.loop && (
            <span className="mt-1 block text-xs text-[var(--ct-mute)]">↻ คลิปวนลูป: ประโยคสุดท้ายต้องพูดค้างไว้ แล้วอ่านต่อด้วยประโยคเปิดได้พอดี — แก้แล้วลองอ่านต่อกันดู</span>
          )}
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">แฮชแท็ก</span>
          <input value={draft.tags} readOnly={locked} onChange={(e) => edit({ ...draft, tags: e.target.value })} className={`${field} min-h-11`} />
        </label>
        </>
      )}
      <p className="mt-3 whitespace-pre-line text-xs text-[var(--ct-mute)]">ต่อท้ายให้อัตโนมัติ:{"\n"}{footer(output)}</p>

      {item.format !== "script" && (
        <div className="mt-4 rounded-lg bg-[var(--ct-ground)] p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-[var(--ct-mute)]">
            คนเห็นก่อนกด “ดูเพิ่มเติม” ({Math.min(fold.length, FOLD)}/{FOLD} ตัวอักษรแรก)
          </p>
          <p className="whitespace-pre-line leading-relaxed">
            {fold.shown}
            {fold.hidden && <span className="text-[var(--ct-mute)]">… ดูเพิ่มเติม</span>}
          </p>
        </div>
      )}

      {anything && (
        <div id={checksId} className="mt-4 scroll-mt-20 space-y-3">
          {dirty && anything && (
            <p className="text-xs text-[var(--ct-mute)]">ผลตรวจนี้เป็นของฉบับที่บันทึกล่าสุด — ตัวเลขหรือคำที่เพิ่งพิมพ์จะถูกตรวจเมื่อกดบันทึก (⌘S)</p>
          )}
          {policy.length > 0 && (
            <div className="space-y-2">
              {policy.map((f) => (
                <div key={f.code} className={`rounded-lg border p-3 text-sm ${f.severity === "block"
                  ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
                  : "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
                  <p className="font-medium">
                    {f.severity === "block" ? "ผิดกฎโฆษณา Facebook" : "เสี่ยงผิดกฎ Facebook"}:{" "}
                    {f.match ? <button type="button" onClick={() => locate(f.match)} title="หาในข้อความ" className="underline decoration-dotted underline-offset-2">“{f.match}”</button> : null}
                  </p>
                  <p className="mt-0.5">{f.message}</p>
                  <p className="mt-0.5 opacity-80">แก้โดย: {f.fix}</p>
                </div>
              ))}
            </div>
          )}

          {(numbers.length > 0 || words.length > 0 || proofing || openFixes.length > 0) && (
            <div className="space-y-3 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
              {numbers.length > 0 && (
                <div>
                  <p className="font-medium">ตัวเลขที่ไม่มีในข้อมูลของแบบนี้ — ตรวจก่อนโพสต์ <span className="font-normal">(แตะเพื่อหาในข้อความ)</span></p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {numbers.map((n) => (
                      <button key={n} type="button" onClick={() => locate(n)} className="min-h-9 rounded-full border border-[var(--ct-warn-line)] bg-[var(--ct-panel)] px-2.5 tabular-nums hover:brightness-95">{n}</button>
                    ))}
                  </p>
                </div>
              )}
              {words.length > 0 && (
                <div>
                  <p className="font-medium">คำที่ควรเลี่ยงหรือสะกดผิด</p>
                  <ul className="mt-1 space-y-1">
                    {words.map((w) => (
                      <li key={w.word} className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => locate(w.word)} title="หาในข้อความ" className="text-left underline decoration-dotted underline-offset-2">
                          {w.kind === "banned" ? `“${w.word}” — คำโฆษณาที่ควรเลี่ยง` : `“${w.word}” → “${w.fix}”`}
                        </button>
                        {w.fix && !locked && <button type="button" onClick={() => accept({ find: w.word, replace: w.fix! })} className={smallBtn}>แก้</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {proofing && <p>กำลังตรวจภาษา…</p>}
              {openFixes.length > 0 && (
                <div>
                  <p className="font-medium">AI ตรวจภาษาเสนอแก้</p>
                  <ul className="mt-1 space-y-1">
                    {openFixes.map((f) => (
                      <li key={f.find} className="flex flex-wrap items-center gap-2">
                        <span>“{f.find}” → “{f.replace}”{f.why ? <span className="opacity-75"> ({f.why})</span> : null}</span>
                        <button type="button" onClick={() => accept(f)} className={smallBtn}>รับ</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {proofNote && <p role="status" className="text-sm text-[var(--ct-mute)]">{proofNote}</p>}
        </div>
      )}

      {isPost && <PublishPanel item={item} hook={hook} beforePublish={save} onPublished={onPublished} drawing={drawing} suggestDay={suggestDay} onBusy={setSending} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* one solid button a screen: a post's is ลงเพจ above, a script's or an ad's is this */}
        <button type="button" onClick={() => copy()} disabled={busy} className={isPost ? secondary : primary}>
          {isAd ? "คัดลอกข้อความหลัก" : "คัดลอกทั้งชิ้น"}
        </button>
        {!locked && (
          <button type="button" onClick={save} disabled={!dirty || busy} title="บันทึก (⌘S / Ctrl+S)" className={secondary}>
            {saving ? "กำลังบันทึก…" : dirty ? "บันทึกการแก้ไข" : "บันทึกแล้ว"}
          </button>
        )}
        {isPost && (
          <button type="button" onClick={() => setFeed(true)} className={secondary}>ดูแบบในฟีด</button>
        )}
        {item.status === "draft" && (
          <button type="button" onClick={markUsed} disabled={busy} className={`${secondary} inline-flex items-center gap-1.5 text-[var(--ct-accent)]`}>
            <CheckIcon className="size-4" />
            {marking ? "กำลังย้าย…" : "ใช้จริง"}
          </button>
        )}
        {nav?.next ? (
          <button type="button" onClick={dirty && !locked ? saveAndNext : () => go(nav.next)} disabled={busy} className={`${secondary} ml-auto inline-flex items-center gap-1`}>
            {dirty && !locked ? "บันทึกแล้วไปชิ้นถัดไป" : "ชิ้นถัดไป"}
            <ChevronRightIcon className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={leave} className={`${secondary} ml-auto`}>กลับไปรายการ</button>
        )}
        {held && <p className="basis-full text-xs text-[var(--ct-mute)]">บันทึกแล้วระบบจะส่งฉบับแก้ไปแทนโพสต์ที่ตั้งเวลาไว้ (เวลาเดิม)</p>}
        <Note note={note} className="basis-full" />
      </div>

      <p className="mt-3 text-xs text-[var(--ct-mute)]">{item.model} · ฿{item.costThb.toFixed(2)}</p>

      {feed && <FeedPreview text={text} poster={posterUrl(draft.poster)} onClose={() => setFeed(false)} />}

      {item.output.imagePrompt && (
        <details className="mt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-[var(--ct-mute)]">คำสั่งวาดรูปประกอบ (ใช้กับเครื่องมือสร้างรูป)</summary>
          <p className="mt-2 rounded-lg bg-[var(--ct-ground)] p-2 text-xs">{item.output.imagePrompt}</p>
        </details>
      )}
    </section>
  );
}
