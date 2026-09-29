/**
 * Typed catalog of all webhook event types the platform can emit.
 *
 * Client-safe: this module has no server-only imports, so UI components can
 * import it via `@fuutu/webhooks/events` without pulling the delivery worker
 * (which depends on `@fuutu/db`) into the browser bundle.
 */
export const WEBHOOK_EVENTS = [
	"subscription.created",
	"subscription.updated",
	"subscription.canceled",
	"invoice.paid",
	"invoice.created",
	"user.created",
	"user.updated",
	"organization.created",
	"organization.updated",
	"member.invited",
	"member.removed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
