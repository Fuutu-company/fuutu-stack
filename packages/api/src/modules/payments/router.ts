import { featureRouter } from "../../orpc/middleware/require-feature";
import { invoicesRouter } from "./invoices/router";
import { orgPlansRouter } from "./org-plans/router";
import { plansRouter } from "./plans/router";
import { cancelSubscription } from "./procedures/cancel-subscription";
import { createBillingPortal } from "./procedures/create-billing-portal";
import { createCheckout } from "./procedures/create-checkout";
import { createTopupCheckout } from "./procedures/create-topup-checkout";
import { getTopupPackages } from "./procedures/get-topup-packages";
import { subscriptionsRouter } from "./subscriptions/router";

export const paymentsRouter = {
	plans: plansRouter,
	orgPlans: orgPlansRouter,
	checkout: {
		create: createCheckout,
	},
	// Credit top-ups are part of the credits module (`config.features.credits`).
	topupCheckout: featureRouter("credits", {
		create: createTopupCheckout,
	}),
	topupPackages: featureRouter("credits", {
		list: getTopupPackages,
	}),
	portal: {
		open: createBillingPortal,
	},
	subscription: {
		...subscriptionsRouter,
		cancel: cancelSubscription,
	},
	invoices: invoicesRouter,
};
