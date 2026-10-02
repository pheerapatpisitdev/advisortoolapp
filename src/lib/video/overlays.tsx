import type { ReactNode } from "react";
import type { ClipStyle, Hook } from "@/lib/content/clip";
import { renderPng } from "@/lib/content/poster-png";
import type { StyleLook } from "./styles";

/** The words laid on a clip, as transparent pictures the render puts over the video (owner, 2026-10-02). */

export const STYLE_LABEL: Record<ClipStyle, string> = { box: "กล่องดำ", outline: "ตัวขาวขอบดำ", yellow: "เน้นเหลือง", page: "สีของเพจ" };
export const SUB_SIZE = { width: 1080, height: 200 };
export const HOOK_SIZE = { width: 1080, height: 360 };

const text = (look: StyleLook) => ({
  fontFamily: "Plex", fontWeight: 600, fontSize: look.fontSize, lineHeight: 1.25, textAlign: "center" as const,
  color: look.box ? look.box.color : look.color,
  ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}),
});

export function subElement(words: string, look: StyleLook): ReactNode {
  return (
    <div style={{ width: SUB_SIZE.width, height: SUB_SIZE.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", maxWidth: 1000, ...(look.box ? { background: look.box.background, borderRadius: look.box.borderRadius, padding: look.box.padding } : {}), ...text(look) }}>
        {words}
      </div>
    </div>
  );
}

export function hookElement(hook: Hook, look: StyleLook): ReactNode {
  return (
    <div style={{ width: HOOK_SIZE.width, height: HOOK_SIZE.height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {hook.top ? (
        <div style={{ display: "flex", padding: "14px 30px", borderRadius: 18, background: look.hookTopBg, color: look.hookTopInk, fontFamily: "Plex", fontWeight: 600, fontSize: 44, marginBottom: 18 }}>{hook.top}</div>
      ) : null}
      <div style={{ display: "flex", padding: "22px 40px", borderRadius: 24, background: look.hookMainBg, color: look.hookMainInk, fontFamily: "Plex", fontWeight: 600, fontSize: 76, textAlign: "center", maxWidth: 1020, ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}) }}>
        {hook.main}
      </div>
    </div>
  );
}

export const renderSubPng = (words: string, look: StyleLook): Promise<Buffer> => renderPng(subElement(words, look), SUB_SIZE);
export const renderHookPng = (hook: Hook, look: StyleLook): Promise<Buffer> => renderPng(hookElement(hook, look), HOOK_SIZE);
