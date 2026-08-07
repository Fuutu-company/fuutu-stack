import { createLogger } from "@fuutu/logs";
import { emailChannel, inAppChannel, noopChannel } from "./channels";
import { notificationsConfig } from "./config";
import type {
	NotificationChannel,
	NotificationChannelHandler,
	NotificationProvider,
} from "./types";

const log = createLogger({ scope: "notifications:resolve" });

const channelMap: Record<NotificationChannel, NotificationChannelHandler> = {
	"in-app": inAppChannel,
	email: emailChannel,
	noop: noopChannel,
};

/**
 * Resolve a notification provider that dispatches to all configured channels.
 */
export function resolveNotificationProvider(): NotificationProvider {
	const handlers = notificationsConfig.channels.map((ch) => {
		const handler = channelMap[ch];
		if (!handler) {
			log.warn(`unknown channel "${ch}", skipping.`);
			return null;
		}
		return handler;
	});

	const active = handlers.filter(
		(h): h is NotificationChannelHandler => h !== null,
	);

	return {
		id: "multi-channel",
		async notify(userId, type, title, body, data, options) {
			const results = await Promise.allSettled(
				active.map((handler) =>
					handler.send(userId, type, title, body, data, options),
				),
			);
			for (const [i, result] of results.entries()) {
				if (result.status === "rejected") {
					log.error("channel delivery failed", {
						channel: active[i]?.channel,
						userId,
						type,
						err:
							result.reason instanceof Error
								? result.reason.message
								: String(result.reason),
					});
				}
			}
		},
	};
}
