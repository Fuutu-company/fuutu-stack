import { AuthCard, Button } from "@fuutu/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { emailChangeOutcome } from "@/lib/auth-links";
import { getFreshSession } from "@/lib/auth-server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined): string | null {
	return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * Landing page of the email-change links. Better Auth verifies the token
 * and redirects here (`?error=…` on failure); success is shown only when
 * the session really carries the new address (`emailChangeOutcome`).
 */
export default async function VerifyEmailChangePage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const t = await getTranslations("auth.emailChange");
	const expectedEmail = param(params.email);
	const session = await getFreshSession();
	const outcome = emailChangeOutcome({
		error: param(params.error),
		expectedEmail,
		currentEmail: session?.user.email,
	});

	return (
		<AuthCard title={t("title")}>
			<div className="flex flex-col gap-4">
				{outcome === "updated" && <p className="font-medium">{t("success")}</p>}
				{outcome === "pending" && (
					<p className="text-sm">
						{t("pending", { email: expectedEmail ?? "" })}
					</p>
				)}
				{outcome === "invalid" && (
					<p className="text-destructive text-sm">{t("error")}</p>
				)}
				<Button
					asChild
					variant={outcome === "updated" ? "default" : "outline"}
					className="w-full"
				>
					<Link href="/settings">{t("continue")}</Link>
				</Button>
			</div>
		</AuthCard>
	);
}
