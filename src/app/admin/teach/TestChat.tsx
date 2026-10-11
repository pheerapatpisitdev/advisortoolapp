"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { teachable } from "@/lib/assistant/lessons";
import type { AnySlots } from "@/lib/assistant/slots";
import { reportProblem, saveBotTest, teachLesson, tryBot, type Tried } from "./actions";
import { TESTS_CHANGED } from "./TestsList";

/**
 * The test chat: one Page's inbox, played by the owner as the customer.
 *
 * The conversation lives only here, in the browser — history and slots are sent with each
 * message and the server keeps nothing, which is what keeps the owner's tries out of the
 * customers' transcripts and leads.
 */

export interface PageChoice { id: string; name: string; expat: boolean }

type Turn =
  | { role: "user"; text: string }
  | { role: "bot"; tried: Tried; slotsBefore: AnySlots | null };

const CAME_FROM: { value: string; label: string }[] = [
  { value: "", label: "พิมพ์เอง (ไม่ได้มาจากโฆษณา)" },
  { value: "lifeprotect", label: "โฆษณา Life Protect" },
  { value: "ishield", label: "โฆษณา iShield" },
  { value: "ihealthy", label: "โฆษณาประกันสุขภาพ" },
  { value: "legacy", label: "โฆษณามรดก (Legacy)" },
  { value: "plb", label: "โฆษณา PLB" },
];

