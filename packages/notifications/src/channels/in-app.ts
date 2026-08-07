import type { Prisma } from "@fuutu/db";
import { createNotification } from "@fuutu/db";
import type { NotificationChannelHandler } from "../types";

export const inAppChannel: NotificationChannelHandler = {
	channel: "in-app",
	async send(userId, type, title, body, data, options) {
		await createNotification({
			id: options?.id,
			userId,
			type,
			title,
			body,
			data: data as Prisma.InputJsonValue | undefined,
		});
	},
};
