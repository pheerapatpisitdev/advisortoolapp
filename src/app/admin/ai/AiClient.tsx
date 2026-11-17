"use client";
import { useState, useTransition } from "react";
import {
  checkKeys, saveApiKey, saveRenderKey, setProviderEnabled, saveSettings, resetSpend,
  type KeyRow, type ModelRow, type VideoKeyRow, type ProviderCheck, type Result, type Settings,
} from "./actions";
import { PROVIDER_LABEL } from "./labels";
import { Button, Group, GroupLabel, Item, ProviderMark, Said, SectionHead, Sheet, Switch, fieldClass } from "./kit/parts";

/**
 * /admin/ai's keys, budget and premium-table sections, in settings-kit's look (owner chose ข,
 * 2026-11-18, mockup https://claude.ai/artifact/J3GD1YGtWCU9WTiovgeoDP). The actions are the ones the
 * page used before; only how they are laid out changed.
 *
 * The keys: each company a chip (those with a key first, a dot saying how it stands), the rest behind
 * "อีก N รายการ". A chip opens the company's card: paste a key, switch it off, see the last test, and
 * what the system uses it for.
 */

/** What the last save said, and where on the page it belongs: each message sits beside the button that caused it. */
type Note = { where: string; ok: boolean; text: string };

function NoteAt({ note, where, className = "" }: { note?: Note; where: string; className?: string }) {
  if (!note || note.where !== where) return null;
  return <Said ok={note.ok} text={note.text} className={className} />;
}

/**
 * The result of the last test, or "ยังไม่ได้ทดสอบ". The reason a failure gives is shown rather than
 * summarised: an expired key and a provider briefly down want different things done about them.
 */
function Status({ check }: { check?: ProviderCheck }) {
  const chip = "inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  if (!check) return <span className="text-xs text-[var(--bot-ink-faint)]">ยังไม่ได้ทดสอบ</span>;
  if (check.state === "ok") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className={`${chip} bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]`}>ใช้ได้</span>
        <span className="text-xs tabular-nums text-[var(--bot-ink-faint)]">{(check.ms / 1000).toFixed(1)}s</span>
        {check.note && <span className="basis-full text-xs text-[var(--bot-ink-mute)]">{check.note}</span>}
      </span>
    );
  }
  if (check.state === "no-key") return <span className="text-xs text-[var(--bot-ink-faint)]">ยังไม่ได้ตั้งกุญแจ</span>;
  if (check.state === "no-model") return <span className={`${chip} bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]`}>ไม่มีโมเดล</span>;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`${chip} self-start bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]`}>หยุดทำงาน</span>
      {check.error && <span className="break-words text-xs leading-tight text-[var(--bot-red-ink)]">{check.error}</span>}
    </span>
  );
}

/** asked before Google Cloud Run is switched off: its key drives far more than clips (owner chose ข, 2026-11-11) */
const GCP_OFF_CONFIRM = "ปิด Google Cloud Run ใช่ไหม?\n\nงานเหล่านี้จะหยุดทั้งเว็บจนกว่าจะเปิดอีกครั้ง:\n• ทำวิดีโอทุกแบบ\n• เสียงพากย์ Gemini ทาง Cloud\n• การ์ดสรุป ตาราง และ PDF ใบเสนอ รวมถึงรูปที่บอทส่งให้ลูกค้า";

const GCP = "gcp";
const nameOf = (p: string) => (p === GCP ? "Google Cloud Run" : PROVIDER_LABEL[p] ?? p);

/** where each company's keys are made */
const SITE: Record<string, string> = {
  anthropic: "console.anthropic.com", openai: "platform.openai.com", google: "aistudio.google.com", zai: "z.ai",
  elevenlabs: "elevenlabs.io", openrouter: "openrouter.ai", gcp: "console.cloud.google.com",
};

