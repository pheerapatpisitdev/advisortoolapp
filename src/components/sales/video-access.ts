"use server";
import { getViewer } from "@/lib/auth/viewer";

/**
 * Whether whoever is reading a plan's sales page is a signed-in agent, for the
 * สร้างวิดีโอนำเสนอ shortcut (owner, 2026-10-11). Asked by strangers too, so it never throws and
 * says nothing but yes or no; the Studio page it leads to checks again.
 */
export async function canMakeVideo(): Promise<boolean> {
  return Boolean(await getViewer().catch(() => null));
}
