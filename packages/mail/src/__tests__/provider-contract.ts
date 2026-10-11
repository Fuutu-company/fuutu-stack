import { createMock, expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type { EmailMessage, EmailProvider } from "../types";

export interface EmailProviderContractOptions {
	/** Whether send() resolves or throws. */
	readonly sendBehavior: "resolves" | "throws";
	/** Substring expected in the thrown error message (skeletons). */
	readonly throwsContains?: string;
}

/**
 * Shared contract every EmailProvider must satisfy.
 * Called from one test file per provider so every swap candidate is covered.
 */
export function testEmailProviderContract(
	name: string,
	createProvider: () => EmailProvider,
	options: EmailProviderContractOptions,
): void {
	describe(`EmailProvider contract — ${name}`, () => {
		const message = createMock<EmailMessage>({
			from: "noreply@fuutu.test",
			to: "user@fuutu.test",
			subject: "Contract test",
			html: "<p>Contract test</p>",
			text: "Contract test",
		});

		it("exposes a non-empty name", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.name);
		});

		if (options.sendBehavior === "resolves") {
			it("send() resolves for a valid EmailMessage", async () => {
				const provider = createProvider();
				await expect(provider.send(message)).resolves.toBeUndefined();
			});
		} else {
			it("send() throws for a valid EmailMessage", async () => {
				const provider = createProvider();
				await expect(provider.send(message)).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});
		}
	});
}
