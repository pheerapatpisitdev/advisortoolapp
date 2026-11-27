import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { adminRows } from "@/lib/hospitals/places";
import { ownerPhones } from "@/lib/hospitals/store";
import { PageHead } from "../ui";
import { HospitalPhones } from "./HospitalPhones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "โรงพยาบาลในเครือ | หลังบ้าน" };

/**
 * The departments' numbers on /hospitals, filled in by hand where the hospitals' websites gave none, or over
 * what they gave (owner chose 5ก, 2026-11-25). Numbers that cannot be read throw to the error page: a form
 * opened without them would save over what is there.
 */
export default async function AdminHospitalsPage() {
  await gatePage("/admin/hospitals", "backoffice");
  return (
    <>
      <PageHead title="โรงพยาบาลในเครือ" hint="กรอกเบอร์แผนกเพิ่ม หรือแก้เบอร์ที่อ่านจากเว็บโรงพยาบาล ตัวแทนเห็นในเมนูโรงพยาบาลในเครือทันที" />
      <HospitalPhones rows={adminRows(await ownerPhones())} />
    </>
  );
}
