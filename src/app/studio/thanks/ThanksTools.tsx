"use client";
import { useEffect, useId, useState } from "react";
import { workbenchHref } from "@/lib/content/workbench-link";
import type { LogoSpot } from "@/lib/content/logo";
import { LogoPicker } from "../ui/LogoPicker";
import { AUTO, AUTO_FLOOR_THB, OVERHEAD_THB, PAINTERS, WRITERS, painterFor, writerOf } from "@/lib/content/models";
import type { PiecePerson } from "@/lib/content/people";
import { roundsNote, type Rounds } from "@/lib/wallet/note";
import { LENGTHS, MAX_READER, type Format, type Length } from "@/lib/content/prompt";
import {
  MAX_THANKS_CUSTOM, MAX_THANKS_PIECES, THANKS_NAME, THANKS_OCCASIONS, THANKS_TONES, thanksTones,
} from "@/lib/content/thanks";
import type { GenerateResult } from "../actions";
import { thanksRound } from "../draw";
import { PersonPicker, type PersonOption } from "../PersonPicker";
import { PictureBrief } from "../ui/PictureBrief";
import { PosterWords, type PosterWordsValue } from "../ui/PosterWords";
import { cleanPosterWords } from "@/lib/content/poster-words";
import { FormatPicker, FormSection, LoopToggle, overBudget, PictureFold, PressBar, pictureSummary, FormulaPicker, useFormula, useLoop } from "../ui/form-parts";

/**
 * ขอบคุณลูกค้า's tools (owner, 2026-10-06): pick an occasion, set the round, press สร้าง. No
 * customer's name or policy is ever asked for — the writer thanks customers in general
 * (thanks.ts).
 */