/** what the system uses a company for beyond its rows in the model table */
const EXTRA_USES: Record<string, Record<string, string[]>> = {
  google: { เสียง: ["เสียงพากย์ Gemini (API)"] },
  elevenlabs: { เสียง: ["เสียงพากย์คลิป (อ้อม / สมชาย)"] },
  gcp: { วิดีโอ: ["ทำวิดีโอทุกแบบ (Remotion · ตัดต่อคลิป)"], เสียง: ["เสียงพากย์ Gemini ทาง Cloud"], การ์ด: ["การ์ดสรุป ตาราง และ PDF ใบเสนอ"] },
};
const KIND_LABEL: Record<string, string> = { text: "ข้อความ", image: "รูปภาพ", judge: "ตัดสิน" };

/** how a chip's dot reads: on and fine, switched off, or failing the last test */
type Dot = "ok" | "off" | "bad";
const DOT: Record<Dot, { color: string; label: string }> = {
  ok: { color: "bg-[var(--bot-ok)]", label: "เชื่อมต่อแล้ว" },
  off: { color: "bg-[var(--bot-line-strong)]", label: "ปิดอยู่" },
  bad: { color: "bg-[var(--bot-red)]", label: "ทดสอบล่าสุดไม่ผ่าน" },
};

export function KeysSection({ keys, providers, models, video }: {
  keys: KeyRow[]; providers: string[]; models: ModelRow[]; video: { keys: VideoKeyRow[] };
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note>();
  const [busy, setBusy] = useState<string>();
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  /** What the last test said, until the page is reloaded; nothing is guessed before one is run. */
  const [checks, setChecks] = useState<ProviderCheck[]>();
  const [testing, setTesting] = useState(false);
  const checkOf = (p: string) => checks?.find((c) => c.provider === p);

  const gcpHeld = video.keys.find((k) => k.provider === GCP);
  /** every company on the page with what it holds: the AI companies, then Google Cloud Run */
  const all = [
    ...providers.map((p) => {
      const k = keys.find((x) => x.provider === p);
      return { id: p, held: Boolean(k), shown: k ? `•••• ${k.tail}` : null, on: k?.enabled ?? true };
    }),
    { id: GCP, held: Boolean(gcpHeld), shown: gcpHeld?.shown ?? null, on: gcpHeld?.enabled ?? true },
  ];
  const dotOf = (p: (typeof all)[number]): Dot => (!p.on ? "off" : checkOf(p.id)?.state === "failed" ? "bad" : "ok");
  const held = all.filter((p) => p.held);
  const notHeld = all.filter((p) => !p.held);

  const run = (where: string, fn: () => Promise<Result>, ok: string, after?: () => void) => {
    setNote(undefined);
    setBusy(where);
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          setNote({ where, ok: true, text: ok });
          after?.();
        } else {
          setNote({ where, ok: false, text: res.error });
        }
      } catch {
        setNote({ where, ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
      } finally {
        setBusy(undefined);
      }
    });
  };

  const testAll = async () => {
    setTesting(true);
    setNote(undefined);
    try {
      setChecks(await checkKeys());
    } catch {
      setNote({ where: "test", ok: false, text: "ทดสอบไม่สำเร็จ — ลองใหม่อีกครั้ง" });
    } finally {
      setTesting(false);
    }
  };

  const chip = (p: (typeof all)[number]) => {
    const dot = DOT[dotOf(p)];
    return (
      <button
        key={p.id} type="button" onClick={() => { setNote(undefined); setOpen(p.id); }}
        className={`inline-flex h-10 items-center gap-2 rounded-full border bg-[var(--bot-surface)] px-3.5 text-sm transition hover:border-[var(--bot-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bot-navy)] ${
          p.held ? "border-[var(--bot-line-strong)] text-[var(--bot-ink)]" : "border-[var(--bot-line)] text-[var(--bot-ink-mute)]"
        }`}
      >
        <ProviderMark id={p.id} size={16} />
        {nameOf(p.id)}
        {p.held && <span className={`h-2 w-2 rounded-full ${dot.color}`} role="img" aria-label={dot.label} title={dot.label} />}
      </button>
    );
  };

  const shown = all.find((p) => p.id === open) ?? null;
  const tested = checks ? `ตอบได้ ${checks.filter((c) => c.state === "ok").length} จาก ${checks.length} ค่าย` : null;

  return (
    <>
      <SectionHead title="กุญแจของค่าย AI" hint="กดชื่อค่ายเพื่อวางกุญแจ ปิดชั่วคราว หรือดูผลทดสอบ กุญแจเก็บแยกจากระบบอื่น เข้ารหัสไว้ในฐานข้อมูล แสดงเฉพาะ 4 ตัวท้าย" />
      <div className="mb-8 flex flex-wrap gap-2">
        {held.map(chip)}
        {more && notHeld.map(chip)}
        {notHeld.length > 0 && (
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)}
                  className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-[var(--bot-ink-faint)] hover:text-[var(--bot-ink)]">
            {more ? "น้อยลง ‹" : `อีก ${notHeld.length} รายการ ›`}
          </button>
        )}
      </div>
      <Group>
        <Item
          title="ทดสอบกุญแจทั้งหมด"
          description={tested ?? "ส่งคำถามสั้นๆ ไปทุกค่ายเพื่อดูว่ากุญแจไหนยังใช้ได้ ราคาไม่ถึงหนึ่งสตางค์ (Google Cloud Run แค่ถามสิทธิ์ ไม่ได้สั่งงาน)"}
          control={<><NoteAt note={note} where="test" /><Button disabled={testing} onClick={testAll}>{testing ? "กำลังทดสอบ…" : "ทดสอบ"}</Button></>}
        />
        <Item
          title="ยอดใช้ของแต่ละค่าย"
          description="ค่าใช้จ่ายและงานที่แต่ละค่ายทำ อยู่ที่หน้าการใช้งานและค่า AI"
          control={<a href="/admin/stats?tab=provider" className="text-sm text-[var(--bot-navy)] underline-offset-2 hover:underline">ไปที่ตามค่าย AI →</a>}
        />
      </Group>

      {shown && (
        <Sheet label={nameOf(shown.id)} onClose={() => setOpen(null)}>
          {shown.id === GCP
            ? <GcpCard held={shown} pending={pending} busy={busy} note={note} check={checkOf(GCP)} run={run} />
            : <ProviderCard p={shown} models={models} pending={pending} busy={busy} note={note} check={checkOf(shown.id)} run={run} />}
        </Sheet>
      )}
    </>
  );
}

