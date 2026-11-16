/**
 * Guards a procedure carries, readable from the built router — the router
 * policy arch test (`router-policy.test.ts`) walks `appRouter` and checks
 * every procedure against them. The guard middlewares mark themselves
 * (`createRateLimitMiddleware`, `denyImpersonation`, `sessionOnly`,
 * `authProcedure({ denyImpersonation, sessionOnly })`,
 * `systemAdminProcedure`); a marker never changes what a middleware does.
 */
export type PolicyMarker = {
	/** Mutations are rate-limited (`createRateLimitMiddleware`). */
	rateLimit?: true;
	/** Impersonation sessions are rejected. */
	denyImpersonation?: true;
	/** API-key callers are rejected — a signed-in session only. */
	sessionOnly?: true;
};

const markers = new WeakMap<object, PolicyMarker>();

/** Records `marker` on `middleware` and returns the same middleware. */
export function markPolicy<T extends object>(
	middleware: T,
	marker: PolicyMarker,
): T {
	markers.set(middleware, { ...markers.get(middleware), ...marker });
	return middleware;
}

/** The union of the markers on `middlewares` (a procedure's `~orpc.middlewares`). */
export function readPolicy(middlewares: readonly unknown[]): PolicyMarker {
	const policy: PolicyMarker = {};
	for (const middleware of middlewares) {
		if (typeof middleware !== "function") continue;
		Object.assign(policy, markers.get(middleware));
	}
	return policy;
}
