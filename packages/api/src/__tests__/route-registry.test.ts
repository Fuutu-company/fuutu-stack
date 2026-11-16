/**
 * Hono route registry — every route the API app registers on `/api`
 * (kit machine routes + `custom-routes.ts`) is listed in `api-policy.ts`
 * with how it authenticates, its body limit and rate limit, and whether
 * the saas proxy lets it through without a session. Checked against the
 * built `app.routes`, by sending oversized bodies, and against the
 * proxy's public prefixes in both directions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	matchesPublicPath,
	type PublicPathEntry,
} from "@fuutu/utils/public-path";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_POLICIES, type RoutePolicy } from "../api-policy";

vi.mock("@fuutu/auth", () => ({
	auth: { api: {}, handler: vi.fn(async () => new Response("auth")) },
}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));
vi.mock("@fuutu/cron", () => ({ runAllJobs: vi.fn(), runJob: vi.fn() }));
vi.mock("@fuutu/license", () => ({
	checkLicense: vi.fn(async () => ({})),
	getLicenseMode: vi.fn(() => "oss"),
}));
vi.mock("@fuutu/telemetry", () => ({ pingTelemetry: vi.fn(async () => ({})) }));
vi.mock("@fuutu/payments", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments")>()),
	handlePaymentsWebhook: vi.fn(async () => new Response("ok")),
}));
vi.mock("../mcp", () => ({
	handleMcpRequest: vi.fn(async () => new Response("ok")),
}));

const { app } = await import("../app");

const POLICY_FILE = "packages/api/src/app-api-policy.ts";
const SAAS_SRC = join(import.meta.dirname, "../../../../apps/saas/src");

/** Global middlewares and the oRPC dispatch — not routes of their own. */
const MIDDLEWARE_PATH = "/api/*";

type RegisteredRoute = {
	path: string;
	methods: string[];
	hasBodyLimit: boolean;
};

function registeredRoutes(): RegisteredRoute[] {
	const byPath = new Map<string, RegisteredRoute>();
	for (const route of app.routes) {
		if (route.path === MIDDLEWARE_PATH) continue;
		const entry = byPath.get(route.path) ?? {
			path: route.path,
			methods: [],
			hasBodyLimit: false,
		};
		if (!entry.methods.includes(route.method)) entry.methods.push(route.method);
		// hono/body-limit returns a function named `bodyLimit`.
		if (route.handler.name === "bodyLimit") entry.hasBodyLimit = true;
		byPath.set(route.path, entry);
	}
	return [...byPath.values()];
}

const sorted = (values: readonly string[]) => [...values].sort();

/** A concrete request path for a route pattern (`/a/:id/**` → `/a/x/x`). */
const samplePath = (pattern: string) =>
	pattern.replace(/:[^/]+/g, "x").replace(/\*+/g, "x");

/** String and `{ exact }` entries of proxy.ts's `PUBLIC_PREFIXES` array. */
function kitProxyPublicPaths(): PublicPathEntry[] {
	const source = readFileSync(join(SAAS_SRC, "proxy.ts"), "utf8");
	const body = source.match(/const PUBLIC_PREFIXES = \[([\s\S]*?)\n\];/)?.[1];
	if (!body)
		throw new Error("PUBLIC_PREFIXES not found in apps/saas/src/proxy.ts");
	const entries: PublicPathEntry[] = [];
	for (const raw of body.split("\n")) {
		const line = raw.trim();
		const exact = line.match(/^\{\s*exact:\s*"([^"]+)"\s*\},?$/)?.[1];
		const prefix = line.match(/^"([^"]+)",?$/)?.[1];
		if (exact) entries.push({ exact });
		else if (prefix) entries.push(prefix);
	}
	return entries;
}

async function proxyPublicPaths(): Promise<PublicPathEntry[]> {
	const { APP_PUBLIC_PREFIXES } = (await import(
		/* @vite-ignore */ join(SAAS_SRC, "proxy-public.ts")
	)) as { APP_PUBLIC_PREFIXES: readonly PublicPathEntry[] };
	return [...kitProxyPublicPaths(), ...APP_PUBLIC_PREFIXES];
}

const entryPath = (entry: PublicPathEntry) =>
	typeof entry === "string" ? entry : entry.exact;

