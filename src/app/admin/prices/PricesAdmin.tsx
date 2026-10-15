"use client";
import { useState, useTransition } from "react";
import type { PassSettings } from "@/lib/members/pass";
import type { ReferralSettings } from "@/lib/referrals/referral";
import type { ReferralReport } from "@/lib/referrals/store";
import type { FreeCap } from "@/lib/wallet/free-cap";
import { formatBaht } from "@/lib/wallet/money";
import { PRICE_ITEMS, priceBaht, type PriceGroup, type Prices } from "@/lib/wallet/prices";
import { Card, Empty } from "../ui";
import { saveFreeCap, saveMemberPass, savePrices, saveReferral } from "../wallet/actions";
import { ask, input, primary, Said } from "../wallet/form";

/**
 * ราคาและโปรโมชัน (owner chose ข, 2026-10-15): what agents and members pay, set in one place —
 * the price of each piece, the members' monthly pass, and ชวนเพื่อน. All three were cards on
 * กระเป๋าเงินตัวแทน, whose name said only the first thing on it.
 */
export function PricesAdmin({ prices, pass, referral, report, free }: {
  /** the fixed prices agents pay (owner, 2026-10-12) */
  prices: Prices;
  /** the outside members' 30-day pass (owner, 2026-10-13); null when it cannot be read */
  pass: PassSettings | null;
  /** เพื่อนชวนเพื่อน (owner, 2026-10-14); null when it cannot be read */
  referral: ReferralSettings | null;
  report: ReferralReport | null;
  /** เพดานงบใช้ฟรีต่อเดือน and this month's use (owner, 2026-10-15); null when it cannot be read */
  free: FreeView | null;
}) {
  return (
    <>
      <FreeCapCard free={free} />
      <PriceCard prices={prices} />
      <MemberPassCard pass={pass} />
      <ReferralAdminCard referral={referral} report={report} passOn={pass?.enabled ?? false} />
    </>
  );
}

type FreeView = Pick<FreeCap, "cap" | "spent"> & { monthly: number | null; until: string };

const thb = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * เพดานงบใช้ฟรีต่อเดือน (owner, 2026-10-15; mockup https://claude.ai/artifact/3TVTjpUcpnPz9ApRNjV241,
 * option ก): the most agents' free rounds and clips may cost the owner a month, and how much of
 * it is used. src/lib/wallet/free-cap.ts says what is counted and what happens when it is full.
 */
