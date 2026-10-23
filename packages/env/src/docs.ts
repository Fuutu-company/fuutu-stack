import { createEnv } from "@t3-oss/env-nextjs";
import { publicEnvOptions } from "./public";

/**
 * Docs-only env surface.
 *
 * Exposes ONLY public `NEXT_PUBLIC_*` variables — no DB, auth, payments,
 * storage, or mail secrets. This guarantees that `apps/docs` can never
 * accidentally import server-only secrets (compile-time error) and keeps the
 * public bundle clean.
 *
 * Mirrors @fuutu/env/marketing — docs is a public-facing app.
 */
export const env = createEnv({
	server: {},
	...publicEnvOptions,
	emptyStringAsUndefined: true,
});
