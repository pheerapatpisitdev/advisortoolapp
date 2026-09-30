import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { memberSettings } from "@/lib/auth/member-store";
import { getViewer } from "@/lib/auth/viewer";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมัครใช้ Studio | advisortool" };

/** Sign-up for people outside UnitOS (owner, 2026-10-01); closed until the owner switches it on. */
export default async function SignupPage() {
  if (await getViewer()) redirect("/studio");
  const open = (await memberSettings().catch(() => null))?.signupOpen === true;
  if (!open) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <div className="rounded-lg border bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">ยังไม่เปิดรับสมัคร</h1>
          <p className="mt-2 text-sm text-[var(--bot-ink-mute)]">ตัวแทนใน UnitOS เข้าสู่ระบบด้วยรหัสตัวแทนได้เลย</p>
          <Link href="/login" className="mt-6 block text-sm underline">ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </main>
    );
  }
  return <SignupForm />;
}
