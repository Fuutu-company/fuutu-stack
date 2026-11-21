"use client";

import { config } from "@fuutu/config";
import { AreaTile, Button, PageHeader } from "@fuutu/ui";
import { CreditCard, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { appHome } from "@/app-home";
import { useAccount } from "@/components/account-provider";

const app = config.app.name;

export default function HomePage() {
	// Your home content (src/app-home.tsx), else the kit placeholder.
	const AppHome = appHome;
	return AppHome ? <AppHome /> : <KitHome />;
}

function TileLink({ href, children }: PropsWithChildren<{ href: string }>) {
	return (
		<Link
			href={href}
			className="group block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>[data-slot=area-tile]]:h-full [&>[data-slot=area-tile]]:transition-shadow [&>[data-slot=area-tile]]:group-hover:shadow-md"
		>
			{children}
		</Link>
	);
}

/** Placeholder home in the SaaS dashboard's layout: greeting + account tiles. */
function KitHome() {
	const t = useTranslations("desktop.shell.home");
	const tAccess = useTranslations("desktop.account.plan.access");
	const formatter = useFormatter();
	const { status, session } = useAccount();
	const data =
		session?.state === "online" || session?.state === "offline"
			? session.session
			: null;
	const firstName = data?.user.name.trim().split(/\s+/)[0] || null;
	return (
		<div className="space-y-6">
			<PageHeader
				title={firstName ? t("greeting", { name: firstName }) : t("title")}
				description={t("description", { app })}
				actions={
					<Button asChild variant="outline">
						<Link href="/settings/">
							<Settings className="size-4" />
							{t("openSettings")}
						</Link>
					</Button>
				}
			/>
			{status?.mode === "off" ? null : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<TileLink href="/settings/account/">
						<AreaTile
							aligned
							area="users"
							title={t("tiles.account.title")}
							icon={<UserRound />}
							value={
								<span className="font-bold text-base">
									{data ? data.user.name : t("tiles.account.signedOut")}
								</span>
							}
							description={
								data ? data.user.email : t("tiles.account.signInHint", { app })
							}
						/>
					</TileLink>
					{data ? (
						<TileLink href="/settings/account/">
							<AreaTile
								aligned
								area="billing"
								title={t("tiles.plan.title")}
								icon={<CreditCard />}
								value={<span className="text-3xl">{data.plan.tier}</span>}
								description={tAccess(data.access.status, {
									app,
									date: data.access.trialEndsAt
										? formatter.dateTime(new Date(data.access.trialEndsAt), {
												dateStyle: "medium",
											})
										: "",
								})}
							/>
						</TileLink>
					) : null}
				</div>
			)}
		</div>
	);
}
