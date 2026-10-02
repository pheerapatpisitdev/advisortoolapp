FROM public.ecr.aws/lambda/nodejs:20
# a static ffmpeg build (https://johnvansickle.com/ffmpeg/) — x86_64 Lambda
RUN dnf install -y tar xz && \
    curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar -xJ -C /opt && \
    mv /opt/ffmpeg-*-amd64-static /opt/ffmpeg && dnf clean all
COPY core.mjs handler.mjs ${LAMBDA_TASK_ROOT}/
CMD ["handler.handler"]
