import type { ReactNode } from "react";
import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL, type PayMode } from "@/calc/types";
import { Highlighted } from "@/components/Highlighted";
import { FIRST_MONTHLY_INSTALMENTS, firstMonthlyPayment } from "@/lib/first-payment";
import type { Legacy } from "@/lib/legacy-headline";

/**
 * What is paid, in the back-office calculator's summary box (owner, 2026-10-06), shared by
 * every sales calculator: every instalment the company will take a row, largest first, the
 * one the card headlines in bold and the others highlighted, with what paying monthly takes
 * up front under the monthly row. `children` goes at the foot, under a rule — Life Protect
 * puts its contract-by-contract split there.
 */
export function PremiumSummary({ modes, main, children }: {
  modes: ModePremium[];
  /** the instalment the card headlines */
  main: PayMode;
  children?: ReactNode;
}) {
  const payable = modes.filter((m) => !m.belowMinimum).sort((a, b) => b.total - a.total);
  const first = firstMonthlyPayment(modes);
  return (
    <div className="rounded-lg bg-[var(--bot-sand-soft)] p-4">
      <div className="text-sm text-[var(--bot-navy)]">เบี้ยประกันที่ต้องชำระ</div>
      <dl className="mt-2 space-y-1">
        {payable.map((m) => {
          const bold = m.mode === main;
          const amount = `${formatBaht(m.total)} บาท`;
          return (
            <div key={m.mode}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className={`text-sm text-[var(--bot-navy)] ${bold ? "font-semibold" : ""}`}>
                  {bold ? PAY_MODE_LABEL[m.mode] : <Highlighted>{PAY_MODE_LABEL[m.mode]}</Highlighted>}
                </dt>
                <dd className={`tabular-nums text-[var(--bot-navy)] ${bold ? "text-2xl font-semibold" : ""}`}>
                  {bold ? amount : <Highlighted>{amount}</Highlighted>}
                </dd>
              </div>
              {m.mode === "monthly" && first !== undefined && (
                <div className="mt-1 text-right text-xs text-[var(--bot-navy)]">
                  <Highlighted>ชำระเบี้ยครั้งแรก {FIRST_MONTHLY_INSTALMENTS} งวด {formatBaht(first)} บาท</Highlighted>
                </div>
              )}
            </div>
          );
        })}
      </dl>
      {children && <div className="mt-3 border-t border-[var(--bot-line-strong)] pt-2.5">{children}</div>}
    </div>
  );
}

/**
 * The block above the box: what the premium is, in the largest type, and what it comes to by
 * the day. As tall as the family photo in the panel's corner, so the box after it never runs
 * under the picture — the photo is 6rem from 0.5rem down on a phone, 8rem on a wider screen,
 * and the panel's own padding is 1.25rem.
 */
export function PremiumHeadline({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-[5.5rem] sm:min-h-[7.5rem]">
      <div className="text-sm text-[var(--lg-mute)]">{label}</div>
      {children}
    </div>
  );
}

/**
 * The figure's size on a phone, by how long it is. On a 375px screen the room left of the
 * family photo is about 217px, and at the full 2.6rem "2,000,000 บาท" already ran under the
 * picture; a sum's digits cannot wrap, so a longer figure is set smaller instead — down to
 * Life Protect's largest, 100,000,000. From `sm` up there is room for every one at full size.
 */
function phoneSize(figure: string): string {
  if (figure.length <= 7) return "text-[2.6rem]";
  if (figure.length <= 9) return "text-[2.3rem]";
  if (figure.length <= 10) return "text-[2rem]";
  return "text-[1.7rem]";
}

/**
 * The block above the box, led by what the family inherits (owner, 2026-10-06): "มรดก" and the
 * figure in the largest type, how it is paid under it, and what the premium comes to by the
 * day. The premium itself is the box's to state. As tall as the family photo in the panel's
 * corner, as PremiumHeadline is, so the box after it never runs under the picture.
 */
export function LegacyHeadline({ legacy, perDay }: {
  legacy: Legacy;
  /** "48", from perDayText; absent when there is no price to divide */
  perDay?: string;
}) {
  const figure = legacy.amount.toLocaleString("en-US");
  return (
    <div className="min-h-[5.5rem] sm:min-h-[7.5rem]">
      <div className="text-sm text-[var(--lg-mute)]">มรดก</div>
      <div className={`lg-figure mt-1 ${phoneSize(figure)} leading-none tabular-nums sm:text-[2.6rem]`}>
        <span className="lg-metal-text">{figure}</span>
        <span className="ml-2 text-base text-[var(--lg-mute)]">บาท</span>
      </div>
      {legacy.note && <div className="mt-1.5 text-sm text-[var(--lg-mute)]">{legacy.note}</div>}
      {perDay && (
        <div className="mt-2.5 text-sm text-[var(--lg-mute)]">
          <Highlighted>
            ตกวันละ <span className="lg-figure tabular-nums">{perDay}</span> บาท
          </Highlighted>
        </div>
      )}
    </div>
  );
}