/** the thank-you reader is its own, as the recruit form's is */
const READER_KEY = "content-thanks-reader";
/** a thank-you is a post or a clip: it sells nothing, so it is never an ad */
const FORMATS: Format[] = ["post", "script"];

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function ThanksTools({ writer, onWriter, painter, onPainter, people, person, onPerson, brief, onBrief, logo, rounds, left, pending, making, run, folded, formId }: {
  writer: string;
  onWriter: (id: string) => void;
  painter: string;
  onPainter: (id: string) => void;
  people: PersonOption[];
  /** the Page's logo and its spot, shared with the plan form (ui/LogoPicker.tsx) */
  logo: { page?: string; spot: LogoSpot | null; onSpot: (s: LogoSpot | null) => void };
  person: PiecePerson | null;
  onPerson: (p: PiecePerson | null) => void;
  /** บรีฟภาพเพิ่มเติม, shared with the plan form and remembered (ui/PictureBrief.tsx) */
  brief: string;
  onBrief: (next: string) => void;
  /** the month's content money left, for the estimate and for อัตโนมัติ */
  left: number;
  /** the agent's free AI rounds and their wallet; null for staff (src/lib/auth/quota.ts) */
  rounds?: Rounds | null;
  pending: boolean;
  making: number;
  /** `paintWith`, `who` and `brief` are the painter, person and picture brief at the press; the page draws each new poster's picture with them */
  run: (asked: number, format: Format, send: () => Promise<GenerateResult>, paintWith: string, who: PiecePerson | null, brief: string) => Promise<void>;
  /** a phone's form folded away after a round: the fields go, the press stays in reach */
  folded?: boolean;
  /** the id the page's ตั้งค่าการสร้าง button controls */
  formId?: string;
}) {
  const id = useId();
  const [occasion, setOccasion] = useState<string>(THANKS_OCCASIONS[0].id);
  const [custom, setCustom] = useState("");
  const [reader, setReaderState] = useState("");
  useEffect(() => {
    try { setReaderState(localStorage.getItem(READER_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const setReader = (r: string) => {
    setReaderState(r);
    try { localStorage.setItem(READER_KEY, r); } catch { /* not kept */ }
  };
  const [format, setFormat] = useState<Format>("post");
  const [length, setLength] = useState<Length>("60");
  const [loop, setLoop] = useLoop();
  const [formula, setFormula] = useFormula();
  const [tone, setTone] = useState("");
  const [count, setCount] = useState(1);
  const [posterWords, setPosterWords] = useState<PosterWordsValue>({});

  const blocked = occasion === "custom" && !custom.trim() ? "พิมพ์โอกาส หรือเลือกจากรายการ" : null;

  const pick = writerOf(writer, left);
  // a person in the picture is drawn by Gemini whatever was picked, at Gemini's price
  const paints = painterFor(painter, left, Boolean(person));
  const drawn = format === "script" ? 0 : paints.thb * count;
  const estimate = (count * (pick.thb + OVERHEAD_THB) + drawn).toFixed(2);
  const unit = "ชิ้น";

  async function create() {
    if (pending || blocked) return;
    // the form as it was at the press, whatever changes while the round is out
    const round = { occasion, custom: custom.trim(), reader: reader.trim(), tone, format, length, loop: format === "script" && loop, formula, count, writer,
      ...(format !== "script" && logo.spot ? { logoSpot: logo.spot } : {}),
      ...(format !== "script" && cleanPosterWords(posterWords) ? { posterWords: cleanPosterWords(posterWords) } : {}), page: logo.page };
    const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
    await run(count, round.format, () => thanksRound(round), paintWith, person, brief.trim());
  }

  const quota = rounds ? roundsNote(rounds, estimate) : null;

  return (
    <>
      <div id={formId} className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">ขอบคุณเรื่องอะไร</span>
            <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className={field}>
              {THANKS_OCCASIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              <option value="custom">พิมพ์เอง…</option>
            </select>
          </label>
          {occasion === "custom" && (
            <label className="mt-2 block">
              <span className="sr-only">โอกาส (พิมพ์เอง)</span>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAX_THANKS_CUSTOM} placeholder="เช่น ขอบคุณลูกค้าที่มางานเลี้ยงขอบคุณของเพจ" className={field} />
            </label>
          )}
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">ขอบคุณลูกค้าโดยรวม ไม่ใส่ชื่อหรือเรื่องของลูกค้าคนไหน ไม่เสนอของแถมหรือส่วนลด และไม่ขายประกัน — ระบบตรวจให้ทุกชิ้น</p>
        </div>

        <FormatPicker value={format} onChange={setFormat} formats={FORMATS} />

        {format === "script" && (
          <div role="group" aria-labelledby={`${id}-length`}>
            <span id={`${id}-length`} className="mb-1.5 block text-sm font-medium">ความยาวคลิป</span>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <button key={l.id} type="button" aria-pressed={length === l.id} onClick={() => setLength(l.id)} className={chip(length === l.id)}>{l.label}</button>
              ))}
            </div>
          </div>
        )}

        {format === "script" && <LoopToggle value={loop} onChange={setLoop} />}
        <FormulaPicker value={formula} onChange={setFormula} />

        <FormSection title="เรื่องที่เล่า">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ขอบคุณใคร <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ระบบจำไว้ให้)</span></span>
          <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="เช่น ลูกค้าที่ทำประกันสุขภาพกับเรา" className={field} />
        </label>

        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">วิธีเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={field}>
              <option value="">ให้ AI เลือก</option>
              {THANKS_TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">
            {tone && count > 1 ? `ทุก${unit}ใช้วิธีเล่าที่เลือก เปิดเรื่องต่างกัน` : thanksTones(tone, count).map((t) => t.label).join(" · ")}
          </p>
        </div>
        </FormSection>

        {format !== "script" && <PosterWords value={posterWords} onChange={setPosterWords} />}
        {format !== "script" && <LogoPicker {...logo} />}
        <PictureFold summary={pictureSummary({
          format, writer: pick.short, painter: paints.modelId ? paints.short : null,
          person: person ? people.find((p) => p.id === person.id)?.name : undefined,
        })}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">โมเดลเขียน</span>
          <select value={writer} onChange={(e) => onWriter(e.target.value)} className={field}>
            <option value={AUTO}>อัตโนมัติ</option>
            {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.short}</option>)}
          </select>
        </label>

        {format !== "script" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">ภาพประกอบ</span>
            <select value={painter} onChange={(e) => onPainter(e.target.value)} className={field}>
              <option value={AUTO}>อัตโนมัติ</option>
              {PAINTERS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.thb > 0 ? ` · ฿${p.thb.toFixed(2)} ต่อภาพ` : ""}</option>)}
            </select>
            <span className="mt-1 block text-xs text-[var(--ct-mute)]">
              {painter === AUTO
                ? `ตอนนี้${paints.modelId ? `วาดด้วย ${paints.short}` : "ไม่วาดภาพ"} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะหยุดวาดเอง`
                : painter === "none" ? "ใช้พื้นสีตามโทน วาดทีหลังได้ในหน้าแก้ไข" : `${paints.short} · AI วาดภาพบรรยากาศการทำงานให้ทุกชิ้นหลังเขียนเสร็จ`}
            </span>
          </label>
        )}

        {format !== "script" && painter !== "none" && (
          <div>
            <PersonPicker people={people} value={person} onChange={onPerson} back={workbenchHref({ page: logo.page })} />
            {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ราวภาพละ ฿2.4</span>}
          </div>
        )}

        {format !== "script" && painter !== "none" && <PictureBrief value={brief} onChange={onBrief} asPerson={Boolean(person)} />}
        </PictureFold>
      </div>

      {/* the press, its count and its price stay in reach, as on the plan form */}
      <PressBar
        count={count} max={MAX_THANKS_PIECES} onCount={setCount} unit={unit}
        onPress={create} disabled={pending || Boolean(blocked)}
        label={pending
          ? `กำลังเขียน ${making} ${unit}… (ราว 20–40 วินาที)`
          : `สร้าง${format === "post" ? "โพสต์" : "สคริปต์"}${THANKS_NAME} ${count} ${unit}`}
        note={blocked ?? (quota ? quota.text : `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`)}
        topUp={!blocked && Boolean(quota?.topUp)}
        warning={blocked ? null : overBudget(Number(estimate), left)}
      />
    </>
  );
}
