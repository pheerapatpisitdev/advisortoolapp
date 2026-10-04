"use client";
import { pageNameOf } from "@/lib/ads/ad-card";
import type { Room } from "./AdEditor";
import { SentSend } from "./SentSend";

/** The room's ส่งแล้ว tab: each batch send, newest first, as its own panel (SentSend). */

export function SentTab({ room, productName, onOpen }: {
  room: Room;
  productName: string;
  onOpen: (pieceId: string) => void;
}) {
  const { sends, pieces, connection, pages, campaign } = room;
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const accountOf = (actId: string) => {
    const a = connection.accounts.find((x) => x.id === actId);
    return a ? `${a.name} (${a.id})` : actId;
  };
  const pageOf = (pageId: string) => (pageId === campaign.pageId && campaign.pageName ? campaign.pageName : pageNameOf(pageId, pages));

  if (sends.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">
        ยังไม่มีแอดที่ส่งไป Facebook — ติ๊ก “เลือกส่ง” บนการ์ดในแท็บร่าง แล้วกด “ส่งขึ้น Facebook”
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sends.map((s) => (
        <SentSend
          key={s.id} send={s} pieces={byId} account={accountOf(s.actId)} pageName={pageOf(s.pageId)}
          productName={productName} onOpen={onOpen}
        />
      ))}
    </div>
  );
}
