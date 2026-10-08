"use client";
import { useId, useRef, useState } from "react";
import { workbenchHref } from "@/lib/content/workbench-link";
import type { LogoSpot } from "@/lib/content/logo";
import { LogoPicker } from "../ui/LogoPicker";
import {
  FACT_LIMIT, MAX_DOCS, MAX_SHOWCASE_CUSTOM, MAX_SHOWCASE_PIECES, SHOWCASE_ANGLES, showcaseAngleLines, type ShowcaseDocRead, type ShowcaseFacts,
} from "@/lib/content/showcase";
import { AUTO, AUTO_FLOOR_THB, OVERHEAD_THB, PAINTERS, WRITERS, painterFor, writerOf } from "@/lib/content/models";
import type { PiecePerson } from "@/lib/content/people";
import { roundsNote, type Rounds } from "@/lib/wallet/note";
import { MAX_PAPERS } from "@/lib/content/poster";
import { LENGTHS, MAX_READER, NICHES, type Format, type Length } from "@/lib/content/prompt";
import type { GenerateResult } from "../actions";
import { PhotoDrop } from "../people/PhotoDrop";
import { PersonPicker, type PersonOption } from "../PersonPicker";
import { PictureBrief } from "../ui/PictureBrief";
import { PosterWords, type PosterWordsValue } from "../ui/PosterWords";
import { cleanPosterWords } from "@/lib/content/poster-words";
import { FormatPicker, FormSection, LoopToggle, overBudget, PictureFold, PressBar, pictureSummary, FormulaPicker, useFormula, useLoop } from "../ui/form-parts";
import { burn, shrink, type Shrunk } from "../claim/redact";

/**
 * โชว์ผลงาน's tools (owner, 2026-10-06), as รีวิวเคลม's are: add the pictures from the app, tick
 * the customer's consent, set the round, press สร้าง. The press reads the pictures, puts the
 * AI's stickers on the ones for the poster (names, and any income figure of the agent's own),
 * and writes; the pieces land in รอตรวจ like any round's. The one check left — are the stickers
 * enough — is in the editor (ClaimPaperCheck), and a piece with a picture cannot be posted
 * until it is ticked there.
 */
/** a showcase sells nothing, so it is a post or a clip and never an ad */
const FORMATS: Format[] = ["post", "script"];

type ReadOk = { ok: true; costThb: number; facts: ShowcaseFacts; docs: ShowcaseDocRead[] };
type ReadReply = ReadOk | { ok: false; error: string };

