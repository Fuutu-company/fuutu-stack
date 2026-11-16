import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { publicEnvOptions } from "./public";

/**
 * Docs-only env surface.
 *
 * Exposes ONLY public `NEXT_PUBLIC_*` variables — no DB, auth, payments,
 * storage, or mail secrets. This guarantees that `apps/docs` can never
 * accidentally import server-only secrets (compile-time error) and keeps the
 * public bundle clean.
 *
 * Mirrors @fuutu/env/marketing — docs is a public-facing app. Its one
 * server var is the non-secret `TRUST_PROXY_HEADERS` flag for the search
 * rate limit (same meaning as in @fuutu/env/saas).
 */
export const env = createEnv({
	server: {
		TRUST_PROXY_HEADERS: z
			.stringbool({ truthy: ["1", "true"], falsy: ["0", "false"] })
			.default(false),
	},
	...publicEnvOptions,
	runtimeEnv: {
		...publicEnvOptions.runtimeEnv,
		TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
	},
	emptyStringAsUndefined: true,
});
