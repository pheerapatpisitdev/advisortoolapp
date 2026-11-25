"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEPARTMENTS, dialParts, telOf } from "@/lib/hospitals/phones";
import { REGIONS } from "@/lib/hospitals/regions";
import { byType, CARE_LABEL, inProvince, isSearch, listText, matches, provincesOf, regionCount, TYPES, type Place, type TypeKey } from "@/lib/hospitals/rules";

const chip = (on: boolean) =>
  `min-h-10 rounded-lg border px-3 py-1.5 text-sm ${on ? "border-[var(--hm-solid)] bg-[var(--hm-solid)] text-[var(--hm-solid-ink)]" : "border-[var(--hm-line)] bg-[var(--hm-panel)] text-[var(--hm-ink)]"}`;
const count = "ml-1.5 tabular-nums opacity-75";
const panel = "overflow-hidden rounded-xl border border-[var(--hm-hair)] bg-[var(--hm-panel)]";

/** a number as the hospital writes it, a tap to call where there is one to dial */
function PhoneLine({ text, tel }: { text: string; tel: string | null }) {
  return tel
    ? <a href={`tel:${tel}`} className="block w-fit text-[var(--hm-accent)] underline-offset-2 hover:underline">{text}</a>
    : <span className="block">{text}</span>;
}

function Departments({ place }: { place: Place }) {
  if (!place.dept) return null;
  const { source } = place.dept;
  return (
    <dl className="mt-2 grid gap-1.5 rounded-lg bg-[var(--hm-ground)] px-3 py-2.5 text-sm sm:col-span-2">
      {DEPARTMENTS.map(({ key, label }) => place.dept![key].length > 0 && (
        <div key={key} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
          <dt className="text-[var(--hm-mute)]">{label}</dt>
          <dd className="tabular-nums text-[var(--hm-accent)]">
            {place.dept![key].map((line) => <PhoneLine key={line} text={line} tel={telOf(line)} />)}
          </dd>
        </div>
      ))}
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2 text-[var(--hm-mute)]">
        <dt>ที่มา</dt>
        <dd className="min-w-0 break-words">{source}</dd>
      </div>
    </dl>
  );
}

function Row({ place, showProvince }: { place: Place; showProvince: boolean }) {
  // the insurer writes the province again as the district of a few; once is enough
  const where = [place.district === place.province ? "" : place.district, showProvince ? place.province : ""].filter(Boolean).join(", ");
  const phones = dialParts(place.phone);
  return (
    <li className="grid gap-x-4 border-t border-[var(--hm-hair)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="min-w-0">
        <h3 className="font-semibold">{place.th}</h3>
        {where && <p className="text-[13px] text-[var(--hm-mute)]">{where}</p>}
        <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {place.clinic && <span className="rounded bg-[var(--bot-sand-soft)] px-1.5 py-0.5 text-[var(--bot-sand-ink)]">คลินิก</span>}
          {place.care.map((c) => <span key={c} className="rounded bg-[var(--bot-navy-soft)] px-1.5 py-0.5 text-[var(--hm-accent)]">{CARE_LABEL[c]}</span>)}
        </p>
      </div>
      <div className="mt-2 text-sm tabular-nums sm:mt-0 sm:text-right [&_a]:sm:ml-auto">
        {phones.length > 0 ? (
          <>
            <span className="block text-xs text-[var(--hm-mute)]">เบอร์กลาง</span>
            {phones.map((p) => <PhoneLine key={p.text} {...p} />)}
          </>
        ) : <span className="text-[var(--hm-mute)]">ไม่มีเบอร์ในข้อมูล</span>}
      </div>
      <Departments place={place} />
    </li>
  );
}

function CopyList({ text }: { text: string }) {
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    const ok = await navigator.clipboard.writeText(text).then(() => true, () => false);
    setSaid(ok ? "คัดลอกแล้ว" : "คัดลอกไม่ได้");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid(null), 2000);
  };
  return (
    <button type="button" onClick={copy} className="min-h-9 shrink-0 rounded-lg border border-white/60 px-3 text-[13px] text-[var(--hm-solid-ink)]">
      <span aria-live="polite">{said ?? "คัดลอกรายชื่อ"}</span>
    </button>
  );
}

