import { createEnv } from "@t3-oss/env-nextjs";
import { publicEnvOptions } from "./public";

/**
 * Marketing-only env surface.
 *
 * Exposes ONLY public `NEXT_PUBLIC_*` variables — no DB, auth, payments,
 * storage, or mail secrets. This guarantees that `apps/marketing` can never
 * accidentally import server-only secrets (compile-time error) and keeps the
 * public bundle clean.
 *
 * Rule: any server-side secret used in marketing must first be exposed via
 * a public `NEXT_PUBLIC_*` proxy, or the feature must move to `apps/saas`.
 */
export const env = createEnv({
	server: {},
	...publicEnvOptions,
	emptyStringAsUndefined: true,
});
