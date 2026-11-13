import type { UserWithRole } from "@fuutu/auth/types";
import { toSystemRole } from "@fuutu/rbac";
import { requireAuth } from "@/lib/auth-server";
import { ApiKeyList } from "@/modules/app/api-keys/components/api-key-list";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgApiKeysPage({ params }: Props) {
	const { slug } = await params;
	const session = await requireAuth();
	return (
		<div className="mx-auto max-w-4xl">
			<ApiKeyList
				slug={slug}
				isSystemAdmin={
					toSystemRole((session.user as UserWithRole).role) === "admin"
				}
			/>
		</div>
	);
}
