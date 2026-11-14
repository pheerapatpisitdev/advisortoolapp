-- แสดงคำอธิบายในตาราง (owner, 2026-11-14, ก ก on mockup v2 https://claude.ai/artifact/VKTji2SfSz7cCXiCQKJCf4):
-- whether an agent's value tables carry the pen notes (braces, arrows, handwritten words, red
-- rings). No row or true = shown, as before the setting. Additive only.
alter table ins_agent_prefs add column if not exists show_pen boolean not null default true;
