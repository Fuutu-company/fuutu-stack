import { deliveriesRouter } from "./deliveries/router";
import { createWebhookProcedure } from "./procedures/create";
import { deleteWebhookProcedure } from "./procedures/delete";
import { listWebhooksProcedure } from "./procedures/list";
import { updateWebhookProcedure } from "./procedures/update";

export const webhooksRouter = {
	create: createWebhookProcedure,
	list: listWebhooksProcedure,
	update: updateWebhookProcedure,
	delete: deleteWebhookProcedure,
	deliveries: deliveriesRouter,
};
