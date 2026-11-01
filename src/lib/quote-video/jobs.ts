import { defineJob } from "@/lib/later";
import { produce, redrawScene, type RedrawJob } from "@/lib/quote-video/make";

/**
 * A clip's making, after the action that took the order has answered (src/lib/later.ts): every
 * kind of clip — วิดีโอนำเสนอ, สรุป FHC, คลิปเล่าเรื่อง, คลิปตามโจทย์ — is made by produce(), which
 * reads the clip by its id. `agentName` is the name on its end card.
 */
export const clipProduce = defineJob<{ id: string; agentName: string }>(
  "clip-produce",
  ({ id, agentName }) => produce(id, agentName),
);

/** วาดภาพฉากนี้ใหม่'s drawing and cut, once the clip is taken (redrawPicture) */
export const clipRedraw = defineJob<RedrawJob>("clip-redraw", redrawScene);
