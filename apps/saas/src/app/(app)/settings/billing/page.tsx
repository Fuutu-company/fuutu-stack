import { InvoiceList } from "@/modules/app/invoices/components/invoice-list";

export default async function UserBillingPage() {
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<InvoiceList />
		</div>
	);
}
