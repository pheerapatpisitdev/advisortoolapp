"use client";
import { useEffect, useState } from "react";
import {
  BLOCK_KINDS, BLOCK_LABEL, LAYOUTS, LAYOUT_LABEL, MAX_CHARS, SIZES,
  posterUrl, type BlockKind, type PosterSpec, type SizeId,
} from "@/lib/content/poster";
import { PAINTERS, painterFor } from "@/lib/content/models";
import type { PiecePerson } from "@/lib/content/people";
import { SAVE_LABEL, usePictureSaver } from "./savePicture";
import { PersonPicker, type PersonOption } from "./PersonPicker";
import { ThemeSwatches } from "./ThemeSwatches";
import { ask } from "./ask";
import { CheckIcon, LockIcon } from "./ui/editor-icons";

/**
 * The poster, editable: its four lines, where they sit, which colours, which size to download.
 *
 * One line of each kind — the shape the writer is asked for. Emptying a line leaves it off the
 * poster. A poster without a headline is not drawn, so while the headline is empty the preview
 * asks for one and there is nothing to download; saving then keeps the poster as it was. The
 * preview waits for typing to pause before it asks for a new picture, since every change is a
 * new drawing.
 */

const ORDER: BlockKind[] = [...BLOCK_KINDS];

function textsOf(p: PosterSpec): Record<BlockKind, string> {
  const t = { badge: "", headline: "", sub: "", footer: "" };
  for (const b of p.blocks) if (!t[b.kind]) t[b.kind] = b.text;
  return t;
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-50 ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`;

interface Props {
  value: PosterSpec;
  onChange: (p: PosterSpec) => void;
  /** orders a photograph behind the words; resolves to an error to show, or null when done */
  onDraw: (request: string, painter: string, person: PiecePerson | null) => Promise<string | null>;
  people: PersonOption[];
  /** who the piece's picture was last drawn with; the redraw starts from them */
  person: PiecePerson | null;
  /** a photograph is already being drawn for this piece, ordered by the page */
  busy?: boolean;
  /**
   * The piece is held by Facebook or on the Page: a new picture would not reach the post, so
   * drawing and the plain colour are shut, with a line saying why.
   */
  pictureLocked?: boolean;
  /** the piece is on the Page: nothing here can be changed */
  readOnly?: boolean;
  /** asked before a link leaves the editor; false stays */
  confirmLeave?: () => Promise<boolean>;
}

/** who the picture was last drawn with, when they are still in the library */
const known = (who: PiecePerson | null, people: PersonOption[]) => (who && people.some((p) => p.id === who.id) ? who : null);

export function PosterPanel({ value, onChange, onDraw, busy, people, person: drawnWith, pictureLocked, readOnly, confirmLeave }: Props) {
  const [request, setRequest] = useState("");
  const [person, setPerson] = useState<PiecePerson | null>(() => known(drawnWith, people));
  // the piece's own person again when it changes under the editor (a redraw landed) or the
  // library arrives after the editor opened
  const peopleKey = people.map((p) => p.id).join(",");
  useEffect(() => {
    setPerson(known(drawnWith, people));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids, not the arrays' identity
  }, [drawnWith?.id, drawnWith?.pose, peopleKey]);
  const [painter, setPainter] = useState("standard");
  // a person's photos go to Gemini Image whatever the painter, so it is priced as that
  const price = `~฿${painterFor(painter, Infinity, Boolean(person)).thb.toFixed(2)}`;
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const shut = Boolean(pictureLocked || readOnly);

  /** the paid photograph goes only when the owner says so */
  async function dropPicture() {
    if (!(await ask("ทิ้งภาพที่ AI วาดไว้? วาดใหม่ต้องจ่ายอีกรอบ", "ใช้สีพื้น"))) return;
    onChange({ layout: value.layout, theme: value.theme, blocks: value.blocks });
  }

  async function draw() {
    setDrawing(true);
    setDrawError(null);
    setDrawError(await onDraw(request, painter, person).catch(() => "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"));
    setDrawing(false);
  }

  const texts = textsOf(value);
  const drawable = value.blocks.some((b) => b.kind === "headline");
  const [size, setSize] = useState<SizeId>("square");
  const [shown, setShown] = useState(value);
  const saver = usePictureSaver(posterUrl(shown, size), `poster-${size}.png`);

  // a new picture once typing pauses, not on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 600);
    return () => clearTimeout(t);
  }, [value]);

  const set = (kind: BlockKind, text: string) => {
    const next = { ...texts, [kind]: text };
    onChange({ ...value, blocks: ORDER.filter((k) => next[k].trim()).map((k) => ({ kind: k, text: next[k] })) });
  };

  return (
    <div className="grid gap-4 rounded-lg bg-[var(--ct-ground)] p-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div>
        {shown.blocks.some((b) => b.kind === "headline") ? (
          // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
          <img
            src={posterUrl(shown, size)}
            alt="ตัวอย่างโปสเตอร์"
            onLoad={saver.ready}
            className="w-full rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)]"
            style={{ aspectRatio: `${SIZES[size].width} / ${SIZES[size].height}` }}
          />
        ) : (
          <p className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[var(--ct-line)] p-4 text-center text-sm text-[var(--ct-mute)]">
            ใส่พาดหัวก่อน แล้วรูปจะขึ้นตรงนี้
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(SIZES) as SizeId[]).map((s) => (
            <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s)}>{SIZES[s].label}</button>
          ))}
        </div>
        {drawable && (
          <button
            type="button"
            onClick={saver.save}
            disabled={saver.state === "saving" || shown !== value}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-center text-sm font-medium hover:bg-[var(--ct-soft)] disabled:opacity-50"
          >
            {saver.state === "saved" && <CheckIcon className="size-4" />}
            {SAVE_LABEL[saver.state]}
          </button>
        )}
      </div>

      <div className="min-w-0 space-y-3">
      <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-3 border-0 p-0">
        <legend className="sr-only">ข้อความและสีบนรูป</legend>
        {ORDER.map((kind) => (
          <label key={kind} className="block">
            <span className="mb-1 flex justify-between text-sm font-medium">
              <span>{BLOCK_LABEL[kind]}{kind === "headline" ? "" : " (ไม่ใส่ก็ได้)"}</span>
              <span className="text-xs font-normal text-[var(--ct-mute)]">{[...texts[kind]].length}/{MAX_CHARS[kind]}</span>
            </span>
            <input
              value={texts[kind]}
              maxLength={MAX_CHARS[kind]}
              onChange={(e) => set(kind, e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)] disabled:opacity-60"
            />
          </label>
        ))}
        {/* a รีวิวเคลม poster lays its words above the paper, always */}
        {!value.documents?.length && <div role="group" aria-label="ตำแหน่งข้อความ" className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="mr-1 font-medium">ตำแหน่งข้อความ</span>
          {LAYOUTS.map((l) => (
            <button key={l} type="button" aria-pressed={value.layout === l} onClick={() => onChange({ ...value, layout: l })} className={chip(value.layout === l)}>{LAYOUT_LABEL[l]}</button>
          ))}
        </div>}
        <div className="text-sm">
          <span className="mb-1.5 block font-medium">โทนสี</span>
          <ThemeSwatches value={value.theme} onChange={(theme) => onChange({ ...value, theme })} />
        </div>
        </fieldset>
        <fieldset disabled={shut} className="m-0 min-w-0 space-y-2 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-2.5">
          <legend className="sr-only">ภาพพื้นหลัง</legend>
          <p className="text-sm font-medium">
            ภาพพื้นหลัง {value.background ? "— มีภาพจาก AI แล้ว" : "— ตอนนี้เป็นสีพื้น"}
          </p>
          {pictureLocked && !readOnly && (
            <p className="flex items-start gap-1.5 text-sm text-[var(--ct-warn-ink)]">
              <LockIcon className="mt-0.5 size-4" />
              <span>ภาพของโพสต์ที่ตั้งเวลา/ขึ้นเพจแล้วแก้ไม่ได้ — ยกเลิกการตั้งเวลาก่อน</span>
            </p>
          )}
          {!shut && <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">อยากได้ภาพแบบไหน (ไม่ใส่ก็ได้)</span>
              <input
                value={request} onChange={(e) => setRequest(e.target.value)} maxLength={300}
                placeholder="เช่น พ่อกับลูกสาวอ่านนิทานก่อนนอน"
                className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]"
              />
            </label>
            <PersonPicker people={people} value={person} onChange={setPerson} confirmLeave={confirmLeave} />
            {!person && <div role="group" aria-label="วาดด้วย" className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="mr-1 font-medium">วาดด้วย</span>
              {PAINTERS.filter((p) => p.modelId).map((p) => (
                <button key={p.id} type="button" aria-pressed={painter === p.id} onClick={() => setPainter(p.id)} className={chip(painter === p.id)}>
                  {p.label} ฿{p.thb.toFixed(2)}
                </button>
              ))}
            </div>}
          </>}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={draw} disabled={drawing || busy || shut} className="min-h-11 rounded-lg border border-[var(--ct-accent)] bg-[var(--ct-panel)] px-3 py-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50">
              {drawing || busy ? "กำลังวาด… ราว 20–40 วินาที" : value.background ? `วาดภาพใหม่ (${price})` : `วาดภาพพื้นหลังด้วย AI (${price})`}
            </button>
            {value.background && !drawing && !busy && (
              <button type="button" onClick={dropPicture} disabled={shut} className="min-h-11 rounded-lg border border-[var(--ct-line)] px-3 py-2 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50">
                ใช้สีพื้นแทน
              </button>
            )}
          </div>
          {drawError && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{drawError}</p>}
          <p className="text-xs leading-relaxed text-[var(--ct-mute)]">
            AI วาดเฉพาะภาพ ไม่มีตัวหนังสือ แล้วระบบพิมพ์ข้อความไทยทับด้วยฟอนต์จริง จึงไม่เพี้ยน · ค่ารูปนับรวมในงบคอนเทนต์เดือนนี้
          </p>
        </fieldset>
        <p className="text-xs text-[var(--ct-mute)]">ตัวเลขบนภาพถูกตรวจเทียบตารางเบี้ยเมื่อกดบันทึก</p>
      </div>
    </div>
  );
}
