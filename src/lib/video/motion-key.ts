/**
 * ภาพขยับ: the keys that turn a clip's still cartoon into a moving one — fal.ai and Runware
 * (owner, 2026-10-16). Kept in the same encrypted table as the AI keys under these names, but in
 * neither PROVIDERS nor RENDER_PROVIDERS: they have no chat model to test and are not render
 * engines. A plain module, not actions.ts, so the checks can be tested without the server action.
 */
export const MOTION_PROVIDERS = ["fal", "runware"] as const;
export type MotionProvider = (typeof MOTION_PROVIDERS)[number];
export const isMotionProvider = (p: unknown): p is MotionProvider => (MOTION_PROVIDERS as readonly unknown[]).includes(p);

/** fal: the model the test asks the price of; asking costs nothing, and only a good key gets an answer */
const FAL_PRICED_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const FAL_PRICING_URL = `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(FAL_PRICED_MODEL)}`;
const RUNWARE_URL = "https://api.runware.ai/v1";

/** `credit`: what the account has left, when the provider says (Runware does, fal does not) */
export type MotionCheck = { state: "ok"; ms: number; credit?: string } | { state: "bad"; error: string };

const WRONG_KEY = "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว";
const UNREACHABLE = (who: string) => `ติดต่อ ${who} ไม่ได้ ลองใหม่อีกครั้ง`;

/**
 * Whether the provider takes this key, without making a video. fal: one GET of a model's price.
 * Runware: its account getDetails, which also says the balance — and lists the account's API
 * keys, so nothing from the answer but the balance is kept. 401/403 is the key itself; anything
 * else is the provider's own trouble, said with its status.
 */
export async function checkMotionKey(provider: MotionProvider, key: string, fetchImpl: typeof fetch = fetch): Promise<MotionCheck> {
  const who = provider === "fal" ? "fal" : "Runware";
  const t0 = Date.now();
  try {
    const res = provider === "fal"
      ? await fetchImpl(FAL_PRICING_URL, { headers: { Authorization: `Key ${key}` }, signal: AbortSignal.timeout(15_000) })
      : await fetchImpl(RUNWARE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify([{ taskType: "accountManagement", taskUUID: crypto.randomUUID(), operation: "getDetails" }]),
          signal: AbortSignal.timeout(15_000),
        });
    if (res.status === 401 || res.status === 403) return { state: "bad", error: WRONG_KEY };
    if (provider === "fal") {
      return res.ok ? { state: "ok", ms: Date.now() - t0 } : { state: "bad", error: `${who} ตอบกลับไม่ได้ (${res.status}) ลองใหม่อีกครั้ง` };
    }
    const body = (await res.json().catch(() => null)) as { data?: { balance?: { amount?: unknown; currency?: unknown } }[]; errors?: { code?: unknown }[] } | null;
    // Runware may answer a wrong key with a 200 and an errors list rather than a 401
    if (body?.errors?.some((e) => e?.code === "invalidApiKey")) return { state: "bad", error: WRONG_KEY };
    const balance = body?.data?.[0]?.balance;
    if (!res.ok || !balance) return { state: "bad", error: `${who} ตอบกลับไม่ได้ (${res.status}) ลองใหม่อีกครั้ง` };
    const amount = Number(balance.amount);
    const currency = balance.currency === "USD" || balance.currency == null ? "$" : `${String(balance.currency)} `;
    return { state: "ok", ms: Date.now() - t0, ...(Number.isFinite(amount) ? { credit: `เครดิตเหลือ ${currency}${amount.toFixed(2)}` } : {}) };
  } catch {
    return { state: "bad", error: UNREACHABLE(who) };
  }
}
