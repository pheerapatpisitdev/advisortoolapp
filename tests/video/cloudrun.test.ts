import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudRunEngine, gcpKeyFromUpload, GOOGLE_SCOPE, GOOGLE_TOKEN_URL, parseGcpKey } from "@/lib/video/engines/cloudrun";
import { EngineError } from "@/lib/video/engines/types";

// a throwaway key pair made here, never a real one
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PAYLOAD_URL = "https://store.example/content-video/p1/abc.job.json?token=SIGNED";
const TOKEN = "ya29.ACCESS-TOKEN";
const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };

let n = 0;
/** a stored key for a fresh service account, so cached tokens never cross tests */
function storedKey(over: Record<string, unknown> = {}) {
  const email = `clip-render-${++n}@my-proj.iam.gserviceaccount.com`;
  return { email, key: JSON.stringify({ client_email: email, private_key: PEM, project_id: "my-proj", region: "asia-southeast1", job: "clip-ffmpeg", ...over }) };
}

type Answer = { status?: number; body?: unknown } | Error;
function google(answers: Answer[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const a = answers.shift() ?? { status: 500, body: {} };
    if (a instanceof Error) throw a;
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status ?? 200 });
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}
const tokenOk = (expires_in = 3600): Answer => ({ body: { access_token: TOKEN, expires_in, token_type: "Bearer" } });
const runOk: Answer = { body: { name: "projects/my-proj/locations/asia-southeast1/operations/op1" } };
const opts = { callbackUrl: "https://app/api/content-video/job", token: "cb-secret", id: "job-1", payloadUrl: PAYLOAD_URL };

const logged: string[] = [];
afterEach(() => { vi.restoreAllMocks(); logged.length = 0; });
function captureLogs() {
  for (const m of ["error", "warn", "log", "info"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(" ")); });
  }
}

function decodeJwt(assertion: string) {
  const [h, p, s] = assertion.split(".");
  const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
  return { ok, header: JSON.parse(Buffer.from(h, "base64url").toString()), claims: JSON.parse(Buffer.from(p, "base64url").toString()) };
}

