# วิดีโอนำเสนอ's Remotion render on Cloud Run (src/lib/quote-video/remotion.ts): the pre-built bundle (build/,
# with its fonts and pictures) rendered by @remotion/renderer in Chrome's headless shell. job.mjs takes the app's
# payload (JOB_URL); render.mjs is the trial's (THEME, from the props baked in by the prepare step).
FROM node:22-bookworm-slim
# what Chrome's headless shell needs on Debian (remotion.dev/docs/miscellaneous/linux-dependencies),
# and one plain face for a sign no web font has
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 ca-certificates fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY cloudrun/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && node -e "require('@remotion/renderer').ensureBrowser().then(()=>console.log('browser ok'))"
COPY build ./build
COPY render.mjs job.mjs ./
CMD ["node", "job.mjs"]
