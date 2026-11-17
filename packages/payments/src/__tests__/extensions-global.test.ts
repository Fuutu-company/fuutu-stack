import { afterEach, describe, expect, it, vi } from "vitest";

// Re-imports the module in every test and hook: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

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
	const last = await freshInstance();
	last.registerEntitlementResolver(null);
	last.registerSupersedePolicy(null);
	last.registerSeatGate(null);
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

	it("shares the seat gate, and null restores the default", async () => {
		const instrumentation = await freshInstance();
		const gate = vi.fn(() => 3);
		instrumentation.registerSeatGate(gate);

		const authHook = await freshInstance();
		expect(authHook.getSeatGate()).toBe(gate);
		authHook.registerSeatGate(null);
		expect((await freshInstance()).getSeatGate()).toBeNull();
	});

	it("shares the supersede policy", async () => {
		const instrumentation = await freshInstance();
		const policy = vi.fn(() => false);
		instrumentation.registerSupersedePolicy(policy);

		const webhookRoute = await freshInstance();
		expect(webhookRoute.getSupersedePolicy()).toBe(policy);
	});

	it("shares checkout guards and their unsubscribe", async () => {
		const instrumentation = await freshInstance();
		const guard = vi.fn();
		const unsubscribe = instrumentation.registerCheckoutGuard(guard);

		const apiRoute = await freshInstance();
		expect(apiRoute.getCheckoutGuards()).toEqual([guard]);
		unsubscribe();
		expect(apiRoute.getCheckoutGuards()).toEqual([]);
	});
});
