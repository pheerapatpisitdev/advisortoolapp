FROM public.ecr.aws/lambda/nodejs:22
# A pinned static ffmpeg build from https://johnvansickle.com/ffmpeg/old-releases/ (x86_64 Lambda).
# FFMPEG_SHA256 is the checksum of that exact archive and the build FAILS without it (see README step 1).
ARG FFMPEG_VERSION=6.0.1
ARG FFMPEG_SHA256
RUN test -n "$FFMPEG_SHA256" || { echo "build with --build-arg FFMPEG_SHA256=<sha256> (see README)"; exit 1; } && \
    dnf install -y tar xz && \
    curl -fsSL -o /tmp/ffmpeg.tar.xz "https://johnvansickle.com/ffmpeg/old-releases/ffmpeg-${FFMPEG_VERSION}-amd64-static.tar.xz" && \
    echo "${FFMPEG_SHA256}  /tmp/ffmpeg.tar.xz" | sha256sum -c - && \
    mkdir /opt/ffmpeg && tar -xJf /tmp/ffmpeg.tar.xz -C /opt/ffmpeg --strip-components=1 && \
    rm /tmp/ffmpeg.tar.xz && dnf clean all
# Build context is the infra/ folder (the render code is shared with cloudrun-ffmpeg): see README step 1.
COPY ffmpeg-core/ ${LAMBDA_TASK_ROOT}/ffmpeg-core/
COPY lambda-ffmpeg/handler.mjs ${LAMBDA_TASK_ROOT}/lambda-ffmpeg/
CMD ["lambda-ffmpeg/handler.handler"]
