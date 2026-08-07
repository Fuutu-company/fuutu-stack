import { db } from "../client";
import type { Prisma } from "../generated/client";

export type NotificationInput = {
	id?: string;
	userId: string;
	type: string;
	title: string;
	body: string;
	data?: Prisma.InputJsonValue;
};

export const createNotification = (input: NotificationInput) =>
	db.notification.create({ data: input });

export const findNotificationById = (id: string) =>
	db.notification.findUnique({ where: { id } });

export const notificationExists = async (id: string): Promise<boolean> => {
	const found = await db.notification.findUnique({
		where: { id },
		select: { id: true },
	});
	return found !== null;
};

export const listNotifications = (
	userId: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	return db.notification.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take,
		skip,
	});
};

export const getUnreadCount = (userId: string) =>
	db.notification.count({ where: { userId, readAt: null } });

export const countNotifications = (userId: string) =>
	db.notification.count({ where: { userId } });

export const markRead = async (id: string, userId: string) => {
	const owned = await db.notification.findFirst({ where: { id, userId } });
	if (!owned) return null;
	return db.notification.update({
		where: { id },
		data: { readAt: new Date() },
	});
};

export const markAllRead = (userId: string) =>
	db.notification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	});
