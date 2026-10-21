import { TOPUP_THB } from "@/lib/wallet/money";
import type { PassSettings } from "@/lib/members/pass";
import type { ReferralSettings } from "@/lib/referrals/referral";

/**
 * The price list under the sign-in box (owner, 2026-10-20; mockup
 * https://claude.ai/artifact/QEphNuJbqufEhqVJzRKrcC, owner chose ก ก ก). Two packages — the
 * outside members' and UnitOS agents' — and the top-ups. No per-item prices: the owner took
 * them out; they stay on Studio's own price list.
 *
 * Every figure is the back office's: the member pass and its credits (/admin/wallet), the
 * agents' starter credit (/admin/prices), the referral days. Built here, apart from the reads,
 * so what a visitor is told can be checked without a database.
 */
export interface FrontPrices {
  member: {
    /** the pass is switched on; off, a member signs up and uses it free (/membership says so) */
    paid: boolean;
    trialDays: number;
    trialCreditThb: number;
    passThb: number;
    passCreditThb: number;
    /** days a member is given for each friend who pays; null when referrals are off */
    referralDays: number | null;
  };
  /** an agent's one starter credit; null when it cannot be read, and the line is left out */
  agentStarterThb: number | null;
  /** the top-up amounts; empty while the wallet is switched off. The list no longer shows them (2026-10-21), only that topping up is possible */
  topUpsThb: number[];
}

export function frontPricesOf(input: {
  pass: PassSettings;
  referral: ReferralSettings | null;
  agentStarterSatang: number | null;
  walletOn: boolean;
}): FrontPrices {
  const { pass, referral } = input;
  return {
    member: {
      paid: pass.enabled,
      trialDays: pass.trialDays,
      trialCreditThb: pass.trialCreditSatang / 100,
      passThb: pass.satang / 100,
      passCreditThb: pass.creditSatang / 100,
      referralDays: referral?.enabled && referral.days > 0 ? referral.days : null,
    },
    agentStarterThb: input.agentStarterSatang === null ? null : input.agentStarterSatang / 100,
    topUpsThb: input.walletOn ? [...TOPUP_THB] : [],
  };
}

/** "199", "1,500", "12.50": baht as the list writes it */
export function thb(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** the line under the Google button for somebody without an account yet */
export function signupHint(p: FrontPrices["member"]): string {
  return p.paid && p.trialDays > 0
    ? `ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร ทดลองฟรี ${p.trialDays} วัน`
    : "ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร";
}
