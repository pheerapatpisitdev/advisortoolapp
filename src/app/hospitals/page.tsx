import "../home-theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage } from "@/lib/auth/viewer";
import { NETWORK_DAY, places, thaiDay } from "@/lib/hospitals/places";
import { ownerPhonesOrNone } from "@/lib/hospitals/store";
import { shellWho } from "@/lib/shell/who";
import { HospitalCatalogue } from "./HospitalCatalogue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "โรงพยาบาลในเครือ | AdvisorTool",
  description: "โรงพยาบาลและคลินิกคู่สัญญาของกรุงไทย-แอกซ่า ประกันชีวิต แยกตามภาคและจังหวัด พร้อมเบอร์แผนก",
};

/**
 * โรงพยาบาลในเครือ (owner, 2026-11-24; ก ×5 on 2026-11-25, mockup https://claude.ai/artifact/2pdzVimrFm1xLhR5uSNfv5):
 * the insurer's own list by part of the country and province, with the departments' numbers. Signed in and
 * with a live pass, as the calculators are.
 */
export default async function HospitalsPage() {
  const viewer = await gatePage("/hospitals");
  const list = places(await ownerPhonesOrNone());
  const day = thaiDay(NETWORK_DAY);
  return (
    <div className="home-chat min-h-dvh text-[var(--hm-ink)]">
      <AppShell who={await shellWho(viewer)}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pb-10 pt-3 lg:pt-6">
          {/* on a phone, clear of the menu button fixed at the top left */}
          <header className="max-lg:ml-12">
            <h1 className="text-2xl font-semibold text-balance text-[var(--hm-accent)]">โรงพยาบาลในเครือ</h1>
            <p className="text-sm text-[var(--hm-mute)]">
              {`กรุงไทย-แอกซ่า ประกันชีวิต ${list.length} แห่ง ใน ${new Set(list.map((p) => p.province)).size} จังหวัด`}
            </p>
          </header>
          <HospitalCatalogue places={list} />
          <p className="text-[13px] text-[var(--hm-mute)]">
            {`ข้อมูลจากเว็บกรุงไทย-แอกซ่า ประกันชีวิต (ประกันสุขภาพรายบุคคล) ณ วันที่ ${day} เบอร์แผนกมาจากเว็บของแต่ละโรงพยาบาล รายชื่อและเบอร์อาจเปลี่ยนแปลงได้ กรุณาโทรยืนยันกับโรงพยาบาลก่อนเข้ารับการรักษา`}
          </p>
        </div>
      </AppShell>
    </div>
  );
}
