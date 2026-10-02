# Clip ffmpeg on Google Cloud Run (Jobs)

คู่มือสำหรับเจ้าของระบบ (ไม่ต้องเป็นสายเทคนิค) — คำสั่งทั้งหมดเป็นภาษาอังกฤษ ให้คัดลอกไปรันตามลำดับ

The app starts a Cloud Run **Job** per render, passing one environment variable, `JOB_URL`: a one-hour signed link
to the job's payload (`{ id, job, uploads, callbackUrl, token }`, the same object the AWS Lambda gets). The container
downloads it, runs the same ffmpeg render as Lambda (`infra/ffmpeg-core`), uploads the outputs, POSTs the result to
the app, then exits. The job needs **no Google permissions of its own** at run time.

## Before you start (ต้องมีก่อน)

- A Google account and a Google Cloud **billing account with a card** (https://console.cloud.google.com/billing).
- The `gcloud` CLI installed (`gcloud --version` works), then run `gcloud auth login` once.
- No Docker needed: Google builds the image for you (Cloud Build).

### 0. A project with billing

Create a project (https://console.cloud.google.com/projectcreate) and link your billing account to it
(https://console.cloud.google.com/billing/linkedaccount, pick the project, "Link a billing account"). Note the
project ID it shows.

Run everything from the repo root. Replace `YOUR_PROJECT_ID` with that project.

```bash
export PROJECT=YOUR_PROJECT_ID
export REGION=asia-southeast1
export JOB=clip-ffmpeg
# a new tag per build: a rebuilt :latest may not be picked up by the job
export IMAGE=$REGION-docker.pkg.dev/$PROJECT/clip/clip-ffmpeg:$(git rev-parse --short HEAD)

gcloud config set project $PROJECT
```

## 1. Turn on the services

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com
```

On a **new** project, the default compute service account must be allowed to run builds, or step 3 fails with
`PERMISSION_DENIED`:

```bash
gcloud projects add-iam-policy-binding $PROJECT \
  --member serviceAccount:$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com \
  --role roles/cloudbuild.builds.builder
```

## 2. A place for the image

```bash
gcloud artifacts repositories create clip --repository-format=docker --location=$REGION
```

## 3. Build the image (Cloud Build)

The build context is the `infra/` folder, because the render code in `infra/ffmpeg-core` is shared with the Lambda
image. ffmpeg is the same pinned 6.0.1 static build as the Lambda; the build fails if the checksum does not match
(computed from https://johnvansickle.com/ffmpeg/old-releases/ffmpeg-6.0.1-amd64-static.tar.xz).

```bash
gcloud builds submit infra \
  --config infra/cloudrun-ffmpeg/cloudbuild.yaml \
  --substitutions _IMAGE=$IMAGE,_FFMPEG_SHA256=28268bf402f1083833ea269331587f60a242848880073be8016501d864bd07a5
```

If it asks to grant Cloud Build access to the repository or bucket, answer yes. If the build says permission denied
on Artifact Registry, grant the Cloud Build service account `roles/artifactregistry.writer` on the `clip` repo and
run it again.

## 4. The job

```bash
gcloud run jobs create $JOB \
  --region $REGION \
  --image $IMAGE \
  --tasks 1 \
  --max-retries 0 \
  --task-timeout 900 \
  --cpu 4 \
  --memory 8Gi
```

`--max-retries 0` matters: Google must never re-run a job on its own (a retry would run after the app has already
given up on it). `/tmp` on Cloud Run is in memory, so 8Gi covers the 300 MB source plus outputs.

New image later: set `IMAGE` again (a new commit gives a new tag), repeat step 3, then
`gcloud run jobs update $JOB --region $REGION --image $IMAGE`.

## 5. A key that can only run this job

```bash
gcloud iam service-accounts create clip-render --display-name "Clip render starter"
export SA=clip-render@$PROJECT.iam.gserviceaccount.com

gcloud run jobs add-iam-policy-binding $JOB \
  --region $REGION \
  --member serviceAccount:$SA \
  --role roles/run.jobsExecutorWithOverrides

gcloud iam service-accounts keys create key.json --iam-account $SA
```

The role is `roles/run.jobsExecutorWithOverrides` (checked against Google's role reference: it holds
`run.jobs.run` and `run.jobs.runWithOverrides`; the plain `roles/run.jobsExecutor` is not enough because the app
sets `JOB_URL` as an override). It is granted on **this job only**, not the project.

If the last command says key creation is not allowed, your organization enforces the policy
`iam.disableServiceAccountKeyCreation` (the default for organizations). Grant yourself `roles/orgpolicy.policyAdmin` on
the organization (console: IAM, organization level), then:

```bash
gcloud resource-manager org-policies disable-enforce iam.disableServiceAccountKeyCreation --project $PROJECT
# wait 1-2 minutes, then create the key again
gcloud iam service-accounts keys create key.json --iam-account $SA
gcloud resource-manager org-policies enable-enforce iam.disableServiceAccountKeyCreation --project $PROJECT
```

Turn the policy back on afterwards; keys that already exist keep working.

`key.json` is a secret. **Never paste it in chat or email.**

## 6. Paste the key into the app

Open `/admin/ai`, add the `gcp` key: paste the contents of `key.json`, then type the region (`asia-southeast1`)
and the job name (`clip-ffmpeg`). The app keeps only the fields it needs, encrypted. Afterwards **delete the file**:

```bash
rm key.json
```

## 7. Budget alert (กันค่าใช้จ่ายบานปลาย)

Google Cloud console, Billing, Budgets and alerts, Create budget: pick the project, set a small monthly amount
(for example the most you are happy to pay), and keep the 50% / 90% / 100% email alerts on. Budgets only alert, they
do not stop spending, so check the mail.

## 8. Check it and read logs

```bash
gcloud run jobs describe $JOB --region $REGION
gcloud run jobs executions list --job $JOB --region $REGION
gcloud beta run jobs executions logs read EXECUTION_NAME --region $REGION
```

`EXECUTION_NAME` is from the `executions list` output. Logs are also in the console: Cloud Run, Jobs, `clip-ffmpeg`,
Executions, Logs. Lines look like `job <id>: render failed: ...` or `job: payload 403` (the payload link was
refused or expired); a link, token or key is never printed.
