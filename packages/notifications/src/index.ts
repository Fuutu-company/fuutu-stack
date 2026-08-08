export { emailChannel } from "./channels/email";
export { inAppChannel } from "./channels/in-app";
export { noopChannel } from "./channels/noop";
export { type NotificationsConfig, notificationsConfig } from "./config";
export { resolveNotificationProvider } from "./provider";
export type {
	NotificationChannel,
	NotificationChannelHandler,
	NotificationOptions,
	NotificationProvider,
	NotificationType,
} from "./types";
