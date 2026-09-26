"use client";
import { useEffect, useRef, useState } from "react";
import { atFold, FOLD, footer, fullText } from "@/lib/content/output";
import { defaultPoster, type PosterSpec } from "@/lib/content/poster";
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
import { AutoTextarea, errorNote, Note, okNote, type NoteState } from "./ui/editor-fields";

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
}

export function PieceEditor({ item, productName, drawing, onSaved, onDraw, onStatus, onPublished, onClose, people, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(item, productName));
  const [hook, setHook] = useState(0);
  const [fixes, setFixes] = useState<Fix[] | null>(item.flags.fixes);
  const [proofing, setProofing] = useState(false);
  const [proofNote, setProofNote] = useState<string>();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
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
    if (!dirty) return;
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [dirty]);

  // and the page around the editor is told, for its own links
  const tell = useRef(onDirtyChange);
  useEffect(() => { tell.current = onDirtyChange; }, [onDirtyChange]);
  useEffect(() => { tell.current?.(dirty); }, [dirty]);
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
  const mayLeave = async () => !dirty || ask("ยังไม่ได้บันทึกที่แก้ไว้ ออกเลยไหม?", "ออกเลย");

  /** back to the list */
  async function leave() {
    if (await mayLeave()) onClose();
  }

  const flags = item.flags;
  const policy = flags.policy ?? [];
  const openFixes = locked ? [] : (fixes ?? []).filter((f) => !applied.has(f.find));
  const words = flags.words.filter((w) => !applied.has(w.word));
  const anything = flags.numbers.length > 0 || words.length > 0 || policy.length > 0 || proofing || openFixes.length > 0 || Boolean(proofNote);
  const checksId = `checks-${item.id}`;
  const blocks = policy.filter((f) => f.severity === "block").length;
  const summary = ([
    ["ผิดกฎ Facebook", blocks, "alert"],
    ["เสี่ยงผิดกฎ Facebook", policy.length - blocks, "warn"],
    ["ตัวเลขไม่ตรงตาราง", flags.numbers.length, "warn"],
    ["คำต้องระวัง", words.length, "warn"],
    ["AI เสนอแก้คำ", openFixes.length, "warn"],
  ] as const).filter(([, n]) => n > 0);
  const busy = saving || marking;

  return (
    <section className="rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 pt-14 lg:pt-4">
      <button type="button" onClick={leave} className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
        <BackIcon className="size-4" />
        กลับไปรายการ
      </button>
      <div className="mt-2">
        <h2 className="text-base font-semibold">{productName} · {FORMAT_LABEL[item.format]}</h2>
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
        <ClaimPaperCheck item={item} onChecked={onSaved} />
      )}

      {item.format !== "script" && <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium">รูปโพสต์</p>
        <PosterPanel
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
          {policy.length > 0 && (
            <div className="space-y-2">
              {policy.map((f) => (
                <div key={f.code} className={`rounded-lg border p-3 text-sm ${f.severity === "block"
                  ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
                  : "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
                  <p className="font-medium">{f.severity === "block" ? "ผิดกฎโฆษณา Facebook" : "เสี่ยงผิดกฎ Facebook"}: “{f.match}”</p>
                  <p className="mt-0.5">{f.message}</p>
                  <p className="mt-0.5 opacity-80">แก้โดย: {f.fix}</p>
                </div>
              ))}
            </div>
          )}

          {(flags.numbers.length > 0 || words.length > 0 || proofing || openFixes.length > 0) && (
            <div className="space-y-3 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
              {flags.numbers.length > 0 && (
                <div>
                  <p className="font-medium">ตัวเลขที่ไม่มีในข้อมูลของแบบนี้ — ตรวจก่อนโพสต์</p>
                  <p className="mt-0.5">{flags.numbers.join(" · ")}</p>
                </div>
              )}
              {words.length > 0 && (
                <div>
                  <p className="font-medium">คำที่ควรเลี่ยงหรือสะกดผิด</p>
                  <ul className="mt-1 space-y-1">
                    {words.map((w) => (
                      <li key={w.word} className="flex flex-wrap items-center gap-2">
                        <span>{w.kind === "banned" ? `“${w.word}” — คำโฆษณาที่ควรเลี่ยง` : `“${w.word}” → “${w.fix}”`}</span>
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

      {isPost && <PublishPanel item={item} hook={hook} beforePublish={save} onPublished={onPublished} drawing={drawing} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* one solid button a screen: a post's is ลงเพจ above, a script's or an ad's is this */}
        <button type="button" onClick={() => copy()} disabled={busy} className={isPost ? secondary : primary}>
          {isAd ? "คัดลอกข้อความหลัก" : "คัดลอกทั้งชิ้น"}
        </button>
        {!locked && (
          <button type="button" onClick={save} disabled={!dirty || busy} className={secondary}>
            {saving ? "กำลังบันทึก…" : dirty ? "บันทึกการแก้ไข" : "บันทึกแล้ว"}
          </button>
        )}
        {item.status === "draft" && (
          <button type="button" onClick={markUsed} disabled={busy} className={`${secondary} inline-flex items-center gap-1.5 text-[var(--ct-accent)]`}>
            <CheckIcon className="size-4" />
            {marking ? "กำลังย้าย…" : "ใช้จริง"}
          </button>
        )}
        <button type="button" onClick={leave} className={`${secondary} ml-auto`}>กลับไปรายการ</button>
        {held && <p className="basis-full text-xs text-[var(--ct-mute)]">บันทึกแล้วระบบจะส่งฉบับแก้ไปแทนโพสต์ที่ตั้งเวลาไว้ (เวลาเดิม)</p>}
        <Note note={note} className="basis-full" />
      </div>

      <p className="mt-3 text-xs text-[var(--ct-mute)]">{item.model} · ฿{item.costThb.toFixed(2)}</p>

      {item.output.imagePrompt && (
        <details className="mt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-[var(--ct-mute)]">คำสั่งวาดรูปประกอบ (ใช้กับเครื่องมือสร้างรูป)</summary>
          <p className="mt-2 rounded-lg bg-[var(--ct-ground)] p-2 text-xs">{item.output.imagePrompt}</p>
        </details>
      )}
    </section>
  );
}
