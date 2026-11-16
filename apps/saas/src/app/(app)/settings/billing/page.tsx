import { paymentsConfig } from "@fuutu/payments/config";
import { notFound } from "next/navigation";
import { InvoiceList } from "@/modules/app/invoices/components/invoice-list";

export default async function UserBillingPage() {
	// Org-attached billing lives on /organizations/<slug>/settings/billing.
	if (paymentsConfig.billingAttachedTo !== "user") notFound();
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<InvoiceList />
		</div>
	);
}
