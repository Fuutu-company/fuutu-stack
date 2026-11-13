"use client";

import { authClient } from "@fuutu/auth/client";
import { useFullOrganization } from "./use-full-organization";

/**
 * Resolve the current user's member role in the org identified by `slug`.
 *
 * Deliberately reads the org by slug instead of `useActiveOrganization()` —
 * the active org may point at a different org, or be absent when the session
 * cookie cache is stale (e.g. right after creating an org via oRPC).
 */
export function useOrgRole(slug: string | null): string | undefined {
	const { data: session } = authClient.useSession();
	const { data: org } = useFullOrganization(slug);
	const userId = session?.user.id;
	if (!userId) return undefined;
	return org?.members?.find((m) => m.userId === userId)?.role;
}
