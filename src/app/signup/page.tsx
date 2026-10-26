import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { memberProfile } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { memberAccess } from "@/lib/members/access";
import { DAY_MS } from "@/lib/members/pass";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมัครสมาชิก | AdvisorTool" };

/**
 * สมัครสมาชิก (owner, 2026-10-27, mockup 189doYqMskU9fUDbvfHbLU): a member signs in with Google
 * on the front page as before, then gives their ชื่อ - นามสกุล and สำนักงาน here before anything
 * else — every page's gate sends them (src/lib/auth/viewer.ts). Members who joined earlier fill it
 * in once on their next visit (owner chose ก). Anybody not signed in goes to the front page, as
 * this address always did; anybody with nothing to fill in goes on to `next`.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const viewer = await getViewer();
  if (!viewer) redirect(`/?next=${encodeURIComponent(next)}`);
  if (viewer.kind !== "member" || !viewer.profileDue) redirect(next);
  const profile = await memberProfile(viewer.agentId);
  if (!profile) redirect(`/?next=${encodeURIComponent(next)}`);

  // the trial is said only to somebody who has just opened their account; a member from before
  // this page is told nothing new, and saves and carries on
  const fresh = Date.now() - Date.parse(profile.createdAt) < DAY_MS;
  const access = fresh ? await memberAccess(viewer).catch(() => null) : null;
  const trial = access?.gated && access.state.status !== "expired" ? access.settings : null;

  return (
    <AuthCard title="สมัครสมาชิก" subtitle="กรอกข้อมูลอีกนิด แล้วเริ่มใช้ได้เลย">
      <SignupForm
        name={profile.name} email={profile.email} next={next}
        trial={trial && `ทดลองฟรี ${trial.trialDays} วัน · ถาม AI ไม่จำกัด · เครดิต Studio ฿${(trial.trialCreditSatang / 100).toLocaleString("en-US")}`}
        button={trial ? `เริ่มทดลองฟรี ${trial.trialDays} วัน` : "บันทึกแล้วใช้งานต่อ"}
      />
    </AuthCard>
  );
}
