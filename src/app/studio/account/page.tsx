import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";
import { AccountForm } from "./AccountForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "บัญชีของฉัน | advisortool" };

/** A member's name and PIN (owner, 2026-10-01). UnitOS agents manage theirs in UnitOS. */
export default async function AccountPage() {
  const viewer = await gatePage("/studio/account");
  if (viewer.kind !== "member") redirect("/studio");
  return <AccountForm name={viewer.name} phone={viewer.code} />;
}