/** reading the papers, on top of the writing; Gemini Flash reads six for about ฿0.1 */
const READ_THB = 0.2;

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function ShowcaseTools({ writer, onWriter, painter, onPainter, people, person, onPerson, brief, onBrief, logo, rounds, reader, onReader, left, pending, making, run, folded, formId }: {
  writer: string;
  onWriter: (id: string) => void;
  /** the picture behind the poster, as on the plan form; shared with it and remembered */
  painter: string;
  onPainter: (id: string) => void;
  /** a person from the library in the photograph, as on the plan form; shared with it and remembered */
  people: PersonOption[];
  /** the Page's logo and its spot, shared with the plan form (ui/LogoPicker.tsx) */
  logo: { page?: string; spot: LogoSpot | null; onSpot: (s: LogoSpot | null) => void };
  person: PiecePerson | null;
  onPerson: (p: PiecePerson | null) => void;
  /** บรีฟภาพเพิ่มเติม, shared with the plan form and remembered (ui/PictureBrief.tsx) */
  brief: string;
  onBrief: (next: string) => void;
  /** who the posts talk to — the plan form's, remembered on this device for both */
  reader: string;
  onReader: (r: string) => void;
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
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [format, setFormat] = useState<Format>("post");
  const [length, setLength] = useState<Length>("60");
  const [loop, setLoop] = useLoop();
  const [formula, setFormula] = useFormula();
  /** an angle id, "custom", or "" for ให้ AI เลือก */
  const [angle, setAngle] = useState("");
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState(1);
  const [posterWords, setPosterWords] = useState<PosterWordsValue>({});

  /**
   * The consent is for these papers. It stayed ticked when the photos were swapped for the next
   * customer's, so their papers went out on the last customer's yes; a new photo asks again.
   * Taking one away keeps it — what is left was already agreed to.
   */
  const pickFiles = (next: File[]) => {
    if (next.some((f) => !files.includes(f))) setConsent(false);
    setFiles(next);
  };

  const blocked = files.length === 0 ? "เลือกรูปจากแอปก่อน"
    : !consent ? "ติ๊กยืนยันความยินยอมของลูกค้าก่อน"
      : angle === "custom" && !custom.trim() ? "พิมพ์มุมที่อยากเล่า หรือเลือก “ให้ AI เลือก”" : null;

  const pick = writerOf(writer, left);
  // a person in the picture is drawn by Gemini whatever was picked, at Gemini's price
  const paints = painterFor(painter, left, Boolean(person));
  const drawn = format === "script" ? 0 : paints.thb * count;
  /**
   * The papers as last read. Pressing สร้าง again with the same photos — another round, another
   * format — paid to have them read again; a new photo, or one taken away, reads them afresh.
   */
  const lastRead = useRef<{ papers: File[]; shrunk: Shrunk[]; read: ReadOk } | null>(null);
  const sameAsRead = (list: File[]) => {
    const last = lastRead.current;
    return Boolean(last) && last!.papers.length === list.length && last!.papers.every((f, i) => f === list[i]);
  };
  const estimate = ((sameAsRead(files) ? 0 : READ_THB) + count * (pick.thb + OVERHEAD_THB) + drawn).toFixed(2);
  const unit = "ชิ้น";

  async function create() {
    if (pending || blocked) return;
    // the form as it was at the press, whatever changes while the round is out
    const papers = files;
    const round = { format, length, loop: format === "script" && loop, formula, angle, custom: custom.trim(), reader: reader.trim(), note: note.trim(), count, writer, words: cleanPosterWords(posterWords) };
    // อัตโนมัติ settled at the press, on the money left then, as the plan form does
    const paintWith = round.format === "script" ? "none" : painterFor(painter, left, Boolean(person)).id;
    const pictureBrief = brief.trim();
    const who = person;
    await run(count, round.format, async (): Promise<GenerateResult> => {
      // the same photos read a moment ago: their reading is used again rather than paid for again
      const cached = sameAsRead(papers) ? lastRead.current! : null;
      let shrunk: Shrunk[];
      let read: ReadOk;
      if (cached) {
        shrunk = cached.shrunk;
        read = cached.read;
      } else {
        /*
         * Everything before the last request writes nothing, so a failure there is said as what
         * it is. It used to throw, and the page read every throw as a connection dropped while
         * the pieces were being saved: "ชิ้นงานอาจสร้างเสร็จแล้ว", the tab switched to รอตรวจ,
         * and nothing there — for a photo the browser could not open.
         */
        try {
          shrunk = await Promise.all(papers.map((f) => shrink(f)));
        } catch {
          return { ok: false, error: "เปิดรูปบางรูปไม่ได้ — ลองแคปหน้าจอหรือบันทึกเป็น JPG แล้วเลือกใหม่ (ยังไม่ได้สร้างอะไร)" };
        }
        const readForm = new FormData();
        readForm.set("consent", "on");
        shrunk.forEach((s, i) => readForm.append("docs", s.blob, `doc-${i + 1}.jpg`));
        let reply: ReadReply;
        try {
          const res = await fetch("/api/content-showcase", { method: "POST", body: readForm });
          const body = await res.json().catch(() => null) as ReadReply | null;
          if (!body) {
            return { ok: false, error: res.status === 413 ? "รูปรวมกันใหญ่เกินไป — ลดจำนวนรูปแล้วลองใหม่ (ยังไม่ได้สร้างอะไร)" : "อ่านรูปเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง (ยังไม่ได้สร้างอะไร)" };
          }
          reply = body;
        } catch {
          return { ok: false, error: "ส่งรูปไม่สำเร็จ การเชื่อมต่อหลุด — ลองกดสร้างใหม่ (ยังไม่ได้สร้างอะไร)" };
        }
        if (!reply.ok) return { ok: false, error: reply.error };
        read = reply;
        lastRead.current = { papers, shrunk, read };
      }

      const form = new FormData();
      form.set("consent", "on");
      form.set("facts", JSON.stringify({ ...read.facts, note: round.note }));
      form.set("count", String(round.count));
      form.set("writer", round.writer);
      form.set("format", round.format);
      form.set("length", round.length);
      if (round.loop) form.set("loop", "on");
      if (round.formula) form.set("formula", round.formula);
      if (round.format !== "script" && logo.spot) form.set("logoSpot", logo.spot);
      if (round.format !== "script" && round.words) form.set("posterWords", JSON.stringify(round.words));
      // the project's Page: the round is written into it (2026-09-30)
      if (logo.page) form.set("page", logo.page);
      form.set("angle", round.angle);
      form.set("custom", round.custom);
      form.set("reader", round.reader);
      // a script is spoken: no poster, so no papers. Otherwise up to three on the poster, the
      // receipts and issued policies first (they show the work best), then the rest in the order given —
      // each with the AI's stickers, checked in the editor before anything is posted
      if (round.format !== "script") {
        const shows = (i: number) => Number(read.docs[i]?.kind === "receipt" || read.docs[i]?.kind === "policy");
        const order = shrunk.map((_, i) => i).sort((a, b) => shows(b) - shows(a));
        try {
          for (const at of order.slice(0, MAX_PAPERS)) {
            form.append("paper", await burn(shrunk[at].blob, read.docs[at]?.boxes ?? []), `paper-${at + 1}.jpg`);
            form.append("ratio", String(shrunk[at].width / shrunk[at].height));
          }
        } catch {
          return { ok: false, error: "แปะสติ๊กเกอร์บนรูปไม่สำเร็จ ลองใหม่อีกครั้ง (ยังไม่ได้สร้างอะไร)" };
        }
      }
      // only this one saves: a connection lost here may have left the pieces written, which
      // is what a throw tells the page
      return await (await fetch("/api/content-showcase", { method: "PUT", body: form })).json() as GenerateResult;
    }, paintWith, who, pictureBrief);
  }

  const quota = rounds ? roundsNote(rounds, estimate) : null;

  return (
    <>
      <div id={formId} className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>
        <div>
          <span className="mb-1 block text-sm font-medium">รูปจากแอป <span className="font-normal text-[var(--ct-mute)]">(ไม่เกิน {MAX_DOCS} รูป)</span></span>
          <PhotoDrop files={files} onChange={pickFiles} limit={MAX_DOCS} />
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">ใบเสร็จหรือหลักฐานชำระเบี้ย กรมธรรม์ออกแล้ว อันดับหรือผลงานในแอป · PDF ให้แคปหน้าจอก่อน · AI อ่านทุกรูป แปะสติ๊กเกอร์ปิดชื่อ แล้ววางบนโปสเตอร์ได้ถึง {MAX_PAPERS} ใบ (หนังสืออนุมัติก่อน) · ระบบเก็บเฉพาะรูปที่ปิดข้อมูลแล้ว</p>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>ลูกค้ายินยอมให้ใช้ภาพนี้ลงเพจแล้ว <span className="block text-xs opacity-80">ภาพมีข้อมูลของลูกค้า ต้องได้รับความยินยอมก่อนทุกครั้ง · ระบบถมดำชื่อ และตัวเลขรายได้ของตัวแทนให้ แต่คุณต้องตรวจทุกภาพก่อนลงเพจ</span></span>
        </label>

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
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <select value={angle} onChange={(e) => setAngle(e.target.value)} className={field}>
              <option value="">ให้ AI เลือก</option>
              {SHOWCASE_ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              <option value="custom">พิมพ์เอง…</option>
            </select>
          </label>
          {angle === "custom" && (
            <label className="mt-2 block">
              <span className="sr-only">มุมที่อยากเล่า (พิมพ์เอง)</span>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAX_SHOWCASE_CUSTOM} placeholder="เช่น ลูกค้าได้รับกรมธรรม์เร็วกว่าที่คาด" className={field} />
            </label>
          )}
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">
            {angle && count > 1 && (angle !== "custom" || custom.trim())
              ? `ทุก${unit}เล่ามุมที่เลือก เปิดเรื่องต่างกัน`
              : showcaseAngleLines({ angle, custom }, count).map((a) => a.label).join(" · ")}
          </p>
        </div>

        <div role="group" aria-labelledby={`${id}-reader`}>
          <span id={`${id}-reader`} className="mb-1.5 block text-sm font-medium">คนอ่านคือใคร <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={reader === ""} onClick={() => onReader("")} className={chip(reader === "")}>ทุกคน</button>
            {NICHES.map((n) => (
              <button key={n} type="button" aria-pressed={reader === n} onClick={() => onReader(n)} className={chip(reader === n)}>{n}</button>
            ))}
          </div>
          <label className="mt-2 block">
            <span className="sr-only">คนอ่าน (พิมพ์เอง)</span>
            <input value={reader} onChange={(e) => onReader(e.target.value)} maxLength={MAX_READER} placeholder="หรือพิมพ์เอง เช่น พยาบาลกะดึก" className={field} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">เล่าเพิ่ม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ห้ามใส่ชื่อ)</span></span>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={FACT_LIMIT.note} rows={3}
            placeholder="เช่น ลูกค้าบอกว่าอุ่นใจที่มีคนดูแลหลังการขาย" className={field}
          />
        </label>
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
                : painter === "none" ? "ใช้พื้นสีตามโทน วาดทีหลังได้ในหน้าแก้ไข" : `${paints.short} · AI วาดภาพพื้นหลังหลังรูปเอกสาร ให้ทุกชิ้นหลังเขียนเสร็จ`}
            </span>
          </label>
        )}

        {format !== "script" && painter !== "none" && (
          <div>
            <PersonPicker people={people} value={person} onChange={onPerson} back={workbenchHref({ page: logo.page })} />
            {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ราวภาพละ ฿2.4 · บุคคลยืนด้านขวา เอกสารเลื่อนไปทางซ้ายให้</span>}
          </div>
        )}

        {format !== "script" && painter !== "none" && <PictureBrief value={brief} onChange={onBrief} asPerson={Boolean(person)} papers />}
        </PictureFold>
      </div>

      {/* the press, its count and its price stay in reach, as on the plan form */}
      <PressBar
        count={count} max={MAX_SHOWCASE_PIECES} onCount={setCount} unit={unit}
        onPress={create} disabled={pending || Boolean(blocked)}
        label={pending
          ? `กำลังอ่านรูปและเขียน ${making} ${unit}… (ราว 30–60 วินาที)`
          : `สร้าง${format === "post" ? "โพสต์" : "สคริปต์"}โชว์ผลงาน ${count} ${unit}`}
        note={blocked ?? (quota ? quota.text : `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`)}
        topUp={!blocked && Boolean(quota?.topUp)}
        warning={blocked ? null : overBudget(Number(estimate), left)}
      />
    </>
  );
}
