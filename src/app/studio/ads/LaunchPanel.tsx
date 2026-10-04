"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LaunchRow } from "@/lib/ads/launch-store";
import { LAUNCH_STEPS, pageNameOf } from "@/lib/ads/ad-card";
import { ask } from "../ask";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { budgetBaht, formReady, overCap } from "./form-ready";
import { activateAd, launchAd, type Connection, type LaunchView } from "./actions";
import { field, plain, solid } from "./styles";

/**
 * Puts the ad open in the editor on Facebook as a paused ad, and switches it on in a second
 * press. The Page is the campaign's; nothing here picks one.
 *
 * Saving never spends: every step is made PAUSED. The button that can spend is a separate one
 * that asks first, and shows the account, the Page and the daily budget it is about to spend —
 * read from the launch itself, because that is what is on Facebook, not what the form says now.
 * Making a new set in place of the old one asks too.
 */

/** Meta's effective_status in the words the owner reads; anything not listed is shown as Meta says it */
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "กำลังวิ่ง",
  PAUSED: "หยุดไว้",
  CAMPAIGN_PAUSED: "หยุดไว้ (ที่แคมเปญ)",
  ADSET_PAUSED: "หยุดไว้ (ที่ชุดโฆษณา)",
  PENDING_REVIEW: "รอ Meta ตรวจ",
  IN_PROCESS: "Meta กำลังประมวลผล",
  DISAPPROVED: "Meta ไม่อนุมัติ",
  WITH_ISSUES: "มีปัญหา",
  ARCHIVED: "เก็บถาวร",
  DELETED: "ถูกลบ",
};
const BAD_STATUS = new Set(["DISAPPROVED", "WITH_ISSUES"]);

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

/** a launch row as the panel draws it, for what a result hands back before the room is read again */
function toView(r: LaunchRow): LaunchView {
  return {
    id: r.id, actId: r.actId, pageId: r.pageId, step: r.step, adId: r.adId, error: r.error,
    activatedAt: r.activatedAt, effectiveStatus: null, dailyBudgetBaht: r.dailyBudgetMinor / 100,
  };
}

