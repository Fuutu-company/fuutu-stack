import type { AppRouterClient } from "@fuutu/api";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const log = createLogger({ scope: "api-client" });

/**
 * Absolute base URL for API calls.
 *
 * `new URL()` (used internally by RPCLink) requires an absolute URL —
 * a bare path like "/api/rpc" throws "Failed to construct 'URL': Invalid URL".
 *
 * - Browser: use window.location.origin (works for any host)
 * - Server:  use validated BETTER_AUTH_URL from @fuutu/env/saas
 */
function getBaseUrl(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return env.BETTER_AUTH_URL;
}

const link = new RPCLink({
	url: `${getBaseUrl()}/api/rpc`,
	headers: async () => {
		if (typeof window !== "undefined") return {};

		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
	interceptors: [
		onError((error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			log.error("api request failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}),
	],
});

export const api: AppRouterClient = createORPCClient(link);
