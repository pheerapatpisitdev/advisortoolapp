import type { Viewer } from "@/lib/auth/access";
import type { FeatureKey } from "@/lib/switches/features";
import { closedNotice } from "@/lib/switches/store";

/**
 * The line at the top of a tool's page while the Super Admin has it switched off (เปิด-ปิดฟังก์ชัน,
 * owner chose ก ก ก, 2026-10-17): why, to its users, whose new jobs are refused; to the owner and
 * the Super Admin, who may go on, that it is off for everyone else. Nothing while it is on.
 * Studio's warning colours, or the home palette's alert on ถาม AI, which is outside Studio.
 */
export async function ClosedNotice({ viewer, feature }: { viewer: Viewer; feature: FeatureKey }) {
  const n = await closedNotice(viewer, feature);
  if (!n) return null;
  return (
    <p
      role="status"
      className="my-3 rounded-xl border px-4 py-3 text-sm"
      style={{ borderColor: "var(--ct-warn-line, var(--hm-alert-line))", background: "var(--ct-warn-bg, var(--hm-alert-bg))", color: "var(--ct-warn-ink, var(--hm-alert))" }}
    >
      <b>{n.forOthers ? "ปิดอยู่สำหรับผู้ใช้อื่น" : "ปิดชั่วคราว"}</b>
      {" · "}
      {n.message}
      {n.forOthers ? " · คุณยังใช้ทดสอบได้ เปิดคืนที่หลังบ้าน › เปิด-ปิดฟังก์ชัน" : " · งานที่ทำไว้แล้วยังเปิดดูได้ตามปกติ"}
    </p>
  );
}
