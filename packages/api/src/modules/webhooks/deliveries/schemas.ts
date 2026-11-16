import { z } from "zod";

// Explicit output: the stored receiver response body is never returned.
const deliverySchema = z.object({
	id: z.string(),
	eventId: z.string(),
	eventType: z.string(),
	status: z.string(),
	responseCode: z.number().int().nullable(),
	attempt: z.number().int(),
	attemptedAt: z.date(),
	nextRetryAt: z.date().nullable(),
});

export const listDeliveriesOutputSchema = z.object({
	items: z.array(deliverySchema),
	page: z.number().int(),
	limit: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});
