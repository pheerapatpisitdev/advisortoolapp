import { OA_ID, linkUrl, linkWords, type AgentLine, type AgentNotify } from "@/lib/line/agent-line";

/**
 * เชื่อม LINE ของฉัน as ตั้งค่าส่วนตัว shows it (src/app/studio/settings/LineLinkForm.tsx). The QR is
 * drawn in the browser from `url`, which opens the account's chat with the words already typed.
 */
export interface LineView {
  linked: boolean;
  linkedAt: string | null;
  notify: Record<AgentNotify, boolean>;
  /** `words`: what to type in the chat; `oa`: the account to type it to */
  pending: { code: string; until: string; url: string; words: string; oa: string } | null;
}

export function lineViewOf(line: AgentLine): LineView {
  const pending = line.pendingCode && line.pendingUntil
    ? { code: line.pendingCode, until: line.pendingUntil, url: linkUrl(line.pendingCode), words: linkWords(line.pendingCode), oa: OA_ID }
    : null;
  return { linked: line.linked, linkedAt: line.linkedAt, notify: line.notify, pending };
}
