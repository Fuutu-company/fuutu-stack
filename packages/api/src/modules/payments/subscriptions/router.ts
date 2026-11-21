import { getActiveSubscription } from "./procedures/active";
import { getSubscription } from "./procedures/get";
import { getLifetimePurchaseProcedure } from "./procedures/lifetime";

export const subscriptionsRouter = {
	status: getSubscription,
	active: getActiveSubscription,
	lifetime: getLifetimePurchaseProcedure,
};
