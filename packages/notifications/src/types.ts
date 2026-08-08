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

export interface NotificationProvider {
	readonly id: string;
	notify(
		userId: string,
		type: string,
		title: string,
		body: string,
		data?: Record<string, unknown>,
		options?: NotificationOptions,
	): Promise<void>;
}

export interface NotificationChannelHandler {
	readonly channel: NotificationChannel;
	send(
		userId: string,
		type: string,
		title: string,
		body: string,
		data?: Record<string, unknown>,
		options?: NotificationOptions,
	): Promise<void>;
}

export interface NotificationOptions {
	id?: string;
}
