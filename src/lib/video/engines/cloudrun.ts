import { createHash, createPrivateKey, createSign } from "node:crypto";
import { EngineError, mayHaveReached, type RenderEngine } from "./types";

/**
 * Our own ffmpeg as a Google Cloud Run Job (owner, 2026-10-02), infra/cloudrun-ffmpeg. The app
 * writes the job's payload as a file and hands its signed link to the run call (env JOB_URL);
 * the job renders, writes the outputs into our storage itself and calls back, like Lambda.
 * Auth is a service-account key: we mint the OAuth token ourselves (RS256 JWT), no Google SDK.
 * Kept in the encrypted key store (provider "gcp") as minified JSON
 * { client_email, private_key, project_id, region, job }.
 */

export interface GcpKey { clientEmail: string; privateKey: string; projectId: string; region: string; job: string }

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const RUN_API = "https://run.googleapis.com/v2";
const CALL_TIMEOUT_MS = 10_000;
/** a cached token is used only while more than this is left of it (a slow run call, a skewed clock) */
const TOKEN_MARGIN_MS = 60_000;
const BAD_KEY = "ตั้งค่า Google Cloud ไม่ครบ";

const REGION = /^[a-z]+-[a-z]+\d+$/;
const JOB_NAME = /^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;
/** Google project ids, including the older domain-scoped "example.com:name" */
const PROJECT_ID = /^[a-z0-9][-a-z0-9.:]{0,98}[a-z0-9]$/;

/**
 * JSON.parse after a paste: a BOM, CRLF and surrounding whitespace are fine; a raw line break
 * inside a string (a hand-edited private key) is turned back into "\n" and tried once more.
 */
function parsePasted(text: string): unknown {
  const t = text.replace(/^﻿/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(escapeBreaksInStrings(t));
    } catch {
      return null;
    }
  }
}

function escapeBreaksInStrings(t: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inString && !escaped && (c === "\r" || c === "\n")) {
      if (c === "\r" && t[i + 1] === "\n") i++;
      out += "\\n";
      continue;
    }
    out += c;
    if (escaped) escaped = false;
    else if (c === "\\") escaped = inString;
    else if (c === '"') inString = !inString;
  }
  return out;
}

function validKey(o: unknown, region: unknown, job: unknown): GcpKey | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (r.type !== undefined && r.type !== "service_account") return null;
  const { client_email: email, private_key: pk, project_id: project } = r;
  if (typeof email !== "string" || !EMAIL.test(email.trim())) return null;
  if (typeof pk !== "string" || !pk.includes("BEGIN PRIVATE KEY")) return null;
  if (typeof project !== "string" || !PROJECT_ID.test(project.trim())) return null;
  if (typeof region !== "string" || !REGION.test(region.trim())) return null;
  if (typeof job !== "string" || !JOB_NAME.test(job.trim())) return null;
  const privateKey = pk.replace(/\r\n?/g, "\n");
  try {
    createPrivateKey(privateKey); // a key that cannot sign is refused now, not at the first render
  } catch {
    return null;
  }
  return { clientEmail: email.trim(), privateKey, projectId: project.trim(), region: region.trim(), job: job.trim() };
}

/** The stored form of a pasted service-account file plus the region and job typed beside it; null when anything is off. */
export function gcpKeyFromUpload(json: string, region: string, job: string): string | null {
  const k = validKey(parsePasted(json), region, job);
  if (!k) return null;
  return JSON.stringify({ client_email: k.clientEmail, private_key: k.privateKey, project_id: k.projectId, region: k.region, job: k.job });
}

export function parseGcpKey(stored: string): GcpKey | null {
  const o = parsePasted(stored);
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  return validKey(r, r.region, r.job);
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** access tokens by service account and key (a swapped key must not reuse the old one's token), kept in this server instance's memory only */
const tokens = new Map<string, { token: string; expiresAt: number }>();

const tokenKey = (k: GcpKey) => `${k.clientEmail}:${createHash("sha256").update(k.privateKey).digest("hex").slice(0, 12)}`;

interface Deps { fetch?: typeof fetch; now?: () => number }

async function accessToken(k: GcpKey, f: typeof fetch, now: () => number): Promise<string> {
  const cached = tokens.get(tokenKey(k));
  if (cached && cached.expiresAt - now() > TOKEN_MARGIN_MS) return cached.token;

  // backdated: a server clock a little ahead of Google's must not get "issued in the future"
  const iat = Math.floor(now() / 1000) - 30;
  const input = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: k.clientEmail, scope: GOOGLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600,
  }))}`;
  let assertion: string;
  try {
    assertion = `${input}.${b64url(createSign("RSA-SHA256").update(input).sign(k.privateKey))}`;
  } catch {
    throw new EngineError(BAD_KEY, true);
  }

  let res: Response;
  try {
    res = await f(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (e) {
    // the error's name only: its message or cause could carry the request
    console.error("cloudrun token request failed:", e instanceof Error ? e.name : "unknown error");
    throw new EngineError("ขอสิทธิ์จาก Google Cloud ไม่ได้", true);
  }
  const body = await res.json().catch(() => ({})) as { access_token?: unknown; expires_in?: unknown };
  if (!res.ok || typeof body.access_token !== "string" || !body.access_token) {
    console.error("cloudrun token refused:", res.status);
    throw new EngineError(`ขอสิทธิ์จาก Google Cloud ไม่ได้ (${res.status})`, true);
  }
  const life = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;
  tokens.set(tokenKey(k), { token: body.access_token, expiresAt: now() + life * 1000 });
  return body.access_token;
}

export function cloudRunEngine(key: string, deps: Deps = {}): RenderEngine {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  return {
    name: "cloudrun",
    // the id is ours to give, so the job is on the row before the run can call back about it
    takesId: true,
    async submit(_job, opts) {
      const k = parseGcpKey(key);
      if (!k) throw new EngineError(BAD_KEY, true);
      // the caller always writes the payload file first; without it there is nothing to run
      if (!opts.payloadUrl) throw new EngineError("internal: no payload link for the Cloud Run job", false);
      const id = opts.id ?? crypto.randomUUID();
      const token = await accessToken(k, f, now);
      const name = `projects/${encodeURIComponent(k.projectId)}/locations/${encodeURIComponent(k.region)}/jobs/${encodeURIComponent(k.job)}`;
      let res: Response;
      try {
        res = await f(`${RUN_API}/${name}:run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: { containerOverrides: [{ env: [{ name: "JOB_URL", value: opts.payloadUrl }] }] } }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS), // a run call must never hang a server action
        });
      } catch (e) {
        console.error("cloudrun run failed:", e instanceof Error ? e.name : "unknown error");
        // no answer (the 10 s abort, a dropped connection): Google may have started the run
        throw new EngineError("ส่งงานให้ Google Cloud ไม่ได้", true, mayHaveReached(e));
      }
      if (!res.ok) {
        // a token Google no longer takes is not offered again
        if (res.status === 401) tokens.delete(tokenKey(k));
        // status code only: Google's text is not ours to keep. Google never sees the ffmpeg
        // command (it is in the payload file), so any refusal is about the setup: try elsewhere.
        console.error("cloudrun run refused:", res.status);
        throw new EngineError(`Google Cloud ไม่รับงาน (${res.status})`, true);
      }
      await res.body?.cancel().catch(() => undefined);
      return { id };
    },
    async status() { return null; },
    async cleanup() { /* the job writes straight into our storage */ },
  };
}
