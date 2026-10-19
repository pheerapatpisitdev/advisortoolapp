"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { onPage, publishView } from "@/lib/content/publish-label";
import type { ContentItem, ContentStatus } from "@/lib/content/store";
import { contentWorkbench, removeContent, setContentStatus, type Workbench } from "../actions";
import { ask } from "../ask";
import { ClipCard } from "../clip/ClipCard";
import { ClipEditor } from "../clip/ClipEditor";
import { ClipTools } from "../clip/ClipTools";

const TABS: { id: ContentStatus; label: string }[] = [
  { id: "draft", label: "รอตรวจ" },
  { id: "used", label: "ใช้จริง" },
  { id: "trashed", label: "ถังขยะ" },
];
const DROPPED = "การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ";

/**
 * The clips of one Page (owner chose ก, 2026-10-19): the form to attach one on the left, its
 * cards on the right under รอตรวจ / ใช้จริง / ถังขยะ, and the card's editor (ClipEditor, whose
 * ตัดต่อ opens ClipEditStudio) in the list's place. What Organic's workbench did for its คลิป
 * tab, with nothing of the writing around it.
 */
export function ClipDesk({ initial, initialOpen, project, pages, planner, clipEditing }: {
  initial: Workbench;
  /** a clip opened from the calendar or the history (?open=), which may be in no tab's list */
  initialOpen: ContentItem | null;
  project: { pageId: string; pageName: string } | null;
  pages: { pageId: string; pageName: string }[];
  /** the agent may not post: วางแผน instead of ลงเพจ */
  planner: boolean;
  /** the owner's switch (admin/ai): off hides the editor's ตัดต่อ */
  clipEditing: boolean;
}) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [tab, setTab] = useState<ContentStatus>("draft");
  const [items, setItems] = useState(initial.items);
  const [counts, setCounts] = useState(initial.counts);
  const [loadFailed, setLoadFailed] = useState(Boolean(initial.failed));
  const [loadingMore, setLoadingMore] = useState(false);
  const [opened, setOpened] = useState<ContentItem | null>(initialOpen);
  const [editing, setEditing] = useState<string | null>(initialOpen?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  // what is on screen now, for an upload that reports in long after its press
  const view = useRef({ tab, items, opened });
  useEffect(() => { view.current = { tab, items, opened }; });
  const list = useRef<HTMLElement>(null);
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (editing) { list.current?.scrollIntoView({ block: "start" }); return; }
    // the calendar's แก้ไข arrived as ?open=; once its editor is closed a reload should not open it again
    const url = new URL(window.location.href);
    if (url.searchParams.has("open")) {
      url.searchParams.delete("open");
      window.history.replaceState(window.history.state, "", url);
    }
    if (returnTo.current) document.getElementById(`clip-${returnTo.current}`)?.scrollIntoView({ block: "center" });
    returnTo.current = null;
  }, [editing]);

  const editingItem = editing ? (items.find((x) => x.id === editing) ?? (opened?.id === editing ? opened : undefined)) : undefined;

  async function reload(next: ContentStatus) {
    const wb = await contentWorkbench({ status: next, page: project?.pageId, clips: true }).catch(() => null);
    if (!wb || wb.failed) { setNote("โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    setItems(wb.items);
    setCounts(wb.counts);
    setLoadFailed(false);
    setNote(null);
  }

  async function chooseTab(next: ContentStatus) {
    if (next === tab) return;
    if (dirty && !(await ask("แคปชันที่แก้ยังไม่ได้บันทึก — ออกจากหน้านี้เลยไหม?", "ออกเลย"))) return;
    setEditing(null);
    setTab(next);
    await reload(next);
  }

  async function loadMore() {
    setLoadingMore(true);
    const oldest = items.reduce<string | undefined>((o, x) => (!o || x.createdAt < o ? x.createdAt : o), undefined);
    const wb = await contentWorkbench({ status: tab, page: project?.pageId, clips: true, ...(oldest ? { before: oldest } : { offset: items.length }) }).catch(() => null);
    setLoadingMore(false);
    if (!wb || wb.failed) { setNote("โหลดเพิ่มไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    setItems((now) => {
      const seen = new Set(now.map((x) => x.id));
      return [...now, ...wb.items.filter((x) => !seen.has(x.id))];
    });
    setCounts(wb.counts);
  }

  function saved(next: ContentItem) {
    setItems((now) => now.map((x) => (x.id === next.id ? next : x)));
    setOpened((o) => (o?.id === next.id ? next : o));
  }

  /** a clip as it arrives and changes (useClipUpload): one on screen is updated, a new one goes on top of รอตรวจ */
  const counted = useRef(new Set<string>());
  function arrived(next: ContentItem) {
    const now = view.current;
    if (now.items.some((x) => x.id === next.id) || now.opened?.id === next.id) { saved(next); return; }
    // one clip reports in up to three times (made, kept, listened to); it is new once
    if (counted.current.has(next.id)) return;
    counted.current.add(next.id);
    setCounts((c) => ({ ...c, draft: c.draft + 1 }));
    if (now.tab === "draft") setItems((l) => (l.some((x) => x.id === next.id) ? l : [next, ...l]));
  }

  function openEditor(id: string) {
    returnTo.current = id;
    setEditing(id);
  }

  function closeEditor() {
    setEditing(null);
    // a clip posted or held from here is on the calendar now: it leaves the list on the way out
    setItems((now) => now.filter((x) => x.status === view.current.tab && !onPage(x.publish)));
  }

  async function changeStatus(item: ContentItem, status: ContentStatus) {
    if (item.status === status) { if (editing === item.id) setEditing(null); return; }
    mark(item.id, true);
    const res = await setContentStatus(item.id, status).catch(() => ({ ok: false, error: DROPPED }));
    mark(item.id, false);
    if (!res.ok) { setNote(res.error || "เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    setNote(status === "trashed" ? "ย้ายไปถังขยะแล้ว" : status === "used" ? "ย้ายไปใช้จริงแล้ว" : "ย้ายกลับไปรอตรวจแล้ว");
    if (editing === item.id) setEditing(null);
    setItems((now) => now.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1), [status]: c[status] + 1 }));
  }

  async function remove(item: ContentItem) {
    const scheduled = publishView(item.publish).kind === "scheduled";
    const question = scheduled
      ? "ลบคลิปนี้ถาวร และเอา Reel ที่ตั้งเวลาไว้ออกจากเพจด้วย? กู้คืนไม่ได้"
      : "ลบคลิปนี้ถาวร? ลบแล้วกู้คืนไม่ได้";
    if (!(await ask(question, "ลบถาวร"))) return;
    mark(item.id, true);
    const dropped = { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" } as Awaited<ReturnType<typeof removeContent>>;
    let res = await removeContent(item.id).catch(() => dropped);
    // a send that never answered: Facebook may show it, so the owner looks before it is let go
    if (!res.ok && res.confirmDelete) {
      if (!(await ask("Reel นี้อาจขึ้นเพจไปแล้ว — เปิดเพจเช็กก่อน ถ้ายังไม่ขึ้นค่อยลบ", "ลบ"))) { mark(item.id, false); return; }
      res = await removeContent(item.id, { force: true }).catch(() => dropped);
    }
    mark(item.id, false);
    if (!res.ok) { setNote(res.error || dropped.error!); return; }
    setNote(null);
    if (editing === item.id) setEditing(null);
    setItems((now) => now.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1) }));
  }

  async function choosePage(pageId: string) {
    if (dirty && !(await ask("แคปชันที่แก้ยังไม่ได้บันทึก — ออกจากหน้านี้เลยไหม?", "ออกเลย"))) return;
    startSwitch(() => router.push(`/studio/clip-edit?page=${encodeURIComponent(pageId)}`));
  }

  const tabBtn = (on: boolean) => `min-h-tap rounded-lg px-3 text-sm ${on ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "hover:bg-[var(--ct-soft)]"}`;

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <aside className="h-fit space-y-1 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:sticky lg:top-4">
        {pages.length > 1 && (
          <label className="block px-3 pt-3">
            <span className="mb-1 block text-sm font-medium">เพจ</span>
            <select
              value={project?.pageId ?? ""} disabled={switching} onChange={(e) => void choosePage(e.target.value)}
              className="min-h-tap w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm disabled:opacity-60"
            >
              {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
            </select>
          </label>
        )}
        {pages.length === 1 && project && <p className="px-3 pt-3 text-sm text-[var(--ct-mute)]">เพจ: <span className="font-medium text-[var(--ct-ink)]">{project.pageName}</span></p>}
        <ClipTools page={project?.pageId} onItem={arrived} />
      </aside>

      <section ref={list} className="min-w-0 scroll-mt-4 space-y-4">
        {editingItem ? (
          <ClipEditor
            key={editingItem.id}
            item={editingItem}
            planner={planner}
            onSaved={saved}
            onPublished={saved}
            onStatus={(s) => changeStatus(editingItem, s)}
            onItem={arrived}
            onClose={closeEditor}
            onDirtyChange={setDirty}
            suggestDay={null}
            clipEditing={clipEditing}
          />
        ) : (
          <>
            <div role="tablist" aria-label="สถานะคลิป" className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => void chooseTab(t.id)} className={tabBtn(tab === t.id)}>
                  {t.label} <span className="tabular-nums text-[var(--ct-mute)]">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">
                {loadFailed ? (
                  <p>
                    โหลดรายการไม่สำเร็จ —{" "}
                    <button type="button" onClick={() => void reload(tab)} className="inline-flex min-h-tap items-center font-medium text-[var(--ct-accent)] underline">ลองใหม่</button>
                  </p>
                ) : tab === "draft" ? (
                  <p>ยังไม่มีคลิปรอตรวจ — แนบคลิปที่ถ่ายแล้วทางซ้ายได้เลย</p>
                ) : tab === "trashed" ? (
                  <p>ถังขยะว่าง</p>
                ) : (
                  <p>ยังไม่มีคลิปที่ใช้แล้วแต่ยังไม่ได้ลงเพจ — คลิปที่ลงเพจหรือตั้งเวลาแล้วอยู่ในปฏิทินโพสต์</p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((item, i) => (
                  <div key={item.id} id={`clip-${item.id}`} className="grid scroll-mt-4">
                    <ClipCard
                      item={item}
                      index={i}
                      busy={busy.has(item.id)}
                      onEdit={() => openEditor(item.id)}
                      onStatus={(s) => void changeStatus(item, s)}
                      onDelete={() => void remove(item)}
                      onItem={arrived}
                    />
                  </div>
                ))}
              </div>
            )}
            {items.length > 0 && items.length < counts[tab] && (
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-tap w-full rounded-lg border border-[var(--ct-line)] text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50">
                {loadingMore ? "กำลังโหลด…" : `ดูเพิ่ม (${counts[tab] - items.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
