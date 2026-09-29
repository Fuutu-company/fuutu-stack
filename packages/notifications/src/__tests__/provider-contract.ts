import { expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type { NotificationProvider } from "../types";

export interface NotificationProviderContractOptions {
	readonly notifyBehavior: "resolves" | "throws";
	readonly throwsContains?: string;
}

/**
 * Shared contract every NotificationProvider must satisfy.
 */
export function testNotificationProviderContract(
	name: string,
	createProvider: () => NotificationProvider,
	options: NotificationProviderContractOptions,
): void {
	describe(`NotificationProvider contract — ${name}`, () => {
		it("exposes a non-empty id", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.id);
		});

		if (options.notifyBehavior === "resolves") {
			it("notify() resolves for valid input", async () => {
				const provider = createProvider();
				await expect(
					provider.notify("user-1", "system", "Test", "Body"),
				).resolves.toBeUndefined();
			});
		} else {
			it("notify() throws for valid input", async () => {
				const provider = createProvider();
				await expect(
					provider.notify("user-1", "system", "Test", "Body"),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});
		}
	});
}
