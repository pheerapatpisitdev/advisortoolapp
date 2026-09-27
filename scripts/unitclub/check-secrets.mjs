#!/usr/bin/env node
/**
 * Prove the encrypted columns still open on the new project: every AI key and every Page or
 * ad-account token is decrypted with ADMIN_SESSION_SECRET through the same RPCs the app uses.
 * Prints only providers, key tails and token lengths — never a key or a token.
 *
 *   URL=https://cenysylrzbwfrtuqoeqk.supabase.co SERVICE_KEY=... ADMIN_SESSION_SECRET=... \
 *   node scripts/unitclub/check-secrets.mjs
 */

import { createClient } from "@supabase/supabase-js";

const { URL: url, SERVICE_KEY: key, ADMIN_SESSION_SECRET: passphrase } = process.env;
if (!url || !key || !passphrase) throw new Error("URL, SERVICE_KEY and ADMIN_SESSION_SECRET are all needed");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let bad = 0;

const [{ data: keys, error: keysError }, { data: tails }] = await Promise.all([
  db.rpc("ins_get_api_keys", { p_passphrase: passphrase }),
  db.from("ins_api_keys").select("provider, tail"),
]);
if (keysError) throw new Error(`ins_get_api_keys: ${keysError.message}`);
for (const { provider, tail } of tails ?? []) {
  const plain = keys.find((k) => k.provider === provider)?.api_key ?? "";
  const ok = plain.length > 0 && plain.endsWith(tail);
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ai key ${provider} …${tail}`);
}

const { data: channels } = await db.from("ins_channel_auth").select("key");
for (const { key: channel } of channels ?? []) {
  const { data, error } = await db.rpc("ins_get_channel_auth", { p_key: channel, p_passphrase: passphrase });
  const token = data?.[0]?.token ?? "";
  const ok = !error && token.length > 20;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${channel} token length ${token.length}${error ? ` (${error.message})` : ""}`);
}

process.exit(bad ? 1 : 0);
