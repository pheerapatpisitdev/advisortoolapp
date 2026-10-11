"use client";
import { useMemo, useState, useTransition } from "react";
import { teachable } from "@/lib/assistant/lessons";
import { deleteNote, setNoteEnabled } from "../knowledge/actions";
import { ConfirmDelete } from "../knowledge/ConfirmDelete";
import { listTaught, teachLesson, updateTaught, type Taught } from "./actions";
import type { PageChoice } from "./TestChat";

/**
 * คำตอบที่สอนไว้: every row of ins_faq, the taught answers (บังคับตอบ) and the notes the model
 * reads alike, so the owner keeps one list. Searched and filtered here in the browser; every
 * change goes to the server and the row moves only once it is saved.
 */

type Mode = "all" | "strict" | "note";

const field = "w-full rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--bot-navy)]";
const small = "rounded border border-[var(--bot-line-strong)] px-2 py-1 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 0)} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  return `${Math.round(hours / 24)} วันที่แล้ว`;
}

export function TaughtList({ initial, pages }: { initial: Taught[]; pages: PageChoice[] }) {
  const [rows, setRows] = useState(initial);
  const [find, setFind] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [rowError, setRowError] = useState<{ id: string; text: string }>();
  const [pending, start] = useTransition();
  const pageName = (id: string | null) => (id ? pages.find((p) => p.id === id)?.name ?? "เพจที่เลิกเชื่อมแล้ว" : "ทุกเพจและ LINE");

  const shown = useMemo(() => {
    const words = find.trim().toLowerCase();
    return rows.filter((r) => (mode === "all" || (mode === "strict") === r.strict)
      && (!words || [r.question, r.answer, ...r.phrasings].some((t) => t.toLowerCase().includes(words))));
  }, [rows, find, mode]);

  async function reload() {
    const res = await listTaught();
    if (res.ok) setRows(res.rows);
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="taught-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="ค้นหาคำถามหรือคำตอบ…"
          className={`${field} min-w-[12rem] flex-1`}
        />
        <select
          id="taught-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}
          className="rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-2 text-sm"
        >
          <option value="all">ทุกแบบ</option>
          <option value="strict">บังคับตอบ</option>
          <option value="note">ให้ AI อ้างอิง</option>
        </select>
        <button
          type="button" onClick={() => { setAdding(true); setEditing(undefined); }}
          className="rounded-lg bg-[var(--bot-navy)] px-3 py-2 text-sm text-[var(--bot-surface)]"
        >
          + สอนคำถามใหม่
        </button>
      </div>

      {adding && (
        <Editor
          pages={pages}
          initial={{ question: "", answer: "", phrasings: [], pageId: null, strict: true }}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            const res = await teachLesson(v);
            if (!res.ok) return res.error;
            setAdding(false);
            await reload();
          }}
        />
      )}

      <p className="text-xs text-[var(--bot-ink-mute)]">
        “บังคับตอบ” บอทส่งคำตอบนี้ทุกคำเมื่อลูกค้าถามคำถามนี้ · “ให้ AI อ้างอิง” AI อ่านแล้วเรียบเรียงเอง
        · แสดง {shown.length} จาก {rows.length} รายการ
      </p>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--bot-line)] px-3 py-6 text-center text-sm text-[var(--bot-ink-mute)]">
          {rows.length ? "ไม่พบรายการที่ตรงกับคำค้น" : "ยังไม่มีคำตอบที่สอนไว้ ลองสอนจากแท็บแชททดลอง หรือกด + สอนคำถามใหม่"}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--bot-line)] rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)]">
          {shown.map((r) => (
            <li key={r.id} className="px-4 py-3">
              {editing === r.id ? (
                <Editor
                  pages={pages}
                  initial={r}
                  onCancel={() => setEditing(undefined)}
                  onSave={async (v) => {
                    const res = await updateTaught(r.id, v);
                    if (!res.ok) return res.error;
                    setEditing(undefined);
                    await reload();
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <div className={`min-w-0 flex-1 ${r.enabled ? "" : "opacity-45"}`}>
                    <p className="text-sm font-medium">{r.question}</p>
                    {r.phrasings.length > 0 && (
                      <p className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">หรือ: {r.phrasings.join(" · ")}</p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--bot-ink-foot)]">{r.answer}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem] text-[var(--bot-ink-mute)]">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${r.strict ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]"}`}>
                        {r.strict ? "บังคับตอบ" : "ให้ AI อ้างอิง"}
                      </span>
                      <span>{pageName(r.pageId)}</span>
                      {r.strict && <span>ใช้ไป {r.hits.toLocaleString("en-US")} ครั้ง{r.lastHitAt ? ` · ล่าสุด ${ago(r.lastHitAt)}` : ""}</span>}
                      {!r.enabled && <span>ปิดใช้งานอยู่</span>}
                    </div>
                    {rowError?.id === r.id && <p className="mt-1 text-xs text-[var(--bot-red-ink)]">{rowError.text}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button type="button" className={small} onClick={() => { setEditing(r.id); setAdding(false); }}>แก้</button>
                    <button
                      type="button" disabled={pending} className={small}
                      onClick={() => {
                        setRowError(undefined);
                        start(async () => {
                          const res = await setNoteEnabled(r.id, !r.enabled);
                          if (!res.ok) { setRowError({ id: r.id, text: res.error }); return; }
                          setRows((list) => list.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
                        });
                      }}
                    >
                      {r.enabled ? "ปิด" : "เปิด"}
                    </button>
                    <ConfirmDelete
                      what="คำตอบนี้"
                      onConfirm={() => deleteNote(r.id)}
                      onDone={() => setRows((list) => list.filter((x) => x.id !== r.id))}
                      trigger="ลบ"
                      triggerClass="rounded border border-[var(--bot-red)] px-2 py-1 text-xs text-[var(--bot-red-ink)] hover:bg-[var(--bot-red-soft)]"
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Draft { question: string; answer: string; phrasings: string[]; pageId: string | null; strict: boolean }

function Editor({ pages, initial, onCancel, onSave }: {
  pages: PageChoice[];
  initial: Draft;
  onCancel: () => void;
  /** resolves to an error to show, or nothing once saved */
  onSave: (v: Draft) => Promise<string | void>;
}) {
  const [q, setQ] = useState(initial.question);
  const [a, setA] = useState(initial.answer);
  const [more, setMore] = useState(initial.phrasings.join("\n"));
  const [pageId, setPageId] = useState(initial.pageId ?? "");
  const [strict, setStrict] = useState(initial.strict);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const numbered = strict && q.trim() !== "" && !teachable(q);

  return (
    <div className="grid gap-2.5">
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        เมื่อลูกค้าถามว่า
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} className={field} />
      </label>
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        ลูกค้าอาจพิมพ์แบบอื่น (บรรทัดละแบบ)
        <textarea value={more} onChange={(e) => setMore(e.target.value)} rows={2} className={field} />
      </label>
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        ให้บอทตอบว่า
        <textarea value={a} onChange={(e) => setA(e.target.value)} maxLength={2000} rows={4} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={strict} onChange={() => setStrict(true)} /> บังคับตอบ</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={!strict} onChange={() => setStrict(false)} /> ให้ AI อ้างอิง</label>
        <select
          value={pageId} onChange={(e) => setPageId(e.target.value)}
          className="rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1.5 text-sm"
        >
          <option value="">ทุกเพจและ LINE</option>
          {pages.filter((p) => !p.expat).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {numbered && (
        <p className="text-xs text-[var(--bot-sand-ink)]">คำถามนี้มีตัวเลข ใช้แบบบังคับตอบไม่ได้ เลือก “ให้ AI อ้างอิง” แทน</p>
      )}
      {error && <p className="text-xs text-[var(--bot-red-ink)]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button" disabled={pending || numbered || !q.trim() || !a.trim()}
          onClick={() => {
            setError(undefined);
            start(async () => {
              const err = await onSave({ question: q, answer: a, phrasings: more.split("\n"), pageId: pageId || null, strict });
              if (err) setError(err);
            });
          }}
          className="rounded-lg bg-[var(--bot-navy)] px-3 py-1.5 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-[var(--bot-ink-mute)] hover:bg-[var(--bot-band)]">ยกเลิก</button>
      </div>
    </div>
  );
}
