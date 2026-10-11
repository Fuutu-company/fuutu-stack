import { paymentsConfig } from "@fuutu/payments/config";
import { redirect } from "next/navigation";
import { OrgCreditBalanceView } from "@/modules/app/credits/org-credit-balance-view";

export default async function OrgCreditsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	if (!paymentsConfig.creditsEnabled) {
		redirect(`/organizations/${slug}/settings`);
	}
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<OrgCreditBalanceView slug={slug} />
		</div>
	);
}
