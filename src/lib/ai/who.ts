import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Who an AI call was made for, carried in async context the way a wallet round's meter is
 * (src/lib/wallet/round.ts).
 *
 * The owner wants to see who uses AI and how much before deciding whether to charge for it
 * (owner, 2026-10-10). A question or a Studio round is many calls, made deep inside code that
 * does not know who asked; so the caller opens a context once and recordUsage
 * (src/lib/ai/ledger.ts) writes it on every ledger line. `askId` ties one question's calls
 * together. Outside a context (the customer bots) both are null.
 */
export interface Who { agentId: string; askId: string }

const who = new AsyncLocalStorage<Who>();

/** runs `fn` as one question or round of `agentId`; an empty id runs it untagged */
export function asWho<T>(agentId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (!agentId) return fn();
  return who.run({ agentId, askId: randomUUID() }, fn);
}

export const currentWho = (): Who | undefined => who.getStore();
