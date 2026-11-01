# advisortool-draw (draw/server.ts): the app's pictures, quote PDF and cover crop, drawn on Cloud Run instead of the
# web app's server (Cloudflare move step 1). build/server.mjs is the app's own drawing code bundled by draw/ship.sh;
# fonts/ are the card faces from src/app/api/card. No system fonts: satori draws every letter as a path, and the
# PDF's Chrome (@sparticuz/chromium) brings its own, as on Vercel — so both come out as they did there.
FROM node:22-bookworm-slim
# what Chrome's headless shell needs on Debian (the same list as remotion/cloudrun/Dockerfile, less its fonts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY fonts ./fonts
COPY build/server.mjs ./
# the faces Chrome falls back on are the package's own (unpacked to /tmp/fonts with Chrome), as on Vercel, where the
# package sets this itself: a page measured before its web font arrives then measures as it did there (PenLayer)
ENV DRAW_FONT_DIR=/app/fonts NODE_ENV=production FONTCONFIG_PATH=/tmp/fonts
CMD ["node", "server.mjs"]
