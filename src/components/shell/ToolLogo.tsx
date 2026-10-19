import { TOOL_LOGOS, type ToolLogoId } from "@/lib/shell/tool-logos";

/**
 * A Studio tool's square (src/lib/shell/tool-logos.ts): in the menu in place of the chip, and
 * larger beside the tool's own heading. Hidden from screen readers, the tool's name is always
 * written beside it.
 */
export function ToolLogo({ id, size = "sm" }: { id: ToolLogoId; size?: "sm" | "lg" }) {
  return (
    <span aria-hidden="true" className={`tool-logo tool-logo-${id}${size === "lg" ? " tool-logo-lg" : ""}`}>
      {TOOL_LOGOS[id]}
    </span>
  );
}
