"use client";
import { useState } from "react";
import type { PiecePerson } from "@/lib/content/people";
import { PAINTERS } from "@/lib/content/models";
import { MAX_HEADLINE, MAX_SUB, MAX_TOPIC, SIZES, STYLES, type Idea, type ThumbSize, type ThumbStyle } from "@/lib/content/thumbnail";
import type { ThumbCheck, ThumbSettings, Thumbnail } from "@/lib/content/thumbnail-history";
import { PersonPicker, type PersonOption } from "../PersonPicker";

/** the cover on show: one just made, or one opened from the history */
interface Shown { id?: string; url: string; settings: ThumbSettings; check: ThumbCheck | null; model: string; costThb: number; note?: string }

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-50 ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const btn = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "text-sm font-medium";
const ratio = (s: ThumbSize) => (s === "9:16" ? "9 / 16" : "16 / 9");
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

const PAINTER_CHOICES = PAINTERS.filter((p) => p.modelId);

export function ThumbnailBoard({ people, initial }: { people: PersonOption[]; initial: Thumbnail[] | null }) {
  const [size, setSize] = useState<ThumbSize>("9:16");
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [source, setSource] = useState<"ai" | "person">("ai");
  const [person, setPerson] = useState<PiecePerson | null>(null);
  const [style, setStyle] = useState<ThumbStyle>("bold");
  const [scene, setScene] = useState("");
  const [painter, setPainter] = useState("gemini");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [items, setItems] = useState<Thumbnail[] | null>(initial);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const settings = (): ThumbSettings => ({
    size, style, headline, sub, scene, source, personId: source === "person" ? person?.id ?? null : null, pose: person?.pose ?? "auto",
  });
  const needsPerson = source === "person" && !person;
  const ready = headline.trim().length > 0 && !needsPerson && !busy;

  async function askIdeas() {
    setIdeasBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content-thumbnail/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic }) });
      const data = await res.json().catch(() => null) as { ok?: boolean; ideas?: Idea[]; error?: string } | null;
      if (data?.ok && data.ideas) setIdeas(data.ideas);
      else setError(data?.error ?? "AI คิดหัวปกไม่สำเร็จ ลองกดอีกครั้งนะครับ");
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้งนะครับ");
    } finally {
      setIdeasBusy(false);
    }
  }

  async function make() {
    setBusy(true);
    setError(null);
    const used = settings();
    try {
      const res = await fetch("/api/content-thumbnail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: used, painter }) });
      const data = await res.json().catch(() => null) as
        | { ok: true; dataUrl: string; check: ThumbCheck; model: string; costThb: number; saved: boolean; id?: string; note?: string }
        | { ok: false; error: string } | null;
      if (!data || !data.ok) {
        setError(data && !data.ok ? data.error : "สร้างภาพปกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
        return;
      }
      setShown({ id: data.id, url: data.dataUrl, settings: used, check: data.check, model: data.model, costThb: data.costThb, note: data.note });
      if (data.saved && data.id) {
        const added: Thumbnail = { id: data.id, createdAt: new Date().toISOString(), settings: used, check: data.check, model: data.model, costThb: data.costThb, imageUrl: data.dataUrl };
        setItems((list) => (list === null ? list : [added, ...list.filter((i) => i.id !== added.id)]));
      }
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ หรือใช้เวลานานเกินไป ลองใหม่อีกครั้งนะครับ");
    } finally {
      setBusy(false);
    }
  }

  function reuse(s: ThumbSettings) {
    setSize(s.size); setStyle(s.style); setHeadline(s.headline); setSub(s.sub); setScene(s.scene);
    setSource(s.source); setPerson(s.personId ? { id: s.personId, pose: s.pose } : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/content-thumbnail/${id}`, { method: "DELETE" });
      const ok = res.ok;
      setDeleteFailed(!ok);
      if (ok) {
        setItems((list) => (list ? list.filter((i) => i.id !== id) : list));
        setShown((s) => (s?.id === id ? null : s));
      }
    } catch {
      setDeleteFailed(true);
    }
  }

  const checkLine = (c: ThumbCheck | null) => {
    if (!c) return null;
    return c.issues.length === 0
      ? <p className="text-sm text-[var(--ct-accent)]">✓ ตัวหนังสือถูกต้อง</p>
      : (
        <div role="status" className="text-sm text-[var(--ct-alert)]">
          {c.issues.map((i) => <p key={i}>⚠ {i}</p>)}
          {c.read && <p className="mt-1 whitespace-pre-line text-[var(--ct-mute)]">AI เขียนว่า: {c.read}</p>}
          <p className="mt-1 text-[var(--ct-mute)]">ภาพนี้ใช้ได้เลยถ้าคุณเห็นว่าถูก หรือกดสร้างอีกภาพ</p>
        </div>
      );
  };

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="space-y-2" aria-label="ขนาด">
          <span className={label}>ขนาดภาพปก</span>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {SIZES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={size === s.id} onClick={() => setSize(s.id)} className={chip(size === s.id)}>
                {s.label} <span className="text-xs opacity-70">{s.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2" aria-label="หัวข้อและหัวปก">
          <label htmlFor="th-topic" className={label}>หัวข้อคลิป หรือสคริปต์</label>
          <textarea id="th-topic" value={topic} onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC))} rows={4} className={field} placeholder="เช่น ป่วยหนัก 1 ครั้ง ค่ารักษาเท่าไหร่ ประกันช่วยได้แค่ไหน" />
          <button type="button" className={btn} disabled={ideasBusy || !topic.trim()} onClick={askIdeas}>{ideasBusy ? "กำลังคิด…" : "ให้ AI คิดหัวปก"}</button>
          {ideas.length > 0 && (
            <ul className="space-y-1.5">
              {ideas.map((i) => (
                <li key={i.headline + i.sub}>
                  <button type="button" onClick={() => { setHeadline(i.headline); setSub(i.sub); }} className="w-full rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-3 py-2 text-left text-sm hover:bg-[var(--ct-soft)]">
                    <span className="font-medium">{i.headline}</span>
                    {i.sub && <span className="block text-xs text-[var(--ct-mute)]">{i.sub}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor="th-headline" className={`${label} block pt-1`}>หัวปก <span className="text-xs font-normal text-[var(--ct-mute)]">บรรทัดใหญ่ ({headline.length}/{MAX_HEADLINE})</span></label>
          <input id="th-headline" value={headline} maxLength={MAX_HEADLINE} onChange={(e) => setHeadline(e.target.value)} className={field} />
          <label htmlFor="th-sub" className={`${label} block`}>บรรทัดรอง <span className="text-xs font-normal text-[var(--ct-mute)]">ไม่ใส่ก็ได้ ({sub.length}/{MAX_SUB})</span></label>
          <input id="th-sub" value={sub} maxLength={MAX_SUB} onChange={(e) => setSub(e.target.value)} className={field} />
        </section>

        <section className="space-y-2" aria-label="ภาพหลัก">
          <span className={label}>ภาพหลัก</span>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            <button type="button" role="radio" aria-checked={source === "ai"} onClick={() => setSource("ai")} className={chip(source === "ai")}>AI สร้างทั้งภาพ</button>
            <button type="button" role="radio" aria-checked={source === "person"} onClick={() => setSource("person")} className={chip(source === "person")}>รูปตัวเอง</button>
          </div>
          {source === "person" && <PersonPicker people={people} value={person} onChange={setPerson} back="/studio/thumbnail" />}
          {needsPerson && people.length > 0 && <p className="text-xs text-[var(--ct-mute)]">เลือกบุคคลจากคลังก่อน</p>}
        </section>

        <section className="space-y-2" aria-label="สไตล์">
          <span className={label}>สไตล์ปก</span>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {(Object.keys(STYLES) as ThumbStyle[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={style === k} onClick={() => setStyle(k)} className={chip(style === k)}>{STYLES[k].label}</button>
            ))}
          </div>
        </section>

        <details className="rounded-lg border border-[var(--ct-hair)] px-3 py-2" open={scene.length > 0}>
          <summary className="min-h-9 cursor-pointer py-1 text-sm font-medium">เขียน prompt เอง <span className="text-xs font-normal text-[var(--ct-mute)]">ใช้แทนฉากที่ระบบคิดให้</span></summary>
          <textarea value={scene} onChange={(e) => setScene(e.target.value.slice(0, 2500))} rows={4} className={`${field} mt-2`} aria-label="prompt บรรยายฉาก" placeholder="บรรยายภาพที่ต้องการ ภาษาไทยหรืออังกฤษก็ได้ ระบบยังเติมตัวหนังสือ ขนาด และหน้าคนให้เอง" />
        </details>

        <section className="space-y-2" aria-label="โมเดล">
          <span className={label}>โมเดลวาดรูป</span>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {PAINTER_CHOICES.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={painter === p.id} onClick={() => setPainter(p.id)} className={chip(painter === p.id)}>
                {p.short} <span className="text-xs opacity-70">฿{p.thb.toFixed(2)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--ct-mute)]">Gemini ได้ขนาดตรงเป๊ะ รุ่น GPT วาดได้ใกล้เคียงแล้วระบบตัดขอบให้ ถ้ามีรูปคนจะใช้ Gemini เสมอ</p>
        </section>

        <div>
          <button type="button" onClick={make} disabled={!ready} className="min-h-11 w-full rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "กำลังสร้างภาพปก… (ราว 30–60 วินาที)" : "สร้างภาพปก"}
          </button>
          {error && <p role="alert" className="mt-2 text-sm text-[var(--ct-alert)]">{error}</p>}
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <section aria-label="ผลลัพธ์" aria-live="polite">
          {!shown && <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-sm text-[var(--ct-mute)]">ภาพปกที่สร้างจะแสดงที่นี่</div>}
          {shown && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data link just made, or a signed link to a private file */}
              <img src={shown.url} alt={`ภาพปก: ${shown.settings.headline}`} style={{ aspectRatio: ratio(shown.settings.size) }} className={`rounded-xl border border-[var(--ct-hair)] object-cover ${shown.settings.size === "9:16" ? "max-h-[70vh] w-auto max-w-full" : "w-full"}`} />
              {checkLine(shown.check)}
              <p className="text-xs text-[var(--ct-mute)]">{shown.model} · ใช้ไป ฿{shown.costThb.toFixed(2)}</p>
              {shown.note && <p className="text-sm text-[var(--ct-mute)]">{shown.note}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={shown.url} download={`cover-${shown.settings.size.replace(":", "x")}.jpg`} className={`${btn} inline-flex items-center`}>ดาวน์โหลด</a>
                <button type="button" className={btn} disabled={busy || needsPerson || !headline.trim()} onClick={make}>สร้างอีกภาพ</button>
                <button type="button" className={btn} onClick={() => reuse(shown.settings)}>ใช้ค่าชุดนี้</button>
              </div>
            </div>
          )}
        </section>

        <section aria-label="ประวัติ">
          <h2 className="text-base font-semibold">ประวัติ</h2>
          {deleteFailed && <p role="alert" className="mt-2 text-sm text-[var(--ct-alert)]">ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ</p>}
          {items === null && <p className="mt-2 text-sm text-[var(--ct-mute)]">เปิดประวัติไม่ได้ในตอนนี้ ลองโหลดหน้าใหม่อีกครั้งนะครับ</p>}
          {items && items.length === 0 && <p className="mt-2 text-sm text-[var(--ct-mute)]">ยังไม่มีประวัติ ภาพปกที่สร้างแล้วจะเก็บไว้ที่นี่</p>}
          {items && items.length > 0 && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-2">
                  <button
                    type="button" className="block rounded-lg text-left hover:opacity-90" aria-label={`เปิดภาพปก: ${item.settings.headline}`}
                    onClick={() => { if (item.imageUrl) { setShown({ id: item.id, url: item.imageUrl, settings: item.settings, check: item.check, model: item.model, costThb: item.costThb }); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
                  >
                    {item.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element -- a signed link to a private file
                      ? <img src={item.imageUrl} alt="" style={{ aspectRatio: ratio(item.settings.size) }} className="max-h-56 w-full rounded-lg object-cover" />
                      : <span aria-hidden="true" style={{ aspectRatio: ratio(item.settings.size) }} className="block max-h-56 w-full rounded-lg bg-[var(--ct-soft)]" />}
                  </button>
                  <p className="mt-2 line-clamp-2 text-sm">{item.settings.headline}</p>
                  <p className="text-xs text-[var(--ct-mute)]">{item.settings.size} · {when(item.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.imageUrl && <a href={item.imageUrl} download className={`${btn} inline-flex items-center`}>ดาวน์โหลด</a>}
                    <button type="button" className={btn} onClick={() => reuse(item.settings)}>ใช้ค่าชุดนี้</button>
                    <button type="button" className={btn} onClick={() => { if (window.confirm("ลบภาพปกนี้?")) remove(item.id); }}>ลบ</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