type Held = { id: string; held: boolean; shown: string | null; on: boolean };
type Run = (where: string, fn: () => Promise<Result>, ok: string, after?: () => void) => void;

function Identity({ p, action }: { p: Held; action?: React.ReactNode }) {
  const site = SITE[p.id];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--bot-band)]"><ProviderMark id={p.id} size={24} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-[var(--bot-ink)]">{nameOf(p.id)}</div>
          {site && <a href={`https://${site}`} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--bot-ink-mute)] hover:text-[var(--bot-navy)]">{site} ↗</a>}
        </div>
        {action}
      </div>
      <p className="text-sm text-[var(--bot-ink-mute)]">
        {p.held
          ? <><span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${p.on ? "bg-[var(--bot-ok)]" : "bg-[var(--bot-line-strong)]"}`} />{p.on ? "เชื่อมต่อแล้ว" : "ปิดอยู่"} · <span className="font-mono text-[13px]">{p.shown}</span></>
          : <><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--bot-line)] align-middle" />ยังไม่ได้ตั้งกุญแจ</>}
      </p>
    </>
  );
}

function Uses({ uses }: { uses: Record<string, string[]> }) {
  const kinds = Object.entries(uses).filter(([, v]) => v.length);
  if (!kinds.length) return null;
  return (
    <div>
      <GroupLabel>ระบบใช้ค่ายนี้ทำ</GroupLabel>
      <div className="divide-y divide-[var(--bot-line)] border-y border-[var(--bot-line)]">
        {kinds.map(([kind, names]) => (
          <div key={kind} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
            <span className="w-20 shrink-0 text-sm text-[var(--bot-ink)]">{kind}</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {names.map((n) => <span key={n} className="rounded-md bg-[var(--bot-band)] px-2 py-0.5 text-[13px] text-[var(--bot-ink-mute)]">{n}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ p, models, pending, busy, note, check, run }: {
  p: Held; models: ModelRow[]; pending: boolean; busy?: string; note?: Note; check?: ProviderCheck; run: Run;
}) {
  const [adding, setAdding] = useState(!p.held);
  const [draft, setDraft] = useState("");
  const where = `key:${p.id}`;
  const uses: Record<string, string[]> = { ...(EXTRA_USES[p.id] ?? {}) };
  for (const m of models.filter((x) => x.provider === p.id)) {
    const k = KIND_LABEL[m.kind] ?? m.kind;
    uses[k] = [...(uses[k] ?? []), m.model_name];
  }
  const save = () => run(where, () => saveApiKey(p.id, draft), `บันทึกกุญแจ ${nameOf(p.id)} แล้ว`, () => { setDraft(""); setAdding(false); });

  return (
    <>
      <Identity p={p} action={!adding && <Button variant="quiet" onClick={() => setAdding(true)}>วางกุญแจใหม่</Button>} />
      {adding && (
        <form className="flex flex-wrap gap-2 rounded-xl border border-[var(--bot-line)] p-3" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !pending) save(); }}>
          <input
            type="password" autoComplete="off" spellCheck={false} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder={`วางกุญแจ API ของ ${nameOf(p.id)}`} aria-label={`กุญแจ ${nameOf(p.id)}`}
            className={`min-w-0 flex-1 basis-56 font-mono placeholder:font-sans ${fieldClass}`}
          />
          {p.held && <Button variant="quiet" onClick={() => { setAdding(false); setDraft(""); }}>ยกเลิก</Button>}
          <Button type="submit" variant="primary" disabled={pending || !draft.trim()}>{busy === where ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </form>
      )}
      <NoteAt note={note} where={where} />
      {p.held && (
        <Group>
          <Item
            title="ใช้งาน" description={p.on ? "ปิดเพื่อหยุดเรียกค่ายนี้ โดยไม่ต้องลบกุญแจ" : "เปิดเพื่อให้ระบบเรียกค่ายนี้ได้อีก"}
            control={<Switch checked={p.on} disabled={pending} label={`ใช้งาน ${nameOf(p.id)}`}
                             onChange={(next) => run(where, () => setProviderEnabled(p.id, next), `${next ? "เปิด" : "ปิด"} ${nameOf(p.id)} แล้ว`)} />}
          />
          <Item title="ทดสอบล่าสุด" description="กดทดสอบกุญแจทั้งหมดที่หน้ากุญแจเพื่อดูผลใหม่" control={<Status check={check} />} />
        </Group>
      )}
      <Uses uses={uses} />
      <p className="text-xs text-[var(--bot-ink-faint)]">กุญแจเก็บแยกจากระบบอื่น เข้ารหัสไว้ในฐานข้อมูล แสดงเฉพาะ 4 ตัวท้าย</p>
    </>
  );
}

/** Google Cloud Run: the service account file is pasted whole, region and job typed beside it */
function GcpCard({ held, pending, busy, note, check, run }: {
  held: Held; pending: boolean; busy?: string; note?: Note; check?: ProviderCheck; run: Run;
}) {
  const [adding, setAdding] = useState(!held.held);
  const [draft, setDraft] = useState("");
  const [gcp, setGcp] = useState({ region: "asia-southeast1", job: "clip-ffmpeg" });
  const where = "render:gcp";
  const save = () => run(where, async () => {
    const res = await saveRenderKey("gcp", draft, gcp);
    setDraft(""); // the pasted key does not stay on screen, saved or refused
    return res;
  }, "บันทึกกุญแจ Google Cloud Run แล้ว", () => setAdding(false));

  return (
    <>
      <Identity p={held} action={!adding && <Button variant="quiet" onClick={() => setAdding(true)}>วางไฟล์ JSON ใหม่</Button>} />
      {adding && (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--bot-line)] p-3">
          <textarea
            placeholder="วางไฟล์ Service Account (JSON)" autoComplete="off" spellCheck={false} rows={4} autoFocus aria-label="ไฟล์ Service Account (JSON)"
            className="min-w-0 rounded-lg border border-[var(--bot-line)] bg-[var(--bot-band)] p-2.5 font-mono text-xs text-[var(--bot-ink)] outline-none focus:border-[var(--bot-navy)]"
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--bot-ink-mute)]">region
              <input className={`w-40 ${fieldClass}`} value={gcp.region} onChange={(e) => setGcp({ ...gcp, region: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--bot-ink-mute)]">job
              <input className={`w-32 ${fieldClass}`} value={gcp.job} onChange={(e) => setGcp({ ...gcp, job: e.target.value })} />
            </label>
            <span className="flex-1" />
            {held.held && <Button variant="quiet" onClick={() => { setAdding(false); setDraft(""); }}>ยกเลิก</Button>}
            <Button variant="primary" disabled={pending || !draft.trim()} onClick={save}>{busy === where ? "กำลังบันทึก…" : "บันทึก"}</Button>
          </div>
        </div>
      )}
      <NoteAt note={note} where={where} />
      {held.held && (
        <Group>
          <Item
            title="ใช้งาน"
            description={held.on ? "ปิดเพื่อหยุดทุกงานที่ใช้ Google Cloud Run โดยไม่ต้องลบกุญแจ" : "เปิดเพื่อให้ระบบเรียก Google Cloud Run ได้อีก"}
            control={<Switch checked={held.on} disabled={pending} label="ใช้งาน Google Cloud Run" onChange={(next) => {
              if (!next && !window.confirm(GCP_OFF_CONFIRM)) return;
              run(where, () => setProviderEnabled("gcp", next), `${next ? "เปิด" : "ปิด"} Google Cloud Run แล้ว`);
            }} />}
          />
          <Item title="ทดสอบล่าสุด" description="ถามสิทธิ์อย่างเดียว ไม่ได้สั่งงาน" control={<Status check={check} />} />
        </Group>
      )}
      <Uses uses={EXTRA_USES.gcp} />
      <p className="text-xs text-[var(--bot-ink-faint)]">ปิดแล้ว งานทั้งหมดข้างบนหยุดทั้งเว็บจนกว่าจะเปิดอีกครั้ง หน้านี้แสดงแค่โปรเจกต์ region และ job ของกุญแจ</p>
    </>
  );
}

export function BudgetSection({ settings, spentThisMonth, content }: {
  settings: Settings | null; spentThisMonth: number | null; content: { spent: number | null; cap: number; fallback: number };
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note>();
  const [busy, setBusy] = useState<string>();
  const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const budget = settings?.monthly_budget_thb != null ? Number(settings.monthly_budget_thb) : null;

  const run = (where: string, fn: () => Promise<Result>, ok: string) => {
    setNote(undefined);
    setBusy(where);
    start(async () => {
      try {
        const res = await fn();
        setNote(res.ok ? { where, ok: true, text: ok } : { where, ok: false, text: res.error });
      } catch {
        setNote({ where, ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
      } finally {
        setBusy(undefined);
      }
    });
  };
  const box = `w-32 text-right tabular-nums ${fieldClass}`;

  return (
    <>
      <SectionHead title="งบต่อเดือน" hint="เพดานค่า AI ของทั้งระบบ ตัวหลักและตัวสำรองของแต่ละงานตั้งที่ลำดับหลักและสำรอง" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          // sent as typed: the server reads the numbers, and says in Thai what it refused
          run("settings", () => saveSettings(String(f.get("budget") ?? ""), String(f.get("contentBudget") ?? "")), "บันทึกงบแล้ว");
        }}
      >
        <Group>
          <Item
            title="งบต่อเดือน (บาท)"
            description={<>
              {spentThisMonth === null
                ? <span className="text-[var(--bot-red-ink)]">อ่านยอดใช้ไม่สำเร็จ</span>
                : <>เดือนนี้ใช้ไป <b className="tabular-nums text-[var(--bot-ink)]">฿{baht(spentThisMonth)}</b></>}
              {/* `!= null`, not truthiness: a stored 0 is a ฿0 ceiling that stops the bot, not "no budget" */}
              {budget == null
                ? " (ไม่จำกัดงบ)"
                : budget <= 0
                  ? <span className="text-[var(--bot-red-ink)]"> · งบ ฿{baht(budget)} — ระบบหยุดเรียก AI ทั้งหมด</span>
                  : <> จากงบ ฿{baht(budget)}{spentThisMonth !== null && <> ({Math.round((spentThisMonth / budget) * 100)}%)</>}</>}
              {" · "}เว้นว่าง = ไม่จำกัด
            </>}
            // step "any": a step of 50 made the browser refuse ฿120 and block the whole form
            control={<input name="budget" id="ai-budget" aria-label="งบต่อเดือน (บาท)" type="number" inputMode="decimal" min={0} step="any"
                            defaultValue={settings?.monthly_budget_thb ?? ""} placeholder="ไม่จำกัด" className={box} />}
          />
          {/* a slice of the budget above: the bot answering leads draws on the rest */}
          <Item
            title="งบสร้างคอนเทนต์ต่อเดือน (บาท)"
            description={<>
              Studio โพสต์ บรีฟคลิป แผนประกัน · เว้นว่าง = ฿{content.fallback.toLocaleString("th-TH")} ·{" "}
              {content.spent === null ? "อ่านยอดใช้ไม่สำเร็จ" : <>ใช้ไป {baht(content.spent)} จาก {content.cap.toLocaleString("th-TH")} บาท</>}
            </>}
            control={<input name="contentBudget" id="ai-content-budget" aria-label="งบสร้างคอนเทนต์ต่อเดือน (บาท)" type="number" inputMode="decimal" min={0} step="any"
                            defaultValue={settings?.content_budget_thb ?? ""} placeholder={`${content.fallback}`} className={box} />}
          />
          <Item
            title="บันทึกงบ"
            control={<><NoteAt note={note} where="settings" /><Button type="submit" variant="primary" disabled={pending}>{busy === "settings" ? "กำลังบันทึก…" : "บันทึก"}</Button></>}
          />
        </Group>
      </form>

      <GroupLabel>เริ่มนับใหม่</GroupLabel>
      <Group>
        <Item
          title="รีเซ็ตยอด"
          description={<>
            เริ่มนับยอดใช้ใหม่จากศูนย์ตั้งแต่ตอนนี้ ประวัติการเรียก AI ไม่ถูกลบ
            {settings?.spend_reset_at && <span className="block text-xs text-[var(--bot-ink-faint)]">นับตั้งแต่รีเซ็ต {new Date(settings.spend_reset_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}</span>}
          </>}
          control={<>
            <NoteAt note={note} where="reset" />
            <Button disabled={pending} onClick={() => {
              if (!window.confirm("รีเซ็ตยอดใช้ AI เป็น ฿0 ใช่ไหม?\n\nยอดเดือนนี้และการเช็กงบจะเริ่มนับใหม่ตั้งแต่ตอนนี้ (ประวัติเดิมยังอยู่ ไม่ถูกลบ) และกลับมาใช้ได้ถ้าเคยหยุดเพราะงบเต็ม")) return;
              run("reset", resetSpend, "รีเซ็ตยอดแล้ว — เริ่มนับใหม่จาก ฿0");
            }}>{busy === "reset" ? "กำลังรีเซ็ต…" : "รีเซ็ตยอด"}</Button>
          </>}
        />
      </Group>
    </>
  );
}

/** the premium tables in force: the overview's warning when they near their end leads here (/admin/ai#rates) */
export function RatesSection({ rates }: { rates: { version: string; expiresOn: string; daysLeft: number; expired: boolean } }) {
  const tone = rates.expired ? "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]" : rates.daysLeft <= 30 ? "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" : "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]";
  return (
    <>
      <SectionHead title="ตารางเบี้ย" hint="ชุดตารางเบี้ยที่หน้าคำนวณและบอทใช้อยู่ เปลี่ยนชุดได้ด้วยการอัปเดตระบบเท่านั้น" />
      <Group>
        <Item
          title={`ชุด ${rates.version}`}
          description={`ใช้ได้ถึง ${rates.expiresOn}`}
          control={<span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
            {rates.expired ? "หมดอายุแล้ว ขอชุดใหม่จากบริษัท" : `เหลืออีก ${rates.daysLeft.toLocaleString("th-TH")} วัน`}
          </span>}
        />
      </Group>
    </>
  );
}
