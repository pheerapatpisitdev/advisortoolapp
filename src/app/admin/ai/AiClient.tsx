"use client";
import { useState, useTransition } from "react";
import { Card, Empty } from "../ui";
import type { VideoSettings } from "@/lib/video/settings";
import type { RenderProvider } from "@/lib/video/render-providers";
import {
  checkKeys, saveApiKey, saveRenderKey, saveVideoEngine, setModelEnabled, setProviderEnabled, saveSettings,
  type KeyRow, type VideoKeyRow, type ModelRow, type ProviderCheck, type ProviderSpend, type Result, type Settings,
} from "./actions";

/**
 * What the last save said, and where on the page it belongs.
 *
 * There was one banner, at the top of the page. The budget form is at the bottom, so on a
 * phone the owner pressed บันทึก, saw nothing move, and could not tell a saved budget from a
 * refused one. Each message now sits beside the button that caused it.
 */
type Note = { where: string; ok: boolean; text: string };

function Said({ note, where, className = "" }: { note?: Note; where: string; className?: string }) {
  if (!note || note.where !== where) return null;
  return (
    <span role="status" className={`text-xs ${note.ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"} ${className}`}>
      {note.ok ? "✓ " : ""}{note.text}
    </span>
  );
}

/**
 * What this provider has cost since the first of the month.
 *
 * A bar as well as a number: five figures in a column are five figures to compare by
 * reading, and the whole question here is which one is the expensive one.
 */
function Spend({ spend, top }: { spend?: ProviderSpend; top: number }) {
  if (!spend || spend.calls === 0) {
    return <span className="w-36 text-xs text-[var(--bot-ink-faint)]">ยังไม่มีค่าใช้จ่าย</span>;
  }
  const per = spend.baht / spend.calls;
  return (
    <span className="w-36 shrink-0" title={`${spend.calls} ครั้ง · ${spend.tasks.join(", ")}`}>
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tabular-nums">฿{spend.baht.toFixed(2)}</span>
        <span className="text-[0.65rem] text-[var(--bot-ink-faint)]">{spend.calls} ครั้ง</span>
      </span>
      <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-[var(--bot-panel)]">
        <span className="block h-full rounded-full bg-[var(--bot-navy)]" style={{ width: `${(spend.baht / top) * 100}%` }} />
      </span>
      <span className="mt-0.5 block text-[0.65rem] text-[var(--bot-ink-faint)]">
        ครั้งละ ฿{per < 0.01 ? "<0.01" : per.toFixed(2)}
      </span>
    </span>
  );
}

/**
 * The result of the last test, or a space where one has not been run.
 *
 * The reason a failure gives is shown rather than summarised. "ตัวไหนหยุดทำงาน" is only half
 * the question — a key that has expired and a provider that is briefly down want different
 * things done about them, and only the provider's own words tell them apart.
 */
function Status({ check }: { check?: ProviderCheck }) {
  if (!check) return <span className="w-28 text-xs text-[var(--bot-ink-faint)]">ยังไม่ได้ทดสอบ</span>;
  const chip = "inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  if (check.state === "ok") {
    return (
      <span className="flex w-28 items-baseline gap-1.5">
        <span className={`${chip} bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]`}>ใช้ได้</span>
        <span className="text-[0.65rem] tabular-nums text-[var(--bot-ink-faint)]">{(check.ms / 1000).toFixed(1)}s</span>
      </span>
    );
  }
  if (check.state === "no-key") return <span className="w-28 text-xs text-[var(--bot-ink-faint)]">ยังไม่ได้ตั้งกุญแจ</span>;
  if (check.state === "no-model") {
    return <span className={`${chip} w-28 bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]`}>ไม่มีโมเดล</span>;
  }
  return (
    <span className="flex w-28 flex-col gap-0.5">
      <span className={`${chip} self-start bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]`}>หยุดทำงาน</span>
      {check.error && <span className="break-words text-[0.65rem] leading-tight text-[var(--bot-red-ink)]">{check.error}</span>}
    </span>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", google: "Google (Gemini)", zai: "Z.ai (GLM)",
  typesafe: "TypeSafe (Jev)",
};

