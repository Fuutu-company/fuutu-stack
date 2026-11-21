import { env } from "@fuutu/env/marketing";
import { getBaseUrl } from "@fuutu/utils";

/**
 * Public origin of the marketing site: `NEXT_PUBLIC_MARKETING_URL` when set
 * (production), else the runtime fallback (Vercel URL / localhost). Feeds
 * `metadataBase`, which resolves every relative canonical, hreflang and OG
 * URL.
 */
export function marketingBaseUrl(): string {
	return getBaseUrl({
		override: env.NEXT_PUBLIC_MARKETING_URL,
		defaultPort: 3001,
	});
}
