"use client";

import { authClient } from "@fuutu/auth/client";
import { useEffect, useState } from "react";

/**
 * Resolve the current user's member role in the org identified by `slug`.
 *
 * Deliberately reads the org by slug instead of `useActiveOrganization()` —
 * the active org may point at a different org, or be absent when the session
 * cookie cache is stale (e.g. right after creating an org via oRPC).
 */
export function useOrgRole(slug: string | null): string | undefined {
	const { data: session } = authClient.useSession();
	const [role, setRole] = useState<string | undefined>(undefined);
	const userId = session?.user.id;

	useEffect(() => {
		if (!userId || !slug) {
			setRole(undefined);
			return;
		}
		let cancelled = false;
		authClient.organization
			.getFullOrganization({ query: { organizationSlug: slug } })
			.then((res) => {
				if (cancelled) return;
				const member = (
					res.data as { members?: { userId: string; role: string }[] } | null
				)?.members?.find((m) => m.userId === userId);
				setRole(member?.role);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [slug, userId]);

	return role;
}
