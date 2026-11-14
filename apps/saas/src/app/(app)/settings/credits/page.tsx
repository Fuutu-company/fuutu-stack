import { paymentsConfig } from "@fuutu/payments/config";
import { notFound } from "next/navigation";
import { CreditBalanceView } from "@/modules/app/credits/credit-balance-view";

export default function CreditsPage() {
	if (!paymentsConfig.creditsEnabled) notFound();
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<CreditBalanceView />
		</div>
	);
}
