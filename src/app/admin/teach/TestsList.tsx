"use client";
import { useEffect, useState, useTransition } from "react";
import { ConfirmDelete } from "../knowledge/ConfirmDelete";
import { deleteBotTest, listBotTests, runBotTestNow, type BotTest } from "./actions";
import type { PageChoice } from "./TestChat";

/**
 * ชุดเทส: the conversations the owner saved from the test chat, replayed against the bot as it
 * is now. รันทั้งหมด runs them one after another, each its own request, so the list fills in as
 * they finish and one slow test cannot take the others down with it.
 */

/** the test chat says this when it saves one, so the list here reads the table again */
export const TESTS_CHANGED = "bot-tests-changed";

const CAME_FROM: Record<string, string> = {
  lifeprotect: "โฆษณา Life Protect", ishield: "โฆษณา iShield", ihealthy: "โฆษณาประกันสุขภาพ",
  legacy: "โฆษณามรดก", plb: "โฆษณา PLB",
};
const small = "rounded border border-[var(--bot-line-strong)] px-2 py-1 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

function when(iso: string | null): string {
  if (!iso) return "ยังไม่เคยรัน";
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export function TestsList({ initial, pages }: { initial: BotTest[]; pages: PageChoice[] }) {
  const [tests, setTests] = useState(initial);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string>();
  const [error, setError] = useState<string>();
  const [, start] = useTransition();
  const pageName = (id: string | null) => (id ? pages.find((p) => p.id === id)?.name ?? "เพจที่เลิกเชื่อมแล้ว" : "ไม่ระบุเพจ");

  useEffect(() => {
    const reload = () => start(async () => {
      const res = await listBotTests();
      if (res.ok) setTests(res.tests);
    });
    window.addEventListener(TESTS_CHANGED, reload);
    return () => window.removeEventListener(TESTS_CHANGED, reload);
  }, []);

  async function runOne(id: string) {
    setRunning((s) => new Set(s).add(id));
    const res = await runBotTestNow(id);
    setRunning((s) => { const n = new Set(s); n.delete(id); return n; });
    if (!res.ok) { setError(res.error); return; }
    setTests((list) => list.map((t) => (t.id === id ? res.test : t)));
    if (!res.test.lastOk) setOpen(id);
  }

  async function runAll() {
    setError(undefined);
    for (const t of tests) await runOne(t.id);
  }

  const ran = tests.filter((t) => t.lastOk !== null);
  const passed = ran.filter((t) => t.lastOk).length;
  const busy = running.size > 0;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={() => void runAll()} disabled={busy || !tests.length}
          className="rounded-lg bg-[var(--bot-navy)] px-3 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {busy ? `กำลังรัน… (${running.size})` : "▶ รันทั้งหมด"}
        </button>
        {ran.length > 0 && (
          <span className="text-sm">
            ผ่าน <b className="text-[var(--bot-ok)]">{passed}</b> / {ran.length}
            {passed < ran.length && <> · ตก <b className="text-[var(--bot-red-ink)]">{ran.length - passed}</b></>}
          </span>
        )}
        <span className="text-xs text-[var(--bot-ink-mute)]">ข้อความที่บอทต้องใช้ AI ตอบ มีค่าใช้จ่ายเหมือนลูกค้าจริง</span>
      </div>
      {error && <p className="text-xs text-[var(--bot-red-ink)]">{error}</p>}

      {tests.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--bot-line)] px-3 py-6 text-center text-sm text-[var(--bot-ink-mute)]">
          ยังไม่มีชุดเทส คุยในแท็บแชททดลอง แล้วกด “เก็บเป็นชุดเทส”
        </p>
      ) : (
        <ul className="divide-y divide-[var(--bot-line)] rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)]">
          {tests.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">
                    {pageName(t.pageId)} · {t.cameFor ? CAME_FROM[t.cameFor] ?? t.cameFor : "พิมพ์เอง"} · {t.turns.map((x) => x.say).join(" → ")}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${running.has(t.id) ? "text-[var(--bot-ink-mute)]" : t.lastOk === null ? "text-[var(--bot-ink-mute)]" : t.lastOk ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
                  {running.has(t.id) ? "กำลังรัน…" : t.lastOk === null ? "—" : t.lastOk ? "✓ ผ่าน" : "✗ ตก"}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" className={small} disabled={running.has(t.id)} onClick={() => { setError(undefined); void runOne(t.id); }}>รัน</button>
                  <button type="button" className={small} disabled={!t.lastResult} onClick={() => setOpen(open === t.id ? undefined : t.id)}>
                    {open === t.id ? "ซ่อน" : "ดู"}
                  </button>
                  <ConfirmDelete
                    what={`ชุดเทส ${t.name}`}
                    onConfirm={() => deleteBotTest(t.id)}
                    onDone={() => setTests((list) => list.filter((x) => x.id !== t.id))}
                    trigger="ลบ"
                    triggerClass="rounded border border-[var(--bot-red)] px-2 py-1 text-xs text-[var(--bot-red-ink)] hover:bg-[var(--bot-red-soft)]"
                  />
                </div>
              </div>
              {open === t.id && t.lastResult && (
                <div className="mt-3 grid gap-2">
                  <p className="text-xs text-[var(--bot-ink-mute)]">รันล่าสุด {when(t.lastRunAt)}</p>
                  {t.lastResult.turns.map((r, i) => (
                    <div key={i} className={`grid gap-1 rounded-lg px-3 py-2 text-xs ${r.ok ? "bg-[var(--bot-band)]" : "bg-[var(--bot-red-soft)]"}`}>
                      <span><b>{r.ok ? "✓" : "✗"} ลูกค้า:</b> {r.say}</span>
                      {r.missing.length > 0 && <span className="text-[var(--bot-red-ink)]">ควรมีคำว่า: {r.missing.map((w) => `“${w}”`).join(", ")}</span>}
                      {r.unwanted.length > 0 && <span className="text-[var(--bot-red-ink)]">ไม่ควรมีคำว่า: {r.unwanted.map((w) => `“${w}”`).join(", ")}</span>}
                      <span className="whitespace-pre-wrap text-[var(--bot-ink-foot)]"><b>บอทตอบ:</b> {r.said || "(ไม่ได้ตอบ)"}</span>
                    </div>
                  ))}
                  {t.lastResult.error && <p className="text-xs text-[var(--bot-red-ink)]">หยุดที่ {t.lastResult.error}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
