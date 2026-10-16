-- คลังภาพคอลลาจ (owner, 2026-10-17, mockup https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX):
-- the cut-out pictures คอลลาจกระดาษ clips are built from, drawn once by the owner from the back
-- office. Private. "<piece>.png": the finished sticker (black-and-white dots, a white paper edge,
-- transparent around it); "raw/<piece>.png": the picture as the AI drew it, kept to redo the cut.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collage-library', 'collage-library', false, 8388608, array['image/png'])
on conflict (id) do nothing;
