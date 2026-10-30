import { randomUUID } from "node:crypto";
import {
	type JsonValue,
	listActiveWebhooksByOrg,
	listOrganizationsForUser,
	recordDelivery,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { webhooksConfig } from "./config";
import { WEBHOOK_EVENTS, type WebhookEventType } from "./events";

const log = createLogger({ scope: "webhooks:dispatch" });

/**
 * True when `value` survives `JSON.stringify` (throws on BigInt / circular
 * references — both would otherwise crash the Prisma Json write) and its
 * serialized form fits the configured size cap. Size is measured in UTF-8
 * bytes, not code units — multi-byte characters count more than once.
 * Note that `JSON.stringify` silently drops unserializable members
 * (functions, `undefined`, symbols) rather than failing.
 */
function isSerializablePayload(value: unknown): boolean {
	try {
		const serialized = JSON.stringify(value);
		return (
			typeof serialized === "string" &&
			Buffer.byteLength(serialized, "utf8") <= webhooksConfig.maxPayloadBytes
		);
	} catch {
		return false;
	}
}

const dispatchEventInput = z
	.object({
		event: z.enum(WEBHOOK_EVENTS),
		payload: z.record(z.string(), z.unknown()).refine(isSerializablePayload, {
			message: `payload must be JSON-serializable and within ${webhooksConfig.maxPayloadBytes} bytes when serialized`,
		}),
		organizationId: z.string().min(1).optional(),
		userId: z.string().min(1).optional(),
	})
	.refine((v) => v.organizationId !== undefined || v.userId !== undefined, {
		message: "organizationId or userId is required",
	});

export type DispatchEventInput = {
	event: WebhookEventType;
	organizationId?: string;
	userId?: string;
	payload: Record<string, unknown>;
};

/**
 * Fan out an event to all active webhooks that subscribe to the event type.
 * Creates a `"pending"` delivery record for each matching webhook — the
 * delivery worker (`processPendingDeliveries`) picks them up and performs
 * the actual HTTP POST.
 *
 * Targeting: webhooks are org-scoped. Pass `organizationId` for org events
 * (`organization.*`, `member.*`, `subscription.*`, `invoice.*`); pass
 * `userId` for user events (`user.*`) — the user's organizations are
 * resolved automatically.
 *
 * Call this from API procedures or server actions after a mutation that
 * customers might want to react to, e.g.:
 *
 * ```ts
 * import { dispatchEvent } from "@fuutu/webhooks";
 * await dispatchEvent({
 *   event: "organization.updated",
 *   organizationId: org.id,
 *   payload: { organizationId: org.id },
 * });
 * ```
 */
export async function dispatchEvent(
	rawInput: DispatchEventInput,
): Promise<{ enqueued: number }> {
	const input = dispatchEventInput.parse(rawInput);

	const organizationIds = input.organizationId
		? [input.organizationId]
		: (await listOrganizationsForUser(input.userId ?? "")).map((org) => org.id);

	const eventId = randomUUID();
	let enqueued = 0;

	for (const organizationId of organizationIds) {
		const webhooks = await listActiveWebhooksByOrg(organizationId, input.event);
		const results = await Promise.allSettled(
			webhooks.map((webhook) =>
				recordDelivery({
					webhookId: webhook.id,
					eventId,
					eventType: input.event,
					payload: input.payload as JsonValue,
					status: "pending",
				}),
			),
		);

		for (const [index, result] of results.entries()) {
			if (result.status === "fulfilled") {
				enqueued++;
				continue;
			}
			const webhook = webhooks[index];
			log.error("failed to record webhook delivery", {
				eventId,
				webhookId: webhook?.id,
				eventType: input.event,
				err: result.reason,
			});
		}
	}

	log.info("dispatched event to webhooks", {
		eventType: input.event,
		eventId,
		enqueued,
		organizationId: input.organizationId,
		userId: input.userId,
	});

	return { enqueued };
}
