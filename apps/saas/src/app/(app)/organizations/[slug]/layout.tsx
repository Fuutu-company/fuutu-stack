import type { PropsWithChildren } from "react";
import { requireOrgMembership } from "@/lib/auth-server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrganizationLayout({
	children,
	params,
}: PropsWithChildren<Props>) {
	const { slug } = await params;
	// Defense in depth: org-scoped oRPC procedures enforce membership
	// server-side — this keeps the org shell (dashboard, chat, crm,
	// invoices) from rendering at all for non-members.
	await requireOrgMembership(slug);
	return <>{children}</>;
}
