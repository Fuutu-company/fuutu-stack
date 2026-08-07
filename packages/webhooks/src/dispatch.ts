import { randomUUID } from "node:crypto";
import {
	listActiveWebhooksByOrg,
	type Prisma,
	recordDelivery,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";

const log = createLogger({ scope: "webhooks:dispatch" });

const dispatchEventInput = z.object({
	eventType: z.string().min(1).max(200),
	payload: z.record(z.string(), z.unknown()),
	organizationId: z.string().min(1),
});

/**
 * Fan out an event to all active webhooks in an organization that subscribe
 * to the given event type. Creates a `"pending"` delivery record for each
 * matching webhook — the delivery worker (`processPendingDeliveries`) picks
 * them up and performs the actual HTTP POST.
 *
 * Call this from API procedures or server actions after a mutation that
 * customers might want to react to, e.g.:
 *
 * ```ts
 * import { dispatchEvent } from "@fuutu/webhooks";
 * await dispatchEvent("contact.created", { contactId }, org.id);
 * ```
 */
export async function dispatchEvent(
	eventType: string,
	payload: Record<string, unknown>,
	organizationId: string,
): Promise<{ enqueued: number }> {
	const input = dispatchEventInput.parse({
		eventType,
		payload,
		organizationId,
	});

	const eventId = randomUUID();
	const webhooks = await listActiveWebhooksByOrg(
		input.organizationId,
		input.eventType,
	);

	if (webhooks.length === 0) {
		return { enqueued: 0 };
	}

	const results = await Promise.allSettled(
		webhooks.map((webhook) =>
			recordDelivery({
				webhookId: webhook.id,
				eventId,
				eventType: input.eventType,
				payload: input.payload as Prisma.InputJsonValue,
				status: "pending",
			}),
		),
	);

	let enqueued = 0;
	for (const [index, result] of results.entries()) {
		if (result.status === "fulfilled") {
			enqueued++;
			continue;
		}
		const webhook = webhooks[index];
		log.error("failed to record webhook delivery", {
			eventId,
			webhookId: webhook?.id,
			eventType: input.eventType,
			err: result.reason,
		});
	}

	log.info("dispatched event to webhooks", {
		eventType: input.eventType,
		eventId,
		enqueued,
		organizationId: input.organizationId,
	});

	return { enqueued };
}
