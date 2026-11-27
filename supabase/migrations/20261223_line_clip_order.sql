-- สั่งคลิปผ่าน LINE (ทาง ค, owner chose ก ก ก 2026-11-27, mockup https://claude.ai/artifact/S5X3j9dZbvR7Kij2prLHsS):
-- a linked agent types an order in the LINE OA chat, the bot asks what is missing, shows a summary card
-- and starts the clip; the finished video comes back into that chat. Additive only; nothing is backfilled.

-- the order being put together in the chat, until it is started or left (src/lib/line/clip-order.ts).
-- On ins_agent_line, so ลบสมาชิกทั่วไป (ins_member_delete) already takes it with the row.
alter table ins_agent_line add column if not exists clip_draft jsonb;

-- line_order: ordered in the LINE chat, so it goes back there whatever the "คลิปทำเสร็จ" switch says.
-- line_pending: finished but not sent into LINE (the month's pushes near full, the switch off, or the push
-- failed): "ขอคลิป" replies with it, free, and clears it. Rows from before stay false: nothing owed.
alter table ins_quote_videos add column if not exists line_order boolean not null default false;
alter table ins_quote_videos add column if not exists line_pending boolean not null default false;

-- "ขอคลิป" looks up an agent's finished clips still owed to LINE: few rows, so a partial index
create index if not exists ins_quote_videos_line_pending_idx
  on ins_quote_videos (agent_id, updated_at desc) where line_pending;

-- every message to the LINE OA now asks whether its sender is a linked agent (an order being put
-- together): the lookup by LINE id gets an index
create index if not exists ins_agent_line_user_idx on ins_agent_line (line_user_id) where line_user_id is not null;
