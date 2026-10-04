"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { picturePending, planLink } from "@/lib/ads/room-view";
import { CTA_LABEL, NEW_FORM_URL, OBJECTIVE_LABEL, sendOutcome, tosUrl } from "@/lib/ads/sent-view";
import type { SendResult } from "@/lib/ads/send";
import type { LeadCta, SendObjective } from "@/lib/ads/send-store";
import type { LeadForms } from "@/lib/ads/lead-forms";
import { XIcon } from "../ui/icons";
import { leadForms, sendApproved } from "./actions";
import type { Room, RoomPiece } from "./AdEditor";
import { budgetBaht, formReady, overCap } from "./form-ready";
import { field, plain, solid, TONES } from "./styles";

/**
 * ส่งขึ้น Facebook: every approved ad not yet sent, as one paused Meta campaign and ad set with an
 * ad per piece. The owner picks traffic (a link, the plan's page to begin with), a lead form
 * (one of the Page's Instant Forms and the button) or messages (ส่งข้อความ opens a Messenger chat
 * with the Page, where its bot answers — nothing more to choose), the ad account (baht only), the daily budget
 * under the cap, and can take any piece out by its thumbnail. Nothing is switched on here — that
 * is the sent tab's เปิดใช้ทั้งชุด, asked first.
 *
 * Once back, it says how each piece went: made (paused), failed with Meta's reason, or left out
 * before anything was made, with why (not approved, picture not drawn, sent already…).
 */

/** what each objective's button does, under its name */
const OBJECTIVE_HINT: Record<SendObjective, string> = { traffic: "พาไปเว็บ", leads: "กรอกใน Facebook", messages: "เปิดแชทเพจ" };
/** what is still to fill in before sending, by objective */
const STILL_NEEDED: Record<SendObjective, string> = { traffic: "ใส่ลิงก์ ", leads: "เลือกฟอร์ม ", messages: "" };
/** what the send's Meta campaign is called in the header, by objective */
const CAMPAIGN_KIND: Record<SendObjective, string> = { traffic: "", leads: "ลีด", messages: "ข้อความ" };

/** A lead button in the order the dialog offers them, the default first. */
const CTAS = Object.keys(CTA_LABEL) as LeadCta[];

