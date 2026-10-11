import { getActiveSubscription } from "./procedures/active";
import { getSubscription } from "./procedures/get";

export const subscriptionsRouter = {
	status: getSubscription,
	active: getActiveSubscription,
};
