# Build context is the infra/ folder (see README step 3): docker/gcloud builds -f cloudrun-ffmpeg/Dockerfile .
FROM node:22-slim
# The same pinned static ffmpeg build as infra/lambda-ffmpeg (x86_64), from https://johnvansickle.com/ffmpeg/old-releases/.
# FFMPEG_SHA256 is the checksum of that exact archive and the build FAILS without it (see README).
ARG FFMPEG_VERSION=6.0.1
ARG FFMPEG_SHA256
RUN test -n "$FFMPEG_SHA256" || { echo "build with --build-arg FFMPEG_SHA256=<sha256> (see README)"; exit 1; } && \
    apt-get update && apt-get install -y --no-install-recommends curl xz-utils ca-certificates && \
    curl -fsSL -o /tmp/ffmpeg.tar.xz "https://johnvansickle.com/ffmpeg/old-releases/ffmpeg-${FFMPEG_VERSION}-amd64-static.tar.xz" && \
    echo "${FFMPEG_SHA256}  /tmp/ffmpeg.tar.xz" | sha256sum -c - && \
    mkdir /opt/ffmpeg && tar -xJf /tmp/ffmpeg.tar.xz -C /opt/ffmpeg --strip-components=1 && \
    rm /tmp/ffmpeg.tar.xz && apt-get purge -y curl xz-utils && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app/cloudrun-ffmpeg
COPY ffmpeg-core/ /app/ffmpeg-core/
COPY cloudrun-ffmpeg/job.mjs ./
CMD ["node", "job.mjs"]
