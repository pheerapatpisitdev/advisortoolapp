# Clip rendering on Google Cloud Run — Spec and Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** a third render engine, Google Cloud Run Jobs, beside Rendi and AWS Lambda, picked in `/admin/ai` like the others (primary or fallback).

**Owner decisions (2026-10-02):** "ติดตั้ง Google Cloud Run" after comparing options; approved the design below ("Ok"). Cloud Run needs a Google Cloud billing account (card) — the owner does that step; code ships first, live test after.

**Spec:** this file (section "Design") extends `docs/superpowers/specs/2026-10-02-studio-clip-editing-design.md`; everything not said here stays as B1 built it (switch `video_edit_enabled`, wallet round, 15-minute bound, webhook, cost ledger `content-edit`, 60 s edited-clip cap).

## Design

- **Google side: a Cloud Run *Job*** (not a service) in `asia-southeast1`, one task, `maxRetries: 0`, task timeout 900 s, 4 vCPU / 8 GiB (Cloud Run's /tmp is in memory — 300 MB source + outputs fit). Image: `node:22-slim` + the same pinned, sha256-checked static ffmpeg as `infra/lambda-ffmpeg`; built with Cloud Build (no local Docker needed).
- **How a job is started:** the app writes the job's payload (`{ id, job, uploads, callbackUrl, token }` — the same object Lambda receives) as a JSON file into the clip's folder in `content-video` (`<piece>/<uuid>.job.json`, content type `text/plain`, already allowed by the bucket), signs it for 1 h, then calls the Cloud Run Admin API `POST https://run.googleapis.com/v2/projects/{project}/locations/{region}/jobs/{job}:run` with `overrides.containerOverrides[0].env = [{ name: "JOB_URL", value: <signed url> }]`. The container reads `JOB_URL`, runs the exact same render as Lambda (download inputs, ffmpeg, PUT outputs to the signed upload URLs, callback with retry), then exits. The payload file is removed when the job is finalized (both outcomes) — it holds the callback token and signed upload links.
- **Auth:** a Google service account key (JSON). The app mints an OAuth access token itself (RS256 JWT signed with node `crypto`, exchanged at `https://oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/cloud-platform`), cached in memory until shortly before expiry. No Google SDK dependency. The service account holds only `roles/run.jobsExecutorWithOverrides` on that one job.
- **Key stored:** provider `gcp` in the encrypted key store, as minified JSON `{ client_email, private_key, project_id, region, job }` (the admin pastes the service-account JSON file and types region + job name; the server keeps only those fields). Admin shows `project_id · region · job` — never the email's key or the private key.
- **Engine:** name `cloudrun`, `takesId: true` (our id, recorded before the run call, like Lambda), `status()` → `null` (callback only), `cleanup` nothing. Results arrive through the existing webhook (`POST /api/content-video/job`, token hash, exact `dest` match) — the token branch accepts callback engines (`lambda`, `cloudrun`), not only `lambda`.
- **Order and fallback:** settings `engine` ∈ `rendi | lambda | cloudrun`; `enginesInOrder` = the primary first, then — when fallback is on — every other engine that has a key, in the fixed order rendi → cloudrun → lambda.
- **Costs:** estimate per delivered job `0.006 * 36` ฿ (4 vCPU · ~60 s on Cloud Run) into the existing per-engine cost map; written to the ledger as today.
- **Errors:** a run call refused (401/403/404/429/5xx, or no answer within 10 s) → `EngineError(..., retryElsewhere: true)`; a malformed key → `EngineError("ตั้งค่า Google Cloud ไม่ครบ", true)`. Never a key, token or signed URL in a message or log.

## Global Constraints
- Vercel Hobby: maxDuration ≤ 300; nothing waits for a render.
- No secrets in logs, stored errors, or anything sent to the browser.
- "use server" files export only async functions; no hex colour literals outside palette files.
- Tests never call Google, Rendi, AWS, Supabase or Facebook; `.env.local` points at PRODUCTION.
- Migration additive; applied by the controller before push.

## Review Focus
1. A Google token that expires mid-way / clock skew → mint a fresh one (cache only while > 60 s left).
2. The payload file must not outlive the job (finalize, failed submit, timeout).
3. A run call that times out after Google accepted it → treated like Lambda's lost invoke answer: never handed to a second engine (record kept, times out).
4. Fallback with three engines never retries an engine twice and respects `avoid`.
5. Pasted service-account JSON with real newlines / CRLF / BOM still parses; anything else is refused with a clear Thai message.

---

### Task 1: The Cloud Run container (`infra/cloudrun-ffmpeg`)

**Files:** Create `infra/cloudrun-ffmpeg/job.mjs`, `Dockerfile`, `README.md`; Modify `infra/lambda-ffmpeg/handler.mjs` + `core.mjs` (move the shared render+callback into a reusable function); Test `tests/video/cloudrun-job.test.ts`.

- Refactor: `infra/lambda-ffmpeg/core.mjs` (or a new shared `infra/ffmpeg-core/`) exports `runRender(event, { ffmpegPath, fetch?, log? })` = today's `render` + `callback` flow (finished render never reported failed). Lambda's `handler(event)` calls it unchanged in behaviour. Lambda tests keep passing.
- `job.mjs`: reads `process.env.JOB_URL`; fetches the payload (fail → log `job: payload <status>` and exit 1, no callback possible); calls `runRender`; exits 0 after the callback attempt (even when the render failed — the failure was reported). Never logs the URL.
- `Dockerfile`: `node:22-slim`, ffmpeg pinned + `FFMPEG_SHA256` build arg required (same version/hash mechanism as `infra/lambda-ffmpeg/Dockerfile`), copies the shared core and `job.mjs`, `CMD ["node", "job.mjs"]`.
- `README.md` for a non-expert owner, Thai-friendly but commands in English: prerequisites (Google account, billing with a card, `gcloud` installed + `gcloud auth login`); `gcloud config set project`; enable `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`; create an Artifact Registry repo in `asia-southeast1`; `gcloud builds submit --tag …` with the ffmpeg sha build arg (via a `cloudbuild.yaml` if needed); `gcloud run jobs create clip-ffmpeg --region asia-southeast1 --image … --tasks 1 --max-retries 0 --task-timeout 900 --cpu 4 --memory 8Gi`; create service account `clip-render`, grant `roles/run.jobsExecutorWithOverrides` on the job only (`gcloud run jobs add-iam-policy-binding`); `gcloud iam service-accounts keys create key.json`; paste into `/admin/ai` (never chat/email), then delete `key.json`; set a Budget alert; how to read logs (`gcloud run jobs executions list/logs`).
- Tests: `job.mjs` logic exported as a function taking injected `env`, `fetch`, `runRender` — payload fetched and passed through; payload fetch failure → no runRender, non-zero result; the URL never appears in logs. Shared core: existing Lambda tests still pass.

Commit: `feat(video): a Cloud Run job that runs the same ffmpeg render as Lambda`

### Task 2: The engine (`src/lib/video/engines/cloudrun.ts`)

**Interfaces — produces:** `parseGcpKey(stored: string): { clientEmail; privateKey; projectId; region; job } | null`; `gcpKeyFromUpload(json: string, region: string, job: string): string | null` (builds the stored minified JSON; tolerant of CRLF/BOM/whitespace; validates email/private key/project id; region like `asia-southeast1`; job name `[a-z][-a-z0-9]{0,62}`); `cloudRunEngine(key: string, deps?: { fetch?; now? }): RenderEngine` (name `cloudrun`, `takesId: true`, `submit(job, opts)` requires `opts.payloadUrl` — see Task 3 — and calls the run API; `status` → null; `cleanup` no-op).
- Token minting with node `crypto` (`createSign("RSA-SHA256")`), cached per client email while > 60 s of life remain; 10 s timeout on the token call and the run call (AbortSignal).
- Tests: with a test RSA key pair generated in the test, the JWT the engine sends verifies with the public key and has the right iss/scope/aud/exp; the run call URL/body (env JOB_URL = payloadUrl) are exact; 401/403/404/429/500/timeout → EngineError retryElsewhere true; malformed key → EngineError; token reused within its life and re-minted near expiry; no key/token/URL in error messages or logs; `gcpKeyFromUpload` accepts a real-shaped SA JSON with CRLF and BOM, refuses missing fields/bad region/bad job name.

Commit: `feat(video): the Cloud Run render engine`

### Task 3: Wiring — settings, jobs, webhook, costs, admin

**Files:** `src/lib/content/clip.ts` (EngineName + "cloudrun"), `src/lib/video/settings.ts`, `src/lib/video/engines/index.ts`, `src/lib/video/engines/types.ts` (submit opts gain `payloadUrl?`), `src/lib/video/jobs.ts`, `src/app/api/content-video/job/route.ts`, `src/lib/video/render-run.ts` + `src/app/studio/clip-edit.ts` (cost map), `src/lib/video/render-providers.ts` (+ "gcp"), `src/app/admin/ai/actions.ts` + `AiClient.tsx`, migration `supabase/migrations/20261003_clip_cloudrun.sql`, tests.

- Migration: replace the `video_engine` check constraint to allow `'cloudrun'` (look up the real constraint name; `drop constraint if exists … ; add constraint … check (video_engine in ('rendi','lambda','cloudrun'))`). Controller applies it.
- `enginesInOrder`: primary first; if fallback, the others with keys in order rendi → cloudrun → lambda; `engineNamed("cloudrun")`.
- `submitJob`: callback engines (`lambda`, `cloudrun`) get `destinations(...)`; for `cloudrun`, also write the payload file `<piece>/<uuid>.job.json` (text/plain) BEFORE the run call, sign it 1 h, pass `payloadUrl`; record its path on the job (e.g. `payloadPath`) and remove it in `finalize` (both outcomes), on a failed submit, and on timeout. The lost-run-answer rule (record kept, no second engine) applies to every `takesId` engine. `forClient` strips `payloadPath`.
- Webhook route + `finishJob`: accept the token branch for callback engines (`lambda`, `cloudrun`); Rendi stays re-poll only.
- Costs: `cloudrun: 0.006 * 36` in the per-engine estimate map.
- Admin: engine select gets "Google Cloud Run"; a key form for Google: a textarea "วางไฟล์ Service Account (JSON)", region (default `asia-southeast1`), job name (default `clip-ffmpeg`); `saveRenderKey("gcp", …)` builds the stored key with `gcpKeyFromUpload`; display `project_id · region · job`; `saveVideoEngine` accepts `cloudrun`; spend card maps `cloudrun` → `gcp`. The textarea's value is cleared after save; the private key never goes back to the browser.
- Tests: settings read/save cloudrun; enginesInOrder for all primaries × fallback on/off × missing keys; submitJob for cloudrun writes the payload file before the run call, passes its signed URL, records and later removes it (done, failed, timeout, failed submit); a callback for a cloudrun job finishes it; a Rendi-style re-poll is never applied to cloudrun; admin save/display of the gcp key (secret absent from `loadAiPage`), refusal of a bad upload; migration file present.

Commit: `feat(video): Cloud Run as a third render engine, picked in admin`

### Task 4 (controller): verify, migrate, ship (switch stays as the owner left it), owner setup via README, live test when billing is on.
