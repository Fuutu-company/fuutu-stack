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

export type NotificationData = Record<string, JsonValue>;

export interface NotificationProvider {
	readonly id: string;
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
