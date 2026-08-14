import { env } from "@fuutu/env/saas";
import { paymentsConfig } from "@fuutu/payments/config";
import { redirect } from "next/navigation";
import { OrgSettingsBilling } from "@/modules/app/organizations/org-settings-billing";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function BillingPage({ params }: Props) {
	if (paymentsConfig.billingAttachedTo !== "organization") {
		redirect("/dashboard");
	}
	const { slug } = await params;
	const paymentsEnabled =
		paymentsConfig.provider === "stripe"
			? Boolean(env.STRIPE_SECRET_KEY)
			: paymentsConfig.provider === "creem"
				? Boolean(env.CREEM_API_KEY)
				: false;
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsBilling
				slug={slug}
				paymentsEnabled={paymentsEnabled}
				productIds={{
					pro: env.PAYMENTS_PRO_PRICE_ID ?? undefined,
				}}
			/>
		</div>
	);
}
