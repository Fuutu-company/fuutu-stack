import { invoicesRouter } from "./invoices/router";
import { plansRouter } from "./plans/router";
import { cancelSubscription } from "./procedures/cancel-subscription";
import { createBillingPortal } from "./procedures/create-billing-portal";
import { createCheckout } from "./procedures/create-checkout";
import { subscriptionsRouter } from "./subscriptions/router";

export const paymentsRouter = {
	plans: plansRouter,
	checkout: {
		create: createCheckout,
	},
	portal: {
		open: createBillingPortal,
	},
	subscription: {
		...subscriptionsRouter,
		cancel: cancelSubscription,
	},
	invoices: invoicesRouter,
};
