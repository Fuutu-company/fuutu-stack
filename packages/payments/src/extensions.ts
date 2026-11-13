/**
 * App extension points for billing state — let an app compute or store
 * entitlements its own way without editing sync.ts / entitlements.ts.
 *
 * Kept free of runtime imports so sync.ts and entitlements.ts can both
 * depend on it without an import cycle. Register once at server startup
 * — in the SaaS app: `registerApp()` in `apps/saas/src/server-init.ts`.
 *
 * State lives on `globalThis` (not module scope): Next.js may evaluate
 * this module once per bundle (instrumentation, route handlers, RSC), and
 * a registration made in one bundle must be visible in all of them.
 */
import type { PurchaseOwner } from "@fuutu/db";
import type { Entitlement } from "./entitlements";

// ─── Entitlement resolver ─────────────────────────────────────────────────────

/** `defaults` runs the kit's live computation — call it to build on it. */
export type EntitlementResolverFn = (
	ownerId: string,
	defaults: () => Promise<Entitlement>,
) => Promise<Entitlement>;

/**
 * Applies wherever the kit reads entitlements: `getOrgEntitlement`,
 * `getUserEntitlement`, `hasFeature`, and the oRPC `authProcedure` plan /
 * subscription / limit gates (tier, planId and limits come from the
 * entitlement). Not covered: direct `resolveActivePlan` / `getPlanLimit`
 * calls in app code — read the entitlement there instead.
 */
export type EntitlementResolver = {
	/** Replaces the computation behind `getOrgEntitlement`. */
	org?: EntitlementResolverFn;
	/** Replaces the personal (no active org) path of `getUserEntitlement`. */
	user?: EntitlementResolverFn;
};

// Bundle-shared state (see header).
interface ExtensionRegistry {
	entitlementResolver: EntitlementResolver | null;
	purchaseChangedHandlers: Set<PurchaseChangedHandler>;
}

const REGISTRY_KEY = Symbol.for("fuutu.payments.extensions");

function registry(): ExtensionRegistry {
	const scope = globalThis as typeof globalThis & {
		[REGISTRY_KEY]?: ExtensionRegistry;
	};
	scope[REGISTRY_KEY] ??= {
		entitlementResolver: null,
		purchaseChangedHandlers: new Set(),
	};
	return scope[REGISTRY_KEY];
}

/**
 * Replace the default live entitlement computation for the scopes the
 * resolver covers; uncovered scopes keep the default. `null` restores
 * the default everywhere. Only one resolver is active at a time.
 */
export function registerEntitlementResolver(
	resolver: EntitlementResolver | null,
): void {
	registry().entitlementResolver = resolver;
}

export function getEntitlementResolver(): EntitlementResolver | null {
	return registry().entitlementResolver;
}

// ─── Purchase-changed callback ────────────────────────────────────────────────

export type PurchaseChangedHandler = (
	owner: PurchaseOwner,
) => void | Promise<void>;

/**
 * Run `handler` after webhook sync writes a purchase for an owner. A
 * thrown error fails the webhook delivery (5xx → provider retry), and
 * redeliveries re-notify — handlers must be idempotent. Outgoing webhook
 * events (`subscription.created`, `invoice.paid`) are emitted before the
 * handlers run, so a failing handler never suppresses them. Returns an
 * unsubscribe function.
 */
export function onPurchaseChanged(handler: PurchaseChangedHandler): () => void {
	const { purchaseChangedHandlers } = registry();
	purchaseChangedHandlers.add(handler);
	return () => {
		purchaseChangedHandlers.delete(handler);
	};
}

/** Invoke every registered handler in registration order. */
export async function notifyPurchaseChanged(
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	const owner: PurchaseOwner | null = organizationId
		? { organizationId }
		: userId
			? { userId }
			: null;
	if (!owner) return;
	for (const handler of registry().purchaseChangedHandlers) {
		await handler(owner);
	}
}