function Table({ title, list, showProvince = false, copy }: { title: string; list: Place[]; showProvince?: boolean; copy?: string }) {
  return (
    <section className={`${panel} min-w-0`} aria-label={title}>
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[var(--hm-solid)] px-4 py-2.5 text-[var(--hm-solid-ink)]">
        <h2 className="text-base font-semibold">{`${title} ${list.length} แห่ง`}</h2>
        {copy && list.length > 0 && <CopyList key={copy} text={copy} />}
      </header>
      {list.length > 0
        ? <ul className="m-0 list-none p-0 [&>li:first-child]:border-t-0">{list.map((p) => <Row key={p.id} place={p} showProvince={showProvince} />)}</ul>
        : <p className="px-4 py-6 text-[var(--hm-mute)]">ไม่พบรายชื่อ ลองพิมพ์คำที่สั้นลง หรือกดทั้งหมด</p>}
    </section>
  );
}

/**
 * The catalogue (owner chose ก ×5, 2026-11-25): a part of the country, then a province, its places beside it;
 * the search box looks through the whole country. The whole list is handed in, so nothing is asked of the
 * server while it is used.
 */
export function HospitalCatalogue({ places }: { places: Place[] }) {
  const [type, setType] = useState<TypeKey>("all");
  const [region, setRegion] = useState(0);
  const [asked, setAsked] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const pool = useMemo(() => byType(places, type), [places, type]);
  const provinces = useMemo(() => provincesOf(pool, REGIONS[region]), [pool, region]);
  // a filter or another region may leave the province pressed with nothing in it: the first one then
  const province = provinces.some((p) => p.province === asked) ? asked! : provinces[0]?.province ?? null;
  const searching = isSearch(q);
  const shown = useMemo(
    () => (searching ? pool.filter((p) => matches(p, q)) : province ? inProvince(pool, province) : []),
    [pool, searching, q, province],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <input
        type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อโรงพยาบาล อำเภอ หรือจังหวัด" aria-label="ค้นหาโรงพยาบาล"
        className="w-full rounded-lg border border-[var(--hm-line)] bg-[var(--hm-panel)] px-3.5 py-2.5 text-base"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="แสดงเฉพาะ">
        {TYPES.map((t) => (
          <button key={t.key} type="button" aria-pressed={type === t.key} onClick={() => setType(t.key)} className={chip(type === t.key)}>
            {t.label}<span className={count}>{byType(places, t.key).length}</span>
          </button>
        ))}
      </div>

      {searching ? (
        <Table title="ผลการค้นหา" list={shown} showProvince />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกภาค">
            {REGIONS.map((r, i) => (
              <button key={r.name} type="button" aria-pressed={i === region} onClick={() => { setRegion(i); setAsked(null); }} className={chip(i === region)}>
                {r.name}<span className={count}>{regionCount(pool, r)}</span>
              </button>
            ))}
          </div>
          <div className="grid items-start gap-3.5 md:grid-cols-[13rem_minmax(0,1fr)]">
            {provinces.length > 0 && (
              <div className={`${panel} flex overflow-x-auto md:block`} role="group" aria-label="เลือกจังหวัด">
                {provinces.map((p) => (
                  <button
                    key={p.province} type="button" aria-pressed={p.province === province} onClick={() => setAsked(p.province)}
                    className={`flex shrink-0 justify-between gap-2 border-[var(--hm-hair)] px-3.5 py-2.5 text-left text-[15px] max-md:border-r max-md:last:border-r-0 md:w-full md:border-b md:last:border-b-0 ${p.province === province ? "bg-[var(--bot-navy-soft)] font-semibold text-[var(--hm-accent)]" : ""}`}
                  >
                    {p.province}<span className="tabular-nums font-normal text-[var(--hm-mute)]">{p.count}</span>
                  </button>
                ))}
              </div>
            )}
            {province
              ? <Table title={province} list={shown} copy={listText(province, shown)} />
              : <Table title={REGIONS[region].name} list={[]} />}
          </div>
        </>
      )}
    </div>
  );
}