describe("Hono route registry (api-policy.ts)", () => {
	const routes = registeredRoutes();

	it("finds the kit routes", () => {
		const paths = routes.map((route) => route.path);
		expect(paths).toContain("/api/webhooks/payments");
		expect(paths).toContain("/api/mcp");
		expect(paths).toContain("/api/spec.json");
	});

	it("lists every registered route with its methods", () => {
		const problems: string[] = [];
		for (const route of routes) {
			const policy = ROUTE_POLICIES.find((entry) => entry.path === route.path);
			if (!policy) {
				problems.push(
					`${route.methods.join(",")} ${route.path} is not in the route registry — add it to appRoutePolicies (${POLICY_FILE}) with auth, reason, bodyLimit, rateLimit and proxyPublic.`,
				);
				continue;
			}
			if (sorted(policy.methods).join() !== sorted(route.methods).join()) {
				problems.push(
					`${route.path}: registered as ${sorted(route.methods).join(",")}, listed as ${sorted(policy.methods).join(",")} — update its methods in the registry.`,
				);
			}
		}
		for (const policy of ROUTE_POLICIES) {
			if (!routes.some((route) => route.path === policy.path)) {
				problems.push(
					`${policy.path} is listed in the route registry but not registered on the app — remove the entry.`,
				);
			}
		}
		expect(problems).toEqual([]);
	});

	it("gives every entry a reason, a rate-limit note and a body limit (or why none)", () => {
		const problems: string[] = [];
		for (const policy of ROUTE_POLICIES) {
			if (!policy.reason.trim()) problems.push(`${policy.path}: empty reason`);
			if (!policy.rateLimit.trim()) {
				problems.push(
					`${policy.path}: say where it is rate-limited, or why not`,
				);
			}
			if (
				typeof policy.bodyLimit === "object" &&
				!policy.bodyLimit.none.trim()
			) {
				problems.push(`${policy.path}: say why it needs no body limit`);
			}
			const route = routes.find((candidate) => candidate.path === policy.path);
			const listedLimit = typeof policy.bodyLimit === "number";
			if (route && route.hasBodyLimit !== listedLimit) {
				problems.push(
					listedLimit
						? `${policy.path} is listed with a ${policy.bodyLimit}-byte body limit but has no bodyLimit middleware — add \`bodyLimit({ maxSize })\` (hono/body-limit) before its handler.`
						: `${policy.path} has a bodyLimit middleware — list its maxSize as bodyLimit in the registry.`,
				);
			}
		}
		expect(problems).toEqual([]);
	});

	const limited = ROUTE_POLICIES.filter(
		(policy): policy is RoutePolicy & { bodyLimit: number } =>
			typeof policy.bodyLimit === "number",
	);

	it.each(limited)(
		"$path answers 413 above $bodyLimit bytes",
		async (policy) => {
			const method = policy.methods[0] === "ALL" ? "POST" : policy.methods[0];
			const res = await app.request(samplePath(policy.path), {
				method,
				body: "x".repeat(policy.bodyLimit + 1),
				headers: { "content-type": "application/json" },
			});
			expect(res.status).toBe(413);
		},
	);

	it("matches the saas proxy's public prefixes in both directions", async () => {
		const publicPaths = await proxyPublicPaths();
		const problems: string[] = [];
		for (const policy of ROUTE_POLICIES) {
			const isPublic = matchesPublicPath(samplePath(policy.path), publicPaths);
			if (policy.proxyPublic && !isPublic) {
				problems.push(
					`${policy.path} is proxyPublic but no saas proxy public prefix covers it — add a prefix with a \`// reason:\` comment to APP_PUBLIC_PREFIXES (apps/saas/src/proxy-public.ts), or set proxyPublic: false.`,
				);
			}
			if (!policy.proxyPublic && isPublic) {
				problems.push(
					`${policy.path} is not proxyPublic but a saas proxy public prefix covers it — set proxyPublic: true (and say how it authenticates) or narrow the prefix.`,
				);
			}
		}
		for (const entry of publicPaths) {
			const path = entryPath(entry);
			if (!path.startsWith("/api")) continue;
			const covers = ROUTE_POLICIES.some((policy) =>
				matchesPublicPath(samplePath(policy.path), [entry]),
			);
			if (!covers) {
				problems.push(
					`saas proxy public prefix "${path}" covers no listed API route — remove it, or list the route it opens in the registry.`,
				);
			}
		}
		expect(problems).toEqual([]);
	});
});
