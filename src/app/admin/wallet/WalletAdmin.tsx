"use client";
import { useState, useTransition } from "react";
import { formatBaht } from "@/lib/wallet/money";
import type { FrozenWallet, WalletRow, WalletSettings } from "@/lib/wallet/store";
import { Card, Empty } from "../ui";
import { adjustAgentWallet, saveWallet, unfreezeAgentWallet } from "./actions";
import { ask, input, primary, quiet, Said } from "./form";

/**
 * กระเป๋าเงิน: the switch, the wallets a refund froze, and every wallet's line. The prices, the
 * members' pass and ชวนเพื่อน went to ราคาและโปรโมชัน on 2026-10-15 (owner chose ข).
 */
export function WalletAdmin({ settings, rows, frozen = [] }: {
  settings: WalletSettings | null;
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
      <Card title="กระเป๋าเงินตัวแทน" hint="เปิดแล้ว ตัวแทนเติมเงินและใช้ AI ต่อจากกระเป๋าได้เมื่อเครดิตเริ่มต้นหมด · ผู้ช่วยก็เช่นกัน · เจ้าของใช้ฟรี">
        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
            เปิดให้ตัวแทนเติมเงินและใช้ AI ต่อจากกระเป๋าเมื่อเครดิตหมด
          </label>
          <label className="block text-sm">
            <span className="block text-xs text-[var(--bot-ink-mute)]">ตัวคูณราคา สำหรับเขียนโพสต์และตัดต่อคลิป (ต้นทุนจริงของ AI × ตัวคูณ, 1 ถึง 10) · รูปและวิดีโอใช้ราคาที่หน้าราคาและโปรโมชัน</span>
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

      <p className="mb-5 text-sm text-[var(--bot-ink-mute)]">
        ราคาต่อชิ้น ค่าสมาชิก และชวนเพื่อน อยู่ที่หน้า{" "}
        <a href="/admin/prices" className="text-[var(--bot-navy)]">ราคาและโปรโมชัน</a>
      </p>

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
