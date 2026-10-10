import { getViewer } from "@/lib/auth/viewer";
import { Fhc } from "./Fhc";

export const metadata = {
  title: "Financial Health Check — ตรวจสุขภาพการเงิน",
  description:
    "กรอกอายุ รายได้ เงินเก็บ หนี้ และคนที่คุณดูแล ดูคะแนนสุขภาพการเงินหกด้าน ห้าเหตุการณ์ที่ควบคุมไม่ได้ และแผนประกันพร้อมเบี้ยจริงที่พอดีกับงบ",
};

export default async function FhcPage() {
  // only a signed-in agent or member can keep a customer; anyone else uses the check as before
  const canSave = (await getViewer().catch(() => null)) !== null;
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-3xl sm:pb-10">
      <header className="pb-6 pt-8 print:hidden">
        <p className="text-sm text-[var(--lg-mute)]">Financial Health Check</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">ตรวจสุขภาพการเงิน</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          กรอกตัวเลขคร่าวๆ ก็พอ ระบบให้คะแนนสุขภาพการเงินหกด้าน บอกว่าห้าเหตุการณ์ที่ควบคุมไม่ได้กระทบคุณแค่ไหน
          และแบบประกันไหนพอดีกับงบของคุณ ไม่ต้องให้เบอร์โทร
        </p>
      </header>
      <Fhc canSave={canSave} />
    </main>
  );
}
