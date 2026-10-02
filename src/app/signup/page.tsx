import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SECONDARY } from "@/components/auth/styles";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมัครสมาชิก | AdvisorTool" };

/** Sign-up for people outside UnitOS (owner, 2026-10-01); closed until the owner switches it on. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // where to go once signed up: ถาม AI sends people here with next=/ after its free questions
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  const open = (await memberSettings().catch(() => null))?.signupOpen === true;
  if (!open) {
    return (
      <AuthCard title="ยังไม่เปิดรับสมัคร" subtitle="ตัวแทนใน UnitOS เข้าสู่ระบบด้วยรหัสตัวแทนได้เลย">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${SECONDARY} mt-6`}>ไปหน้าเข้าสู่ระบบ</Link>
      </AuthCard>
    );
  }
  return <SignupForm next={next} />;
}
