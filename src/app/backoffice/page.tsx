import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { FormError } from "@/components/auth/fields";
import { GOOGLE, GoogleG } from "@/components/auth/google-button";
import { googleError } from "@/lib/auth/google";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "ระบบหลังบ้าน | AdvisorTool", robots: { index: false, follow: false } };

/**
 * The Super Admin's door (owner, 2026-10-15; mockup https://claude.ai/artifact/4X65JZ3TLN7VvKjfpDy4MU):
 * Google only, no agent code, no sign-up, and no link to it from the front of the app. Only an
 * address listed in ins_super_admins gets past the callback (src/lib/auth/google-super.ts).
 * Somebody already signed in goes on: the Super Admin to /admin, anyone else is sent there too
 * and turned back to /home by its gate.
 */
export default async function BackofficeDoor({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getViewer()) redirect("/admin");
  const said = googleError(error);
  return (
    <AuthCard title="ระบบหลังบ้าน" subtitle="สำหรับผู้ดูแลระบบเท่านั้น เข้าด้วยบัญชี Gmail ที่ลงทะเบียนไว้">
      <div className="mt-6 space-y-3">
        {said && <FormError>{said}</FormError>}
        <a href="/backoffice/google" className={GOOGLE}>
          <GoogleG />
          เข้าสู่ระบบด้วย Google
        </a>
      </div>
    </AuthCard>
  );
}
