"use client";
import { Upload } from "tus-js-client";
import { CLIP_BUCKET, type ClipFile } from "@/lib/content/clip";

/**
 * The browser's half of a clip upload (owner, 2026-10-02): what the file is, read from the
 * phone's own player, and the bytes sent straight to storage in 6MB pieces that carry on
 * after a dropped connection (Supabase resumable uploads, signed with x-signature).
 */

/** the storage host itself, as Supabase's guide asks for large uploads */
function resumableEndpoint(): string {
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const ref = base.hostname.split(".")[0];
  return `https://${ref}.storage.supabase.co/storage/v1/upload/resumable`;
}

export function readClipFile(file: File): Promise<ClipFile> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (d: number, w: number, h: number) => {
      URL.revokeObjectURL(url);
      // a .mov from an iPhone can come with an empty type; its name says what it is
      const mime = file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.mp4$/i.test(file.name) ? "video/mp4" : "");
      resolve({ sizeBytes: file.size, durationSec: d, width: w, height: h, mime });
    };
    v.onloadedmetadata = () => done(v.duration, v.videoWidth, v.videoHeight);
    v.onerror = () => done(Number.NaN, 0, 0);
    v.src = url;
  });
}

export function uploadClip(opts: { file: File; path: string; token: string; onProgress: (fraction: number) => void; signal?: AbortSignal }): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new Upload(opts.file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { "x-signature": opts.token, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: CLIP_BUCKET,
        objectName: opts.path,
        contentType: opts.file.type || "video/mp4",
        cacheControl: "3600",
      },
      // Supabase takes exactly 6MB chunks
      chunkSize: 6 * 1024 * 1024,
      onProgress: (sent, total) => opts.onProgress(total ? sent / total : 0),
      onError: (e) => reject(e),
      onSuccess: () => resolve(),
    });
    opts.signal?.addEventListener("abort", () => { void upload.abort(); reject(new DOMException("aborted", "AbortError")); });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}
