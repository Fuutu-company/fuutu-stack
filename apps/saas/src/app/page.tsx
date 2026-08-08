import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";

/**
 * Root of the SaaS app. Authenticated users land on the dashboard,
 * anonymous visitors on the sign-in page. The (app) layout will itself
 * re-check auth via `requireAuth()` — we just pick the right entry URL.
 */
export default async function RootPage() {
	const session = await getSession();
	redirect(session ? "/dashboard" : "/auth/sign-in");
}
