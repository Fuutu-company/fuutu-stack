import { CrmLayout } from "@app/crm";
import { config } from "@fuutu/config";
import { notFound } from "next/navigation";

export default function CrmPage() {
	if (!config.features.crm) notFound();
	return <CrmLayout />;
}