function FreeCapCard({ free }: { free: FreeView | null }) {
  const [typed, setTyped] = useState(free?.cap == null ? "" : String(free.cap));
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  if (!free) {
    return (
      <Card title="เพดานงบใช้ฟรีต่อเดือน">
        <Empty>อ่านเพดานงบใช้ฟรีไม่ได้ — ตรวจว่า migration 20261111_free_budget ถูก apply แล้ว</Empty>
      </Card>
    );
  }
  const save = () => {
    setSaid(undefined);
    start(async () => setSaid(await ask(() => saveFreeCap(typed), "บันทึกเพดานแล้ว")));
  };
  const { cap, spent } = free;
  const full = cap !== null && spent.thb >= cap;
  const pct = cap ? Math.round((spent.thb / cap) * 100) : null;
  // the bar is drawn against the ceiling, or against what was spent when there is none
  const scale = Math.max(cap ?? 0, spent.thb, 0.01);
  const width = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;

  return (
    <Card title="เพดานงบใช้ฟรีต่อเดือน" hint="ค่า AI ที่เราออกให้ตัวแทนใช้ฟรีได้สูงสุดต่อเดือน · ไม่นับงานของเจ้าของ สมาชิกที่จ่ายค่าสมาชิก ถาม AI บอท และงานที่ตัวแทนจ่ายจากกระเป๋าเงิน">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="free-cap" className="block text-xs text-[var(--bot-ink-mute)]">
            เพดานต่อเดือน (บาท)
            <input id="free-cap" inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="ไม่จำกัด"
                   className={`mt-1 block w-32 text-right tabular-nums text-[var(--bot-ink)] ${input}`} />
          </label>
          <button type="button" onClick={save} disabled={pending} className={primary}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          <span className="text-xs text-[var(--bot-ink-mute)]">
            เว้นว่าง = ไม่จำกัด{free.monthly !== null && ` · ต้องไม่เกินงบ AI รวม ฿${free.monthly.toLocaleString("en-US")}`}
          </span>
          {said && <Said {...said} />}
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
            <span>ใช้ไปเดือนนี้ <b>{thb(spent.thb)}</b>{cap !== null && <> จาก ฿{cap.toLocaleString("en-US")}</>}</span>
            {pct !== null && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${full
                ? "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"
                : pct >= 80 ? "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" : "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]"}`}>
                {full ? `เต็มแล้ว · รอบฟรีหยุดถึงวันที่ ${free.until}` : `${pct}% · ยังใช้ได้`}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex h-3 overflow-hidden rounded-md bg-[var(--bot-navy-soft)]" role="img" aria-label={pct === null ? "ไม่จำกัด" : `ใช้ไป ${pct} เปอร์เซ็นต์`}>
            <div style={{ width: width(spent.studioThb), background: "var(--bot-navy)" }} />
            <div style={{ width: width(spent.clipsThb), background: "var(--bot-blue)" }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--bot-ink-mute)] tabular-nums">
            <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-[var(--bot-navy)] align-[-1px]" />รอบฟรี Studio {thb(spent.studioThb)}</span>
            <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-[var(--bot-blue)] align-[-1px]" />คลิปฟรี {thb(spent.clipsThb)}</span>
          </div>
        </div>

        <dl className="grid gap-1.5 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-semibold">ใช้ไป 80%</dt><dd>ส่ง LINE แจ้งเจ้าของ</dd>
          <dt className="font-semibold">เต็มเพดาน</dt><dd>รอบฟรีและคลิปฟรีของตัวแทนหยุดชั่วคราวจนถึงวันที่ 1 ของเดือนถัดไป และส่ง LINE แจ้งเจ้าของอีกครั้ง</dd>
          <dt className="font-semibold">ยังใช้ได้ตามปกติ</dt><dd>งานที่จ่ายจากกระเป๋าเงิน รอบของสมาชิกที่จ่ายค่าสมาชิกแล้ว ถาม AI บอทตอบลูกค้า และงานของเจ้าของ</dd>
        </dl>
      </div>
    </Card>
  );
}

const GROUPS: { group: PriceGroup; title: string }[] = [
  { group: "picture", title: "รูปภาพ" },
  { group: "video", title: "วิดีโอนำเสนอ" },
];

/**
 * The fixed prices agents pay, typed in baht (owner, 2026-10-12). Each beside what one costs the
 * providers, about, and red when the price is not above it — a price is the owner's to set, so a
 * low one is said, not refused.
 */
function PriceCard({ prices }: { prices: Prices }) {
  const [typed, setTyped] = useState<Record<string, string>>(
    () => Object.fromEntries(PRICE_ITEMS.map((i) => [i.key, priceBaht(prices[i.key]).replace(/,/g, "")])),
  );
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  const save = () => {
    setSaid(undefined);
    start(async () => setSaid(await ask(() => savePrices(typed), "บันทึกราคาแล้ว")));
  };
  return (
    <Card title="ราคาต่อชิ้น" hint={`ตัวแทนจ่ายตามนี้เมื่อใช้รอบฟรีหมดแล้ว และเห็นราคานี้ในหน้ากระเป๋าเงิน · ต้นทุนเป็นตัวเลขประมาณ ช่องสีแดงคือราคาไม่เกินต้นทุน`}>
      <div className="space-y-4">
        {GROUPS.map(({ group, title }) => (
          <div key={group}>
            <h3 className="mb-1 text-xs font-semibold text-[var(--bot-ink-mute)]">{title}</h3>
            <div className="divide-y divide-[var(--bot-line)]">
              {PRICE_ITEMS.filter((i) => i.group === group).map((i) => {
                const v = Number(typed[i.key]);
                const low = !(v > i.costThb);
                return (
                  <label key={i.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="min-w-0 flex-1">{i.label}</span>
                    <span className={`text-xs tabular-nums ${low ? "font-semibold text-[var(--bot-red-ink)]" : "text-[var(--bot-ink-mute)]"}`}>
                      ต้นทุน ≈ ฿{i.costThb.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-[var(--bot-ink-mute)]">{i.extra ? "+฿" : "฿"}</span>
                      <input
                        id={`price-${i.key}`} inputMode="decimal" value={typed[i.key]}
                        onChange={(e) => setTyped((t) => ({ ...t, [i.key]: e.target.value }))}
                        aria-label={`ราคา ${i.label}`}
                        className={`w-24 text-right tabular-nums ${input}`}
                      />
                      <span className="w-10 text-xs text-[var(--bot-ink-mute)]">/{i.unit}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-[var(--bot-ink-mute)]">เขียนโพสต์ 8 แบบ และถอดเสียง/ตัดต่อคลิป ยังคิดต้นทุนจริง × ตัวคูณด้านบน</p>
        {(
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className={primary}>
              {pending ? "กำลังบันทึก…" : "บันทึกราคา"}
            </button>
            {said && <Said {...said} />}
          </div>
        )}
      </div>
    </Card>
  );
}

/** satang as the owner types baht: 9900 → "99", 14950 → "149.50" */
const typedBaht = (satang: number) => (satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2));

/**
 * What outside members pay for 30 days (owner, 2026-10-13). Off, members use the app free as
 * before. The owner's alone to change, like the price list; other admins see it read-only.
 */
function MemberPassCard({ pass }: { pass: PassSettings | null }) {
  const [enabled, setEnabled] = useState(pass?.enabled ?? false);
  const [baht, setBaht] = useState(pass ? typedBaht(pass.satang) : "");
  const [trialDays, setTrialDays] = useState(String(pass?.trialDays ?? ""));
  const [rounds, setRounds] = useState(String(pass?.rounds ?? ""));
  const [videos, setVideos] = useState(String(pass?.videos ?? ""));
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  if (!pass) {
    return (
      <Card title="ค่าสมาชิกทั่วไป">
        <Empty>อ่านการตั้งค่าค่าสมาชิกไม่ได้ — ตรวจว่า migration 20261027_member_pass ถูก apply แล้ว</Empty>
      </Card>
    );
  }

  const save = () => {
    setSaid(undefined);
    start(async () => setSaid(await ask(() => saveMemberPass({ enabled, baht, trialDays, rounds, videos }), "บันทึกแล้ว")));
  };
  const field = (label: string, id: string, value: string, set: (v: string) => void, mode: "decimal" | "numeric") => (
    <label htmlFor={id} className="block text-xs text-[var(--bot-ink-mute)]">
      {label}
      <input id={id} inputMode={mode} value={value} onChange={(e) => set(e.target.value)}
             className={`mt-1 block w-32 text-right tabular-nums text-[var(--bot-ink)] ${input}`} />
    </label>
  );

  return (
    <Card title="ค่าสมาชิกทั่วไป" hint={`สมาชิกทั่วไปที่สมัครด้วย Google จ่ายรายเดือนเพื่อใช้แอป · ตัวแทน UnitOS พนักงาน และเจ้าของไม่เปลี่ยน`}>
      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
          เก็บค่าสมาชิกทั่วไป (ปิดอยู่ = สมาชิกทุกคนใช้ฟรีเหมือนวันนี้)
        </label>
        <div className="flex flex-wrap gap-4">
          {field("ราคาต่อ 30 วัน (บาท)", "pass-price", baht, setBaht, "decimal")}
          {field("ทดลองใช้ฟรี (วัน)", "trial-days", trialDays, setTrialDays, "numeric")}
          {field("Studio ฟรีต่อ 30 วัน (รอบ)", "pass-rounds", rounds, setRounds, "numeric")}
          {/* วิดีโอนำเสนอ per period, counted afresh like the rounds (owner, 2026-10-14) */}
          {field("วิดีโอฟรีต่อ 30 วัน (คลิป)", "pass-videos", videos, setVideos, "numeric")}
        </div>
        <p className="text-xs text-[var(--bot-ink-mute)]">
          ราคาต่ำกว่า ฿150 จ่ายได้แค่พร้อมเพย์ (ค่าธรรมเนียมบัตรสูง) · {pass.trialDays > 0
            ? `เปิดสวิตช์แล้ว สมาชิกที่มีอยู่ได้ทดลอง ${pass.trialDays} วัน นับจากครั้งแรกที่เข้าใช้หลังเปิด`
            : "ทดลองใช้ 0 วัน = สมาชิกต้องจ่ายก่อนจึงใช้ได้"}
        </p>
        {(
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className={primary}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            {said && <Said {...said} />}
          </div>
        )}
      </div>
    </Card>
  );
}

/** someone whose friends sign up and never pay is worth a look (mockup v5: น่าสงสัย) */
export const SUSPECT_JOINED = 5;

/**
 * เพื่อนชวนเพื่อน (owner, 2026-10-14): the switch and its numbers, the owner's alone to change,
 * and everyone who invited somebody.
 */
function ReferralAdminCard({ referral, report, passOn }: {
  referral: ReferralSettings | null; report: ReferralReport | null; passOn: boolean;
}) {
  const [enabled, setEnabled] = useState(referral?.enabled ?? false);
  const [days, setDays] = useState(String(referral?.days ?? ""));
  const [daysCap, setDaysCap] = useState(String(referral?.daysCap ?? ""));
  const [baht, setBaht] = useState(referral ? String(referral.satang / 100) : "");
  const [bahtCap, setBahtCap] = useState(referral ? String(referral.satangCap / 100) : "");
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  if (!referral) {
    return (
      <Card title="ชวนเพื่อน">
        <Empty>อ่านการตั้งค่าชวนเพื่อนไม่ได้ — ตรวจว่า migration 20261103_referrals ถูก apply แล้ว</Empty>
      </Card>
    );
  }

  const save = () => {
    setSaid(undefined);
    start(async () => setSaid(await ask(() => saveReferral({ enabled, days, daysCap, baht, bahtCap }), "บันทึกแล้ว")));
  };
  const field = (label: string, id: string, value: string, set: (v: string) => void) => (
    <label htmlFor={id} className="block text-xs text-[var(--bot-ink-mute)]">
      {label}
      <input id={id} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)}
             className={`mt-1 block w-32 text-right tabular-nums text-[var(--bot-ink)] ${input}`} />
    </label>
  );
  const reward = (kind: "member" | "unitos", n: number) => (kind === "member" ? `+${n} วัน` : formatBaht(n));

  return (
    <Card title="ชวนเพื่อน" hint={`เพื่อนสมัครผ่านลิงก์และจ่ายค่าสมาชิกครั้งแรก คนชวนได้รางวัล · เพื่อนขอเงินคืน รางวัลถูกหักคืน`}>
      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
          เปิดระบบชวนเพื่อน
        </label>
        {enabled && !passOn && (
          <p className="text-xs text-[var(--bot-red-ink)]">ค่าสมาชิกทั่วไปปิดอยู่ เพื่อนจึงยังไม่ต้องจ่าย การ์ดชวนเพื่อนจะยังไม่ขึ้นจนกว่าจะเปิดค่าสมาชิก</p>
        )}
        <p className="text-xs font-medium">สมาชิกทั่วไปชวน ได้วันใช้ฟรี</p>
        <div className="flex flex-wrap gap-4">
          {field("วันฟรีต่อเพื่อน 1 คน", "ref-days", days, setDays)}
          {field("สูงสุดต่อเดือน (วัน)", "ref-days-cap", daysCap, setDaysCap)}
        </div>
        <p className="text-xs font-medium">ตัวแทน UnitOS ชวน ได้เงินเข้ากระเป๋า Studio</p>
        <div className="flex flex-wrap gap-4">
          {field("เงินต่อเพื่อน 1 คน (บาท)", "ref-baht", baht, setBaht)}
          {field("สูงสุดต่อเดือน (บาท)", "ref-baht-cap", bahtCap, setBahtCap)}
        </div>
        {(
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className={primary}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            {said && <Said {...said} />}
          </div>
        )}

        {report === null ? <Empty>อ่านรายงานชวนเพื่อนไม่ได้</Empty> : (
          <>
            <p className="text-sm text-[var(--bot-ink-mute)]">
              เดือนนี้ให้วันฟรีไป <b className="tabular-nums text-[var(--bot-ink)]">{report.monthDays}</b> วัน
              · ให้เงินตัวแทน <b className="tabular-nums text-[var(--bot-ink)]">{formatBaht(report.monthSatang)}</b>
              {" "}· เพื่อนใหม่ที่จ่ายแล้ว <b className="tabular-nums text-[var(--bot-ink)]">{report.monthPaid}</b> คน
              {" "}· รายได้สมาชิกจากเพื่อนที่ถูกชวน <b className="tabular-nums text-[var(--bot-ink)]">{formatBaht(report.monthRevenueSatang)}</b>
            </p>
            {report.rows.length === 0 ? <Empty>ยังไม่มีใครชวนเพื่อน</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bot-line)] text-left text-[var(--bot-ink-mute)]">
                      <th className="py-2 pr-3">คนชวน</th>
                      <th className="py-2 pr-3 text-right">สมัคร</th>
                      <th className="py-2 pr-3 text-right">จ่ายแล้ว</th>
                      <th className="py-2 pr-3 text-right">ได้เดือนนี้</th>
                      <th className="py-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => {
                      const cap = r.kind === "member" ? referral.daysCap : referral.satangCap;
                      const status = r.joined >= SUSPECT_JOINED && r.paid === 0 ? { text: "น่าสงสัย · สมัครแต่ไม่มีใครจ่าย", cls: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]" }
                        : r.monthReward >= cap && cap > 0 ? { text: "ถึงเพดานเดือนนี้", cls: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" }
                        : { text: "ปกติ", cls: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" };
                      return (
                        <tr key={r.referrerId} className="border-b border-[var(--bot-line)] last:border-0">
                          <td className="py-2 pr-3">
                            {r.name} <span className="text-xs text-[var(--bot-ink-mute)]">· {r.kind === "member" ? "สมาชิก" : "ตัวแทน UnitOS"}</span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.joined}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{r.paid}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{reward(r.kind, r.monthReward)}</td>
                          <td className="py-2"><span className={`rounded-full px-2 text-xs ${status.cls}`}>{status.text}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
