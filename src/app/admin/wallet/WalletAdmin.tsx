"use client";
import { useState, useTransition } from "react";
import type { PassSettings } from "@/lib/members/pass";
import type { ReferralSettings } from "@/lib/referrals/referral";
import type { ReferralReport } from "@/lib/referrals/store";
import { formatBaht } from "@/lib/wallet/money";
import { PRICE_ITEMS, priceBaht, type PriceGroup, type Prices } from "@/lib/wallet/prices";
import type { FrozenWallet, WalletRow, WalletSettings } from "@/lib/wallet/store";
import { Card, Empty } from "../ui";
import { adjustAgentWallet, saveMemberPass, savePrices, saveReferral, saveWallet, unfreezeAgentWallet, type Result } from "./actions";

/**
 * The same look as /admin/ai (its Card, tokens and input classes), so the two settings pages
 * read as one back office. Every control is at least 44px tall: the owner uses this on a phone.
 */
const input = "min-h-11 rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-1 text-sm";
const primary = "min-h-11 rounded bg-[var(--bot-navy)] px-4 text-sm text-[var(--bot-surface)] disabled:opacity-40";
const quiet = "min-h-11 rounded border border-[var(--bot-line-strong)] px-3 text-sm font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

/** A save's answer, beside the button that asked: green with a tick, or red with the reason. */
function Said({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span role="status" className={`text-xs ${ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
      {ok ? "✓ " : ""}{text}
    </span>
  );
}

/** A thrown action means the request never came back; a returned one carries its own Thai sentence. */
async function ask(fn: () => Promise<Result>, ok: string): Promise<{ ok: boolean; text: string }> {
  try {
    const r = await fn();
    return r.ok ? { ok: true, text: ok } : { ok: false, text: r.error };
  } catch {
    return { ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" };
  }
}

export function WalletAdmin({ settings, rows, frozen = [], prices, pass = null, referral = null, report = null, canPrice }: {
  settings: WalletSettings | null;
  /** เพื่อนชวนเพื่อน (owner, 2026-10-14); null when it cannot be read */
  referral?: ReferralSettings | null;
  report?: ReferralReport | null;
  /** the outside members' 30-day pass (owner, 2026-10-13); null when it cannot be read */
  pass?: PassSettings | null;
  /** the fixed prices agents pay (owner, 2026-10-12) */
  prices: Prices;
  /** the owner's alone to change; an admin sees them */
  canPrice: boolean;
  rows: WalletRow[] | null;
  /** wallets a refund or a dispute froze; null when they cannot be read */
  frozen?: FrozenWallet[] | null;
}) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [multiplier, setMultiplier] = useState(String(settings?.multiplier ?? 2));
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  if (!settings) {
    return (
      <Card title="กระเป๋าเงินตัวแทน">
        <Empty>อ่านการตั้งค่ากระเป๋าเงินไม่ได้ — ตรวจว่า migration 20260930_wallet ถูก apply แล้ว</Empty>
      </Card>
    );
  }

  const save = () => {
    setSaid(undefined);
    start(async () => setSaid(await ask(() => saveWallet(enabled, multiplier), "บันทึกแล้ว")));
  };

  return (
    <>
      <Card title="กระเป๋าเงินตัวแทน" hint="เปิดแล้ว ตัวแทนเติมเงินและใช้ AI ต่อจากกระเป๋าได้เมื่อรอบฟรีหมด · ผู้ช่วยก็เช่นกัน · เจ้าของใช้ฟรี">
        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
            เปิดให้ตัวแทนเติมเงินและใช้ AI ต่อจากกระเป๋าเมื่อรอบฟรีหมด
          </label>
          <label className="block text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">ตัวคูณราคา สำหรับเขียนโพสต์และตัดต่อคลิป (ต้นทุนจริงของ AI × ตัวคูณ, 1 ถึง 10) · รูปและวิดีโอใช้ราคาด้านล่าง</span>
            <input inputMode="decimal" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={`mt-1 w-32 ${input}`} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className={primary}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            {said && <Said {...said} />}
          </div>
        </div>
      </Card>

      <PriceCard prices={prices} canPrice={canPrice} />

      <MemberPassCard pass={pass} canPrice={canPrice} />

      <ReferralAdminCard referral={referral} report={report} passOn={pass?.enabled ?? false} canPrice={canPrice} />

      {frozen === null ? (
        <Card title="กระเป๋าที่ถูกพัก">
          <Empty>อ่านรายการกระเป๋าที่ถูกพักไม่ได้ — ตรวจว่า migration 20261001_wallet_refunds_free_rounds ถูก apply แล้ว</Empty>
        </Card>
      ) : frozen.length > 0 && (
        <Card title="กระเป๋าที่ถูกพัก" hint="ถูกคืนเงินหรือถูกโต้แย้งการชำระใน Stripe · ใช้ AI จากกระเป๋าและเติมเงินไม่ได้จนกว่าเจ้าของจะปลด">
          <ul className="space-y-3">
            {frozen.map((f) => <FrozenRow key={f.agentId} wallet={f} row={rows?.find((r) => r.agentId === f.agentId)} />)}
          </ul>
        </Card>
      )}

      <Card title="กระเป๋าของตัวแทน" hint="ยอดเติมและยอดใช้ นับตั้งแต่ต้นเดือนนี้">
        {rows === null ? <Empty>อ่านรายการกระเป๋าไม่ได้</Empty>
          : rows.length === 0 ? <Empty>ยังไม่มีใครเติมเงิน</Empty>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--bot-line)] text-left text-[var(--bot-ink-mute)]">
                    <th className="py-2 pr-3">ตัวแทน</th>
                    <th className="py-2 pr-3">สังกัด</th>
                    <th className="py-2 pr-3">หน่วย</th>
                    <th className="py-2 pr-3 text-right">คงเหลือ</th>
                    <th className="py-2 pr-3 text-right">เติมเดือนนี้</th>
                    <th className="py-2 pr-3 text-right">ใช้เดือนนี้</th>
                    <th className="py-2"><span className="sr-only">ปรับยอด</span></th>
                  </tr>
                </thead>
                <tbody>{rows.map((r) => <Row key={r.agentId} row={r} />)}</tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  );
}

function Row({ row }: { row: WalletRow }) {
  const [open, setOpen] = useState(false);
  const [baht, setBaht] = useState("");
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  const apply = () => {
    setSaid(undefined);
    start(async () => {
      const r = await ask(() => adjustAgentWallet(row.agentId, baht, note), "ปรับแล้ว");
      setSaid(r);
      if (r.ok) { setBaht(""); setNote(""); setOpen(false); }
    });
  };
  return (
    <>
      <tr className="border-b border-[var(--bot-line)]">
        <td className="py-1.5 pr-3">{row.name || "(ไม่มีชื่อ)"} <span className="text-xs text-[var(--bot-ink-faint)]">{row.code}</span></td>
        <td className="py-1.5 pr-3">{row.isMember ? <MemberTag /> : row.tenant ?? "–"}</td>
        <td className="py-1.5 pr-3">{row.unit ?? "–"}</td>
        <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{formatBaht(row.balanceSatang)}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{formatBaht(row.toppedUpSatang)}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{formatBaht(row.chargedSatang)}</td>
        <td className="py-1.5 text-right">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={quiet}>ปรับยอด</button>
        </td>
      </tr>
      {(open || said) && (
        <tr className="border-b border-[var(--bot-line)]">
          <td colSpan={7} className="py-3">
            {open && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); apply(); }}>
                <label className="text-xs text-[var(--bot-ink-mute)]">
                  บาท (ใส่ - เพื่อหักออก)
                  <input inputMode="decimal" value={baht} onChange={(e) => setBaht(e.target.value)} className={`mt-1 block w-32 text-[var(--bot-ink)] ${input}`} />
                </label>
                <label className="min-w-48 flex-1 text-xs text-[var(--bot-ink-mute)]">
                  เหตุผล (ต้องใส่)
                  <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`mt-1 block w-full text-[var(--bot-ink)] ${input}`} />
                </label>
                <button disabled={pending} className={primary}>{pending ? "กำลังบันทึก…" : "ยืนยัน"}</button>
              </form>
            )}
            {said && <div className="mt-2"><Said {...said} /></div>}
          </td>
        </tr>
      )}
    </>
  );
}

/** an outside member's wallet (สมาชิกทั่วไป): no สังกัด or หน่วย */
function MemberTag() {
  return <span className="rounded-full bg-[var(--bot-line)] px-2 py-0.5 text-xs text-[var(--bot-ink-mute)]">สมาชิกทั่วไป</span>;
}

/**
 * A wallet a refund or a dispute froze: what could not be taken back, why, and the owner's
 * hand to lift it (owner, 2026-10-01). Lifting it lets the shortfall go — to collect it, take
 * it with ปรับยอด on the wallet's line below first.
 */
function FrozenRow({ wallet, row }: { wallet: FrozenWallet; row?: WalletRow }) {
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  const lift = () => {
    setSaid(undefined);
    start(async () => {
      const r = await ask(() => unfreezeAgentWallet(wallet.agentId, note), "ปลดการพักแล้ว");
      setSaid(r);
      if (r.ok) setNote("");
    });
  };
  return (
    <li className="rounded border border-[var(--bot-line)] p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          {row?.name || "(ไม่มีชื่อ)"} <span className="text-xs text-[var(--bot-ink-faint)]">{row?.code ?? wallet.agentId}</span>
          {row?.isMember ? <> <MemberTag /></>
            : (row?.tenant || row?.unit) && <span className="text-xs text-[var(--bot-ink-mute)]"> · {[row.tenant, row.unit && `หน่วย${row.unit}`].filter(Boolean).join(" · ")}</span>}
        </span>
        <span className="text-xs text-[var(--bot-ink-mute)]">
          พักตั้งแต่ {new Date(wallet.frozenAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
        </span>
      </div>
      {wallet.reason && <p className="mt-1 text-xs text-[var(--bot-ink-mute)]">{wallet.reason}</p>}
      <p className="mt-1">
        หักคืนไม่ครบ <span className={`font-semibold tabular-nums ${wallet.shortfallSatang > 0 ? "text-[var(--bot-red-ink)]" : ""}`}>{formatBaht(wallet.shortfallSatang)}</span>
        {row && <> · คงเหลือ <span className="tabular-nums">{formatBaht(row.balanceSatang)}</span></>}
      </p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); lift(); }}>
        <label className="min-w-48 flex-1 text-xs text-[var(--bot-ink-mute)]">
          เหตุผลที่ปลดการพัก (ต้องใส่ · ยอดที่หักคืนไม่ครบจะถูกล้างไปด้วย)
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`mt-1 block w-full text-[var(--bot-ink)] ${input}`} />
        </label>
        <button disabled={pending} className={primary}>{pending ? "กำลังบันทึก…" : "ปลดการพัก"}</button>
      </form>
      {said && <div className="mt-2"><Said {...said} /></div>}
    </li>
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
function PriceCard({ prices, canPrice }: { prices: Prices; canPrice: boolean }) {
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
    <Card title="ราคาต่อชิ้น" hint={`ตัวแทนจ่ายตามนี้เมื่อใช้รอบฟรีหมดแล้ว และเห็นราคานี้ในหน้ากระเป๋าเงิน · ต้นทุนเป็นตัวเลขประมาณ ช่องสีแดงคือราคาไม่เกินต้นทุน${canPrice ? "" : " · เจ้าของเท่านั้นที่แก้ราคาได้"}`}>
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
                        id={`price-${i.key}`} inputMode="decimal" value={typed[i.key]} disabled={!canPrice}
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
        {canPrice && (
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
function MemberPassCard({ pass, canPrice }: { pass: PassSettings | null; canPrice: boolean }) {
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
      <input id={id} inputMode={mode} value={value} disabled={!canPrice} onChange={(e) => set(e.target.value)}
             className={`mt-1 block w-32 text-right tabular-nums text-[var(--bot-ink)] ${input}`} />
    </label>
  );

  return (
    <Card title="ค่าสมาชิกทั่วไป" hint={`สมาชิกทั่วไปที่สมัครด้วย Google จ่ายรายเดือนเพื่อใช้แอป · ตัวแทน UnitOS พนักงาน และเจ้าของไม่เปลี่ยน${canPrice ? "" : " · เจ้าของเท่านั้นที่แก้ได้"}`}>
      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canPrice} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
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
        {canPrice && (
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
function ReferralAdminCard({ referral, report, passOn, canPrice }: {
  referral: ReferralSettings | null; report: ReferralReport | null; passOn: boolean; canPrice: boolean;
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
      <input id={id} inputMode="numeric" value={value} disabled={!canPrice} onChange={(e) => set(e.target.value)}
             className={`mt-1 block w-32 text-right tabular-nums text-[var(--bot-ink)] ${input}`} />
    </label>
  );
  const reward = (kind: "member" | "unitos", n: number) => (kind === "member" ? `+${n} วัน` : formatBaht(n));

  return (
    <Card title="ชวนเพื่อน" hint={`เพื่อนสมัครผ่านลิงก์และจ่ายค่าสมาชิกครั้งแรก คนชวนได้รางวัล · เพื่อนขอเงินคืน รางวัลถูกหักคืน${canPrice ? "" : " · เจ้าของเท่านั้นที่แก้ได้"}`}>
      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canPrice} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
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
        {canPrice && (
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
