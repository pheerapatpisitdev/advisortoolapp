"use client";
import { useEffect, useId, useState } from "react";
import type { LogoSpot } from "@/lib/content/logo";
import { LogoPicker } from "../ui/LogoPicker";
import { AUTO, AUTO_FLOOR_THB, OVERHEAD_THB, PAINTERS, WRITERS, painterFor, writerOf } from "@/lib/content/models";
import type { PiecePerson } from "@/lib/content/people";
import { LENGTHS, MAX_READER, type Format, type Length } from "@/lib/content/prompt";
import { DRAFT_STYLES, MAX_DRAFT, MAX_DRAFT_PIECES } from "@/lib/content/draft";
import type { GenerateResult } from "../actions";
import { draftRound } from "../draw";
import { PersonPicker, type PersonOption } from "../PersonPicker";
import { FormatPicker, FormSection, LoopToggle, overBudget, PictureFold, PressBar, pictureSummary, ProToggle, useLoop, usePro } from "../ui/form-parts";

/** เขียนเอง's tools (owner, 2026-09-29): the agent's draft and how many versions to polish it into (draft.ts). */

const READER_KEY = "content-draft-reader";

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function DraftTools({ writer, onWriter, painter, onPainter, people, person, onPerson, logo, rounds, left, pending, making, run, folded, formId }: {
  writer: string;
  onWriter: (id: string) => void;
  painter: string;
  onPainter: (id: string) => void;
  people: PersonOption[];
  /** the Page's logo and its spot, shared with the plan form (ui/LogoPicker.tsx) */
  logo: { page?: string; spot: LogoSpot | null; onSpot: (s: LogoSpot | null) => void };
  person: PiecePerson | null;
  onPerson: (p: PiecePerson | null) => void;
  /** the month's content money left, for the estimate and for อัตโนมัติ */
  left: number;
  /** the agent's own AI rounds this month; null for staff (src/lib/auth/quota.ts) */
  rounds?: { used: number; limit: number } | null;
  pending: boolean;
  making: number;
  /** `paintWith` and `who` are the painter and person at the press; the page draws each new poster's picture with them */
  run: (asked: number, format: Format, send: () => Promise<GenerateResult>, paintWith: string, who: PiecePerson | null) => Promise<void>;
  /** a phone's form folded away after a round: the fields go, the press stays in reach */
  folded?: boolean;
  /** the id the page's ตั้งค่าการสร้าง button controls */
  formId?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
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
  const [pro, setPro] = usePro();
  const [count, setCount] = useState(1);

  const blocked = !draft.trim() ? "พิมพ์ร่างก่อน" : null;

  const pick = writerOf(writer, left);
  // a person in the picture is drawn by Gemini whatever was picked, at Gemini's price
  const paints = painterFor(painter, left, Boolean(person));
  const drawn = format === "script" ? 0 : paints.thb * count;
  const estimate = (count * (pick.thb + OVERHEAD_THB) + drawn).toFixed(2);
  const unit = format === "ad" ? "แบบ" : "เวอร์ชัน";

  async function create() {
    if (pending || blocked) return;
    // the form as it was at the press, whatever changes while the round is out
    const round = { draft: draft.trim(), reader: reader.trim(), format, length, loop: format === "script" && loop, pro: format !== "ad" && pro, count, writer,
      ...(format !== "script" && logo.spot ? { logoSpot: logo.spot } : {}), page: logo.page };
    const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
    await run(count, round.format, () => draftRound(round), paintWith, person);
  }

  return (
    <>
      <div id={formId} className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>
        <label className="block">
          <span className="mb-1 flex justify-between text-sm font-medium">
            <span>ร่างของคุณ</span>
            <span className="text-xs font-normal text-[var(--ct-mute)]">{[...draft].length}/{MAX_DRAFT}</span>
          </span>
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_DRAFT} rows={7}
            placeholder="พิมพ์เรื่องที่อยากโพสต์ได้เลย ภาษาพูดก็ได้ AI จะเกลาให้ โดยไม่เพิ่มข้อมูลหรือตัวเลขที่คุณไม่ได้เขียน"
            className={`${field} min-h-40 leading-relaxed`}
          />
        </label>

        <FormatPicker value={format} onChange={setFormat} />

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
        {format !== "ad" && <ProToggle value={pro} onChange={setPro} />}

        <FormSection title="เรื่องที่เล่า">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">คนอ่าน <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ระบบจำไว้ให้)</span></span>
            <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="เช่น พ่อแม่ลูกเล็ก หรือคนเพิ่งเริ่มทำงาน" className={field} />
          </label>
          <p className="text-xs text-[var(--ct-mute)]">เวอร์ชันในรอบนี้: {DRAFT_STYLES.slice(0, count).map((s) => s.label).join(" · ")}</p>
        </FormSection>

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
                : painter === "none" ? "ใช้พื้นสีตามโทน วาดทีหลังได้ในหน้าแก้ไข" : `${paints.short} · AI วาดภาพประกอบให้ทุกชิ้นหลังเขียนเสร็จ`}
            </span>
          </label>
        )}

        {format !== "script" && painter !== "none" && (
          <div>
            <PersonPicker people={people} value={person} onChange={onPerson} back="/studio/write" />
            {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ราวภาพละ ฿2.4</span>}
          </div>
        )}
        </PictureFold>
      </div>

      {/* the press, its count and its price stay in reach, as on the plan form */}
      <PressBar
        count={count} max={MAX_DRAFT_PIECES} onCount={setCount} unit={unit}
        onPress={create} disabled={pending || Boolean(blocked)}
        label={pending
          ? `กำลังเกลา ${making} ${unit}… (ราว 20–40 วินาที)`
          : `เกลา${format === "post" ? "โพสต์" : format === "ad" ? "โฆษณา" : "สคริปต์"} ${count} ${unit}`}
        note={blocked ?? (rounds ? `ราว ฿${estimate} · เดือนนี้สร้างด้วย AI ได้อีก ${Math.max(0, rounds.limit - rounds.used)} จาก ${rounds.limit} ครั้ง` : `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`)}
        warning={blocked ? null : overBudget(Number(estimate), left)}
      />
    </>
  );
}
