import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { lasted } from "@/lib/ai/health-rules";
import { readConnectionsPage, type ConnectionsPage } from "@/lib/signin-health/page-data";
import { diagnose, ROUTE_LABEL, ROUTE_NOTE, ROUTE_SEEN, ROUTES, type Route } from "@/lib/signin-health/rules";
import { runSigninCheck, type Standing } from "@/lib/signin-health/run";
import type { Tone } from "@/lib/signin-health/tally";
import { Card, Empty, PageHead } from "../ui";
import { CheckNow } from "./CheckNow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "การเชื่อมต่อ | AdvisorTool" };

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", {
  timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const dayLabel = (day: string, first: boolean) => {
  const d = new Date(`${day}T12:00:00+07:00`);
  return d.getUTCDate() === 1 || first
    ? d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })
    : String(d.getUTCDate());
};
const n = (v: number) => v.toLocaleString("en-US");
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} วิ`);

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = {
    ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
    warn: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]",
    bad: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
    off: "bg-[var(--bot-band)] text-[var(--bot-ink-mute)]",
  }[tone];
  return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

function Fig({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--bot-ink-mute)]">{label}</dt>
      <dd className={`font-semibold tabular-nums ${bad ? "text-[var(--bot-red-ink)]" : ""}`}>{value}</dd>
    </div>
  );
}

/** One way in: its standing, how much it is used, and on a failure what is wrong and how to fix it. */
function RouteCard({ route, s, data }: { route: Route; s: Standing | undefined; data: ConnectionsPage }) {
  const use = data.use[route];
  const down = s ? !s.ok : false;
  const shaky = down && !s!.alerted;
  const d = down ? diagnose(route, s!.lastError ?? "") : null;
  const closed = route === "bluewealth" && !data.bluewealthOpen;
  const pill = !s ? <Pill tone="off">ยังไม่เคยตรวจ</Pill>
    : !down ? <Pill tone="ok">ปกติ</Pill>
    : shaky ? <Pill tone="warn">ตรวจไม่ผ่าน 1 รอบ</Pill>
    : <Pill tone="bad">เข้าไม่ได้</Pill>;
  return (
    <article className={`flex min-w-0 flex-col gap-2.5 rounded-lg border bg-[var(--bot-surface)] p-4 ${down && !shaky ? "border-[var(--bot-red-ink)]" : "border-[var(--bot-line)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{ROUTE_LABEL[route]}</h2>
          <p className="text-xs text-[var(--bot-ink-mute)]">
            {ROUTE_NOTE[route]}
            {route === "bluewealth" && <> · สวิตช์ <b>{closed ? "ปิดอยู่" : "เปิดอยู่"}</b></>}
          </p>
        </div>
        {pill}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Fig label="ตอบใน" value={secs(s?.lastMs ?? null)} />
        {down && s?.downSince
          ? <Fig label="ใช้ไม่ได้มา" value={lasted(s.downSince, new Date().toISOString())} bad />
          : <Fig label="เข้าสำเร็จ 7 วัน" value={`${n(use.week)} ครั้ง`} />}
        <Fig label="เข้าล่าสุด" value={use.last ? when(use.last) : "เกิน 30 วัน"} />
      </dl>
      {d && (
        <div className={`rounded-md px-3 py-2.5 text-sm ${shaky ? "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>
          <p><b className="font-semibold">{d.why}</b>{shaky ? " · ถ้ารอบหน้ายังไม่ผ่านจะแจ้ง LINE" : ` · ${ROUTE_SEEN[route]}`}</p>
          {d.fix.length > 0 && (
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              {d.fix.map((f) => <li key={f} className="break-words">{f}</li>)}
            </ol>
          )}
          <p className="mt-1.5 break-all font-mono text-xs opacity-80">ข้อความจากระบบ: {s!.lastError}</p>
        </div>
      )}
    </article>
  );
}

function TriesChart({ data }: { data: ConnectionsPage }) {
  const top = Math.max(5, ...data.tries.map((t) => t.ok + t.failed));
  const h = (v: number) => `${Math.round((v / top) * 88)}px`;
  return (
    <Card title="เข้าสำเร็จและกรอกรหัสผิด 7 วัน" hint="รหัสผิดเยอะแต่ไม่มีใครเข้าได้เลย เป็นสัญญาณว่าทางเข้าเสีย แม้ตัวตรวจยังไม่จับได้">
      <div className="grid h-28 grid-cols-7 items-end gap-2" role="img" aria-label={data.tries.map((t) => `${t.day}: สำเร็จ ${t.ok} ไม่ผ่าน ${t.failed}`).join(", ")}>
        {data.tries.map((t, i) => (
          <div key={t.day} className="flex h-full flex-col items-center justify-end gap-1 text-[11px] text-[var(--bot-ink-mute)]">
            <span className="tabular-nums">{t.ok + t.failed > 0 ? `${t.ok}/${t.failed}` : ""}</span>
            <div className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t">
              <i className="block bg-[var(--bot-ok)]" style={{ height: h(t.ok) }} />
              <i className="block bg-[var(--bot-red-ink)] opacity-75" style={{ height: h(t.failed) }} />
            </div>
            <span>{dayLabel(t.day, i === 0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--bot-ink-mute)]">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--bot-ok)] align-[-1px]" />เข้าสำเร็จด้วยรหัส</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--bot-red-ink)] align-[-1px] opacity-75" />กรอกรหัสแล้วไม่ผ่าน</span>
      </div>
    </Card>
  );
}

const th = "bg-[var(--bot-navy)] px-2.5 py-1.5 text-left text-xs font-semibold text-white";
const td = "border-b border-[var(--bot-line)] px-2.5 py-1.5";

function Rooms({ data }: { data: ConnectionsPage }) {
  const seen = data.rooms.some((r) => r.seenOnly);
  return (
    <Card title="ห้องที่เข้าใช้" hint="ทุกห้องที่มีตัวแทนเข้า advisortool ได้ จากทั้งสองระบบ เรียงตามการเข้าใช้ 7 วัน">
      {data.rooms.length === 0 ? <Empty>ยังไม่มีห้อง</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr><th className={th}>ห้อง</th><th className={th}>สถานะห้อง</th><th className={`${th} text-right`}>ตัวแทน</th><th className={`${th} text-right`}>เข้า 7 วัน</th><th className={th}>เข้าล่าสุด</th></tr></thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={`${r.system}:${r.name}`}>
                  <td className={td}>{r.name}<div className="text-[11px] text-[var(--bot-ink-mute)]">{r.system}</div></td>
                  <td className={td}><Pill tone={r.tone}>{r.label}</Pill></td>
                  <td className={`${td} text-right tabular-nums`}>{n(r.agents)}{r.seenOnly ? "*" : ""}</td>
                  <td className={`${td} text-right tabular-nums`}>{n(r.week)}</td>
                  <td className={td}>{r.last ? when(r.last) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {seen && <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">* Bluewealth นับเฉพาะตัวแทนที่เคยเข้า advisortool แล้ว (ฝั่งเราไม่เห็นรายชื่อทั้งหมดของ Bluewealth)</p>}
    </Card>
  );
}

function Outages({ data }: { data: ConnectionsPage }) {
  const now = new Date().toISOString();
  return (
    <Card title="ประวัติขัดข้อง" hint="ทุกครั้งที่ตรวจไม่ผ่าน 2 รอบติดและแจ้ง LINE แล้ว ย้อนหลัง 90 วัน">
      {data.outages.length === 0 ? <Empty>ยังไม่มีครั้งไหนขัดข้อง</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr><th className={th}>ทางเข้า</th><th className={th}>เริ่ม</th><th className={th}>กลับมา</th><th className={`${th} text-right`}>นาน</th><th className={th}>สาเหตุ</th></tr></thead>
            <tbody>
              {data.outages.map((o) => (
                <tr key={o.id}>
                  <td className={td}>{ROUTE_LABEL[o.route] ?? o.route}</td>
                  <td className={td}>{when(o.startedAt)}</td>
                  <td className={td}>{o.endedAt ? when(o.endedAt) : <Pill tone="bad">ยังไม่กลับ</Pill>}</td>
                  <td className={`${td} text-right tabular-nums`}>{lasted(o.startedAt, o.endedAt ?? now)}</td>
                  <td className={td}>{diagnose(o.route, o.error ?? "").why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * การเชื่อมต่อระบบเข้าใช้ for the Super Admin (owner chose ก ก ก, 2026-11-03; mockup
 * https://claude.ai/artifact/CM989D3EiZgrFKWHEwAksq): whether each way in still works, checked every
 * 30 minutes (src/lib/signin-health), with what to do when one does not.
 */
export default async function AdminConnectionsPage() {
  await gatePage("/admin/connections", "backoffice");
  let data = await readConnectionsPage();
  // the first visit before the scheduler's first round asks once, rather than show four blanks
  if (data.standing.length === 0) {
    await runSigninCheck().catch((e) => console.error("[signin-health] first check failed:", e));
    data = await readConnectionsPage();
  }
  const by = new Map(data.standing.map((s) => [s.route, s]));
  const down = data.standing.filter((s) => !s.ok && s.alerted);
  const checked = data.standing.map((s) => s.lastChecked).filter((t): t is string => Boolean(t)).sort().at(-1);

  return (
    <>
      <PageHead title="การเชื่อมต่อระบบเข้าใช้" hint="ตรวจว่าแต่ละทางที่ตัวแทนและสมาชิกใช้เข้า advisortool ยังต่อได้ ระบบตรวจเองทุก 30 นาที">
        <CheckNow checkedAt={checked ? `ตรวจล่าสุด ${when(checked)} น.` : "ยังไม่เคยตรวจ"} />
      </PageHead>

      {data.standing.length > 0 && (down.length === 0 ? (
        <p role="status" className="mb-4 flex gap-2.5 rounded-lg bg-[var(--bot-ok-soft)] px-3.5 py-3 font-medium text-[var(--bot-ok)]">
          <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
          ทุกทางเข้าใช้ได้ปกติ
        </p>
      ) : (
        <div role="alert" className="mb-4 flex gap-2.5 rounded-lg bg-[var(--bot-red-soft)] px-3.5 py-3 font-medium text-[var(--bot-red-ink)]">
          <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
          <div>
            {down.map((s) => <p key={s.route}>{ROUTE_LABEL[s.route]} เข้าไม่ได้ ตั้งแต่ {when(s.downSince!)} น. ({lasted(s.downSince!, new Date().toISOString())})</p>)}
            <p className="text-sm font-normal">อีก {ROUTES.length - down.length} ทางปกติ</p>
          </div>
        </div>
      ))}

      <div className="mb-5 grid gap-3.5 lg:grid-cols-2">
        {ROUTES.map((r) => <RouteCard key={r} route={r} s={by.get(r)} data={data} />)}
      </div>
      <TriesChart data={data} />
      <Rooms data={data} />
      <Outages data={data} />
    </>
  );
}
