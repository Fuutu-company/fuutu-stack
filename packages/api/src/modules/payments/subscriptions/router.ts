import { getSubscription } from "./procedures/get";

export const subscriptionsRouter = {
	status: getSubscription,
};