describe("cloudRunEngine.submit", () => {
  it("mints a signed token for the service account, then runs the job with the payload link as JOB_URL", async () => {
    const { email, key } = storedKey();
    const g = google([tokenOk(), runOk]);
    const now = Date.UTC(2026, 9, 2, 12, 0, 0);
    const e = cloudRunEngine(key, { fetch: g.fetch, now: () => now });
    expect(e.name).toBe("cloudrun");
    expect(e.takesId).toBe(true);
    expect(await e.submit(job, opts)).toEqual({ id: "job-1" });

    const [tok, run] = g.calls;
    expect(tok.url).toBe(GOOGLE_TOKEN_URL);
    expect(tok.init.method).toBe("POST");
    expect(tok.init.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(tok.init.signal).toBeInstanceOf(AbortSignal);
    const form = new URLSearchParams(String(tok.init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const jwt = decodeJwt(form.get("assertion")!);
    expect(jwt.ok).toBe(true);
    expect(jwt.header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(jwt.claims).toEqual({ iss: email, scope: GOOGLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now / 1000 - 30, exp: now / 1000 + 3570 });

    expect(run.url).toBe("https://run.googleapis.com/v2/projects/my-proj/locations/asia-southeast1/jobs/clip-ffmpeg:run");
    expect(run.init.method).toBe("POST");
    expect(run.init.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" });
    expect(run.init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(run.init.body))).toEqual({ overrides: { containerOverrides: [{ env: [{ name: "JOB_URL", value: PAYLOAD_URL }] }] } });
    expect(await e.status("job-1")).toBeNull();
    await expect(e.cleanup({ state: "done" })).resolves.toBeUndefined();
  });

  it("names the job itself when not handed an id", async () => {
    const g = google([tokenOk(), runOk]);
    const { id } = await cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, { ...opts, id: undefined });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses a token while more than a minute of it is left, and mints a fresh one after", async () => {
    const { key } = storedKey();
    let t = 1_000_000_000_000;
    const g = google([tokenOk(3600), runOk, runOk, tokenOk(3600), runOk]);
    const e = cloudRunEngine(key, { fetch: g.fetch, now: () => t });
    await e.submit(job, opts);
    t += 3600_000 - 61_000; // 61 s left: still good
    await cloudRunEngine(key, { fetch: g.fetch, now: () => t }).submit(job, opts); // a new engine shares the cache
    t += 2_000; // 59 s left: too close
    await e.submit(job, opts);
    expect(g.calls.map((c) => c.url.startsWith(GOOGLE_TOKEN_URL) ? "token" : "run")).toEqual(["token", "run", "run", "token", "run"]);
  });

  it("a swapped private key for the same account does not reuse the old key's token", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const a = storedKey();
    const swapped = JSON.stringify({ ...JSON.parse(a.key), private_key: other });
    const g = google([tokenOk(), runOk, tokenOk(), runOk]);
    await cloudRunEngine(a.key, { fetch: g.fetch }).submit(job, opts);
    await cloudRunEngine(swapped, { fetch: g.fetch }).submit(job, opts);
    expect(g.calls.map((c) => c.url.startsWith(GOOGLE_TOKEN_URL) ? "token" : "run")).toEqual(["token", "run", "token", "run"]);
  });

  it("drops a token Google refuses, so the next try mints a new one", async () => {
    const { key } = storedKey();
    captureLogs();
    const g = google([tokenOk(), { status: 401, body: {} }, tokenOk(), runOk]);
    const e = cloudRunEngine(key, { fetch: g.fetch });
    await expect(e.submit(job, opts)).rejects.toMatchObject({ retryElsewhere: true });
    await e.submit(job, opts);
    expect(g.calls.filter((c) => c.url === GOOGLE_TOKEN_URL)).toHaveLength(2);
  });

  it.each([401, 403, 404, 429, 500, 503])("a run refused with %i is one to try elsewhere", async (status) => {
    captureLogs();
    const g = google([tokenOk(), { status, body: { error: { code: status, message: `denied ${TOKEN}`, status: "PERMISSION_DENIED" } } }]);
    const err = await cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, opts).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.retryElsewhere).toBe(true);
    // Google answered: a definite refusal, nothing started
    expect(err.mayBeTaken).toBe(false);
    expect(err.message).toContain(String(status));
  });

  it("a run call that times out or loses its connection may have started the job: its outcome is unknown", async () => {
    captureLogs();
    const timeout = new DOMException(`The operation was aborted due to timeout ${PAYLOAD_URL}`, "TimeoutError");
    let g = google([tokenOk(), timeout]);
    await expect(cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, opts)).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: true });
    g = google([tokenOk(), new TypeError(`fetch failed ${PAYLOAD_URL}`, { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) })]);
    await expect(cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, opts)).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: true });
  });

  it("a run call that never connected (host not found, refused) started nothing", async () => {
    captureLogs();
    for (const code of ["ENOTFOUND", "ECONNREFUSED"]) {
      const g = google([tokenOk(), new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) })]);
      await expect(cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, opts)).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: false });
    }
  });

  it("a token endpoint that refuses, times out or answers nonsense is one to try elsewhere", async () => {
    captureLogs();
    for (const a of [{ status: 400, body: { error: "invalid_grant" } }, { status: 500 }, { status: 200, body: {} }, new DOMException("t", "TimeoutError")] as Answer[]) {
      const g = google([a]);
      // no token, no run call: a definite "not started", whatever the token call did
      await expect(cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, opts)).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: false });
      expect(g.calls).toHaveLength(1); // never runs without a token
    }
  });

  it("a malformed key is refused without calling Google", async () => {
    const g = google([]);
    for (const bad of ["", "not json", JSON.stringify({ client_email: "a@b", private_key: "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----\n", project_id: "p1", region: "asia-southeast1", job: "j" }), storedKey({ region: "Asia" }).key]) {
      await expect(cloudRunEngine(bad, { fetch: g.fetch }).submit(job, opts)).rejects.toMatchObject({ message: "ตั้งค่า Google Cloud ไม่ครบ", retryElsewhere: true });
    }
    expect(g.calls).toHaveLength(0);
  });

  it("without a payload link there is nothing to run: a mistake of ours, not one to try elsewhere", async () => {
    const g = google([]);
    await expect(cloudRunEngine(storedKey().key, { fetch: g.fetch }).submit(job, { ...opts, payloadUrl: undefined }))
      .rejects.toMatchObject({ message: "internal: no payload link for the Cloud Run job", retryElsewhere: false });
    expect(g.calls).toHaveLength(0);
  });

  it("never puts the key, a token or a link in an error message or a log", async () => {
    captureLogs();
    const messages: string[] = [];
    const cases: Answer[][] = [
      [{ status: 400, body: { error: "invalid_grant", error_description: PEM } }],
      [new TypeError(`connect ${PAYLOAD_URL}`)],
      [tokenOk(), { status: 403, body: { error: { message: `${TOKEN} ${PAYLOAD_URL}` } } }],
      [tokenOk(), new DOMException(`aborted ${PAYLOAD_URL} ${TOKEN}`, "TimeoutError")],
    ];
    for (const answers of cases) {
      const err: Error = await cloudRunEngine(storedKey().key, { fetch: google(answers).fetch }).submit(job, opts).then(() => new Error("resolved"), (e: Error) => e);
      expect(err).toBeInstanceOf(EngineError);
      messages.push(String(err.message), String(err.stack));
    }
    const all = [...messages, ...logged].join("\n");
    for (const secret of ["PRIVATE KEY", PEM.split("\n")[1], TOKEN, PAYLOAD_URL, "SIGNED", "cb-secret", "iam.gserviceaccount.com"]) {
      expect(all).not.toContain(secret);
    }
    expect(logged.length).toBeGreaterThan(0);
  });
});

