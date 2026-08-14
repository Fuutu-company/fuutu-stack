/**
 * Customer creation helper — called on user signup.
 *
 * Replaces Better Auth's `createCustomerOnSignUp` plugin option. We call
 * the active provider's `createCustomer()` and store the returned ID in
 * `User.paymentsCustomerId`. Failures are logged but never propagate —
 * signup must not block on payment-provider availability.
 */

import { updatePaymentsCustomerId } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { resolvePaymentProvider } from "./resolve";

const log = createLogger({ scope: "payments:customers" });

/**
 * Create a customer record at the active payment provider for a newly
 * signed-up user. Called from the Better Auth `user.create.after` hook.
 *
 * Best-effort: if the provider is unavailable or misconfigured, the user
 * is still created — they just won't have a provider customer ID until
 * the next checkout (which creates one on the fly at most providers).
 */
export async function createCustomerForUser(user: {
	id: string;
	email: string;
	name?: string;
}): Promise<void> {
	try {
		const provider = resolvePaymentProvider();
		const { customerId } = await provider.createCustomer({
			userId: user.id,
			email: user.email,
			name: user.name,
		});
		await updatePaymentsCustomerId(user.id, customerId);
		log.info("created provider customer on signup", {
			userId: user.id,
			provider: provider.id,
			customerId,
		});
	} catch (err) {
		log.warn(
			"createCustomerForUser failed — user created without provider customer",
			{
				userId: user.id,
				err: String(err),
			},
		);
	}
}
