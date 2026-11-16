import { CrmLayout } from "@app/crm";
import { config } from "@fuutu/config";
import { notFound } from "next/navigation";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgCrmPage({ params }: Props) {
	if (!config.features.crm) notFound();
	const { slug } = await params;

	return <CrmLayout slug={slug} />;
}