describe("gcpKeyFromUpload / parseGcpKey", () => {
  // the shape of a real service-account file, as Google hands it out
  const saFile = (over: Record<string, unknown> = {}) => JSON.stringify({
    type: "service_account", project_id: "my-proj", private_key_id: "abc123", private_key: PEM,
    client_email: "clip-render@my-proj.iam.gserviceaccount.com", client_id: "1234567890",
    auth_uri: "https://accounts.google.com/o/oauth2/auth", token_uri: GOOGLE_TOKEN_URL,
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/clip-render", universe_domain: "googleapis.com", ...over,
  }, null, 2);

  it("keeps only the fields the engine needs, and reads them back", () => {
    const stored = gcpKeyFromUpload(saFile(), "asia-southeast1", "clip-ffmpeg")!;
    expect(JSON.parse(stored)).toEqual({ client_email: "clip-render@my-proj.iam.gserviceaccount.com", private_key: PEM, project_id: "my-proj", region: "asia-southeast1", job: "clip-ffmpeg" });
    expect(stored).not.toContain("\n  "); // minified
    expect(parseGcpKey(stored)).toEqual({ clientEmail: "clip-render@my-proj.iam.gserviceaccount.com", privateKey: PEM, projectId: "my-proj", region: "asia-southeast1", job: "clip-ffmpeg" });
  });

  it("takes a paste with a BOM, CRLF line ends and whitespace around it, and region/job with spaces", () => {
    const pasted = `﻿  \r\n${saFile().replace(/\n/g, "\r\n")}\r\n  `;
    const stored = gcpKeyFromUpload(pasted, " asia-southeast1 ", "clip-ffmpeg\n");
    expect(parseGcpKey(stored!)?.privateKey).toBe(PEM);
  });

  it("takes a private key whose line breaks became real ones (a hand-edited file)", () => {
    const raw = saFile().replace(JSON.stringify(PEM), `"${PEM.replace(/\n/g, "\r\n")}"`);
    expect(() => JSON.parse(raw)).toThrow();
    expect(parseGcpKey(gcpKeyFromUpload(raw, "asia-southeast1", "clip-ffmpeg")!)?.privateKey).toBe(PEM);
  });

  it("refuses missing or wrong fields, a bad region or job name, and anything not JSON", () => {
    const ok = (s: string | null) => s !== null;
    expect(ok(gcpKeyFromUpload(saFile(), "asia-southeast1", "clip-ffmpeg"))).toBe(true);
    for (const over of [{ client_email: undefined }, { client_email: "no-at-sign" }, { private_key: undefined }, { private_key: "secret" },
      { private_key: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n" }, { project_id: undefined }, { project_id: "" },
      { type: "authorized_user" }]) {
      expect(gcpKeyFromUpload(saFile(over), "asia-southeast1", "clip-ffmpeg")).toBeNull();
    }
    for (const region of ["", "asia", "Asia-Southeast1", "asia-southeast", "asia-southeast1/x"]) expect(gcpKeyFromUpload(saFile(), region, "clip-ffmpeg")).toBeNull();
    for (const j of ["", "Clip", "1clip", "clip-", "clip_ffmpeg", "clip/ffmpeg", `c${"a".repeat(63)}`]) expect(gcpKeyFromUpload(saFile(), "asia-southeast1", j)).toBeNull();
    for (const text of ["", "nope", "[]", "null", "{\"a\":1"]) expect(gcpKeyFromUpload(text, "asia-southeast1", "clip-ffmpeg")).toBeNull();
    expect(parseGcpKey("")).toBeNull();
    expect(parseGcpKey(JSON.stringify({ client_email: "a@b.c", private_key: PEM, project_id: "my-proj", region: "asia-southeast1" }))).toBeNull();
  });

  it("a file without a type is taken", () => {
    expect(gcpKeyFromUpload(saFile({ type: undefined }), "us-central1", "c")).not.toBeNull();
  });
});
