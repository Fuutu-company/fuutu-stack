import { auth } from "@fuutu/auth";
import { createLogger } from "@fuutu/logs";
import { getBaseUrl } from "@fuutu/utils";

const log = createLogger({ scope: "openapi-merge" });

interface BetterAuthSpec {
	paths?: Record<string, Record<string, unknown>>;
}

let cachedSpec: BetterAuthSpec | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;

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

async function getBetterAuthSpec(): Promise<BetterAuthSpec | null> {
	const now = Date.now();
	if (cachedSpec && now - cacheTimestamp < CACHE_TTL) {
		return cachedSpec;
	}
	const spec = await fetchBetterAuthSpec();
	if (spec) {
		cachedSpec = spec;
		cacheTimestamp = now;
	}
	return spec;
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
