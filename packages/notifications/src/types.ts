/**
 * @fuutu/notifications — provider-agnostic notification dispatch interface.
 *
 * A notification is dispatched to one or more channels (in-app, email, …).
 * Each channel implements `NotificationChannelHandler`; the active set is
 * driven by `notificationsConfig.channels`.
 */

export type NotificationChannel = "in-app" | "email" | "noop";

export type NotificationType =
	| "billing"
	| "org"
	| "auth"
	| "system"
	| "webhook"
	| (string & {});

/** JSON-safe value — notification payloads are persisted to a JSON column. */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * Notification payload. Persisted to a JSON column by the in-app channel
 * and forwarded to every configured channel — never put secrets or
 * unnecessary PII here.
 *
 * Reserved keys consumed by the email channel: `email`, `name`, `appUrl`,
 * `locale`. `email` overrides the recipient address; only trusted
 * server-side callers may set it — never pass raw user input.
 */
export type NotificationData = Record<string, JsonValue>;

export interface NotificationProvider {
	readonly id: string;
	/**
	 * Dispatch to all configured channels. Throws `AggregateError` when at
	 * least one channel fails. Delivery is NOT atomic — other channels may
	 * already have delivered when it throws; callers needing all-or-nothing
	 * semantics must handle partial delivery themselves. `options.id`
	 * becomes the in-app channel's DB row id, enabling caller-side
	 * deduplication — a retry with the same id surfaces as a
	 * unique-constraint violation.
	 */
	notify(
		userId: string,
		type: NotificationType,
		title: string,
		body: string,
		data?: NotificationData,
		options?: NotificationOptions,
	): Promise<void>;
}

export interface NotificationChannelHandler {
	readonly channel: NotificationChannel;
	send(
		userId: string,
		type: NotificationType,
		title: string,
		body: string,
		data?: NotificationData,
		options?: NotificationOptions,
	): Promise<void>;
}

export interface NotificationOptions {
	id?: string;
}
