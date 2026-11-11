"use client";
import { useState, useTransition } from "react";
import { Card } from "../ui";
import type { VideoSettings } from "@/lib/video/settings";
import {
  checkKeys, saveApiKey, saveRenderKey, saveVideoEngine, setProviderEnabled, saveSettings, resetSpend,
  type KeyRow, type VideoKeyRow, type ProviderCheck, type Result, type Settings,
} from "./actions";
import { PROVIDER_LABEL } from "./labels";

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
      <span className="flex w-28 flex-wrap items-baseline gap-x-1.5">
        <span className={`${chip} bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]`}>ใช้ได้</span>
        <span className="text-[0.65rem] tabular-nums text-[var(--bot-ink-faint)]">{(check.ms / 1000).toFixed(1)}s</span>
        {check.note && <span className="basis-full text-[0.65rem] text-[var(--bot-ink-mute)]">{check.note}</span>}
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


/** asked before Google Cloud Run is switched off: its key drives far more than clips (owner chose ข, 2026-11-11) */
const GCP_OFF_CONFIRM = "ปิด Google Cloud Run ใช่ไหม?\n\nงานเหล่านี้จะหยุดทั้งเว็บจนกว่าจะเปิดอีกครั้ง:\n• ทำวิดีโอทุกแบบ\n• ตัดต่อคลิปของเอเจนต์\n• เสียงพากย์ Gemini ทาง Cloud\n• การ์ดสรุป ตาราง และ PDF ใบเสนอ รวมถึงรูปที่บอทส่งให้ลูกค้า";

