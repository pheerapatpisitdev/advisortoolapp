-- ins_content and ins_hook_templates point at each other, so copying the rows one table at a
-- time only works if these checks may wait for the end of the transaction. They stay
-- immediate unless a transaction asks otherwise, so nothing the app does changes.
alter table public.ins_content
  alter constraint ins_content_hook_template_id_fkey deferrable initially immediate;
alter table public.ins_hook_templates
  alter constraint ins_hook_templates_source_content_id_fkey deferrable initially immediate;