/** How a model's kind reads on the page. A judge answers in probabilities, never in words. */
const KIND_LABEL: Record<string, string> = { text: "ข้อความ", image: "รูปภาพ", judge: "ตัดสิน (ไม่สร้างข้อความ)" };

/** The quality an image row is asked for, so one model at two prices reads as two choices. */
const QUALITY_LABEL: Record<string, string> = { low: "คุณภาพต่ำ", medium: "คุณภาพมาตรฐาน", high: "คุณภาพสูง (คมชัด)" };

export function AiClient({ keys, models, settings, providers, spentThisMonth, spend, content, video }: {
  keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[];
  spentThisMonth: number | null; spend: ProviderSpend[]; content: { spent: number | null; cap: number; fallback: number };
  video: { settings: VideoSettings; keys: VideoKeyRow[] };
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>();
  /** which button is saving, so that one says กำลังบันทึก… and the rest merely wait */
  const [busy, setBusy] = useState<string>();
  const keyOf = (p: string) => keys.find((k) => k.provider === p);
  const tailOf = (p: string) => keyOf(p)?.tail;
  /**
   * What the last test said, until the page is reloaded. Nothing is shown before one is run:
   * a key's health is not knowable without asking, and a guess dressed as a status is worse
   * than an empty column.
   */
  const [checks, setChecks] = useState<ProviderCheck[]>();
  const [testing, setTesting] = useState(false);
  const checkOf = (p: string) => checks?.find((c) => c.provider === p);
  const spendOf = (p: string) => spend.find((s) => s.provider === p);
  /** the busiest line, so the others can be drawn as a share of it */
  const topSpend = Math.max(...spend.map((s) => s.baht), 0.0001);
  const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const textModels = models.filter((m) => m.kind === "text");

  const budget = settings?.monthly_budget_thb != null ? Number(settings.monthly_budget_thb) : null;

  /**
   * Runs one save and says how it went beside `where`. The action answers {ok, error} rather
   * than throwing, so the error is the Thai sentence it wrote; a throw here means the request
   * itself never came back.
   */
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

  const [engine, setEngine] = useState<VideoSettings>(video.settings);
  const input = "rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1";

  return (
    <>
      <Card title="กุญแจของค่าย AI" hint="เก็บแยกจากระบบอื่น เข้ารหัสไว้ในฐานข้อมูล แสดงเฉพาะ 4 ตัวท้าย">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button" disabled={testing}
            className="rounded border border-[var(--bot-line-strong)] px-3 py-1.5 text-xs font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40"
            onClick={async () => {
              setTesting(true);
              setNote(undefined);
              try {
                setChecks(await checkKeys());
              } catch {
                setNote({ where: "test", ok: false, text: "ทดสอบไม่สำเร็จ — ลองใหม่อีกครั้ง" });
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "กำลังทดสอบ…" : "ทดสอบกุญแจทั้งหมด"}
          </button>
          <span className="text-xs text-[var(--bot-ink-mute)]">
            {checks
              ? `ตอบได้ ${checks.filter((c) => c.state === "ok").length} จาก ${checks.length} ค่าย`
              : "ส่งคำถามสั้นๆ ไปทุกค่ายเพื่อดูว่ากุญแจไหนยังใช้ได้ — ราคาไม่ถึงหนึ่งสตางค์"}
          </span>
          <Said note={note} where="test" />
          <span className="ml-auto text-xs text-[var(--bot-ink-mute)]">
            {spentThisMonth === null
              ? <span className="text-[var(--bot-red-ink)]">อ่านยอดใช้ไม่สำเร็จ</span>
              : <>เดือนนี้ใช้ไป <b className="text-sm tabular-nums text-[var(--bot-ink)]">฿{baht(spentThisMonth)}</b></>}
            {/* `!= null`, not truthiness: a stored 0 is a ฿0 ceiling that stops the bot, not "no budget" */}
            {budget == null
              ? " (ไม่จำกัดงบ)"
              : budget <= 0
                ? <span className="text-[var(--bot-red-ink)]"> · งบ ฿{baht(budget)} — ระบบหยุดเรียก AI ทั้งหมด</span>
                : <> จากงบ ฿{baht(budget)}{spentThisMonth !== null && <> ({Math.round((spentThisMonth / budget) * 100)}%)</>}</>}
          </span>
        </div>
        <div className="space-y-2">
          {providers.map((p) => {
            const key = keyOf(p);
            const on = key?.enabled ?? true;
            return (
              <div key={p} className={`flex flex-wrap items-center gap-2 rounded-md border border-[var(--bot-line)] p-2 ${on ? "" : "opacity-60"}`}>
                <span className="w-44 text-sm">{PROVIDER_LABEL[p] ?? p}</span>
                <span className="w-24 text-xs text-[var(--bot-ink-mute)]">{key ? `••••${key.tail}` : "ยังไม่ได้ตั้ง"}</span>
                {/* the switch: off keeps the key and stops every call to this company */}
                <label className={`flex w-20 items-center gap-1.5 text-xs ${key ? "cursor-pointer" : "invisible"}`} title={on ? "ปิดเพื่อหยุดเรียกค่ายนี้ โดยไม่ต้องลบกุญแจ" : "เปิดเพื่อให้ระบบเรียกค่ายนี้ได้อีก"}>
                  <input
                    type="checkbox" role="switch" className="sr-only" checked={on} disabled={pending || !key}
                    onChange={(e) => run(`key:${p}`, () => setProviderEnabled(p, e.target.checked), `${e.target.checked ? "เปิด" : "ปิด"} ${PROVIDER_LABEL[p] ?? p} แล้ว`)}
                  />
                  <span aria-hidden className={`relative inline-block h-4 w-7 rounded-full transition-colors ${on ? "bg-[var(--bot-ok)]" : "bg-[var(--bot-line-strong)]"}`}>
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[var(--bot-surface)] transition-all ${on ? "left-3.5" : "left-0.5"}`} />
                  </span>
                  <span className={on ? "text-[var(--bot-ok)]" : "text-[var(--bot-ink-mute)]"}>{on ? "เปิด" : "ปิด"}</span>
                </label>
                <Status check={checkOf(p)} />
                <Spend spend={spendOf(p)} top={topSpend} />
                <span className="flex min-w-64 flex-1 items-center gap-2">
                  <input
                    type="password" placeholder="วางกุญแจใหม่" autoComplete="off"
                    className={`min-w-0 flex-1 text-sm ${input}`}
                    value={draft[p] ?? ""} onChange={(e) => setDraft({ ...draft, [p]: e.target.value })}
                  />
                  <button
                    type="button" disabled={pending || !(draft[p] ?? "").trim()}
                    className="shrink-0 rounded bg-[var(--bot-navy)] px-3 py-1 text-xs text-[var(--bot-surface)] disabled:opacity-40"
                    onClick={() => run(`key:${p}`, () => saveApiKey(p, draft[p] ?? ""), `บันทึกกุญแจ ${PROVIDER_LABEL[p] ?? p} แล้ว`,
                      () => setDraft((d) => ({ ...d, [p]: "" })))}
                  >
                    {busy === `key:${p}` ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                </span>
                <Said note={note} where={`key:${p}`} className="basis-full" />
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="ตัวตัดต่อวิดีโอ" hint="บริการที่ใช้ตัดคลิปเป็นรีล เก็บกุญแจแบบเดียวกับค่าย AI แสดงเฉพาะ 4 ตัวท้าย">
        <div className="space-y-2">
          {([
            ["rendi", "Rendi", "วางกุญแจ API ของ Rendi"],
            ["aws", "AWS Lambda", "accessKeyId:secretAccessKey:region:functionName"],
          ] as [RenderProvider, string, string][]).map(([p, label, placeholder]) => {
            const held = video.keys.find((k) => k.provider === p);
            return (
              <div key={p} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--bot-line)] p-2">
                <span className="w-44 text-sm">{label}</span>
                <span className="w-44 break-all text-xs text-[var(--bot-ink-mute)]">{held ? held.shown : "ยังไม่ได้ตั้ง"}</span>
                <span className="flex min-w-64 flex-1 items-center gap-2">
                  <input
                    type="password" placeholder={placeholder} autoComplete="off"
                    className={`min-w-0 flex-1 text-sm ${input}`}
                    value={draft[`render:${p}`] ?? ""} onChange={(e) => setDraft({ ...draft, [`render:${p}`]: e.target.value })}
                  />
                  <button
                    type="button" disabled={pending || !(draft[`render:${p}`] ?? "").trim()}
                    className="shrink-0 rounded bg-[var(--bot-navy)] px-3 py-1 text-xs text-[var(--bot-surface)] disabled:opacity-40"
                    onClick={() => run(`render:${p}`, () => saveRenderKey(p, draft[`render:${p}`] ?? ""), `บันทึกกุญแจ ${label} แล้ว`,
                      () => setDraft((d) => ({ ...d, [`render:${p}`]: "" })))}
                  >
                    {busy === `render:${p}` ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                </span>
                <Said note={note} where={`render:${p}`} className="basis-full" />
              </div>
            );
          })}
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); run("engine", () => saveVideoEngine(engine), "บันทึกตัวตัดต่อแล้ว"); }}
        >
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">ตัวตัดต่อหลัก</span>
            <select value={engine.engine} className={`mt-1 ${input}`}
                    onChange={(e) => setEngine({ ...engine, engine: e.target.value === "lambda" ? "lambda" : "rendi" })}>
              <option value="rendi">Rendi</option>
              <option value="lambda">AWS Lambda</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">เวลาสูงสุดของ Rendi</span>
            <select value={engine.rendiMaxSeconds} className={`mt-1 ${input}`}
                    onChange={(e) => setEngine({ ...engine, rendiMaxSeconds: Number(e.target.value) })}>
              <option value={60}>60 วินาที (แพลนฟรี)</option>
              <option value={600}>600 วินาที (Pro)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-sm">
            <input type="checkbox" checked={engine.fallback} onChange={(e) => setEngine({ ...engine, fallback: e.target.checked })} />
            <span>ถ้าตัวหลักทำไม่ได้ ให้ลองอีกตัวแทน</span>
          </label>
          <button disabled={pending} className="rounded bg-[var(--bot-navy)] px-3 py-1.5 text-sm text-[var(--bot-surface)] disabled:opacity-40">
            {busy === "engine" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          <Said note={note} where="engine" className="basis-full text-sm" />
        </form>
      </Card>

      <Card title="โมเดล" hint="ปิดโมเดลที่ไม่ต้องการให้ระบบเลือกใช้">
        {models.length === 0 ? <Empty>ยังไม่มีโมเดลในระบบ</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--bot-line)] text-left text-[var(--bot-ink-mute)]"><th className="py-2">ค่าย</th><th className="py-2 pl-3">ประเภท</th><th className="py-2 pl-3">โมเดล</th><th className="py-2 pl-3">ใช้งาน</th></tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--bot-line)]">
                    <td className="py-1.5">{PROVIDER_LABEL[m.provider] ?? m.provider}</td>
                    <td className="py-1.5 pl-3">{KIND_LABEL[m.kind] ?? m.kind}</td>
                    <td className="py-1.5 pl-3">
                      <span className="font-mono text-xs">{m.model_name}</span>
                      {m.quality && <span className="ml-1.5 text-xs text-[var(--bot-ink-mute)]">· {QUALITY_LABEL[m.quality] ?? m.quality}</span>}
                    </td>
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={m.enabled} disabled={pending || m.kind === "judge"}
                             title={m.kind === "judge" ? "ยังไม่มีงานไหนเรียกใช้ เปิดปิดด้วยการใส่หรือลบกุญแจ" : undefined}
                             onChange={(e) => run(`model:${m.id}`, () => setModelEnabled(m.id, e.target.checked), `${e.target.checked ? "เปิด" : "ปิด"}แล้ว`)} />
                      {busy === `model:${m.id}` && <span className="ml-1.5 text-xs text-[var(--bot-ink-mute)]">กำลังบันทึก…</span>}
                      <Said note={note} where={`model:${m.id}`} className="ml-1.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="ค่าเริ่มต้นและงบ" hint="โมเดลเล็กใช้แยกข้อความและตอบสั้น โมเดลใหญ่ใช้ตอบจากเอกสาร">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            // sent as typed: the server reads the numbers, and says in Thai what it refused
            run("settings", () => saveSettings(String(f.get("small") ?? ""), String(f.get("large") ?? ""),
                String(f.get("budget") ?? ""), String(f.get("contentBudget") ?? "")),
                "บันทึกค่าเริ่มต้นและงบแล้ว");
          }}
        >
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">โมเดลเล็ก</span>
            <select name="small" defaultValue={settings?.small_model ?? ""} className={`mt-1 ${input}`}>
              <option value="">เลือกอัตโนมัติ</option>
              {textModels.map((m) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">โมเดลใหญ่</span>
            <select name="large" defaultValue={settings?.large_model ?? ""} className={`mt-1 ${input}`}>
              <option value="">เลือกอัตโนมัติ</option>
              {textModels.map((m) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">งบต่อเดือน (บาท)</span>
            {/* step "any": a step of 50 made the browser refuse ฿120 and block the whole form */}
            <input name="budget" type="number" inputMode="decimal" min={0} step="any" defaultValue={settings?.monthly_budget_thb ?? ""}
                   className={`mt-1 w-32 ${input}`} placeholder="ไม่จำกัด" />
            <span className="mt-1 block text-xs text-[var(--bot-ink-mute)]">เว้นว่าง = ไม่จำกัด</span>
          </label>
          {/* a slice of the budget above: the bot answering leads draws on the rest */}
          <label className="text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">งบสร้างคอนเทนต์ต่อเดือน (บาท)</span>
            <input name="contentBudget" type="number" inputMode="decimal" min={0} step="any" defaultValue={settings?.content_budget_thb ?? ""}
                   className={`mt-1 w-32 ${input}`} placeholder={`${content.fallback}`} />
            <span className="mt-1 block text-xs text-[var(--bot-ink-mute)]">
              เว้นว่าง = ฿{content.fallback.toLocaleString("th-TH")} ·{" "}
              {content.spent === null
                ? "อ่านยอดใช้ไม่สำเร็จ"
                : <>ใช้ไป {baht(content.spent)} จาก {content.cap.toLocaleString("th-TH")} บาท</>}
            </span>
          </label>
          <button disabled={pending} className="rounded bg-[var(--bot-navy)] px-3 py-1.5 text-sm text-[var(--bot-surface)] disabled:opacity-40">
            {busy === "settings" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          <span className="text-xs text-[var(--bot-ink-mute)]">
            {spentThisMonth === null ? "อ่านยอดใช้ไม่สำเร็จ" : `ใช้ไปเดือนนี้ ${baht(spentThisMonth)} บาท`}
          </span>
          <Said note={note} where="settings" className="basis-full text-sm" />
        </form>
      </Card>
    </>
  );
}
