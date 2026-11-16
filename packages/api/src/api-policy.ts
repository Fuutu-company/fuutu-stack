import {
	appProcedurePolicyExceptions,
	appRoutePolicies,
	appSensitiveProcedurePrefixes,
	appSystemAdminProcedurePrefixes,
} from "./app-api-policy";
import { apiConfig } from "./config";

/**
 * The API's security policy as data — checked mechanically by
 * `__tests__/router-policy.test.ts` (every oRPC procedure of `appRouter`)
 * and `__tests__/route-registry.test.ts` (every Hono route of `app`).
 * Kit entries live here; add your app's in `./app-api-policy.ts`.
 */

/** A guard a procedure may lack, with the reason it does. */
export type ProcedureGuard =
	| "rateLimit"
	| "denyImpersonation"
	| "sessionOnly"
	| "systemAdmin";

/**
 * Procedure path (`payments.portal.open`) → the guards it deliberately
 * lacks, each with its reason (another layer enforces it, or it cannot
 * apply).
 */
export type ProcedurePolicyExceptions = Readonly<
	Record<string, Partial<Record<ProcedureGuard, string>>>
>;

/** How a Hono route authenticates its caller. */
export type RouteAuth =
	| "public"
	| "better-auth"
	| "signature"
	| "shared-secret"
	| "api-key"
	| "session";

/** One Hono route on `/api` (mounted before the oRPC dispatch). */
export type RoutePolicy = {
	/** Path as Hono registers it, base path included (`/api/webhooks/payments`). */
	path: string;
	/** Methods as Hono registers them (`ALL` for `app.all`). */
	methods: readonly string[];
	auth: RouteAuth;
	/** Why that is enough for what the route does. */
	reason: string;
	/** `bodyLimit` maximum in bytes, or why the route needs none. */
	bodyLimit: number | { none: string };
	/** Where requests are rate-limited, or why they need no limit. */
	rateLimit: string;
	/**
	 * Reachable without a session cookie: a saas proxy public prefix
	 * (`apps/saas/src/proxy.ts`, `apps/saas/src/proxy-public.ts`) covers it.
	 */
	proxyPublic: boolean;
};

/**
 * Procedure path prefixes for money, credentials and org structure: their
 * mutations reject impersonation sessions AND API keys.
 */
const KIT_SENSITIVE_PROCEDURE_PREFIXES: readonly string[] = [
	// money — checkouts, portal, cancel/resume
	"payments.",
	// credentials
	"apiKeys.",
	// org structure — members, roles, invitations, the org itself
	"organizations.",
	// outgoing webhooks — keep receiving org events after the key is revoked
	"webhooks.",
	// back office (systemAdminProcedure)
	"admin.",
];

/**
 * Procedure path prefixes of the back office: every procedure under them —
 * reads included — is built on `systemAdminProcedure`.
 */
const KIT_SYSTEM_ADMIN_PROCEDURE_PREFIXES: readonly string[] = ["admin."];

const KIT_PROCEDURE_POLICY_EXCEPTIONS: ProcedurePolicyExceptions = {
	"organizations.create": {
		denyImpersonation:
			"creates a new organization of the user's own and changes nothing that exists (Better Auth /organization/create is allowed too)",
	},
	"admin.impersonation.stop": {
		denyImpersonation:
			"runs inside the impersonation session it ends — the signed-in user is the target",
		sessionOnly:
			"checked in the handler (API keys cannot stop an impersonation) before Better Auth is called",
		systemAdmin:
			"called by the impersonation session — the signed-in user is the target, not an admin",
	},
};

const ONE_KB = 1024;

const KIT_ROUTE_POLICIES: readonly RoutePolicy[] = [
	{
		path: "/api/auth/**",
		methods: ["GET", "POST"],
		auth: "better-auth",
		reason:
			"Better Auth's own endpoints (sign-in, sign-up, OAuth callbacks) — each checks its own credentials",
		bodyLimit: apiConfig.maxBodyBytes,
		rateLimit: "Better Auth rateLimit (authConfig)",
		proxyPublic: true,
	},
	{
		path: "/api/health",
		methods: ["GET"],
		auth: "public",
		reason: "liveness probe — a constant answer, no data",
		bodyLimit: { none: "GET, no body is read" },
		rateLimit: "none — constant response, no lookup",
		proxyPublic: true,
	},
	{
		path: "/api/version",
		methods: ["GET"],
		auth: "public",
		reason:
			"kit/app name, version and license mode (LICENSE.md §6(5) reporting surface) — cached values, no user data",
		bodyLimit: { none: "GET, no body is read" },
		rateLimit: "none — in-memory values, no lookup",
		proxyPublic: true,
	},
	{
		path: "/api/webhooks/payments",
		methods: ["ALL"],
		auth: "signature",
		reason:
			"payment provider events — HMAC signature over the raw body verified in handlePaymentsWebhook",
		bodyLimit: 256 * ONE_KB,
		rateLimit:
			"none — the signature is checked before any lookup; providers retry on 429",
		proxyPublic: true,
	},
	{
		path: "/api/mcp",
		methods: ["ALL"],
		auth: "api-key",
		reason:
			"MCP server — org API key with the `mcp` scope or an OAuth access token (resolveMcpPrincipal); anonymous callers reach only `public` tools",
		bodyLimit: ONE_KB * ONE_KB,
		rateLimit: "per principal and pre-auth throttle (src/mcp)",
		proxyPublic: true,
	},
	{
		path: "/api/cron",
		methods: ["GET", "POST"],
		auth: "shared-secret",
		reason:
			"cron trigger — `Authorization: Bearer <CRON_SECRET>` (timing-safe); 501 when the secret is unset",
		bodyLimit: { none: "no body is read" },
		rateLimit:
			"none — the bearer is compared before anything runs; jobs are idempotent per schedule",
		proxyPublic: true,
	},
	{
		path: "/api/docs",
		methods: ["GET"],
		auth: "public",
		reason:
			"OpenAPI reference UI — public by design; procedures keep their own auth",
		bodyLimit: { none: "GET, no body is read" },
		rateLimit: "per client IP (apiConfig.rateLimit.endpoints.apiDocs)",
		proxyPublic: true,
	},
	{
		path: "/api/spec.json",
		methods: ["GET"],
		auth: "public",
		reason: "OpenAPI spec — public by design; built once per process",
		bodyLimit: { none: "GET, no body is read" },
		rateLimit: "per client IP (apiConfig.rateLimit.endpoints.apiDocs)",
		proxyPublic: true,
	},
];

export const SENSITIVE_PROCEDURE_PREFIXES: readonly string[] = [
	...KIT_SENSITIVE_PROCEDURE_PREFIXES,
	...appSensitiveProcedurePrefixes,
];

export const SYSTEM_ADMIN_PROCEDURE_PREFIXES: readonly string[] = [
	...KIT_SYSTEM_ADMIN_PROCEDURE_PREFIXES,
	...appSystemAdminProcedurePrefixes,
];

export const PROCEDURE_POLICY_EXCEPTIONS: ProcedurePolicyExceptions = {
	...KIT_PROCEDURE_POLICY_EXCEPTIONS,
	...appProcedurePolicyExceptions,
};

export const ROUTE_POLICIES: readonly RoutePolicy[] = [
	...KIT_ROUTE_POLICIES,
	...appRoutePolicies,
];
