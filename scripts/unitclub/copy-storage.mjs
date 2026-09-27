#!/usr/bin/env node
/**
 * Copy advisortool's four storage buckets from DATA2.0 to UnitClub, file by file, keeping each
 * path and content type — the rows that name a file keep pointing at the same place.
 *
 * Files already on UnitClub are overwritten, so running it again after a later change is the
 * way to catch up. Nothing is deleted on either side. Keys come from the environment and are
 * never printed:
 *
 *   SRC_URL=https://tmbbxahyxwkshxuxphcb.supabase.co SRC_SERVICE_KEY=... \
 *   DST_URL=https://cenysylrzbwfrtuqoeqk.supabase.co DST_SERVICE_KEY=... \
 *   node scripts/unitclub/copy-storage.mjs
 */

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["assets", "content-media", "content-people", "insurance-docs"];

function client(url, key) {
  if (!url || !key) throw new Error("SRC_URL, SRC_SERVICE_KEY, DST_URL and DST_SERVICE_KEY are all needed");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const src = client(process.env.SRC_URL, process.env.SRC_SERVICE_KEY);
const dst = client(process.env.DST_URL, process.env.DST_SERVICE_KEY);

/** Every file under a folder. A folder comes back from list() as an entry with no id. */
async function walk(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await src.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await walk(bucket, path)));
      else files.push({ path, type: entry.metadata?.mimetype });
    }
    if (data.length < 1000) return files;
  }
}

let failed = 0;
for (const bucket of BUCKETS) {
  const files = await walk(bucket);
  let copied = 0;
  for (const { path, type } of files) {
    const { data: blob, error: down } = await src.storage.from(bucket).download(path);
    if (down) { failed++; console.error(`✗ ${bucket}/${path}: ${down.message}`); continue; }
    const { error: up } = await dst.storage.from(bucket).upload(path, blob, { contentType: type, upsert: true });
    if (up) { failed++; console.error(`✗ ${bucket}/${path}: ${up.message}`); continue; }
    copied++;
  }
  console.log(`${bucket}: ${copied}/${files.length}`);
}
process.exit(failed ? 1 : 0);
