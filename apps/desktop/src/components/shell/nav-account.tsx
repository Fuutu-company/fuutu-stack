"use client";

import { config } from "@fuutu/config";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	Skeleton,
	useSidebar,
} from "@fuutu/ui";
import {
	BadgeCheck,
	ChevronsUpDown,
	CreditCard,
	ExternalLink,
	Info,
	LogIn,
	LogOut,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { openExternal } from "@/lib/desktop";
import { openAboutWindow } from "@/lib/windows";
import { useSignIn } from "../access-gate";
import { useAccount } from "../account-provider";

const app = config.app.name;

function initials(name: string, email: string): string {
	return (
		((name.trim()[0] ?? "") + (email.trim()[0] ?? "")).toUpperCase() || "?"
	);
}

const OPEN_CLASS =
	"data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground";

/**
 * Sidebar footer — the SaaS app's user menu. Account data comes from the
 * SaaS app (`desktop.session`); plans, billing and account changes open
 * there in the browser, never in the desktop app.
 */
export function NavAccount() {
	const t = useTranslations("desktop.shell.user");
	const { isMobile } = useSidebar();
	const { status, session, loading, signOut } = useAccount();
	const signIn = useSignIn();
	const data =
		session?.state === "online" || session?.state === "offline"
			? session.session
			: null;
	const online = session?.state === "online";
	const side = isMobile ? "bottom" : "right";

	if (loading && !session) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" disabled aria-label={t("loading")}>
						<Skeleton className="size-8 rounded-lg" />
						<div className="grid flex-1 gap-1">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-28" />
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const about = (
		<DropdownMenuItem onSelect={() => void openAboutWindow()}>
			<Info />
			{t("about", { app })}
		</DropdownMenuItem>
	);

	if (!data) {
		// Signed out (`optional`) or a build without accounts (`off`).
		const canSignIn = status?.mode !== "off" && status?.available;
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton size="lg" className={OPEN_CLASS}>
								<Avatar className="size-8 rounded-lg">
									<AvatarFallback className="rounded-lg">
										<LogIn className="size-4" />
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{canSignIn ? t("signedOut") : app}
									</span>
								</div>
								<ChevronsUpDown className="ml-auto size-4" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
							side={side}
							align="end"
							sideOffset={4}
						>
							{canSignIn ? (
								<>
									<DropdownMenuItem
										disabled={signIn.isPending}
										onSelect={() => signIn.mutate()}
									>
										<LogIn />
										{t("signIn")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							) : null}
							{about}
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const { user, links } = data;
	const avatar = (
		<Avatar className="size-8 rounded-lg">
			{user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
			<AvatarFallback className="rounded-lg">
				{initials(user.name, user.email)}
			</AvatarFallback>
		</Avatar>
	);
	const identity = (
		<div className="grid flex-1 text-left text-sm leading-tight">
			<span className="truncate font-semibold">{user.name}</span>
			<span className="truncate text-xs">{user.email}</span>
		</div>
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton size="lg" className={OPEN_CLASS}>
							{avatar}
							{identity}
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={side}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5">
								{avatar}
								{identity}
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/settings/account/">
									<BadgeCheck />
									{t("account")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!online}
								onSelect={() => void openExternal(links.billing)}
							>
								<CreditCard />
								{t("billing")}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!online}
								onSelect={() =>
									void openExternal(new URL(links.account).origin)
								}
							>
								<ExternalLink />
								{t("openWebApp", { app })}
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						{about}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => void signOut()}>
							<LogOut />
							{t("signOut")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
