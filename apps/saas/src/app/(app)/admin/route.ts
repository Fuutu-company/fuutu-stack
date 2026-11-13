import { ADMIN_HOME } from "@app/components/nav-config";
import { redirect } from "next/navigation";

/**
 * Groups have no overview page: `/admin` opens its first item. A route
 * handler, not a page, so the redirect is a real 307 — a page redirect
 * would stream behind `(app)/loading.tsx` as a 200 plus client redirect.
 * Access is enforced by the target's layout (`requireAdmin`).
 */
export function GET(): never {
	redirect(ADMIN_HOME);
}
