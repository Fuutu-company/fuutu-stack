import { randomBytes } from "node:crypto";
import { db } from "../client";
import type { Prisma, WebhookDelivery } from "../generated/client";

function generateSecret(): string {
	return randomBytes(32).toString("base64url");
}

export type CreatedWebhook = Awaited<ReturnType<typeof createWebhook>>;

export const createWebhook = async (
	organizationId: string,
	url: string,
	events: string[],
) => {
	const secret = generateSecret();
	const webhook = await db.webhook.create({
		data: { organizationId, url, events, secret },
	});
	return { ...webhook, secret };
};

export const listWebhooks = (
	organizationId: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	return db.webhook.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
		take,
		skip,
		omit: { secret: true },
	});
};

export const countWebhooks = (organizationId: string) =>
	db.webhook.count({ where: { organizationId } });

export const getWebhook = (id: string, organizationId: string) =>
	db.webhook.findFirst({
		where: { id, organizationId },
		omit: { secret: true },
	});

/**
 * internal — delivery worker only.
 * Returns the webhook including its signing secret. Never expose to API callers.
 */
export const getWebhookForDelivery = (id: string) =>
	db.webhook.findUnique({ where: { id } });

export type WebhookUpdateInput = {
	url?: string;
	events?: string[];
	isActive?: boolean;
};

export const updateWebhook = async (
	id: string,
	organizationId: string,
	data: WebhookUpdateInput,
) => {
	const owned = await db.webhook.findFirst({
		where: { id, organizationId },
	});
	if (!owned) return null;
	return db.webhook.update({
		where: { id },
		data,
		omit: { secret: true },
	});
};

export const deleteWebhook = async (id: string, organizationId: string) => {
	const owned = await db.webhook.findFirst({
		where: { id, organizationId },
	});
	if (!owned) return null;
	return db.webhook.delete({ where: { id }, omit: { secret: true } });
};

export type WebhookDeliveryInput = {
	webhookId: string;
	eventId: string;
	eventType: string;
	payload: Prisma.InputJsonValue;
	status: string;
	responseCode?: number | null;
	responseBody?: string | null;
	attempt?: number;
	attemptedAt?: Date;
	nextRetryAt?: Date | null;
};

export const recordDelivery = (data: WebhookDeliveryInput) =>
	db.webhookDelivery.create({ data });

export type DeliveryStatusUpdate = {
	status: string;
	responseCode?: number | null;
	responseBody?: string | null;
	attempt?: number;
	attemptedAt?: Date;
	nextRetryAt?: Date | null;
};

export const updateDeliveryStatus = (id: string, data: DeliveryStatusUpdate) =>
	db.webhookDelivery.update({
		where: { id },
		data: {
			status: data.status,
			responseCode: data.responseCode,
			responseBody: data.responseBody,
			attempt: data.attempt,
			attemptedAt: data.attemptedAt ?? new Date(),
			nextRetryAt: data.nextRetryAt,
		},
	});

export const listDeliveries = (
	webhookId: string,
	opts: { take?: number; skip?: number; status?: string } = {},
) => {
	const { take = 50, skip = 0, status } = opts;
	return db.webhookDelivery.findMany({
		where: { webhookId, ...(status ? { status } : {}) },
		orderBy: { attemptedAt: "desc" },
		take,
		skip,
	});
};

export const countDeliveries = (
	webhookId: string,
	opts: { status?: string } = {},
) =>
	db.webhookDelivery.count({
		where: { webhookId, ...(opts.status ? { status: opts.status } : {}) },
	});

/**
 * Atomically claim pending/retrying deliveries for processing.
 *
 * Sets `status` to `"processing"` for up to `limit` deliveries that are
 * ready (nextRetryAt is null or in the past) and whose webhook is active.
 * Uses `FOR UPDATE SKIP LOCKED` so multiple worker instances never claim
 * the same delivery — the second instance skips rows locked by the first.
 *
 * The `limit` parameter is internal (not user input), so raw SQL is safe here.
 */
export const claimPendingDeliveries = async (
	limit = 100,
): Promise<WebhookDelivery[]> => {
	const rows = await db.$queryRaw<WebhookDelivery[]>`
		WITH claimed AS (
			SELECT id FROM "app"."webhook_delivery"
			WHERE status IN ('pending', 'retrying')
				AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
				AND EXISTS (
					SELECT 1 FROM "app"."webhook"
					WHERE "webhook"."id" = "app"."webhook_delivery"."webhookId"
						AND "webhook"."isActive" = true
				)
			ORDER BY "nextRetryAt" ASC NULLS FIRST
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		)
		UPDATE "app"."webhook_delivery"
		SET status = 'processing'
		WHERE id IN (SELECT id FROM claimed)
		RETURNING *
	`;
	return rows;
};

/**
 * Recover deliveries stuck in `"processing"` status.
 *
 * If a worker crashes mid-delivery, the row stays `"processing"` forever —
 * `claimPendingDeliveries` only selects `"pending"` / `"retrying"`, so it
 * would never be retried. This query resets stale `"processing"` rows whose
 * `attemptedAt` is older than `timeoutMs` back to `"retrying"` so the next
 * claim cycle picks them up.
 */
export const recoverStaleDeliveries = (timeoutMs: number) =>
	db.webhookDelivery.updateMany({
		where: {
			status: "processing",
			attemptedAt: { lt: new Date(Date.now() - timeoutMs) },
		},
		data: { status: "retrying" },
	});

/**
 * Find all active webhooks for an organization that subscribe to a given
 * event type. Used by `dispatchEvent` to fan out an event to matching endpoints.
 */
export const listActiveWebhooksByOrg = (
	organizationId: string,
	eventType: string,
) =>
	db.webhook.findMany({
		where: {
			organizationId,
			isActive: true,
			events: { has: eventType },
		},
		select: { id: true },
	});
