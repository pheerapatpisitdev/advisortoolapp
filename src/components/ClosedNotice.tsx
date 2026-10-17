import Link from "next/link";
import type { Viewer } from "@/lib/auth/access";
import { FEATURES, type FeatureKey } from "@/lib/switches/features";
import { closedNotice } from "@/lib/switches/store";

// Studio's warning colours, or the home palette's alert on ถาม AI, which is outside Studio
const WARN = { borderColor: "var(--ct-warn-line, var(--hm-alert-line))", background: "var(--ct-warn-bg, var(--hm-alert-bg))", color: "var(--ct-warn-ink, var(--hm-alert))" };

/**
 * The line at the top of a tool's page for the owner and the Super Admin while it is switched
 * off (เปิด-ปิดฟังก์ชัน, owner chose ก ก ก, 2026-10-17): they go on using it, to try it before it
 * is back on, and are told it is off for everyone else. Everybody else gets `LockedPage` instead.
 */
export async function ClosedNotice({ viewer, feature }: { viewer: Viewer; feature: FeatureKey }) {
  const n = await closedNotice(viewer, feature);
  if (!n?.forOthers) return null;
  return (
    <p role="status" className="my-3 rounded-xl border px-4 py-3 text-sm" style={WARN}>
      <b>ปิดอยู่สำหรับผู้ใช้อื่น</b> · {n.message} · คุณยังใช้ทดสอบได้ เปิดคืนที่หลังบ้าน › เปิด-ปิดฟังก์ชัน
    </p>
  );
}

/**
 * What a switched-off tool's page is, for everyone but the owner and the Super Admin (owner,
 * 2026-10-17: "ปิดแล้วล็อกไม่ต้องให้เข้าไปได้เลย", mockup https://claude.ai/artifact/Mv6YBQTgfQ8BUDeLyAeuXi):
 * the lock and the Super Admin's words, nothing of the tool — its past work comes back with it.
 */
export function LockedPage({ feature, message, back = { href: "/studio", label: "กลับหน้า Studio" } }: {
  feature: FeatureKey;
  message: string;
  back?: { href: string; label: string };
}) {
  const label = FEATURES.find((f) => f.key === feature)?.label ?? "ฟังก์ชันนี้";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <h1 className="text-xl font-semibold">{label} ปิดชั่วคราว</h1>
      <p className="text-sm">{message}</p>
      <Link href={back.href} className="mt-2 rounded-lg border px-4 py-1.5 text-sm no-underline" style={{ borderColor: "currentColor" }}>{back.label}</Link>
    </div>
  );
}
