import type { MetaCampaign } from "@/lib/ads/meta-campaigns";
import { resultCells } from "@/lib/ads/campaign-table";

/**
 * The campaigns built in Meta Ads Manager by hand for this Page, under Ads Studio's own
 * (owner, 2026-10-06): their figures only — they are switched on and off in Meta. Laid out on
 * the แคมเปญ table's columns so the two read as one list; nothing is drawn when there is none.
 */

const th = "border-b border-[var(--ct-line)] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-[var(--ct-mute)]";
const td = "border-b border-[var(--ct-hair)] px-3 py-2 align-top";
const numCell = `${td} text-right tabular-nums whitespace-nowrap`;

export function MetaCampaigns({ result, days }: {
  result: { ok: true; campaigns: MetaCampaign[] } | { ok: false; error: string };
  days: 7 | 30;
}) {
  if (!result.ok) {
    return <p role="alert" className="text-xs text-[var(--ct-alert)]">อ่านแคมเปญที่สร้างใน Meta ไม่ได้ — {result.error}</p>;
  }
  const rows = result.campaigns;
  if (rows.length === 0) return null;
  const total = rows.reduce(
    (t, r) => ({ spend: t.spend + r.result.spend, impressions: t.impressions + r.result.impressions, clicks: t.clicks + r.result.clicks, messaging: t.messaging + r.result.messaging }),
    { spend: 0, impressions: 0, clicks: 0, messaging: 0 },
  );
  const foot = resultCells(total);
  return (
    <section className="space-y-2" aria-labelledby="meta-campaigns">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="meta-campaigns" className="text-sm font-medium">แคมเปญที่สร้างใน Meta Ads Manager</h2>
        <span className="text-xs text-[var(--ct-mute)]">ดูผลอย่างเดียว · เปิด/หยุดใน Meta · เฉพาะที่มีการแสดงผลใน {days} วันล่าสุด</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--ct-ground)]">
              <th scope="col" className={th}>แคมเปญ</th>
              <th scope="col" className={`${th} text-right`}>โฆษณา</th>
              <th scope="col" className={`${th} text-right`}>ใช้ไป</th>
              <th scope="col" className={`${th} text-right`}>การแสดงผล</th>
              <th scope="col" className={`${th} text-right`}>คลิก</th>
              <th scope="col" className={`${th} text-right`}>แชท</th>
              <th scope="col" className={`${th} text-right`}>บาท/แชท</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cells = resultCells(r.result);
              return (
                <tr key={r.key} className="hover:bg-[var(--ct-ground)]">
                  <td className={`${td} min-w-[16rem]`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="rounded-full border border-[var(--ct-line)] px-2 py-0.5 text-xs text-[var(--ct-mute)]">สร้างใน Meta</span>
                    </div>
                    {r.accountName && <p className="mt-0.5 text-xs text-[var(--ct-mute)]">บัญชี {r.accountName}</p>}
                  </td>
                  <td className={numCell}>{r.ads.toLocaleString("th-TH")}</td>
                  <td className={numCell}>{cells.spend}</td>
                  <td className={numCell}>{cells.impressions}</td>
                  <td className={numCell}>{cells.clicks}</td>
                  <td className={numCell}>{cells.messaging}</td>
                  <td className={numCell}>{cells.perChat}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ct-ground)] font-medium">
              <th scope="row" className="px-3 py-2 text-left">รวม {rows.length.toLocaleString("th-TH")} แคมเปญ</th>
              <td className="px-3 py-2 text-right tabular-nums">{rows.reduce((n, r) => n + r.ads, 0).toLocaleString("th-TH")}</td>
              {[foot.spend, foot.impressions, foot.clicks, foot.messaging, foot.perChat].map((v, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{v}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
