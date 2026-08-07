import type { PropsWithChildren } from "react";
import { OrgSettingsNav } from "@/modules/app/organizations/components/org-settings-nav";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function SettingsLayout({
	children,
	params,
}: PropsWithChildren<Props>) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<OrgSettingsNav slug={slug} />
			{children}
		</div>
	);
}
