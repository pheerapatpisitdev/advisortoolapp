import { SIDE_MAX, type UploadKind } from "./upload-rules";

/**
 * The picture as it is sent (browser only): drawn on a canvas at most SIDE_MAX on its longest side, PNG for a
 * part (its clear background stays), JPEG at 0.9 for a style picture or a request's screenshot. Where the
 * canvas cannot be used the file itself goes, and the server's own checks decide.
 */
export async function shrinkForUpload(file: File, kind: UploadKind): Promise<Blob> {
  try {
    if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SIDE_MAX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    if (kind !== "part") {
      // JPEG has no clear background: white, not black
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((done) =>
      kind === "part" ? canvas.toBlob(done, "image/png") : canvas.toBlob(done, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}
