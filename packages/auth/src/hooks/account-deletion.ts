/**
 * Guards that run before Better Auth deletes a user
 * (`databaseHooks.user.delete.before` — self-service `/delete-user` and
 * support's `removeUser` alike) or an organization
 * (`organizationHooks.beforeDeleteOrganization`). Both fail closed: a
 * subscription that is still billing aborts the delete, so no customer is
 * charged for an account or organization that no longer exists.
 */
import { listSoleOwnedOrganizations } from "@fuutu/db";
import { APIError } from "better-auth/api";
import {
	cancelActiveSubscriptionsForOrganizationOrThrow,
	cancelActiveSubscriptionsForUserOrThrow,
	SubscriptionCancellationError,
} from "./payments-sync";

function cancellationFailed(): APIError {
	return new APIError("BAD_GATEWAY", {
		message:
			"Subscriptions could not be cancelled at the payment provider. Nothing was deleted.",
		code: "SUBSCRIPTION_CANCELLATION_FAILED",
	});
}

async function failClosed(cancel: () => Promise<void>): Promise<void> {
	try {
		await cancel();
	} catch (err) {
		if (err instanceof SubscriptionCancellationError) {
			throw cancellationFailed();
		}
		throw err;
	}
}

/**
 * Refuses the sole owner of an organization (transfer ownership or delete
 * the organization first), then cancels the user's subscriptions.
 */
export async function beforeUserDelete(userId: string): Promise<void> {
	const soleOwned = await listSoleOwnedOrganizations(userId);
	if (soleOwned.length > 0) {
		throw new APIError("CONFLICT", {
			message:
				"You are the only owner of an organization. Transfer ownership or delete the organization first.",
			code: "SOLE_ORGANIZATION_OWNER",
		});
	}
	await failClosed(() => cancelActiveSubscriptionsForUserOrThrow(userId));
}

/** Cancels the organization's subscriptions; a failure aborts the delete. */
export async function beforeOrganizationDelete(
	organizationId: string,
): Promise<void> {
	await failClosed(() =>
		cancelActiveSubscriptionsForOrganizationOrThrow(organizationId),
	);
}
