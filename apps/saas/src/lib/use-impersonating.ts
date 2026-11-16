"use client";

import { authClient } from "@fuutu/auth/client";

/**
 * True while support acts as this user (`session.impersonatedBy`, set by
 * `admin.users.impersonate`). Actions the API refuses for impersonation
 * sessions (`denyImpersonation`, Better Auth's `IMPERSONATION_FORBIDDEN`
 * guard) disable themselves up front with `ImpersonationNotice`.
 */
export function useImpersonating(): boolean {
	const { data } = authClient.useSession();
	return Boolean(data?.session.impersonatedBy);
}
