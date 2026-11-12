import { authConfig } from "@fuutu/auth/config";
import { AuthCard, Button } from "@fuutu/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-server";

/**
 * Landing page for Better Auth / OAuth errors (`onAPIError.errorURL`).
 * Shows only a sanitized error code — never `error_description`, which an
 * attacker can put into the URL as phishing text.
 */
export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [params, session, t] = await Promise.all([
		searchParams,
		getSession(),
		getTranslations("auth.error"),
	]);
	const raw = typeof params.error === "string" ? params.error : "";
	const code = /^[A-Za-z0-9_'-]{1,64}$/.test(raw) ? raw : "unknown";

	return (
		<AuthCard title={t("title")}>
			<div className="flex flex-col gap-4 text-center">
				<p className="text-muted-foreground text-sm">{t("description")}</p>
				<p className="text-muted-foreground text-xs">
					{t("code")} <code className="font-mono">{code}</code>
				</p>
				<Button asChild className="w-full">
					<Link
						href={session ? authConfig.redirects.afterSignIn : "/auth/sign-in"}
					>
						{session ? t("continue") : t("backToSignIn")}
					</Link>
				</Button>
			</div>
		</AuthCard>
	);
}
