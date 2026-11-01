import type { Aspect } from "@/lib/ai/images";
import { cropThere, drawServiceSet } from "@/lib/draw/remote";

/**
 * The picture at exactly `aspect` (the cut itself: crop-here.ts). On the draw service when it is
 * set (src/lib/draw/remote.ts), since sharp is a native module only a Node server can run; here
 * when it is not, or did not answer.
 */
export async function cropToAspect(bytes: Buffer, aspect: Aspect, mimeType = "image/jpeg"): Promise<{ bytes: Buffer; mimeType: string }> {
  if (drawServiceSet()) {
    try {
      return await cropThere(bytes, aspect, mimeType);
    } catch (e) {
      console.warn("draw: crop done here, the service failed:", e instanceof Error ? e.message : e);
    }
  }
  return (await import("@/lib/content/crop-here")).cropHere(bytes, aspect, mimeType);
}
