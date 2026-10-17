# The Remotion trial's renderer on Cloud Run: the pre-built bundle (build/, with its public files and
# each theme's props) rendered by @remotion/renderer in Chrome's headless shell. THEME picks the clip.
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
COPY render.mjs ./
CMD ["node", "render.mjs"]
