import { auth } from "@fuutu/auth";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { getBaseUrl } from "@fuutu/utils";

const log = createLogger({ scope: "openapi-merge" });

interface BetterAuthSpec {
	paths?: Record<string, Record<string, unknown>>;
	components?: { schemas?: Record<string, unknown> };
}

async function fetchBetterAuthSpec(): Promise<BetterAuthSpec | null> {
	try {
		const request = new Request(
			new URL("/api/auth/open-api/generate-schema", getBaseUrl()),
			{ method: "GET" },
		);
		const response = await auth.handler(request);
		if (!response.ok) {
			log.warn("Better Auth spec fetch failed", { status: response.status });
			return null;
		}
		const text = await response.text();
		return JSON.parse(text) as BetterAuthSpec;
	} catch (error) {
		log.error("Better Auth spec fetch error", { err: error });
		return null;
	}
}

/**
 * Fetched once per process — a failure (null) is kept too, so a broken
 * Better Auth spec is not retried (and logged) on every docs request.
 * Production skips it: Better Auth's OpenAPI plugin only runs outside
 * production (`@fuutu/auth`), so the fetch could only fail there.
 */
let betterAuthSpec: Promise<BetterAuthSpec | null> | null = null;

function getBetterAuthSpec(): Promise<BetterAuthSpec | null> {
	betterAuthSpec ??=
		env.NODE_ENV === "production"
			? Promise.resolve(null)
			: fetchBetterAuthSpec();
	return betterAuthSpec;
}

export async function getBetterAuthSpecPaths(): Promise<
	Record<string, unknown>
> {
	const spec = await getBetterAuthSpec();
	if (!spec?.paths) {
		return {};
	}
	const prefixed: Record<string, unknown> = {};
	for (const [path, def] of Object.entries(spec.paths)) {
		prefixed[`/auth${path}`] = def;
	}
	return prefixed;
}

/**
 * Better Auth's component schemas (`User`, `Session`, …). Its paths `$ref`
 * them, so they must ship alongside the merged paths — otherwise the
 * reference UI reports unresolved `#/components/schemas/*` refs.
 */
export async function getBetterAuthSpecSchemas(): Promise<
	Record<string, unknown>
> {
	const spec = await getBetterAuthSpec();
	return spec?.components?.schemas ?? {};
}
