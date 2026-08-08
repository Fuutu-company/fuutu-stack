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
	const polarEnabled = Boolean(env.POLAR_ACCESS_TOKEN && env.POLAR_PRODUCT_ID);
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsBilling
				slug={slug}
				polarEnabled={polarEnabled}
				productIds={{
					pro: env.POLAR_PRODUCT_ID ?? undefined,
				}}
			/>
		</div>
	);
}
