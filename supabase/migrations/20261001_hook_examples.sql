-- The formula library's examples are no longer everybody's to read (review, 2026-10-01).
--
-- ins_hook_templates is one library for every tenant: a formula is [slots], nobody's words, and
-- anyone may write with it. But each formula drawn from a used piece kept that piece's actual
-- opening line in example_hook, and /studio/hooks showed it to everyone as "จากโพสต์: …" —
-- every agent read every other agent's hooks, a รีวิวเคลม's among them, which can carry a
-- customer's story. An agent's pieces are their own, not even their office's (owner, 2026-09-27).
--
-- From now on the code shows an example only to whoever may see the piece it came from
-- (src/lib/content/store.ts, examplesShown — the same rule as opening the piece), and deleting
-- a piece clears the example drawn from it. This needs no new column: source_content_id is the
-- example's owner.
--
-- What is left for the data is the examples nobody can be shown any more: their piece was
-- deleted, so source_content_id went null (on delete set null) and there is no way to tell whose
-- words they were. The code already hides them; this takes the words out of the table. The
-- formulas themselves stay. Examples whose piece still exists are kept — their author, and only
-- their author, still sees them, and the same words are in that piece anyway.
--
-- Safe to run before or after the code is deployed: the old code shows fewer examples, the new
-- code hides these regardless.

update public.ins_hook_templates
   set example_hook = null
 where example_hook is not null
   and source_content_id is null;

comment on column public.ins_hook_templates.example_hook is
  'the hook this formula was drawn from — shown only to whoever may see the source piece (source_content_id); cleared when that piece is deleted';
