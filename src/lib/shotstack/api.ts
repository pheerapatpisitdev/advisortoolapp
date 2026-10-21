/**
 * Shotstack's Edit API (owner, 2026-10-21): the ดีไซน์พิเศษ look of a คลิปตามโจทย์ is put together
 * there. One key per environment: a Production key works on /edit/v1, a Sandbox key on /edit/stage
 * (clips with a SHOTSTACK watermark, nothing charged). The key on /admin/ai may be either, so each
 * call tries Production first and the Sandbox when Production refuses the key (403).
 */
export type ShotstackEnv = "v1" | "stage";
const BASE = "https://api.shotstack.io/edit";

type Fetch = typeof fetch;
const headers = (key: string) => ({ "x-api-key": key, "content-type": "application/json", accept: "application/json" });

export type ShotstackCheck = { state: "ok"; ms: number; env: ShotstackEnv } | { state: "bad"; error: string };

const WRONG_KEY = "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว";

/** Which environment takes the key: one GET of the template list each, which costs nothing. */
export async function checkShotstackKey(key: string, f: Fetch = fetch): Promise<ShotstackCheck> {
  const t0 = Date.now();
  try {
    for (const env of ["v1", "stage"] as const) {
      const res = await f(`${BASE}/${env}/templates`, { headers: headers(key), signal: AbortSignal.timeout(15_000) });
      if (res.ok) return { state: "ok", ms: Date.now() - t0, env };
      if (res.status !== 401 && res.status !== 403) return { state: "bad", error: `Shotstack ตอบกลับไม่ได้ (${res.status}) ลองใหม่อีกครั้ง` };
    }
    return { state: "bad", error: WRONG_KEY };
  } catch {
    return { state: "bad", error: "ติดต่อ Shotstack ไม่ได้ ลองใหม่อีกครั้ง" };
  }
}

export interface Submitted { id: string; env: ShotstackEnv }

/**
 * Hands one edit (timeline + output) over to be rendered; Shotstack posts to `callback` when it is
 * done or has failed. Throws with the service's status: a 401/403 on both environments reads as
 * set-up trouble (renderError), anything else as the service's own.
 */
export async function submitRender(key: string, edit: object, callback: string, f: Fetch = fetch): Promise<Submitted> {
  const body = JSON.stringify({ ...edit, callback });
  let last = 0;
  for (const env of ["v1", "stage"] as const) {
    const res = await f(`${BASE}/${env}/render`, { method: "POST", headers: headers(key), body, signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as { response?: { id?: string } } | null;
      if (!j?.response?.id) throw new Error("Shotstack gave no render id");
      return { id: j.response.id, env };
    }
    last = res.status;
    if (res.status !== 401 && res.status !== 403) {
      const why = await res.text().catch(() => "");
      throw new Error(`Shotstack refused the render (${res.status}) ${why.slice(0, 300)}`);
    }
  }
  throw new Error(`Shotstack refused the key (${last})`);
}

export type RenderState =
  | { status: "done"; url: string }
  | { status: "failed"; error: string }
  | { status: "working" };

/** Where a render stands, for the sweep and the callback, which do not trust a posted body alone. */
export async function renderState(key: string, env: ShotstackEnv, id: string, f: Fetch = fetch): Promise<RenderState> {
  const res = await f(`${BASE}/${env}/render/${encodeURIComponent(id)}`, { headers: headers(key), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Shotstack status (${res.status})`);
  const j = (await res.json().catch(() => null)) as { response?: { status?: string; url?: string; error?: string } } | null;
  const r = j?.response;
  if (r?.status === "done" && r.url) return { status: "done", url: r.url };
  if (r?.status === "failed") return { status: "failed", error: r.error || "Shotstack render failed" };
  return { status: "working" };
}
