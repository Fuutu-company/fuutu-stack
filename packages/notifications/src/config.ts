import type { NotificationChannel } from "./types";

export interface NotificationsConfig {
	channels: NotificationChannel[];
}

export const notificationsConfig: NotificationsConfig = {
	channels: ["in-app", "email"],
};