export function SendDialog({ room, pieces, productName, onClose, onShowSent }: {
  room: Room;
  /** the approved pieces not yet sent */
  pieces: RoomPiece[];
  productName: string;
  onClose: () => void;
  onShowSent: () => void;
}) {
  const router = useRouter();
  const { campaign, connection } = room;
  const { accounts, maxDailyBudgetThb } = connection;
  const [actId, setActId] = useState(accounts.find((a) => a.currency === "THB")?.id ?? "");
  const [link, setLink] = useState(planLink(campaign.planHref));
  const [budget, setBudget] = useState("");
  const [objective, setObjective] = useState<SendObjective>("traffic");
  // the Page's forms for the chosen account: null until asked, "loading" while asking
  const [forms, setForms] = useState<LeadForms | "loading" | null>(null);
  const [formsFor, setFormsFor] = useState("");
  const [leadFormId, setLeadFormId] = useState("");
  const [cta, setCta] = useState<LeadCta>("GET_QUOTE");
  const [kept, setKept] = useState<Set<string>>(() => new Set(pieces.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [lost, setLost] = useState(false);
  // what went, kept as it was: the room is read again after a send, and sent pieces leave `pieces`
  const [sentList, setSentList] = useState<RoomPiece[]>([]);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => { window.clearInterval(tick); window.removeEventListener("beforeunload", stay); };
  }, [busy]);

  useEffect(() => {
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = scroll; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function loadForms() {
    setForms("loading");
    setFormsFor(actId);
    try {
      const out = await leadForms(campaign.id, actId);
      setForms(out);
      setLeadFormId(out.ok && out.tosAccepted ? out.forms[0]?.id ?? "" : "");
    } catch {
      setForms({ ok: false, error: "โหลดรายชื่อฟอร์มไม่สำเร็จ ลองอีกครั้ง" });
      setLeadFormId("");
    }
  }

  // the forms are read with the chosen account's token: asked on switching to leads, and again for another account
  useEffect(() => {
    if (objective === "leads" && actId && formsFor !== actId) void loadForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadForms reads the state it is keyed on
  }, [objective, actId, formsFor]);

  const account = accounts.find((a) => a.id === actId);
  const nonBaht = account !== undefined && account.currency !== "THB";
  const ready = formReady({
    hasPoster: kept.size > 0, nonBaht, link, budget, pageId: campaign.pageId, actId, maxDailyBudgetThb, objective, leadFormId,
  });
  const going = pieces.filter((p) => kept.has(p.id));

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    setSeconds(0);
    setLost(false);
    setSentList(going);
    try {
      setResult(await sendApproved({
        campaignId: campaign.id, actId, link, dailyBudgetBaht: budgetBaht(budget), pieceIds: going.map((p) => p.id),
        objective, ...(objective === "leads" ? { leadFormId, cta } : {}),
      }));
    } catch {
      setLost(true);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  const toggle = (id: string) => setKept((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const madeCount = result?.ok ? result.items.filter((i) => i.adId).length : 0;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="send-title" className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[var(--ct-scrim)] p-4">
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="send-title" className="font-semibold">ส่งขึ้น Facebook</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">
              เพจ {campaign.pageName ?? campaign.pageId} · 1 แคมเปญ{CAMPAIGN_KIND[objective]} + 1 ชุดโฆษณา (ไทย อายุ 20+) + แอดต่อชิ้น · สร้างเป็นหยุดไว้ทั้งหมด ยังไม่เสียเงิน
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิด" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--ct-soft)] disabled:opacity-50">
            <XIcon className="size-5" />
          </button>
        </div>

        {!result && !lost && (
          <fieldset disabled={busy} className="m-0 min-w-0 space-y-3 border-0 p-0">
            <legend className="sr-only">วัตถุประสงค์ บัญชี ลิงก์หรือฟอร์ม งบ และแอดที่จะส่ง</legend>
            <div role="group" aria-label="วัตถุประสงค์" className="grid grid-cols-3 gap-2">
              {(["traffic", "leads", "messages"] as const).map((o) => (
                <button
                  key={o} type="button" onClick={() => setObjective(o)} aria-pressed={objective === o}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${objective === o ? "border-[var(--ct-accent)] bg-[var(--ct-soft)] font-medium" : "border-[var(--ct-hair)]"}`}
                >
                  <span className="block">{OBJECTIVE_LABEL[o]}</span>
                  <span className="block text-xs text-[var(--ct-mute)]">{OBJECTIVE_HINT[o]}</span>
                </button>
              ))}
            </div>
            <label className="block min-w-0 space-y-1">
              <span className="text-xs text-[var(--ct-mute)]">บัญชีโฆษณา (สกุลบาทเท่านั้น)</span>
              <select value={actId} onChange={(e) => setActId(e.target.value)} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.currency !== "THB"}>
                    {a.name}{a.currency ? ` · ${a.currency}` : ""}{a.currency !== "THB" ? " (ใช้ไม่ได้)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {nonBaht && <p className="text-sm text-[var(--ct-warn-ink)]">รองรับเฉพาะบัญชีสกุลบาท (THB) เลือกบัญชีอื่น</p>}
            {objective === "traffic" ? (
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">ลิงก์ปลายทางของปุ่ม “ดูเพิ่มเติม”</span>
                <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoCapitalize="none" className={field} />
              </label>
            ) : objective === "messages" ? (
              <p className={`rounded-lg border px-3 py-2 text-sm ${TONES.ok}`}>
                ปุ่ม “ส่งข้อความ” บนแอดเปิดแชท Messenger ของเพจ {campaign.pageName ?? ""} แล้วบอทของเพจตอบต่อ — Meta จะเลือกแสดงให้คนที่น่าจะทักแชท
              </p>
            ) : (
              <LeadFormFields
                forms={forms} pageId={campaign.pageId} leadFormId={leadFormId} onForm={setLeadFormId}
                cta={cta} onCta={setCta} onReload={() => void loadForms()}
              />
            )}
            <label className="block space-y-1">
              <span className="text-xs text-[var(--ct-mute)]">งบต่อวันของทั้งชุด (บาท) · สูงสุด {maxDailyBudgetThb.toLocaleString("en-US")}</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" inputMode="numeric" min={1} max={maxDailyBudgetThb} step={1} className={field} />
              {overCap(budget, maxDailyBudgetThb) && (
                <span role="alert" className="block text-xs font-medium text-[var(--ct-alert)]">
                  เกินเพดาน {maxDailyBudgetThb.toLocaleString("en-US")} บาทต่อวัน — ลดงบก่อนจึงจะส่งได้
                </span>
              )}
            </label>
            <div>
              <p className="mb-1.5 text-xs text-[var(--ct-mute)]">แอดที่จะส่ง {going.length} จาก {pieces.length} ชิ้น · กด ✕ เพื่อเอาออก</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pieces.map((p) => {
                  const on = kept.has(p.id);
                  return (
                    <li key={p.id} className={`relative ${on ? "" : "opacity-40"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route */}
                      <img src={posterUrl(p.poster ?? defaultPoster(p.headline, productName))} alt={p.headline} loading="lazy" className="aspect-square w-full rounded-lg bg-[var(--ct-ground)] object-cover" />
                      <button
                        type="button" onClick={() => toggle(p.id)} aria-pressed={!on}
                        aria-label={on ? `เอา “${p.headline}” ออก` : `ใส่ “${p.headline}” กลับ`}
                        className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-[var(--ct-panel)] text-sm shadow"
                      >
                        {on ? "✕" : "+"}
                      </button>
                      {picturePending(p) && <span className="mt-0.5 block text-[11px] leading-tight text-[var(--ct-warn-ink)]">รูปยังวาดไม่เสร็จ จะถูกกันออก</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
            <button type="button" onClick={send} disabled={!ready || busy} className={`${solid} w-full`}>
              {busy ? `กำลังสร้างบน Facebook… ${seconds} วินาที` : `สร้างเป็นแอดหยุดไว้ (${going.length})`}
            </button>
            {busy && <p role="status" className="text-xs text-[var(--ct-mute)]">ราว 10 วินาทีต่อชิ้น อย่าปิดหน้านี้จนกว่าจะเสร็จ</p>}
            {!busy && !ready && (
              <p className="text-xs text-[var(--ct-mute)]">
                เลือกบัญชีสกุลบาท {STILL_NEEDED[objective]}และงบต่อวันเป็นจำนวนเต็มบาทก่อน
              </p>
            )}
          </fieldset>
        )}

        {lost && (
          <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>
            การเชื่อมต่อหลุด ยังไม่รู้ว่าส่งไปถึงไหน — ดูแท็บ “ส่งแล้ว” ก่อนกดส่งซ้ำ
          </p>
        )}
        {result && (
          <div className="space-y-3" aria-live="polite">
            <p role={result.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? TONES.ok : TONES.bad}`}>
              {result.ok
                ? `สร้างเป็นแอดหยุดไว้แล้ว ${madeCount} แอด ยังไม่เสียเงิน — ตรวจแล้วกด “เปิดใช้ทั้งชุด” ในแท็บส่งแล้ว`
                : `${result.error}${result.send ? " — รอบส่งนี้ถูกบันทึกไว้ กดลองใหม่ได้ในแท็บส่งแล้ว" : ""}`}
            </p>
            <ul className="divide-y divide-[var(--ct-hair)] rounded-lg border border-[var(--ct-hair)]">
              {sentList.map((p) => {
                const line = sendOutcome(result, p.id);
                return (
                  <li key={p.id} className="flex items-start gap-3 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route */}
                    <img src={posterUrl(p.poster ?? defaultPoster(p.headline, productName))} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium">{p.headline || "(ไม่มีหัวข้อ)"}</span>
                      <span className={`block break-words text-xs ${line.tone === "bad" ? "text-[var(--ct-alert)]" : line.tone === "warn" ? "text-[var(--ct-warn-ink)]" : "text-[var(--ct-accent)]"}`}>{line.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {(result || lost) && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onShowSent} className={solid}>ดูแท็บส่งแล้ว</button>
            <button type="button" onClick={onClose} className={plain}>ปิด</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The lead half of the dialog: the Page's forms (or why there are none to pick) and the button. */
function LeadFormFields({ forms, pageId, leadFormId, onForm, cta, onCta, onReload }: {
  forms: LeadForms | "loading" | null;
  pageId: string;
  leadFormId: string;
  onForm: (id: string) => void;
  cta: LeadCta;
  onCta: (c: LeadCta) => void;
  onReload: () => void;
}) {
  const reload = <button type="button" onClick={onReload} className={`${plain} shrink-0`}>โหลดใหม่</button>;
  const note = (tone: "bad" | "warn", body: React.ReactNode) => (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${TONES[tone]}`}>
      <p className="min-w-0">{body}</p>
      {reload}
    </div>
  );

  if (forms === null || forms === "loading") return <p role="status" className="text-sm text-[var(--ct-mute)]">กำลังโหลดฟอร์ม…</p>;
  if (!forms.ok) return note("bad", forms.error);
  if (!forms.tosAccepted) {
    return note("warn", <>เพจนี้ยังไม่ได้ยอมรับเงื่อนไขแอดลีดของ Facebook — <a href={tosUrl(pageId)} target="_blank" rel="noreferrer" className="underline">ไปกดยอมรับ</a> แล้วกดโหลดใหม่</>);
  }
  if (forms.forms.length === 0) {
    return note("warn", <>ยังไม่มีฟอร์มบนเพจนี้ — <a href={NEW_FORM_URL} target="_blank" rel="noreferrer" className="underline">สร้างฟอร์มใน Business Suite</a> แล้วกดโหลดใหม่</>);
  }
  return (
    <>
      <label className="block min-w-0 space-y-1">
        <span className="text-xs text-[var(--ct-mute)]">ฟอร์มที่ปุ่มบนแอดเปิด</span>
        <select value={leadFormId} onChange={(e) => onForm(e.target.value)} className={field}>
          {forms.forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className="block min-w-0 space-y-1">
        <span className="text-xs text-[var(--ct-mute)]">ปุ่มบนแอด</span>
        <select value={cta} onChange={(e) => onCta(e.target.value as LeadCta)} className={field}>
          {CTAS.map((c) => <option key={c} value={c}>{CTA_LABEL[c]}</option>)}
        </select>
      </label>
    </>
  );
}
