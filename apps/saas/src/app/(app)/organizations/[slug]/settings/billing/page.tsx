import { env } from "@fuutu/env/saas";
import {
	isPaymentsEnabled,
	type PaymentProviderId,
	paymentsConfig,
} from "@fuutu/payments/config";
import { redirect } from "next/navigation";
import { OrgSettingsBilling } from "@/modules/app/organizations/org-settings-billing";

interface Props {
	params: Promise<{ slug: string }>;
}

/**
 * Per-provider credential check. `custom` can't be verified statically
 * (kit users wire their own provider), `noop` is never a real provider.
 */
const PROVIDER_CREDENTIALS_CONFIGURED: Record<PaymentProviderId, boolean> = {
	polar: Boolean(env.POLAR_ACCESS_TOKEN),
	stripe: Boolean(env.STRIPE_SECRET_KEY),
	creem: Boolean(env.CREEM_API_KEY),
	custom: true,
	noop: false,
};

export default async function BillingPage({ params }: Props) {
	if (paymentsConfig.billingAttachedTo !== "organization") {
		redirect("/dashboard");
	}
	const { slug } = await params;
	const paymentsEnabled =
		isPaymentsEnabled() &&
		PROVIDER_CREDENTIALS_CONFIGURED[paymentsConfig.provider];
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsBilling
				slug={slug}
				paymentsEnabled={paymentsEnabled}
				productIds={{
					pro: {
						monthly: env.PAYMENTS_PRO_PRICE_ID ?? undefined,
						yearly: env.PAYMENTS_PRO_YEARLY_PRICE_ID ?? undefined,
					},
				}}
			/>
		</div>
	);
}
