import type { ReactNode } from "react";
import type { ClipStyle, Hook } from "@/lib/content/clip";
import { renderPng } from "@/lib/content/poster-png";
import { hookLines, subLines, type StyleLook } from "./styles";

export { hookLines, subLines };

/** two lines fit at full size; more shrink to fit the 200px picture (box padding ~36 comes off first) */
const fit = (size: number, lines: number) => Math.max(40, Math.min(size, Math.floor((SUB_SIZE.height - 36) / (1.25 * lines))));
const rows = (lines: string[]) => lines.map((l, i) => <div key={i} style={{ display: "flex", justifyContent: "center" }}>{l}</div>);

/** The words laid on a clip, as transparent pictures the render puts over the video (owner, 2026-10-02). */

export const STYLE_LABEL: Record<ClipStyle, string> = { box: "กล่องดำ", outline: "ตัวขาวขอบดำ", yellow: "เน้นเหลือง", page: "สีของเพจ" };
export const SUB_SIZE = { width: 1080, height: 200 };
export const HOOK_SIZE = { width: 1080, height: 360 };

const text = (look: StyleLook, fontSize: number) => ({
  fontFamily: "Plex", fontWeight: 600, fontSize, lineHeight: 1.25, textAlign: "center" as const,
  color: look.box ? look.box.color : look.color,
  ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}),
});

export function subElement(words: string, look: StyleLook): ReactNode {
  const lines = subLines(words);
  return (
    <div style={{ width: SUB_SIZE.width, height: SUB_SIZE.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 1000, ...(look.box ? { background: look.box.background, borderRadius: look.box.borderRadius, padding: look.box.padding } : {}), ...text(look, fit(look.fontSize, lines.length)) }}>
        {rows(lines)}
      </div>
    </div>
  );
}

export function hookElement(hook: Hook, look: StyleLook): ReactNode {
  const lines = hookLines(hook.main);
  // the picture is 360 tall: the top pill (~101 with its gap) and the main box's padding come off first
  const mainSize = Math.max(40, Math.min(76, Math.floor((HOOK_SIZE.height - (hook.top ? 101 : 0) - 44 - 10) / (1.25 * lines.length))));
  return (
    <div style={{ width: HOOK_SIZE.width, height: HOOK_SIZE.height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {hook.top ? (
        <div style={{ display: "flex", padding: "14px 30px", borderRadius: 18, background: look.hookTopBg, color: look.hookTopInk, fontFamily: "Plex", fontWeight: 600, fontSize: 44, marginBottom: 18, flexShrink: 0 }}>{hook.top}</div>
      ) : null}
      <div style={{ display: "flex", padding: "22px 40px", borderRadius: 24, background: look.hookMainBg, color: look.hookMainInk, fontFamily: "Plex", fontWeight: 600, fontSize: mainSize, lineHeight: 1.25, flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 1020, ...(look.stroke ? { WebkitTextStroke: look.stroke } : {}) }}>
        {rows(lines)}
      </div>
    </div>
  );
}

export const renderSubPng = (words: string, look: StyleLook): Promise<Buffer> => renderPng(subElement(words, look), SUB_SIZE);
export const renderHookPng = (hook: Hook, look: StyleLook): Promise<Buffer> => renderPng(hookElement(hook, look), HOOK_SIZE);
