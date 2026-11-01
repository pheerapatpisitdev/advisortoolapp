import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

/** OpenNext's build of the app for Cloudflare Workers (wrangler.jsonc); Next's page cache kept in R2 */
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
});
