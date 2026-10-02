import { AsyncLocalStorage } from "node:async_hooks";
import type { EditPass } from "@/lib/content/clip";
import { chargeSatang, holdSatangFor } from "./money";
import { releaseWallet, returnFreeRound, settleWallet } from "./store";

/**
 * Who pays for an AI round, and — when it is the agent's wallet — what the round really cost.
 *
 * The usage ledger says what each call cost but not whose round it was, and a round is many
 * calls (a planner, writers, a proofreader, a picture). So while a wallet round runs it carries
 * a meter in async context: the AI client adds every call's cost to it as it records the call
 * (src/lib/ai/client.ts), and when the round is over the meter is what is charged. Two rounds
 * running at once each have their own.
 */

export type WalletPass = { ok: true; paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number };
/** `auditId`: the round's line in ins_audit, renamed when the round is handed back */
export type FreePass = { ok: true; paidBy: "free"; auditId: number };
export type RoundPass = { ok: false; refusal: string } | { ok: true; paidBy: "staff" } | FreePass | WalletPass;

interface Meter { spentThb: number }
const meters = new AsyncLocalStorage<Meter>();

/** a call's cost, added to the wallet round it belongs to; outside one it is only the owner's */
export function meterCost(thb: number): void {
  const meter = meters.getStore();
  if (meter && Number.isFinite(thb) && thb > 0) meter.spentThb += thb;
}

/** inside a round the agent pays for: the owner's content ceiling does not stand over it */
export const inWalletRound = (): boolean => meters.getStore() !== undefined;

export interface Outcome { ok: boolean; items?: unknown[] }

/** a round gave the agent something: it went through, or it saved pieces before it stopped */
export const delivered = (r: Outcome): boolean => r.ok || (Array.isArray(r.items) && r.items.length > 0);

/** a free round's line renamed, so the count gives it back; a failure is logged and the round stays used */
async function giveBack(pass: FreePass): Promise<void> {
  try {
    if (!(await returnFreeRound(pass.auditId))) console.error(`free round ${pass.auditId} was not there to give back`);
  } catch (e) {
    console.error(`free round ${pass.auditId} not given back:`, e);
  }
}

/** a free round that throws, or gives the agent nothing, is handed back like a wallet round's money (review, 2026-10-01) */
async function runFree<R extends Outcome>(pass: FreePass, run: () => Promise<R>): Promise<R> {
  let result: R;
  try {
    result = await run();
  } catch (e) {
    await giveBack(pass);
    throw e;
  }
  if (!delivered(result)) await giveBack(pass);
  return result;
}

/**
 * Runs a round and settles who paid. A round that throws, or gives the agent nothing, gives
 * the whole hold back: the providers' cost of a failure is the owner's, not the agent's — and a
 * free round that does the same is handed back to the count.
 * A settle that fails is logged and the answer still goes out — the hold is swept back to the
 * agent in fifteen minutes (ins_wallet_sweep_holds), so the error is in the agent's favour.
 */
export async function payRound<R extends Outcome>(pass: Extract<RoundPass, { ok: true }>, run: () => Promise<R>): Promise<R> {
  if (pass.paidBy === "free") return runFree(pass, run);
  if (pass.paidBy !== "wallet") return run();
  const meter: Meter = { spentThb: 0 };
  let result: R;
  try {
    result = await meters.run(meter, run);
  } catch (e) {
    await releaseWallet(pass.holdId).catch((err) => console.error("wallet release failed:", err));
    throw e;
  }
  try {
    if (delivered(result)) {
      // the charge never passes the hold, so a round that cost more is undercharged; said once
      // in the log so the owner can raise ROUND_HOLD_THB (src/lib/wallet/money.ts) (owner, 2026-09-30)
      const wanted = holdSatangFor(meter.spentThb, pass.multiplier);
      if (wanted > pass.heldSatang) {
        console.warn(`wallet hold ${pass.holdId}: the round cost ${wanted} satang with the multiplier but held ${pass.heldSatang}; charged the hold`);
      }
      await settleWallet(pass.holdId, chargeSatang(meter.spentThb, pass.multiplier, pass.heldSatang), meter.spentThb);
    } else {
      await releaseWallet(pass.holdId);
    }
  } catch (e) {
    console.error("wallet settle failed:", e);
  }
  return result;
}

/**
 * Settles a round whose work finished after the answer went back — a clip's render, collected
 * by a poll or a webhook (src/lib/video/jobs.ts). Delivered: a wallet round is charged its cost
 * times the multiplier, never past its hold. Not delivered: a wallet round's hold comes back,
 * a free round goes back to the count. Staff, and a free round that delivered, owe nothing.
 * A settle that fails is logged, as payRound's is: the hold is swept back in fifteen minutes.
 */
export async function settleLater(pass: EditPass, delivered: boolean, costThb: number): Promise<void> {
  if (pass.paidBy === "free") {
    if (!delivered) await giveBack({ ok: true, ...pass });
    return;
  }
  if (pass.paidBy !== "wallet") return;
  try {
    if (!delivered) { await releaseWallet(pass.holdId); return; }
    if (holdSatangFor(costThb, pass.multiplier) > pass.heldSatang) {
      console.warn(`wallet hold ${pass.holdId}: the job cost more than it held; charged the hold`);
    }
    await settleWallet(pass.holdId, chargeSatang(costThb, pass.multiplier, pass.heldSatang), costThb);
  } catch (e) {
    console.error(`wallet hold ${pass.holdId} not settled:`, e instanceof Error ? e.message : e);
  }
}
