import type { Metadata } from "next";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { memberProfile } from "@/lib/auth/member-store";
import { gatePage } from "@/lib/auth/viewer";
import { getContact, photoUrl } from "@/lib/quote-video/contact";
import { AccountForm } from "./AccountForm";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "บัญชีของฉัน | AdvisorTool" };

/**
 * A member's name and สำนักงาน (2026-10-27), and the Google account they sign in with (owner, 2026-10-02). UnitOS agents
 * manage theirs in UnitOS. Since 2026-10-11 every agent's: the contact details a วิดีโอนำเสนอ
 * closes on are kept here.
 */
export default async function AccountPage() {
  const viewer = await gatePage("/studio/account");
  const contact = await getContact(viewer.agentId).catch((e) => {
    console.error("contact not read:", e);
    return { name: "", phone: "", line: "", more: "", photoPath: null };
  });
  const photo = await photoUrl(contact.photoPath);
  // the gate has already sent a member with no สำนักงาน to สมัครสมาชิก
  const profile = viewer.kind === "member" ? await memberProfile(viewer.agentId) : null;
  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      {viewer.kind === "member" ? (
        <AccountForm name={viewer.name} office={profile?.office ?? ""} email={viewer.code} />
      ) : (
        <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
      )}
      <ContactForm accountName={viewer.name} name={contact.name} phone={contact.phone} line={contact.line} more={contact.more} photo={photo} />
    </div>
  );
}
