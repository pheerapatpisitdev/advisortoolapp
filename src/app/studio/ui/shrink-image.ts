import { dominantColors, type Swatch } from "@/lib/content/palette";
import { shrunkSize } from "@/lib/content/picture-shrink";

/**
 * A picture shrunk in the browser before it is sent to be read: the long side to 1,024 px as a
 * JPEG, so what travels is a few hundred KB and what is read costs less. Browser only.
 */

const CANNOT_OPEN = "เปิดรูปนี้ไม่ได้ ลองรูปอื่นนะครับ";

/** the long side of the copy the colours are counted from: 64 px is 4,000 pixels, plenty to tell the main colours */
const COUNT_SIDE = 64;

export interface Shrunk { base64: string; mimeType: "image/jpeg"; name: string; bytes: number; palette: Swatch[] }

/** the picture's main colours, counted from a small copy of the canvas; none when they cannot be read, which does not stop the read */
function colorsOf(canvas: HTMLCanvasElement): Swatch[] {
  try {
    const k = COUNT_SIDE / Math.max(canvas.width, canvas.height);
    const w = Math.max(1, Math.round(canvas.width * k));
    const h = Math.max(1, Math.round(canvas.height * k));
    const tiny = document.createElement("canvas");
    tiny.width = w;
    tiny.height = h;
    const ctx = tiny.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(canvas, 0, 0, w, h);
    return dominantColors(ctx.getImageData(0, 0, w, h).data);
  } catch {
    return [];
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(CANNOT_OPEN));
    reader.readAsDataURL(blob);
  });
}

export async function shrinkImage(file: File): Promise<Shrunk> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error(CANNOT_OPEN); });
  const { w, h } = shrunkSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(CANNOT_OPEN);
  // a JPEG has no transparency: a PNG that has some would turn black without a white ground
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(CANNOT_OPEN);
  return { base64: await toBase64(blob), mimeType: "image/jpeg", name: file.name, bytes: blob.size, palette: colorsOf(canvas) };
}
