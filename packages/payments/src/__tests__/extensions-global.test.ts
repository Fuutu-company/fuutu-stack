import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Next.js can evaluate `@fuutu/payments` once per bundle (instrumentation,
 * route handlers, RSC). A registration made in one module instance must be
 * visible in every other — simulated here with `vi.resetModules()`, which
 * yields a fresh module instance just like a second bundle.
 */

type Extensions = typeof import("../extensions");

async function freshInstance(): Promise<Extensions> {
	vi.resetModules();
	return import("../extensions");
}

const cleanups: (() => void)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	(await freshInstance()).registerEntitlementResolver(null);
});

describe("extension registries across module instances", () => {
	it("shares the entitlement resolver", async () => {
		const instrumentation = await freshInstance();
		const resolver = { org: vi.fn() };
		instrumentation.registerEntitlementResolver(resolver);

		const routeHandler = await freshInstance();
		expect(routeHandler).not.toBe(instrumentation);
		expect(routeHandler.getEntitlementResolver()).toBe(resolver);
	});

	it("shares purchase-changed handlers", async () => {
		const instrumentation = await freshInstance();
		const handler = vi.fn();
		cleanups.push(instrumentation.onPurchaseChanged(handler));

		const webhookRoute = await freshInstance();
		await webhookRoute.notifyPurchaseChanged(null, "org_1");
		expect(handler).toHaveBeenCalledWith({ organizationId: "org_1" });
	});

	it("unsubscribes across instances", async () => {
		const instrumentation = await freshInstance();
		const handler = vi.fn();
		const unsubscribe = instrumentation.onPurchaseChanged(handler);

		const other = await freshInstance();
		unsubscribe();
		await other.notifyPurchaseChanged("user_1", null);
		expect(handler).not.toHaveBeenCalled();
	});
});
