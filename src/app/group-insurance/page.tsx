import { gateCalc } from "@/lib/auth/viewer";
import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { GroupInsurance } from "@/components/group-insurance/GroupInsurance";

/**
 * ประกันภัยกลุ่ม — the sixth thing this system sells, and the first one sold to a company.
 *
 * The page itself is a server component holding nothing but the shell and the description;
 * everything that moves is in `GroupInsurance`. It used to prerender so the first paint did
 * not wait on a session lookup, but the calculators are for members only since 2026-10-20
 * (owner), so it reads the session like the rest.
 *
 * `signedIn` is not passed: this is not the back office, so its pages stay out of the menu.
 */
export const metadata: Metadata = {
  title: "ประกันภัยกลุ่ม — Group Insurance",
  description: "ประกันกลุ่มสำหรับองค์กร — คำนวณเบี้ยหลายกลุ่มและออกใบเสนอราคาได้ทันที",
};

export default async function GroupInsurancePage() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/group-insurance");
  return (
    <AppShell>
      <GroupInsurance />
    </AppShell>
  );
}
