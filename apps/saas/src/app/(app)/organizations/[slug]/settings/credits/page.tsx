import { paymentsConfig } from "@fuutu/payments/config";
import { notFound } from "next/navigation";
import { OrgCreditBalanceView } from "@/modules/app/credits/org-credit-balance-view";

export default async function OrgCreditsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	if (!paymentsConfig.creditsEnabled) notFound();
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<OrgCreditBalanceView slug={slug} />
		</div>
	);
}