/** The four steps with a mark on each: made, the one that broke (with Meta's reason), or not yet. */
function Progress({ launch }: { launch: LaunchView }) {
  const done = launch.step === "none" ? -1 : LAUNCH_STEPS.findIndex((s) => s.key === launch.step);
  return (
    <ol className="space-y-1.5 text-sm">
      {LAUNCH_STEPS.map((s, i) => {
        const failed = launch.error !== null && i === done + 1;
        const made = i <= done;
        return (
          <li key={s.key} className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 text-center ${failed ? "text-[var(--ct-alert)]" : made ? "text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`}>
              {failed ? "✕" : made ? "✓" : "·"}
            </span>
            <span className="min-w-0">
              <span className={made ? "" : "text-[var(--ct-mute)]"}>{s.label}</span>
              <span className="sr-only">{failed ? " ไม่สำเร็จ" : made ? " ทำแล้ว (หยุดไว้)" : " ยังไม่ได้ทำ"}</span>
              {failed && <span className="mt-0.5 block break-words text-[var(--ct-alert)]">ขั้น{s.short}ไม่สำเร็จ — {launch.error}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface LaunchPanelProps {
  piece: { id: string; status: string; hasPoster: boolean; launches: LaunchView[] };
  connection: Connection;
  page: { pageId: string; pageName: string | null; connected: boolean };
  /** the owner's Pages: a launch made before Ads Studio may be on another Page than the campaign's, and is named by its own */
  pages: { pageId: string; pageName: string }[];
  /** the words as the editor holds them now; they go to Facebook as typed */
  copy: { headline: string; primaryText: string; description: string };
  /** the editor holds edits not yet saved: the poster Facebook would get is the saved one */
  dirty: boolean;
}

export function LaunchPanel({ piece, connection, page, pages, copy, dirty }: LaunchPanelProps) {
  const router = useRouter();
  const { accounts, maxDailyBudgetThb, thIdentity } = connection;
  const [actId, setActId] = useState((accounts.find((a) => a.currency === "THB") ?? accounts[0])?.id ?? "");
  const [link, setLink] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState<"save" | "activate" | null>(null);
  const [note, setNote] = useState<NoteState>(null);
  // launches heard of since the room was read, by account
  const [fresh, setFresh] = useState<Record<string, LaunchView>>({});
  useEffect(() => { setFresh({}); }, [piece.launches]);

  const account = accounts.find((a) => a.id === actId);
  const launch: LaunchView | null = fresh[actId] ?? piece.launches.find((l) => l.actId === actId) ?? null;
  const pageName = page.pageName ?? page.pageId;
  const nonBaht = account !== undefined && account.currency !== "THB";
  const tooMuch = overCap(budget, maxDailyBudgetThb);
  const formOk = formReady({ hasPoster: piece.hasPoster, nonBaht, link, budget, pageId: page.pageId, actId, maxDailyBudgetThb });
  const ready = !dirty && formOk;

  // the whole panel is shut, with the reason, when this ad cannot be launched at all
  const shut = !page.connected
    ? <>เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — เชื่อมเพจที่ <a href="/admin/messenger" className="underline">หน้าตั้งค่าเพจ</a> ก่อนจึงจะยิงแอดได้</>
    : accounts.length === 0
      ? <>ยังไม่ได้เชื่อมบัญชีโฆษณา — เชื่อมที่ <a href={`/studio/ads?page=${encodeURIComponent(page.pageId)}`} className="underline">หน้ารายการแคมเปญ</a> ก่อน</>
      : piece.status === "trashed"
        ? "ชิ้นนี้อยู่ในถังขยะ ยิงแอดไม่ได้"
        : null;

  async function save(recreate: boolean) {
    setBusy("save");
    setNote(null);
    try {
      const res = await launchAd({ pieceId: piece.id, actId, link, dailyBudgetBaht: budgetBaht(budget), ...copy, recreate });
      if (res.launch) setFresh((f) => ({ ...f, [actId]: toView(res.launch!) }));
      if (res.ok) setNote(okNote("บันทึกเป็นแอดหยุดไว้แล้ว ยังไม่เสียเงิน ตรวจใน Ads Manager แล้วกดเปิดใช้เมื่อพร้อม"));
      // a step that broke is told under that step; anything else has no row to hang it on
      else if (!res.launch || res.step === "check") setNote(errorNote(res.error));
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าสร้างไปถึงไหน — เปิดหน้านี้ใหม่เพื่อดูสถานะก่อนกดซ้ำ"));
    } finally {
      setBusy(null);
    }
  }

  async function recreate() {
    const ok = await ask(
      "สร้างแอดชุดใหม่แทนชุดเดิม?\n\nระบบจะหยุดแคมเปญเดิมบน Facebook ก่อน (ไม่ว่าจะเปิดใช้อยู่หรือไม่) และชุดเดิมจะไม่ถูกใช้ต่อ (ยังเห็นอยู่ใน Ads Manager)\nชุดใหม่ใช้ค่าตามฟอร์มตอนนี้ และเริ่มจากสถานะหยุดไว้",
      "สร้างใหม่",
    );
    if (ok) await save(true);
  }

  async function activate() {
    if (!launch) return;
    const acct = accounts.find((a) => a.id === launch.actId);
    const ok = await ask(
      [
        "เปิดใช้แอดนี้?",
        "",
        `บัญชีโฆษณา: ${acct ? `${acct.name} (${acct.id})` : launch.actId}`,
        `เพจ: ${pageNameOf(launch.pageId, pages)}`,
        `งบ: ${baht(launch.dailyBudgetBaht)} ต่อวัน`,
        "",
        "กดแล้ว Facebook จะเริ่มใช้เงินจากบัญชีโฆษณานี้ทันที (หลังผ่านการตรวจของ Meta)",
      ].join("\n"),
      "เปิดใช้เลย",
    );
    if (!ok) return;
    setBusy("activate");
    setNote(null);
    try {
      const res = await activateAd(launch.id);
      if (res.ok) {
        setFresh((f) => ({ ...f, [launch.actId]: { ...launch, activatedAt: new Date().toISOString(), effectiveStatus: null } }));
        setNote(okNote("เปิดใช้แล้ว"));
      } else {
        // not kept on the launch, so this is the only place the reason is seen
        setNote(errorNote(res.error));
      }
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าเปิดใช้ได้หรือไม่ — เปิดหน้านี้ใหม่เพื่อดูสถานะ"));
    } finally {
      setBusy(null);
    }
  }

  const resume = launch !== null && launch.step !== "ad";
  const statusText = launch?.effectiveStatus ? `${STATUS_LABEL[launch.effectiveStatus] ?? launch.effectiveStatus} (${launch.effectiveStatus})` : null;
  const bad = launch?.effectiveStatus ? BAD_STATUS.has(launch.effectiveStatus) : false;

  return (
    <section aria-labelledby="launch-title" className="space-y-4 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5">
      <div>
        <h2 id="launch-title" className="text-sm font-semibold">ยิงแอด</h2>
        <p className="mt-0.5 text-xs text-[var(--ct-mute)]">
          เพจ {pageName} · รูปโปสเตอร์ 1:1 ปุ่ม “ดูเพิ่มเติม” ไปที่ลิงก์ที่ใส่ แสดงในประเทศไทย บันทึกแล้วแอดยังหยุดไว้ ไม่เสียเงิน
        </p>
      </div>

      {shut ? (
        <p role="note" className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">{shut}</p>
      ) : (
        <>
          <fieldset disabled={busy !== null} className="m-0 min-w-0 space-y-3 border-0 p-0">
            <legend className="sr-only">บัญชี ลิงก์ และงบ</legend>
            <label className="block min-w-0 space-y-1">
              <span className="text-xs text-[var(--ct-mute)]">บัญชีโฆษณา</span>
              <select value={actId} onChange={(e) => { setActId(e.target.value); setNote(null); }} className={field}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.currency ? ` · ${a.currency}` : ""}</option>)}
              </select>
            </label>
            {nonBaht && <p className="text-sm text-[var(--ct-warn-ink)]">รองรับเฉพาะบัญชีสกุลบาท (THB) เลือกบัญชีอื่น</p>}
            {!thIdentity && (
              <p className="text-sm text-[var(--ct-warn-ink)]">
                ยังยิงไม่ได้ — Meta บังคับให้แอดที่แสดงในไทยระบุผู้ลงโฆษณาที่ยืนยันตัวตนแล้ว ต้องตั้งค่า <code className="break-all">META_TH_VERIFIED_IDENTITY_ID</code> ก่อน (ขั้นตอนอยู่ใน docs/ads-manage-permission.md)
              </p>
            )}
            <label className="block space-y-1">
              <span className="text-xs text-[var(--ct-mute)]">ลิงก์ปลายทางของปุ่ม</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="https://…" className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[var(--ct-mute)]">งบต่อวัน (บาท) · สูงสุด {maxDailyBudgetThb.toLocaleString("en-US")}</span>
              <input
                value={budget} onChange={(e) => setBudget(e.target.value)}
                type="number" inputMode="numeric" min={1} max={maxDailyBudgetThb} step={1} className={field}
              />
              {tooMuch && (
                <span role="alert" className="block text-xs font-medium text-[var(--ct-alert)]">
                  เกินเพดาน {maxDailyBudgetThb.toLocaleString("en-US")} บาทต่อวัน — ลดงบก่อนจึงจะบันทึกได้
                </span>
              )}
            </label>
          </fieldset>

          {!piece.hasPoster && <p className="text-sm text-[var(--ct-warn-ink)]">ชิ้นนี้ยังไม่มีโปสเตอร์ที่บันทึกไว้ ใส่พาดหัวบนภาพแล้วกดบันทึกก่อนจึงจะยิงได้</p>}
          {dirty && <p className="text-sm text-[var(--ct-warn-ink)]">มีการแก้ที่ยังไม่บันทึก — กดบันทึกก่อน แอดจะได้ใช้ข้อความและโปสเตอร์ชุดเดียวกับที่เห็น</p>}

          {launch === null ? (
            <button type="button" disabled={busy !== null || !ready} onClick={() => save(false)} className={solid}>
              {busy === "save" ? "กำลังสร้างบน Facebook… (ราว 10–30 วินาที)" : "บันทึกเป็นแอดหยุดไว้"}
            </button>
          ) : (
            <div className="space-y-3 border-t border-[var(--ct-hair)] pt-3" aria-live="polite">
              <h3 className="text-sm font-medium">แอดของชิ้นนี้ใน {account?.name ?? launch.actId}</h3>
              <Progress launch={launch} />
              {resume && (
                <p className="text-xs text-[var(--ct-mute)]">ลองใหม่จะทำต่อจากขั้นที่ค้าง ไม่สร้างซ้ำขั้นที่ทำแล้ว และใช้ค่าที่บันทึกไว้ตอนเริ่ม ({baht(launch.dailyBudgetBaht)} ต่อวัน)</p>
              )}
              {launch.step === "ad" && (
                <div className="space-y-1 text-sm">
                  <p>เพจ {pageNameOf(launch.pageId, pages)} · งบ {baht(launch.dailyBudgetBaht)} ต่อวัน</p>
                  {launch.activatedAt ? <p>เปิดใช้แล้ว {when(launch.activatedAt)}</p> : <p className="text-[var(--ct-mute)]">หยุดไว้ — ยังไม่เสียเงิน</p>}
                  {statusText && (
                    <p className={bad ? "font-medium text-[var(--ct-alert)]" : ""}>
                      สถานะจาก Meta: {statusText}{bad && " — ดูเหตุผลใน Ads Manager"}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {resume && (
                  <button type="button" disabled={busy !== null || !ready} onClick={() => save(false)} className={solid}>
                    {busy === "save" ? "กำลังสร้าง…" : "ลองใหม่"}
                  </button>
                )}
                {launch.step === "ad" && !launch.activatedAt && (
                  <button type="button" disabled={busy !== null} onClick={activate} className={solid}>
                    {busy === "activate" ? "กำลังเปิดใช้…" : "เปิดใช้"}
                  </button>
                )}
                <button type="button" disabled={busy !== null || !ready} onClick={recreate} className={plain}>สร้างใหม่</button>
              </div>
              {!formOk && <p className="text-xs text-[var(--ct-mute)]">ปุ่มลองใหม่และสร้างใหม่ใช้ค่าในฟอร์มข้างบน กรอกลิงก์และงบให้ครบก่อน</p>}
            </div>
          )}
          <Note note={note} />
        </>
      )}
    </section>
  );
}
