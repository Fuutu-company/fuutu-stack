"use client";

import { authClient } from "@fuutu/auth/client";
import type { UserWithRole } from "@fuutu/auth/types";
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
	LogOut,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

function getInitials(name: string, email: string): string {
	const nameLetter = name?.trim()?.[0] ?? "";
	const emailLetter = email?.trim()?.[0] ?? "";
	return (nameLetter + emailLetter).toUpperCase() || "??";
}

export function NavUser() {
	const t = useTranslations("navigation");
	const router = useRouter();
	const pathname = usePathname();
	const { isMobile } = useSidebar();
	const { data: session, isPending } = authClient.useSession();
	const [isSigningOut, setIsSigningOut] = useState(false);

	// Better Auth client returns untyped session data — cast to our typed UserWithRole
	const user = session?.user as UserWithRole | undefined;

	const orgsOn = config.features.organizationsMode !== "off";
	const orgMatch = pathname.match(/^\/organizations\/([^/]+)/);
	const orgSlug = orgMatch?.[1] ?? null;
	const billingHref = orgsOn
		? orgSlug
			? `/organizations/${orgSlug}/settings/billing`
			: null
		: "/choose-plan";

	async function handleSignOut() {
		setIsSigningOut(true);
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/auth/sign-in");
					router.refresh();
				},
			},
		});
		setIsSigningOut(false);
	}

	if (isPending || !user) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						disabled
						aria-label="Loading user account"
					>
						<Skeleton className="h-8 w-8 rounded-lg" />
						<div className="grid flex-1 gap-1">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-28" />
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const initials = getInitials(user.name, user.email);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{user.image ? (
									<AvatarImage src={user.image} alt={user.name} />
								) : null}
								<AvatarFallback className="rounded-lg">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									{user.image ? (
										<AvatarImage src={user.image} alt={user.name} />
									) : null}
									<AvatarFallback className="rounded-lg">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/choose-plan">
									<Sparkles />
									{t("upgradeToPro")}
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/settings">
									<BadgeCheck />
									{t("account")}
								</Link>
							</DropdownMenuItem>
							{billingHref ? (
								<DropdownMenuItem asChild>
									<Link href={billingHref}>
										<CreditCard />
										{t("billing")}
									</Link>
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem disabled>
									<CreditCard />
									{t("billingSelectOrg")}
								</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
							<LogOut />
							{t("signOut")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
