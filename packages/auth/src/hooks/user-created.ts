/**
 * Emit `user.created` when a user gains their first organization
 * membership. Webhooks are org-scoped, so dispatching at account
 * creation (before any membership exists) would enqueue zero
 * deliveries — the event is emitted here instead, scoped to the org
 * the user first joins.
 *
 * Both `afterAddMember` and `afterAcceptInvitation` call this for the
 * same join; `claimUserCreatedEvent` flips a DB flag atomically so
 * exactly the first caller dispatches. A dispatch failure releases the
 * claim so a later membership can retry instead of losing the event.
 * Best-effort: a dispatch failure must never abort the membership flow.
 */
import { claimUserCreatedEvent, resetUserCreatedEvent } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "auth" });

export async function emitUserCreatedOnFirstMembership(
	userId: string,
	organizationId: string,
): Promise<void> {
	let claimed = false;
	try {
		claimed = await claimUserCreatedEvent(userId);
		if (!claimed) return;
		const { dispatchEvent } = await import("@fuutu/webhooks");
		await dispatchEvent({
			event: "user.created",
			organizationId,
			payload: { userId, organizationId },
		});
	} catch (err) {
		log.error("user.created webhook dispatch failed", { err: String(err) });
		// Only release the flag when this caller actually claimed it — a
		// failed claim must not clobber a flag set by an earlier dispatch.
		if (!claimed) return;
		try {
			await resetUserCreatedEvent(userId);
		} catch (resetErr) {
			log.error("user.created flag reset failed", { err: String(resetErr) });
		}
	}
}
