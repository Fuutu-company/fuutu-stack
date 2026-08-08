import { auth } from "@fuutu/auth";
import type { UserWithRole } from "@fuutu/auth/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth-server";

export default async function SuspendedPage() {
	const user = (await getCurrentUser()) as UserWithRole | null;

	// If not logged in or not banned, redirect
	if (!user?.banned) {
		redirect("/auth/sign-in");
	}

	const t = await getTranslations("auth");
	const locale = await getLocale();
	const isPermanent =
		!user.banExpires || new Date(user.banExpires) > new Date();
	const banReason = user.banReason || t("suspended.defaultReason");

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="mx-auto max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
				<div className="space-y-2 text-center">
					<h1 className="font-bold text-2xl text-destructive">
						{t("suspended.title")}
					</h1>
					<p className="text-muted-foreground text-sm">
						{t("suspended.suspendedMessage", {
							duration: isPermanent
								? t("suspended.permanently")
								: t("suspended.temporarily"),
						})}
					</p>
				</div>

				<div className="space-y-4">
					<div className="rounded-md bg-destructive/10 p-4">
						<p className="font-medium text-sm">{t("suspended.reason")}</p>
						<p className="text-muted-foreground text-sm">{banReason}</p>
					</div>

					{!isPermanent && user.banExpires && (
						<div className="rounded-md bg-muted p-4">
							<p className="font-medium text-sm">{t("suspended.banExpires")}</p>
							<p className="text-muted-foreground text-sm">
								{new Date(user.banExpires).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
						</div>
					)}

					<div className="space-y-2 text-center text-muted-foreground text-sm">
						<p>{t("suspended.contactSupport")}</p>
						<form
							action={async () => {
								"use server";
								await auth.api.signOut({ headers: await headers() });
								redirect("/auth/sign-in");
							}}
						>
							<button
								type="submit"
								className="text-primary underline-offset-4 hover:underline"
							>
								{t("suspended.signOut")}
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
