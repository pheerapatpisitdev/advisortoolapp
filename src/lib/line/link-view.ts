import { OA_ID, addFriendUrl, linkUrl, linkWords, type AgentLine, type AgentNotify } from "@/lib/line/agent-line";
import { liffUrl } from "@/lib/line/liff";

/**
 * เชื่อม LINE ของฉัน as ตั้งค่าส่วนตัว shows it (src/app/studio/settings/LineLinkForm.tsx). The QR is
 * drawn in the browser from `url`.
 *
 * With the LIFF app set up (owner chose ง, 2026-11-21) an agent with a 6-digit code gets one QR
 * that never runs out (`team`): it opens the LIFF page, where they type the code. A member (Google
 * sign-in, no code) asks for a one-time link instead, which opens the same page and links with
 * nothing typed. Without the LIFF app, the code typed into the chat, as before.
 */
export interface LineView {
  linked: boolean;
  linkedAt: string | null;
  notify: Record<AgentNotify, boolean>;
  /** the LIFF page's fixed address, for an agent who types their own code there */
  team: string | null;
  /** `words`: what to type in the chat (old way only); `oa`: the account to type it to */
  pending: { code: string; until: string; url: string; words: string | null; oa: string } | null;
  /** the account's add-friend link: no push reaches a LINE that is not a friend */
  addFriend: string;
  /** whether a push reaches the linked LINE, and its name; undefined = not linked or not known */
  friend?: { friend: boolean; name: string };
}

export interface LiffSetup {
  /** the LIFF app's id, null = not set up */
  liffId: string | null;
  /** an agent with a 6-digit code (not a Google member) */
  byCode: boolean;
}

export function lineViewOf(line: AgentLine, setup: LiffSetup = { liffId: null, byCode: false }, friend?: LineView["friend"]): LineView {
  const { liffId, byCode } = setup;
  const code = line.pendingCode;
  const pending = code && line.pendingUntil
    ? liffId
      ? { code, until: line.pendingUntil, url: liffUrl(liffId, code), words: null, oa: OA_ID }
      : { code, until: line.pendingUntil, url: linkUrl(code), words: linkWords(code), oa: OA_ID }
    : null;
  return {
    linked: line.linked,
    linkedAt: line.linkedAt,
    notify: line.notify,
    team: liffId && byCode ? liffUrl(liffId) : null,
    pending,
    addFriend: addFriendUrl(),
    ...(line.linked && friend ? { friend } : {}),
  };
}
