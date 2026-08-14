import type { RouterClient } from "@orpc/server";
import { activityRouter } from "../modules/activity/router";
import { adminRouter } from "../modules/admin/router";
import { aiRouter } from "../modules/ai/router";
import { apiKeysRouter } from "../modules/api-keys/router";
import { chatRouter } from "../modules/chat/router";
import { creditsRouter } from "../modules/credits/router";
import { crmRouter } from "../modules/crm/router";
import { notificationsRouter } from "../modules/notifications/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { storageRouter } from "../modules/storage/router";
import { usersRouter } from "../modules/users/router";
import { webhooksRouter } from "../modules/webhooks/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
	users: usersRouter,
	activity: activityRouter,
	admin: adminRouter,
	ai: aiRouter,
	organizations: organizationsRouter,
	payments: paymentsRouter,
	storage: storageRouter,
	apiKeys: apiKeysRouter,
	webhooks: webhooksRouter,
	notifications: notificationsRouter,
	chat: chatRouter,
	crm: crmRouter,
	credits: creditsRouter,
});

export const appRouter = router;

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
