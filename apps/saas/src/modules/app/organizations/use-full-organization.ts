"use client";

import { authClient } from "@fuutu/auth/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/utils/orpc";

/** Cache key of the slug-addressed full organization (members, invitations). */
export function fullOrganizationQueryKey(slug: string) {
	return ["auth", "organization", "full", slug] as const;
}

/**
 * The full organization behind `slug`, shared through one TanStack Query
 * cache entry — the sidebar, the settings pages and their sub-components
 * all read the same request instead of each fetching
 * `get-full-organization` on mount. Membership and roles gate UI, so the
 * entry is refetched on every mount, never retried, and a 403/404 (no
 * access, removed from the org) resolves to `null` without an error toast.
 */
export function useFullOrganization(slug: string | null | undefined) {
	return useQuery({
		queryKey: fullOrganizationQueryKey(slug ?? ""),
		enabled: Boolean(slug),
		staleTime: 0,
		refetchOnMount: "always",
		retry: false,
		meta: { silent: true },
		queryFn: async () => {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug ?? "" },
			});
			if (res.error) {
				if (res.error.status === 403 || res.error.status === 404) return null;
				throw new Error(res.error.message ?? "Failed to load organization");
			}
			return res.data ?? null;
		},
	});
}

/**
 * Call after any organization mutation (rename, logo, members, billing).
 * Refreshes the full-org entry, the org switcher's plan badges and the
 * organization list. `{ remove: true }` drops the entry instead (org deleted
 * or left); `{ plansOnly: true }` refreshes just the plan badges (billing
 * state changed, membership did not).
 */
export function useInvalidateOrganization() {
	const queryClient = useQueryClient();
	return useCallback(
		async (
			slug: string,
			options?: { remove?: boolean; plansOnly?: boolean },
		) => {
			const key = fullOrganizationQueryKey(slug);
			if (options?.remove) {
				queryClient.removeQueries({ queryKey: key });
			}
			const tasks: Promise<void>[] = [
				queryClient.invalidateQueries({
					queryKey: orpc.payments.orgPlans.list.key(),
				}),
			];
			if (!options?.plansOnly) {
				authClient.$store.notify("$listOrg");
				if (!options?.remove) {
					tasks.push(queryClient.invalidateQueries({ queryKey: key }));
				}
			}
			await Promise.all(tasks);
		},
		[queryClient],
	);
}
