import { InvoiceList } from "@/modules/app/invoices/components/invoice-list";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgInvoicesPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<InvoiceList slug={slug} />
		</div>
	);
}
