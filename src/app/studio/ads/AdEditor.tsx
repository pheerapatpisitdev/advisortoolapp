"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster, type PosterSpec } from "@/lib/content/poster";
import type { ContentItem } from "@/lib/content/store";
import { PosterPanel } from "../PosterPanel";
import type { PersonOption } from "../PersonPicker";
import { drawPicture } from "../draw";
import { ask } from "../ask";
import { AutoTextarea, errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { XIcon } from "../ui/icons";
import { saveAdCopy, setAdStatus, type AdCampaignRoom } from "./actions";
import { FeedPreview } from "./FeedPreview";
import { LaunchPanel } from "./LaunchPanel";
import type { AdRules } from "./rules";
import { field, plain as plainButton, solid } from "./styles";

/**
 * One ad, full screen: the poster on the left (Studio's own PosterPanel, with its AI picture),
 * the three Ads Manager fields on the right with a count against Facebook's lengths — red when
 * over, never cut — the ad as the feed would show it, the save, and under them the launch.
 *
 * An ad already put on Facebook keeps what it went up with: saving here changes Studio's copy
 * only, and the editor says so. A new set from the launch panel is how an edit reaches Facebook.
 */

export type Room = Extract<AdCampaignRoom, { ok: true }>;
export type RoomPiece = Room["pieces"][number];

interface Draft {
  headline: string;
  primaryText: string;
  description: string;
  poster: PosterSpec;
}

const draftOf = (p: { headline: string; primaryText: string; description: string; poster: PosterSpec | null }, productName: string): Draft => ({
  headline: p.headline,
  primaryText: p.primaryText,
  description: p.description,
  poster: p.poster ?? defaultPoster(p.headline, productName),
});

const fromItem = (item: ContentItem, productName: string): Draft => draftOf({
  headline: item.output.hooks[0] ?? "", primaryText: item.output.body ?? "", description: item.output.closing ?? "", poster: item.output.poster ?? null,
}, productName);

/** One Ads Manager field with its count; over the limit it turns red and says what happens, but keeps every letter. */
function CopyField({ id, label, value, onChange, limit, overNote, rows }: {
  id: string; label: string; value: string; onChange: (v: string) => void; limit: number; overNote: string; rows: number;
}) {
  const n = [...value].length;
  const over = n > limit;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium">
        <label htmlFor={id}>{label}</label>
        <span className={`text-xs tabular-nums ${over ? "font-medium text-[var(--ct-alert)]" : "font-normal text-[var(--ct-mute)]"}`}>
          {n}/{limit}{over ? ` — ${overNote}` : ""}
        </span>
      </div>
      {rows > 1
        ? <AutoTextarea id={id} minRows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} leading-relaxed`} />
        : <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={field} />}
    </div>
  );
}

export function AdEditor({ piece, room, productName, rules, people, onClose }: {
  piece: RoomPiece;
  room: Room;
  /** the plan's name, for the poster of an ad written before posters */
  productName: string;
  rules: AdRules;
  people: PersonOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { campaign } = room;
  const [draft, setDraft] = useState<Draft>(() => draftOf(piece, productName));
  // an ad from before posters shows a drawn-up one: it is unsaved until the owner keeps it
  const [dirty, setDirty] = useState(piece.poster === null);
  /** the AI picture was taken off for the plain colour; the save says so, or the server keeps it */
  const [plain, setPlain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  // every edit counts up, so a save can tell whether the owner typed on while it was out
  const edits = useRef(0);

  const edit = (next: Partial<Draft>) => {
    edits.current += 1;
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
    setNote(null);
  };

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setSaving(true);
    setNote(null);
    const sent = draft;
    const at = edits.current;
    try {
      const res = await saveAdCopy(piece.id, {
        hooks: [sent.headline], body: sent.primaryText, closing: sent.description, hashtags: [], poster: sent.poster,
      }, { plain }).catch(() => null);
      if (!res) { setNote(errorNote("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); return false; }
      if (!res.ok) { setNote(errorNote(res.error)); return false; }
      setPlain(false);
      if (edits.current === at) {
        setDraft(fromItem(res.item, productName));
        setDirty(false);
      } else {
        // words typed meanwhile stay, still unsaved; the picture on file joins them
        const background = res.item.output.poster?.background;
        setDraft((d) => ({ ...d, poster: { ...d.poster, background } }));
      }
      setNote(okNote("บันทึกแล้ว — ตรวจตัวเลขและกฎใหม่แล้ว"));
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  const [moving, setMoving] = useState(false);
  /** ทิ้ง / กู้คืน: the piece moves tab, the room is read again, and the editor closes on a bin */
  async function move(status: "draft" | "trashed") {
    if (status === "trashed" && !(await ask("ทิ้งแอดนี้ลงถังขยะ? กู้คืนได้จากแท็บถังขยะ", "ทิ้ง"))) return;
    setMoving(true);
    setNote(null);
    try {
      const res = await setAdStatus(piece.id, status);
      if (!res.ok) { setNote(errorNote(res.error)); return; }
      router.refresh();
      if (status === "trashed") onClose();
      else setNote(okNote("กู้คืนแล้ว อยู่ในแท็บ “ร่าง”"));
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง"));
    } finally {
      setMoving(false);
    }
  }

  async function close() {
    if (dirty && !(await ask("ปิดหน้าแก้แอด? การแก้ที่ยังไม่บันทึกจะหายไป", "ปิดโดยไม่บันทึก"))) return;
    onClose();
  }

  // Escape closes, asking first like the button; the page under the editor does not scroll
  const closeNow = useRef(close);
  useEffect(() => { closeNow.current = close; });
  useEffect(() => {
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // a question already open (ask's own <dialog>) takes its Escape for itself
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) void closeNow.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
    };
  }, []);
  // leaving the page with unsaved words: the browser asks
  useEffect(() => {
    if (!dirty) return;
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [dirty]);

  // a piece in the bin is read-only: nothing to save or draw (and pay for) until it is restored
  const trashed = piece.status === "trashed";
  const launched = piece.launches.length > 0;
  const policy = piece.flags.policy;
  const ids = `ad-${piece.id}`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[var(--ct-ground)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-2">
        <button type="button" onClick={close} aria-label="ปิดหน้าแก้แอด" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--ct-soft)]">
          <XIcon className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 id={`${ids}-title`} className="truncate text-sm font-semibold">{draft.headline || "แอดไม่มีหัวข้อ"}</h2>
          <p className="truncate text-xs text-[var(--ct-mute)]">{campaign.title}{piece.ad ? ` · ${piece.ad.angle} · ${piece.ad.tone}` : ""}</p>
        </div>
        {piece.status === "trashed" ? (
          <button type="button" onClick={() => move("draft")} disabled={moving || saving} className={`${plainButton} shrink-0`}>
            {moving ? "กำลังกู้คืน…" : "กู้คืน"}
          </button>
        ) : (
          <button type="button" onClick={() => move("trashed")} disabled={moving || saving} className={`${plainButton} shrink-0 text-[var(--ct-alert)]`}>
            {moving ? "กำลังทิ้ง…" : "ทิ้ง"}
          </button>
        )}
        <button type="button" onClick={save} disabled={!dirty || saving || trashed} className={`${solid} shrink-0`}>
          {saving ? "กำลังบันทึก…" : dirty ? "บันทึก" : "บันทึกแล้ว"}
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-6">
        <section aria-label="โปสเตอร์" className="min-w-0 space-y-2">
          <p className="text-sm font-medium">โปสเตอร์ 1:1</p>
          <PosterPanel
            value={draft.poster}
            onChange={(poster) => {
              if (draft.poster.background && !poster.background) setPlain(true);
              if (poster.background) setPlain(false);
              edit({ poster });
            }}
            people={people}
            person={piece.person}
            readOnly={trashed}
            pictureLocked={trashed}
            back={`/studio/ads/${campaign.id}`}
            confirmLeave={async () => !dirty || ask("ออกจากหน้านี้? การแก้ที่ยังไม่บันทึกจะหายไป", "ออก")}
            onDraw={async (request, painter, person) => {
              // the picture is drawn for the poster on file, so an unsaved layout or colour is kept first
              if (dirty && !(await save())) return "บันทึกการแก้ไขไม่สำเร็จ เลยยังไม่ได้วาดภาพ";
              const res = await drawPicture(piece.id, request, painter, person);
              if (!res.ok) return res.error;
              const background = res.item.output.poster?.background;
              setPlain(false);
              setDraft((d) => ({ ...d, poster: { ...d.poster, background } }));
              router.refresh();
              return null;
            }}
          />
        </section>

        <div className="min-w-0 space-y-4">
          {launched && (
            <p role="note" className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm font-medium text-[var(--ct-warn-ink)]">
              แก้ตรงนี้ไม่เปลี่ยนแอดที่ยิงไปแล้ว ใช้สร้างใหม่
            </p>
          )}
          {policy.length > 0 && (
            <div role="note" className="space-y-1 rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
              <p className="font-medium">อาจผิดกฎโฆษณาของ Facebook</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {policy.map((f, i) => <li key={`${f.code}-${i}`}>{f.message}{f.match ? ` (“${f.match}”)` : ""}{f.fix ? ` — ${f.fix}` : ""}</li>)}
              </ul>
            </div>
          )}

          <section aria-label="ข้อความโฆษณา" className="space-y-3 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5">
            <CopyField
              id={`${ids}-primary`} label="ข้อความหลัก (Primary text)" rows={6} value={draft.primaryText}
              onChange={(primaryText) => edit({ primaryText })} limit={rules.limits.fold} overNote="ส่วนที่เกินถูกพับ ต้องกด “ดูเพิ่มเติม”"
            />
            <CopyField
              id={`${ids}-headline`} label="หัวข้อ (Headline) — ใต้ภาพ" rows={1} value={draft.headline}
              onChange={(headline) => edit({ headline })} limit={rules.limits.headline} overNote="ยาวเกิน อาจถูกตัด"
            />
            <CopyField
              id={`${ids}-description`} label="คำอธิบาย (Description)" rows={1} value={draft.description}
              onChange={(description) => edit({ description })} limit={rules.limits.description} overNote="ยาวเกิน อาจถูกตัด"
            />
            <Note note={note} />
          </section>

          <FeedPreview
            pageName={campaign.pageName ?? "เพจของแคมเปญ"} primaryText={draft.primaryText} headline={draft.headline}
            description={draft.description} poster={draft.poster} fold={rules.limits.fold}
          />

          <LaunchPanel
            piece={{ id: piece.id, status: piece.status, hasPoster: piece.hasPoster, launches: piece.launches }}
            connection={room.connection}
            page={{ pageId: campaign.pageId, pageName: campaign.pageName, connected: campaign.pageConnected }}
            pages={room.pages}
            copy={{ headline: draft.headline, primaryText: draft.primaryText, description: draft.description }}
            dirty={dirty}
          />
        </div>
      </div>
    </div>
  );
}
