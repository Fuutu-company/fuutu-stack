import { env } from "@fuutu/env/docs";
import { getBaseUrl } from "@fuutu/utils";

/**
 * Public origin of the docs site: `NEXT_PUBLIC_DOCS_URL` when set (production),
 * else the runtime fallback (Vercel URL / localhost). Feeds `metadataBase`,
 * which resolves every relative canonical, hreflang and OG URL.
 */
export function docsBaseUrl(): string {
	return getBaseUrl({ override: env.NEXT_PUBLIC_DOCS_URL, defaultPort: 4000 });
}
