import { featureRouter } from "../../orpc/middleware/require-feature";
import { deliveriesRouter } from "./deliveries/router";
import { createWebhookProcedure } from "./procedures/create";
import { deleteWebhookProcedure } from "./procedures/delete";
import { listWebhooksProcedure } from "./procedures/list";
import { updateWebhookProcedure } from "./procedures/update";

/** Off with `config.features.webhooks` (NOT_FOUND). */
export const webhooksRouter = featureRouter("webhooks", {
	create: createWebhookProcedure,
	list: listWebhooksProcedure,
	update: updateWebhookProcedure,
	delete: deleteWebhookProcedure,
	deliveries: deliveriesRouter,
});
