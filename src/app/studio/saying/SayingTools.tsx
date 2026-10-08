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
  MAX_SAYING_OWN, MAX_SAYING_PIECES, MAX_SAYING_TOPIC, MAX_SAYING_WHO, SAYING_NAME, SAYING_TONES, SAYING_TOPICS, sayingTones,
} from "@/lib/content/saying";
import type { GenerateResult } from "../actions";
import { sayingRound } from "../draw";
import { PersonPicker, type PersonOption } from "../PersonPicker";
import { PictureBrief } from "../ui/PictureBrief";
import { PosterWords, type PosterWordsValue } from "../ui/PosterWords";
import { cleanPosterWords } from "@/lib/content/poster-words";
import { FormatPicker, FormSection, LoopToggle, overBudget, PictureFold, PressBar, pictureSummary, FormulaPicker, useFormula, useLoop } from "../ui/form-parts";

/**
 * คำคม's tools (owner, 2026-10-09): let the AI write a saying from a topic, or type one's own and
 * who said it; set the round, press สร้าง. The caption ties the saying gently to being prepared
 * and sells nothing (saying.ts).
 */

/** the saying's reader is its own, as the recruit form's is */
const READER_KEY = "content-saying-reader";
/** a saying is a post or a clip: it sells nothing, so it is never an ad */
const FORMATS: Format[] = ["post", "script"];

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function SayingTools({ writer, onWriter, painter, onPainter, people, person, onPerson, brief, onBrief, logo, rounds, left, pending, making, run, folded, formId }: {
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
  const [source, setSource] = useState<"topic" | "own">("topic");
  const [topic, setTopic] = useState<string>(SAYING_TOPICS[0].id);
  const [custom, setCustom] = useState("");
  const [own, setOwn] = useState("");
  const [who, setWho] = useState("");
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

  const blocked = source === "own"
    ? (!own.trim() ? "พิมพ์คำคมก่อน" : null)
    : (topic === "custom" && !custom.trim() ? "พิมพ์หัวข้อ หรือเลือกจากรายการ" : null);

  const pick = writerOf(writer, left);
  // a person in the picture is drawn by Gemini whatever was picked, at Gemini's price
  const paints = painterFor(painter, left, Boolean(person));
  const drawn = format === "script" ? 0 : paints.thb * count;
  const estimate = (count * (pick.thb + OVERHEAD_THB) + drawn).toFixed(2);
  const unit = "ชิ้น";

  async function create() {
    if (pending || blocked) return;
    // the form as it was at the press, whatever changes while the round is out
    const round = { source, topic, custom: custom.trim(), own: own.trim(), who: who.trim(), reader: reader.trim(), tone, format, length, loop: format === "script" && loop, formula, count, writer,
      ...(format !== "script" && logo.spot ? { logoSpot: logo.spot } : {}),
      ...(format !== "script" && cleanPosterWords(posterWords) ? { posterWords: cleanPosterWords(posterWords) } : {}), page: logo.page };
    const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
    await run(count, round.format, () => sayingRound(round), paintWith, person, brief.trim());
  }

  const quota = rounds ? roundsNote(rounds, estimate) : null;

  return (
    <>
      <div id={formId} className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>
        <div role="group" aria-labelledby={`${id}-source`}>
          <span id={`${id}-source`} className="mb-1.5 block text-sm font-medium">คำคมจากไหน</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={source === "topic"} onClick={() => setSource("topic")} className={chip(source === "topic")}>ให้ AI เขียน</button>
            <button type="button" aria-pressed={source === "own"} onClick={() => setSource("own")} className={chip(source === "own")}>พิมพ์คำคมเอง</button>
          </div>
        </div>

        {source === "topic" ? (
          <div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">หัวข้อ</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                {SAYING_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                <option value="custom">พิมพ์เอง…</option>
              </select>
            </label>
            {topic === "custom" && (
              <label className="mt-2 block">
                <span className="sr-only">หัวข้อ (พิมพ์เอง)</span>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAX_SAYING_TOPIC} placeholder="เช่น ความกล้าที่จะเริ่มต้นใหม่" className={field} />
              </label>
            )}
            <p className="mt-1.5 text-xs text-[var(--ct-mute)]">AI แต่งคำคมใหม่ ไม่ยกคำของคนดัง แคปชันโยงเบาๆ เรื่องการเตรียมพร้อม ไม่ขายประกัน — ระบบตรวจให้ทุกชิ้น</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">คำคม <span className="font-normal text-[var(--ct-mute)]">({[...own].length}/{MAX_SAYING_OWN} ตัวอักษร)</span></span>
              <textarea value={own} onChange={(e) => setOwn(e.target.value)} maxLength={MAX_SAYING_OWN} rows={2} placeholder="เช่น เตรียมไว้วันนี้ เพื่อวันที่ไม่ต้องกังวล" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">คำคมของใคร <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <input value={who} onChange={(e) => setWho(e.target.value)} maxLength={MAX_SAYING_WHO} placeholder="เช่น ชื่อคนพูด หรือเว้นว่างไว้" className={field} />
            </label>
            <p className="text-xs text-[var(--ct-mute)]">ใช้คำคมตามที่พิมพ์ทุกตัวอักษร AI เขียนเฉพาะแคปชัน ถ้ายกคำของคนอื่น ใส่ชื่อให้ถูกนะครับ</p>
          </div>
        )}

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
          <span className="mb-1 block text-sm font-medium">เขียนให้ใครอ่าน <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ระบบจำไว้ให้)</span></span>
          <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="เช่น คนทำงานวัยสร้างครอบครัว" className={field} />
        </label>

        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">วิธีเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={field}>
              <option value="">ให้ AI เลือก</option>
              {SAYING_TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">
            {tone && count > 1 ? `ทุก${unit}ใช้วิธีเล่าที่เลือก เปิดเรื่องต่างกัน` : sayingTones(tone, count).map((t) => t.label).join(" · ")}
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
        count={count} max={MAX_SAYING_PIECES} onCount={setCount} unit={unit}
        onPress={create} disabled={pending || Boolean(blocked)}
        label={pending
          ? `กำลังเขียน ${making} ${unit}… (ราว 20–40 วินาที)`
          : `สร้าง${format === "post" ? "โพสต์" : "สคริปต์"}${SAYING_NAME} ${count} ${unit}`}
        note={blocked ?? (quota ? quota.text : `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`)}
        topUp={!blocked && Boolean(quota?.topUp)}
        warning={blocked ? null : overBudget(Number(estimate), left)}
      />
    </>
  );
}