export function AiClient({ keys, settings, providers, spentThisMonth, content, video, rates, lanesCard }: {
  keys: KeyRow[]; settings: Settings | null; providers: string[];
  spentThisMonth: number | null; content: { spent: number | null; cap: number; fallback: number };
  video: { settings: VideoSettings; keys: VideoKeyRow[] };
  /** ภาพขยับ's keys, fal.ai and Runware (owner, 2026-10-16): their own card, since they have no chat model to test */
  /** the premium tables in force (src/calc/plans/tables-meta.ts): their own card since 2026-10-15 */
  rates: { version: string; expiresOn: string; daysLeft: number; expired: boolean };
  /** ลำดับหลักและสำรอง (./LanesCard.tsx) with the all-lanes model switches at its foot, placed before the budgets */
  lanesCard?: React.ReactNode;
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
  const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  // Google Cloud Run: the service account file is pasted whole; region and job are typed beside it
  const [gcp, setGcp] = useState({ region: "asia-southeast1", job: "clip-ffmpeg" });
  const gcpHeld = video.keys.find((k) => k.provider === "gcp");
  const gcpOn = gcpHeld?.enabled ?? true;
  const input = "rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2 py-1";

  return (
    <>
      <Card title="กุญแจของค่าย AI" hint="เก็บแยกจากระบบอื่น เข้ารหัสไว้ในฐานข้อมูล แสดงเฉพาะ 4 ตัวท้าย ส่วน Google Cloud Run แสดงว่ากุญแจชี้ไปที่โปรเจกต์ไหน">
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
              : "ส่งคำถามสั้นๆ ไปทุกค่ายเพื่อดูว่ากุญแจไหนยังใช้ได้ — ราคาไม่ถึงหนึ่งสตางค์ (Google Cloud Run แค่ถามสิทธิ์ ไม่ได้สั่งงาน)"}
          </span>
          <Said note={note} where="test" />
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
          {/* Google Cloud Run, moved up from its own card (owner, 2026-11-11, ข): the same switch as the companies' */}
          <div className={`flex flex-wrap items-start gap-2 rounded-md border border-[var(--bot-line)] p-2 ${gcpOn ? "" : "opacity-60"}`}>
            <span className="w-44 text-sm">Google Cloud Run (ทำวิดีโอ)</span>
            <span className="w-24 break-all text-xs text-[var(--bot-ink-mute)]">{gcpHeld ? gcpHeld.shown : "ยังไม่ได้ตั้ง"}</span>
            <label className={`flex w-20 items-center gap-1.5 text-xs ${gcpHeld ? "cursor-pointer" : "invisible"}`} title={gcpOn ? "ปิดเพื่อหยุดทุกงานที่ใช้ Google Cloud Run โดยไม่ต้องลบกุญแจ" : "เปิดเพื่อให้ระบบเรียก Google Cloud Run ได้อีก"}>
              <input
                type="checkbox" role="switch" className="sr-only" checked={gcpOn} disabled={pending || !gcpHeld}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (!next && !window.confirm(GCP_OFF_CONFIRM)) return;
                  run("render:gcp", () => setProviderEnabled("gcp", next), `${next ? "เปิด" : "ปิด"} Google Cloud Run แล้ว`);
                }}
              />
              <span aria-hidden className={`relative inline-block h-4 w-7 rounded-full transition-colors ${gcpOn ? "bg-[var(--bot-ok)]" : "bg-[var(--bot-line-strong)]"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[var(--bot-surface)] transition-all ${gcpOn ? "left-3.5" : "left-0.5"}`} />
              </span>
              <span className={gcpOn ? "text-[var(--bot-ok)]" : "text-[var(--bot-ink-mute)]"}>{gcpOn ? "เปิด" : "ปิด"}</span>
            </label>
            <Status check={checkOf("gcp")} />
            <span className="flex min-w-64 flex-1 flex-col gap-2">
              <textarea
                placeholder="วางไฟล์ Service Account (JSON)" autoComplete="off" spellCheck={false} rows={2}
                className={`min-w-0 font-mono text-xs ${input}`}
                value={draft["render:gcp"] ?? ""} onChange={(e) => setDraft({ ...draft, ["render:gcp"]: e.target.value })}
              />
              <span className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-[var(--bot-ink-mute)]">
                  region
                  <input className={`ml-1 w-36 text-sm ${input}`} value={gcp.region} onChange={(e) => setGcp({ ...gcp, region: e.target.value })} />
                </label>
                <label className="text-xs text-[var(--bot-ink-mute)]">
                  job
                  <input className={`ml-1 w-32 text-sm ${input}`} value={gcp.job} onChange={(e) => setGcp({ ...gcp, job: e.target.value })} />
                </label>
                <button
                  type="button" disabled={pending || !(draft["render:gcp"] ?? "").trim()}
                  className="ml-auto shrink-0 rounded bg-[var(--bot-navy)] px-3 py-1 text-xs text-[var(--bot-surface)] disabled:opacity-40"
                  onClick={() => run("render:gcp", async () => {
                    const res = await saveRenderKey("gcp", draft["render:gcp"] ?? "", gcp);
                    setDraft((d) => ({ ...d, ["render:gcp"]: "" })); // the pasted key does not stay on screen, saved or refused
                    return res;
                  }, "บันทึกกุญแจ Google Cloud Run แล้ว")}
                >
                  {busy === "render:gcp" ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </span>
            </span>
            {/* saved as it is ticked: no button of its own */}
            <label className="flex basis-full items-center gap-2 text-sm">
              <input
                type="checkbox" checked={engine.enabled} disabled={pending}
                onChange={(e) => {
                  const next = { enabled: e.target.checked };
                  setEngine(next);
                  run("engine", async () => {
                    const res = await saveVideoEngine(next);
                    if (!res.ok) setEngine({ enabled: !next.enabled });
                    return res;
                  }, `${next.enabled ? "เปิด" : "ปิด"}ให้เอเจนต์ตัดต่อคลิปแล้ว`);
                }}
              />
              <span>เปิดให้เอเจนต์ตัดต่อคลิป</span>
              <span className="text-xs text-[var(--bot-ink-mute)]">· ปิดอยู่ = เอเจนต์ไม่เห็นปุ่มตัดต่อ · คลิปที่กำลังทำอยู่ยังทำต่อจนเสร็จ</span>
            </label>
            <Said note={note} where="render:gcp" className="basis-full" />
            <Said note={note} where="engine" className="basis-full" />
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--bot-ink-mute)]">
          ยอดใช้ของแต่ละค่ายและงานที่ใช้ อยู่ที่หน้า{" "}
          <a href="/admin/stats?tab=provider" className="text-[var(--bot-navy)]">การใช้งานและค่า AI → ตามค่าย AI</a>
        </p>
      </Card>

      {lanesCard}

      <Card title="งบ" hint="ตัวหลักและตัวสำรองของแต่ละงาน ตั้งที่ลำดับหลักและสำรองด้านบน">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            // sent as typed: the server reads the numbers, and says in Thai what it refused
            run("settings", () => saveSettings(String(f.get("budget") ?? ""), String(f.get("contentBudget") ?? "")),
                "บันทึกงบแล้ว");
          }}
        >
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
          <Said note={note} where="settings" className="basis-full text-sm" />
        </form>
        {/* the month's spend against the budget, and the reset that starts it again: beside the
            budget since 2026-10-15, when the per-company spend moved to การใช้งานและค่า AI */}
        <div className="mt-3 border-t border-[var(--bot-line)] pt-3">
          <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--bot-ink-mute)]">
            <button
              type="button" disabled={pending}
              className="rounded border border-[var(--bot-line-strong)] px-2.5 py-1 font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40"
              title="เริ่มนับยอดใช้ใหม่จากศูนย์ตั้งแต่ตอนนี้ — ประวัติการเรียก AI ไม่ถูกลบ"
              onClick={() => {
                if (!window.confirm("รีเซ็ตยอดใช้ AI เป็น ฿0 ใช่ไหม?\n\nยอดเดือนนี้และการเช็กงบจะเริ่มนับใหม่ตั้งแต่ตอนนี้ (ประวัติเดิมยังอยู่ ไม่ถูกลบ) และกลับมาใช้ได้ถ้าเคยหยุดเพราะงบเต็ม")) return;
                run("reset", resetSpend, "รีเซ็ตยอดแล้ว — เริ่มนับใหม่จาก ฿0");
              }}
            >
              {busy === "reset" ? "กำลังรีเซ็ต…" : "รีเซ็ตยอด"}
            </button>
            <Said note={note} where="reset" />
            <span>
            {spentThisMonth === null
              ? <span className="text-[var(--bot-red-ink)]">อ่านยอดใช้ไม่สำเร็จ</span>
              : <>เดือนนี้ใช้ไป <b className="text-sm tabular-nums text-[var(--bot-ink)]">฿{baht(spentThisMonth)}</b></>}
            {/* `!= null`, not truthiness: a stored 0 is a ฿0 ceiling that stops the bot, not "no budget" */}
            {budget == null
              ? " (ไม่จำกัดงบ)"
              : budget <= 0
                ? <span className="text-[var(--bot-red-ink)]"> · งบ ฿{baht(budget)} — ระบบหยุดเรียก AI ทั้งหมด</span>
                : <> จากงบ ฿{baht(budget)}{spentThisMonth !== null && <> ({Math.round((spentThisMonth / budget) * 100)}%)</>}</>}
            {settings?.spend_reset_at && <span className="block text-[0.65rem] text-[var(--bot-ink-faint)]">นับตั้งแต่รีเซ็ต {new Date(settings.spend_reset_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}</span>}
            </span>
          </span>
        </div>
      </Card>
      {/* the premium tables in force: the overview's warning when they near their end leads here */}
      <div id="rates" className="scroll-mt-20">
        <Card title="ตารางเบี้ย" hint="ชุดตารางเบี้ยที่หน้าคำนวณและบอทใช้อยู่ เปลี่ยนชุดได้ด้วยการอัปเดตระบบเท่านั้น">
          <p className={`text-sm ${rates.expired ? "text-[var(--bot-red-ink)]" : rates.daysLeft <= 30 ? "text-[var(--bot-sand-ink)]" : "text-[var(--bot-ink)]"}`}>
            ชุด {rates.version} · ใช้ได้ถึง {rates.expiresOn}{" "}
            {rates.expired ? "· หมดอายุแล้ว ขอชุดใหม่จากบริษัท" : `· เหลืออีก ${rates.daysLeft.toLocaleString("th-TH")} วัน`}
          </p>
        </Card>
      </div>
    </>
  );
}
