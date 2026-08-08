import { listNotificationsProcedure } from "./procedures/list";
import { markAllNotificationsReadProcedure } from "./procedures/mark-all-read";
import { markNotificationReadProcedure } from "./procedures/mark-read";
import { getUnreadCountProcedure } from "./procedures/unread-count";

export const notificationsRouter = {
	list: listNotificationsProcedure,
	unreadCount: getUnreadCountProcedure,
	markRead: markNotificationReadProcedure,
	markAllRead: markAllNotificationsReadProcedure,
};
