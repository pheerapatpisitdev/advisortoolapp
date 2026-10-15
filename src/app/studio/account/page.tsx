import type { Metadata } from "next";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { gatePage } from "@/lib/auth/viewer";
import Link from "next/link";
import { getContact, photoUrl } from "@/lib/quote-video/contact";
import { mayClone, myVoices } from "@/lib/voice/mine";
import { AccountForm } from "./AccountForm";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "บัญชีของฉัน | AdvisorTool" };

/**
 * A member's name, and the Google account they sign in with (owner, 2026-10-02). UnitOS agents
 * manage theirs in UnitOS. Since 2026-10-11 every agent's: the contact details a วิดีโอนำเสนอ
 * closes on are kept here.
 */
export default async function AccountPage() {
  const viewer = await gatePage("/studio/account");
  const contact = await getContact(viewer.agentId).catch((e) => {
    console.error("contact not read:", e);
    return { phone: "", line: "", more: "", photoPath: null };
  });
  const photo = await photoUrl(contact.photoPath);
  // เสียงของฉัน (owner, 2026-10-15): for the agents invited to the pilot
  const voice = mayClone(viewer) ? await myVoices(viewer.agentId).catch(() => null) : null;
  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      {viewer.kind === "member" ? (
        <AccountForm name={viewer.name} email={viewer.code} />
      ) : (
        <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
      )}
      <ContactForm name={viewer.name} phone={contact.phone} line={contact.line} more={contact.more} photo={photo} />
      {voice && (
        <Link href="/studio/voice" className="block space-y-1 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 no-underline hover:border-[var(--ct-line)]">
          <b className="block">เสียงของฉัน</b>
          <span className="block text-sm text-[var(--ct-mute)]">
            {voice.active ? "ใช้งานอยู่ · ฟัง อัดใหม่ หรือลบ" : voice.pending?.status === "review" ? "รอแอดมินตรวจ" : "โคลนเสียงของคุณ ใช้พากย์ทุกคลิป →"}
          </span>
        </Link>
      )}
    </div>
  );
}