const SOURCE: Record<Tried["source"], { label: string; cls: string }> = {
  taught: { label: "ตอบตามที่สอน", cls: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" },
  rules: { label: "ตอบตามกฎ", cls: "bg-[var(--bot-navy-soft)] text-[var(--bot-navy)]" },
  model: { label: "ใช้ AI", cls: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" },
};

const field = "w-full rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--bot-navy)]";

/** what the bot remembers of its own turn: its words, as the inbox keeps them */
const spoken = (t: Tried) => t.messages.map((m) => m.text).filter(Boolean).join("\n");

/**
 * `question` opens the teaching panel on its own, for a question brought from elsewhere — the
 * unanswered list in /admin/crm links here with it — before anything has been said in the chat.
 */
export function TestChat({ pages, question }: { pages: PageChoice[]; question?: string }) {
  const [pageId, setPageId] = useState(pages.find((p) => !p.expat)?.id ?? pages[0].id);
  const [cameFor, setCameFor] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [slots, setSlots] = useState<AnySlots | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [teaching, setTeaching] = useState<number>();
  const [brought, setBrought] = useState(question?.trim() || undefined);
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const page = pages.find((p) => p.id === pageId)!;

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [turns.length, pending]);

  function restart() {
    setTurns([]); setSlots(null); setError(undefined); setTeaching(undefined); setBrought(undefined); setSaving(false);
  }

  /** Sends `text` after `before`, from the slots the bot had at that point. */
  function ask(text: string, before: Turn[] = turns, from: AnySlots | null = slots) {
    const said = text.trim();
    if (!said || pending) return;
    setError(undefined);
    const asked: Turn[] = [...before, { role: "user", text: said }];
    setTurns(asked);
    setDraft("");
    start(async () => {
      const history = asked.map((t) => (t.role === "user"
        ? { role: "user" as const, content: t.text }
        : { role: "assistant" as const, content: spoken(t.tried) }));
      const res = await tryBot(history, from, pageId, cameFor || undefined);
      if (!res.ok) { setError(res.error); return; }
      setTurns([...asked, { role: "bot", tried: res.tried, slotsBefore: from }]);
      setSlots(res.tried.slots);
    });
  }

  /** The customer's message the bot turn at `i` answered, and asks it again from there. */
  function askAgain(i: number) {
    const bot = turns[i];
    const user = turns[i - 1];
    if (bot?.role !== "bot" || user?.role !== "user") return;
    setTeaching(undefined);
    ask(user.text, turns.slice(0, i - 1), bot.slotsBefore);
  }

  const lastBot = turns.length - 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
      <section className="flex min-w-0 flex-col rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)]">
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--bot-line)] px-4 py-3">
          <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
            เพจ
            <select
              value={pageId} onChange={(e) => { setPageId(e.target.value); restart(); }}
              className="rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1.5 text-sm text-[var(--bot-ink)]"
            >
              {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
            ลูกค้ามาจาก
            <select
              value={cameFor} onChange={(e) => { setCameFor(e.target.value); restart(); }}
              className="rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1.5 text-sm text-[var(--bot-ink)]"
            >
              {CAME_FROM.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <button
            type="button" onClick={restart} disabled={pending}
            className="rounded-lg border border-[var(--bot-line-strong)] px-3 py-1.5 text-sm hover:bg-[var(--bot-band)] disabled:opacity-40"
          >
            เริ่มใหม่
          </button>
          <button
            type="button" onClick={() => { setSaving(true); setTeaching(undefined); setBrought(undefined); }}
            disabled={pending || !turns.some((t) => t.role === "bot")}
            className="rounded-lg border border-[var(--bot-line-strong)] px-3 py-1.5 text-sm hover:bg-[var(--bot-band)] disabled:opacity-40"
          >
            เก็บเป็นชุดเทส
          </button>
          <span className="text-xs text-[var(--bot-ink-mute)]">ทดลองเท่านั้น · ไม่ส่งถึงลูกค้า</span>
        </div>

        <div className="flex min-h-[360px] flex-col gap-3 px-4 py-4" aria-live="polite">
          {turns.length === 0 && (
            <p className="m-auto max-w-sm text-center text-sm text-[var(--bot-ink-mute)]">
              พิมพ์แบบที่ลูกค้าพิมพ์ เช่น “สนใจค่ะ”, “มรดกเก็บออม 30 บาทต่อวัน” หรือ “ช 45 ทุน 1 ล้าน”
            </p>
          )}
          {turns.map((t, i) => t.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-[var(--bot-navy)] px-3 py-2 text-sm text-[var(--bot-surface)]">
              {t.text}
            </div>
          ) : (
            <div key={i} className="flex max-w-[85%] flex-col items-start gap-1.5">
              {t.tried.messages.map((m, j) => (
                <div key={j} className="flex flex-col items-start gap-1.5">
                  {m.card && (
                    // eslint-disable-next-line @next/next/no-img-element -- a drawn card from our own route, any size
                    <img src={m.card} alt="รูปที่บอทส่ง" loading="lazy" className="w-60 max-w-full rounded-xl border border-[var(--bot-line)]" />
                  )}
                  {m.text && (
                    <div className={`whitespace-pre-wrap rounded-2xl bg-[var(--bot-band)] px-3 py-2 text-sm ${t.tried.source === "taught" ? "ring-2 ring-[var(--bot-ok)]" : ""}`}>
                      {m.text}
                    </div>
                  )}
                  {m.file && (
                    <a href={m.file} target="_blank" rel="noreferrer" className="text-xs text-[var(--bot-navy)] underline">เปิดไฟล์ PDF</a>
                  )}
                </div>
              ))}
              {i === lastBot && t.tried.replies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.tried.replies.map((r) => (
                    <button
                      key={r} type="button" onClick={() => ask(r)} disabled={pending}
                      className="rounded-full border border-[var(--bot-navy)] px-2.5 py-0.5 text-xs text-[var(--bot-navy)] hover:bg-[var(--bot-navy-soft)] disabled:opacity-40"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-[var(--bot-ink-mute)]">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${SOURCE[t.tried.source].cls}`}>{SOURCE[t.tried.source].label}</span>
                {t.tried.model && <span>{t.tried.model}</span>}
                {!page.expat && (
                  <button
                    type="button" onClick={() => { setTeaching(i); setSaving(false); }}
                    className="rounded-full border border-[var(--bot-line-strong)] px-2 py-0.5 text-[var(--bot-navy)] hover:bg-[var(--bot-band)]"
                  >
                    ✎ สอน
                  </button>
                )}
              </div>
            </div>
          ))}
          {pending && <div className="self-start rounded-2xl bg-[var(--bot-band)] px-3 py-2 text-sm text-[var(--bot-ink-mute)]">กำลังพิมพ์…</div>}
          {error && <p className="text-xs text-[var(--bot-red-ink)]">{error}</p>}
          <div ref={end} />
        </div>

        <form
          className="flex gap-2 border-t border-[var(--bot-line)] px-4 py-3"
          onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        >
          <input
            id="teach-say" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000}
            placeholder="พิมพ์แบบลูกค้า…" className={`${field} min-w-0 flex-1`}
          />
          <button
            type="submit" disabled={pending || !draft.trim()}
            className="rounded-lg bg-[var(--bot-navy)] px-4 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
          >
            ส่ง
          </button>
        </form>
      </section>

      {saving ? (
        <SaveTest
          says={turns.flatMap((t, i) => (t.role === "user" && turns[i + 1]?.role === "bot"
            ? [{ say: t.text, said: spoken((turns[i + 1] as { tried: Tried }).tried) }] : []))}
          pageId={pageId}
          cameFor={cameFor}
          onClose={() => setSaving(false)}
        />
      ) : teaching !== undefined && turns[teaching]?.role === "bot" && turns[teaching - 1]?.role === "user" ? (
        <TeachPanel
          key={teaching}
          question={(turns[teaching - 1] as { text: string }).text}
          answer={spoken((turns[teaching] as { tried: Tried }).tried)}
          page={page}
          onClose={() => setTeaching(undefined)}
          onSaved={() => askAgain(teaching)}
        />
      ) : brought ? (
        <TeachPanel
          key={`brought:${brought}`}
          question={brought}
          answer=""
          page={page}
          onClose={() => setBrought(undefined)}
          onSaved={() => { const q = brought; setBrought(undefined); ask(q, [], null); }}
        />
      ) : (
        <aside className="rounded-xl border border-dashed border-[var(--bot-line)] p-4 text-sm text-[var(--bot-ink-mute)]">
          <p className="font-medium text-[var(--bot-ink)]">สอนบอทยังไง</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>กด ✎ สอน ใต้คำตอบที่ไม่ถูกใจ แก้ให้เป็นคำตอบที่ต้องการ แล้วบันทึก</li>
            <li>ลูกค้าถามคำถามนั้น (หรือแบบอื่นที่เพิ่มไว้) บอทจะตอบตามที่สอนทุกคำ</li>
            <li>ข้อความที่มีตัวเลข เช่น อายุ ทุน ระยะจ่าย บอทใช้คิดเบี้ย สอนเป็นคำตอบตายตัวไม่ได้ ให้กด “แจ้งปัญหาให้ทีมแก้”</li>
          </ul>
        </aside>
      )}
    </div>
  );
}

function TeachPanel({ question, answer, page, onClose, onSaved }: {
  question: string; answer: string; page: PageChoice; onClose: () => void; onSaved: () => void;
}) {
  const [q, setQ] = useState(question);
  const [a, setA] = useState(answer);
  const [more, setMore] = useState("");
  const [everyPage, setEveryPage] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const fixed = teachable(q);

  function save() {
    setError(undefined);
    start(async () => {
      const res = await teachLesson({
        question: q, answer: a, phrasings: more.split("\n"), pageId: everyPage ? null : page.id,
      });
      if (!res.ok) { setError(res.error); return; }
      onSaved();
    });
  }

  function report() {
    setError(undefined);
    start(async () => {
      const res = await reportProblem(question, answer, page.id);
      if (!res.ok) { setError(res.error); return; }
      setNote("แจ้งแล้ว ดูได้ที่หน้าลูกค้า แท็บคำถามที่บอทตอบไม่ได้");
    });
  }

  return (
    <aside className="grid gap-3 rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4 lg:sticky lg:top-4" aria-label="สอนบอท">
      <h2 className="text-sm font-semibold">สอนบอท</h2>
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        เมื่อลูกค้าถามว่า
        <input id="teach-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} className={field} />
      </label>
      {!fixed && q.trim() && (
        <p className="rounded-lg bg-[var(--bot-sand-soft)] px-3 py-2 text-xs text-[var(--bot-sand-ink)]">
          ข้อความนี้มีตัวเลข (อายุ ทุน หรือระยะจ่าย) บอทใช้คิดเบี้ยอยู่ ถ้าสอนคำตอบตายตัว ลูกค้าทุกคนจะได้คำตอบเดียวกัน
          ถ้าบอทเลือกแผนผิดหรือคิดผิด กด “แจ้งปัญหาให้ทีมแก้” แทน
        </p>
      )}
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        ให้บอทตอบว่า
        <textarea id="teach-a" value={a} onChange={(e) => setA(e.target.value)} maxLength={2000} rows={6} className={field} />
      </label>
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        ลูกค้าอาจพิมพ์แบบอื่น (บรรทัดละแบบ)
        <textarea id="teach-more" value={more} onChange={(e) => setMore(e.target.value)} rows={3} placeholder={"เช่น\nมีสาขาใกล้บ้านไหม\nอยู่ต่างจังหวัดสมัครได้ไหม"} className={field} />
      </label>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">ใช้กับ</legend>
        <label className="flex items-center gap-1.5"><input type="radio" name="teach-scope" checked={!everyPage} onChange={() => setEveryPage(false)} /> เพจนี้เท่านั้น</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="teach-scope" checked={everyPage} onChange={() => setEveryPage(true)} /> ทุกเพจและ LINE</label>
      </fieldset>
      {error && <p className="text-xs text-[var(--bot-red-ink)]">{error}</p>}
      {note && <p className="text-xs text-[var(--bot-ink-mute)]">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button" onClick={save} disabled={pending || !fixed || !a.trim()}
          className="rounded-lg bg-[var(--bot-navy)] px-3 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกและลองใหม่"}
        </button>
        {answer && <button
          type="button" onClick={report} disabled={pending || Boolean(note)}
          className="rounded-lg border border-[var(--bot-line-strong)] px-3 py-2 text-sm hover:bg-[var(--bot-band)] disabled:opacity-40"
        >
          แจ้งปัญหาให้ทีมแก้
        </button>}
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-[var(--bot-ink-mute)] hover:bg-[var(--bot-band)]">
          ยกเลิก
        </button>
      </div>
    </aside>
  );
}

/**
 * The conversation so far, saved as a test: a name, and for each customer message the words its
 * answer should and should not contain — empty is only "answers at all". Words are separated by
 * commas; the bot's answer this time is shown beside them to copy from.
 */
function SaveTest({ says, pageId, cameFor, onClose }: {
  says: { say: string; said: string }[]; pageId: string; cameFor: string; onClose: () => void;
}) {
  const [name, setName] = useState(says[0]?.say.slice(0, 60) ?? "");
  const [checks, setChecks] = useState(says.map(() => ({ contains: "", not: "" })));
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const split = (v: string) => v.split(/[,，]/).map((w) => w.trim()).filter(Boolean);
  const set = (i: number, k: "contains" | "not", v: string) => setChecks((c) => c.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  function save() {
    setError(undefined);
    start(async () => {
      const res = await saveBotTest(name, pageId, cameFor || null,
        says.map((s, i) => ({ say: s.say, contains: split(checks[i].contains), not: split(checks[i].not) })));
      if (!res.ok) { setError(res.error); return; }
      setDone(true);
      window.dispatchEvent(new Event(TESTS_CHANGED));
    });
  }

  return (
    <aside className="grid max-h-[80vh] gap-3 overflow-y-auto rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4 lg:sticky lg:top-4" aria-label="เก็บเป็นชุดเทส">
      <h2 className="text-sm font-semibold">เก็บเป็นชุดเทส</h2>
      <label className="grid gap-1 text-xs text-[var(--bot-ink-mute)]">
        ชื่อชุดเทส
        <input id="test-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} />
      </label>
      <p className="text-xs text-[var(--bot-ink-mute)]">ใส่คำที่คำตอบ “ควรมี” หรือ “ไม่ควรมี” คั่นด้วยจุลภาค ปล่อยว่างได้ (แค่ต้องตอบ)</p>
      {says.map((s, i) => (
        <div key={i} className="grid gap-1.5 rounded-lg border border-[var(--bot-line)] p-2.5">
          <p className="text-sm"><b>ลูกค้า:</b> {s.say}</p>
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-[var(--bot-ink-mute)]">บอทตอบครั้งนี้: {s.said}</p>
          <input
            id={`test-contains-${i}`} value={checks[i].contains} onChange={(e) => set(i, "contains", e.target.value)}
            placeholder="ควรมีคำว่า เช่น Life Protect, อยากทำประกันเพื่ออะไร" className={field}
          />
          <input
            id={`test-not-${i}`} value={checks[i].not} onChange={(e) => set(i, "not", e.target.value)}
            placeholder="ไม่ควรมีคำว่า เช่น iShield" className={field}
          />
        </div>
      ))}
      {error && <p className="text-xs text-[var(--bot-red-ink)]">{error}</p>}
      {done && <p className="text-xs text-[var(--bot-ok)]">บันทึกแล้ว ดูและรันได้ที่แท็บชุดเทส</p>}
      <div className="flex gap-2">
        <button
          type="button" onClick={save} disabled={pending || done || !name.trim() || !says.length}
          className="rounded-lg bg-[var(--bot-navy)] px-3 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกชุดเทส"}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-[var(--bot-ink-mute)] hover:bg-[var(--bot-band)]">
          {done ? "ปิด" : "ยกเลิก"}
        </button>
      </div>
    </aside>
  );
}
