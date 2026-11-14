import { RULES_2569 } from '@/lib/tax/rules/2569';

export function Disclaimer() {
  return (
    <p className="rounded-xl bg-tx-surface-2 px-4 py-3 text-xs leading-relaxed text-tx-muted">
      เป็นการประมาณการ ไม่ใช่คำแนะนำทางภาษี ใช้กฎภาษีปี {RULES_2569.taxYear} ที่รวบรวมเมื่อ {RULES_2569.updatedAt}{' '}
      บางรายการยังรอยืนยันกับประกาศกรมสรรพากร ก่อนยื่นจริงโปรดตรวจที่ rd.go.th
    </p>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-tx-line bg-tx-surface p-4 sm:p-5 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
