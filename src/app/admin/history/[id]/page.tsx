import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";
import { readPersonHead, readPersonMonth } from "@/lib/admin/people-history-read";
import { ADMIN_FILTERS, groupDays, isAdminKind, summarizeAdmin } from "@/lib/admin/people-history";
import { FIRST_MONTH, monthLabel, monthOf, monthRange, parseMonth, shiftMonth, type Month } from "@/lib/home/history";
import { Empty } from "../../ui";
import { baht, Lines, Work } from "../Lines";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ประวัติผู้ใช้ | AdvisorTool" };

/**
 * One person's whole history, month by month (owner, 2026-10-15; mockup
 * https://claude.ai/artifact/2uzD38rmUBZ223o6SPG3M1): who they are, the month in figures, the
 * work they made as a gallery, then every line — each transaction and each thing done — with
 * what it made.
 */
const GALLERY = 18;

export default async function PersonHistory({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await gatePage(`/admin/history/${id}`, "backoffice");
  const sp = await searchParams;
  const now = new Date();
  const month = parseMonth(sp.m, now);
  const kind = isAdminKind(sp.k) ? sp.k : "all";
  const gallery = sp.g === "image" || sp.g === "video" ? sp.g : "all";

  const head = await readPersonHead(id);
  if (!head) notFound();
  const [from, to] = monthRange(month);
  const month$ = await readPersonMonth(id, from, to).catch((e) => {
    console.error(`history of ${id} not read:`, e);
    return null;
  });

  const here = (next: { m?: Month; k?: string; g?: string }) => {
    const q = new URLSearchParams();
    const m = next.m ?? month;
    const k = next.k ?? kind;
    const g = next.g ?? gallery;
    if (m !== monthOf(now)) q.set("m", m);
    if (k !== "all") q.set("k", k);
    if (g !== "all") q.set("g", g);
    return q.size ? `/admin/history/${id}?${q}` : `/admin/history/${id}`;
  };

  const items = month$?.items ?? [];
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);
  const sum = summarizeAdmin(items, month$?.aiThb ?? 0);
  // each picture once: several rounds drawing for one post, and the post itself, show the same file
  const seen = new Set<string>();
  const made = items.flatMap((it) => it.media.filter((m) => m.url).map((m) => ({ m, it }))).filter(({ m }) => {
    const file = (m.full ?? m.url!).split("?token=")[0];
    if (seen.has(file)) return false;
    seen.add(file);
    return true;
  });
  const works = made.filter(({ m }) => gallery === "all" || m.type === gallery);
  const counts = {
    image: made.filter(({ m }) => m.type === "image").length,
    video: made.filter(({ m }) => m.type === "video").length,
    text: items.filter((it) => it.text && it.kind !== "ask").length,
  };
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const kindLabel = head.kind === "agent" ? "ตัวแทน" : head.kind === "member" ? "สมาชิกทั่วไป" : "Super Admin";

  const facts: [string, string][] = [
    ["เริ่มใช้ระบบ", head.since ?? "—"],
    ...(head.rights ? [["สิทธิ์", head.rights] as [string, string]] : []),
    ...(head.pages.length ? [["เพจที่ดูแล", head.pages.join(", ")] as [string, string]] : []),
    ...(head.pass ? [["บัตรสมาชิก", head.pass] as [string, string]] : []),
    ...(head.status ? [["สถานะ", head.status] as [string, string]] : []),
    ["ยอดคงเหลือ", head.balanceSatang === null ? "ยังไม่มีกระเป๋า" : `${baht(head.balanceSatang, false)}${head.frozen ? ` (ระงับ: ${head.frozen})` : ""}`],
  ];
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-[13px] no-underline ${on
      ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white"
      : "border-[var(--bot-line)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]"}`;
  const tile = "rounded-md border border-[var(--bot-line)] px-3 py-2.5";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/history" className="text-sm text-[var(--bot-navy)] underline">← ประวัติผู้ใช้</Link>

      <section className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">
              {head.name}{" "}
              <span className="ml-1 rounded-full border border-[var(--bot-blue)] bg-[var(--bot-navy-soft)] px-2 align-middle text-xs font-normal text-[var(--bot-navy)]">{kindLabel}</span>
            </h1>
            <p className="text-sm text-[var(--bot-ink-mute)]">{[head.code, head.email, head.room, head.unit].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={head.kind === "member" ? "/admin/members" : "/admin/wallet"} className="rounded-md border border-[var(--bot-ink)] px-2.5 py-1 text-[13px] no-underline">
              {head.kind === "member" ? "ไปหน้าสมาชิกทั่วไป" : "ไปกระเป๋าเงิน"}
            </Link>
            <a href={`/admin/history/${id}/csv?m=${month}`} className="rounded-md border border-[var(--bot-ink)] px-2.5 py-1 text-[13px] no-underline">โหลด CSV เดือนนี้</a>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-4 gap-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-[var(--bot-ink-mute)]">{k}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{monthLabel(month)}</h2>
          <nav className="flex gap-3 text-sm">
            {prev >= FIRST_MONTH && <Link href={here({ m: prev })} className="text-[var(--bot-navy)]">‹ {monthLabel(prev)}</Link>}
            {month < monthOf(now) && <Link href={here({ m: next })} className="text-[var(--bot-navy)]">{monthLabel(next)} ›</Link>}
          </nav>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5 tabular-nums">
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">Studio / โพสต์</div><div className="text-xl font-semibold">{sum.studio}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">คลิปเสร็จ</div><div className="text-xl font-semibold">{sum.clips}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">ลูกค้า FHC</div><div className="text-xl font-semibold">{sum.customers}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">ถาม AI</div><div className="text-xl font-semibold">{sum.asks}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">เติมเงิน / ซื้อบัตร</div><div className="text-xl font-semibold text-[var(--bot-ok)]">{baht(sum.toppedUpSatang, false)}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">ใช้ไป</div><div className="text-xl font-semibold text-[var(--bot-red-ink)]">{baht(sum.spentSatang, false)}</div></div>
          <div className={tile}><div className="text-xs text-[var(--bot-ink-mute)]">ค่า AI จริง (ต้นทุนเรา)</div><div className="text-xl font-semibold">฿{sum.aiThb.toFixed(2)}</div></div>
        </div>
      </section>

      {!month$ ? (
        <p className="rounded-lg border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2.5 text-sm text-[var(--bot-red-ink)]">อ่านประวัติไม่ได้ตอนนี้ ลองโหลดหน้าใหม่อีกครั้ง</p>
      ) : (
        <>
          {(counts.image > 0 || counts.video > 0) && (
            <section className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  ผลงานเดือนนี้ <span className="font-normal text-[var(--bot-ink-mute)]">(ภาพ {counts.image} · คลิป {counts.video} · ข้อความ {counts.text})</span>
                </h2>
                <nav className="flex flex-wrap gap-1.5">
                  {(["all", "image", "video"] as const).map((g) => (
                    <Link key={g} href={here({ g })} className={chip(gallery === g)}>{g === "all" ? "ทั้งหมด" : g === "image" ? "ภาพ" : "คลิป"}</Link>
                  ))}
                </nav>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
                {works.slice(0, sp.all === "1" ? undefined : GALLERY).map(({ m, it }, i) => (
                  <figure key={`${it.key}-${i}`} className="m-0 min-w-0">
                    <Work media={m} fill />
                    <figcaption className="mt-1 truncate text-[11px] text-[var(--bot-ink-mute)]">
                      {new Date(it.at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })} · {it.title}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {works.length > GALLERY && sp.all !== "1" && (
                <p className="mt-2 text-xs"><Link href={`${here({})}${here({}).includes("?") ? "&" : "?"}all=1`} className="text-[var(--bot-navy)] underline">ดูทั้งหมด {works.length} ชิ้น</Link></p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
            <nav className="mb-2 flex flex-wrap gap-1.5">
              {ADMIN_FILTERS.map((f) => {
                const n = f.key === "all" ? items.length : items.filter((i) => i.kind === f.key).length;
                return <Link key={f.key} href={here({ k: f.key })} className={chip(kind === f.key)}>{f.label} {n}</Link>;
              })}
            </nav>
            {shown.length ? <Lines days={groupDays(shown, now)} /> : <Empty>ไม่มีรายการในเดือนนี้</Empty>}
          </section>
          <p className="text-xs text-[var(--bot-ink-mute)]">
            ประวัติเข้าระบบและข้อความที่ถาม AI เริ่มเก็บตั้งแต่ 15 ต.ค. 2569 · ค่า AI รายคนมีตั้งแต่ 10 ต.ค. 2569 · ลิงก์ภาพและคลิปใช้ได้ 1 ชั่วโมง โหลดหน้าใหม่เพื่อต่อเวลา
          </p>
        </>
      )}
    </div>
  );
}
