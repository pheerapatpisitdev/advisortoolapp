import { pngResponse } from "@/lib/draw-png";
import { cardFont } from "@/lib/draw/fonts";
import { C } from "@/lib/line/rich-menu-image";
import type { VideoSize } from "@/lib/quote-video/timeline";

/**
 * The cover LINE shows on a finished clip sent into the agent's chat (owner chose ข, 2026-11-27,
 * mockup https://claude.ai/artifact/S5X3j9dZbvR7Kij2prLHsS): LINE wants a picture with every
 * video, and no clip keeps a still of its own, so the cover is drawn from its name. The LINE
 * menu's navy, the tool, the plan and the customer, in the clip's own shape. No play mark: LINE
 * draws its own over every video's cover.
 */

const SIZES: Record<VideoSize, { width: number; height: number }> = {
  portrait: { width: 540, height: 960 },
  square: { width: 720, height: 720 },
  landscape: { width: 960, height: 540 },
};

/** "วิดีโอนำเสนอ · Life Protect (Motion)" → the tool on top, the rest under it */
export function coverLines(what: string, customer: string): { tool: string; plan: string; who: string } {
  const [tool, ...rest] = what.split(" · ");
  const who = customer.trim();
  return { tool: tool.trim(), plan: rest.join(" · ").trim(), who: who ? (who.startsWith("คุณ") ? who : `คุณ${who}`) : "" };
}

export async function drawClipPreview(what: string, customer: string, size: VideoSize): Promise<Response> {
  const { width, height } = SIZES[size];
  const { tool, plan, who } = coverLines(what, customer);
  const unit = Math.min(width, height) / 540;
  return pngResponse(
    (
      <div
        style={{
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          width, height, padding: Math.round(48 * unit), background: C.ground, fontFamily: "Plex",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: Math.round(30 * unit), color: C.icon, fontWeight: 600 }}>{tool}</div>
          {plan && <div style={{ display: "flex", marginTop: Math.round(10 * unit), fontSize: Math.round(54 * unit), lineHeight: 1.25, color: C.ink, fontWeight: 600 }}>{plan}</div>}
          {who && <div style={{ display: "flex", marginTop: Math.round(14 * unit), fontSize: Math.round(36 * unit), color: C.sub }}>{who}</div>}
        </div>
        <div style={{ display: "flex", fontSize: Math.round(26 * unit), color: C.tabOffInk }}>advisortool.app</div>
      </div>
    ),
    {
      width, height,
      fonts: [
        { name: "Plex", data: cardFont("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
        { name: "Plex", data: cardFont("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
      ],
      // the cover of a finished clip never changes
      headers: { "cache-control": "public, max-age=2592000, immutable" },
    },
  );
}
