import type { PropsWithChildren } from "react";
import { requireOrgMembership } from "@/lib/auth-server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function SettingsLayout({
	children,
	params,
}: PropsWithChildren<Props>) {
	const { slug } = await params;
	// Defense in depth: the org-scoped oRPC procedures already enforce
	// membership server-side — this keeps the settings shell from
	// rendering at all for non-members.
	await requireOrgMembership(slug);
	return <div className="mx-auto max-w-4xl space-y-6">{children}</div>;
}
