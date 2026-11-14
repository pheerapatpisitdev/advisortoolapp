import { can, type Viewer } from "@/lib/auth/access";

/**
 * คลังแอนิเมชัน is the owner's alone (owner, 2026-11-14, "ตัวคลัง ให้แสดงและจัดการเฉพาะ ผมผู้ดูแลคนเดียวเท่านั้น",
 * spec 2026-11-14-library-owner-only-design.md): the owner and the Super Admin, never the demo account, an
 * assistant or an agent. Browser-safe: no server imports.
 */
export function mayLibrary(viewer: Viewer | null): boolean {
  return Boolean(viewer?.agentId) && viewer?.kind !== "demo" && can(viewer, "owner");
}

/** what anyone else is told, on the page, from every action and from the upload route */
export const LIBRARY_CLOSED = "ฟังก์ชันนี้ปิดใช้งานอยู่";
