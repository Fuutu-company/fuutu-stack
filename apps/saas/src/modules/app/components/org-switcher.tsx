"use client";

import { authClient } from "@fuutu/auth/client";
import {
	Badge,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	useSidebar,
} from "@fuutu/ui";
import { Building2, ChevronsUpDown, Plus, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type OrgMetadata = {
	plan?: string;
};

type Org = {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
	metadata?: OrgMetadata | null;
};

function getPlanLabel(org: Org | null, freePlan: string): string {
	if (!org) return freePlan;
	return org.metadata?.plan ?? freePlan;
}

export function OrgSwitcher() {
	const t = useTranslations();
	const { isMobile } = useSidebar();
	const router = useRouter();
	const pathname = usePathname();
	const { data: organizations, isPending: orgsLoading } =
		authClient.useListOrganizations();
	const { data: activeOrg } = authClient.useActiveOrganization();

	// Better Auth client returns untyped organization data — cast to our typed Org
	const orgs = (organizations ?? []) as Org[];
	const active = activeOrg as Org | null;

	// Check if we're currently in personal mode (not inside an org route)
	const inOrgRoute = pathname.startsWith("/organizations/");

	if (orgsLoading) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuSkeleton showIcon />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	if (orgs.length === 0) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" asChild>
						<Link href="/organizations">
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<Plus className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">
									{t("navigation.createOrganization")}
								</span>
							</div>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	async function selectOrg(org: Org) {
		await authClient.organization.setActive({ organizationId: org.id });
		router.push(`/organizations/${org.slug}/dashboard`);
	}

	async function selectPersonal() {
		await authClient.organization.setActive({ organizationId: null });
		router.push("/dashboard");
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<div className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								{inOrgRoute && active?.logo ? (
									<Image
										src={active.logo}
										alt={active.name}
										fill
										unoptimized
										className="size-full rounded-lg object-cover"
									/>
								) : inOrgRoute ? (
									<Building2 className="size-4" />
								) : (
									<User className="size-4" />
								)}
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">
									{inOrgRoute
										? (active?.name ?? t("navigation.organizations"))
										: t("navigation.personalAccount")}
								</span>
								<span className="truncate text-xs">
									{inOrgRoute
										? getPlanLabel(active, t("dashboard.freePlan"))
										: t("navigation.personalAccountSubtitle")}
								</span>
							</div>
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuLabel className="text-muted-foreground text-xs">
							{t("navigation.personalAccount")}
						</DropdownMenuLabel>
						<DropdownMenuItem onClick={selectPersonal} className="gap-2 p-2">
							<div className="flex size-6 items-center justify-center rounded-sm border">
								<User className="size-4 shrink-0" />
							</div>
							<span className="truncate">
								{t("navigation.personalAccount")}
							</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground text-xs">
							{t("navigation.organizations")}
						</DropdownMenuLabel>
						{orgs.map((org) => (
							<DropdownMenuItem
								key={org.id}
								onClick={() => selectOrg(org)}
								className="gap-2 p-2"
							>
								<div className="relative flex size-6 items-center justify-center overflow-hidden rounded-sm border">
									{org.logo ? (
										<Image
											src={org.logo}
											alt={org.name}
											fill
											unoptimized
											className="size-full object-cover"
										/>
									) : (
										<Building2 className="size-4 shrink-0" />
									)}
								</div>
								<span className="truncate">{org.name}</span>
								<Badge variant="secondary" className="ml-auto text-[10px]">
									{getPlanLabel(org, t("dashboard.freePlan"))}
								</Badge>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem className="gap-2 p-2" asChild>
							<Link href="/organizations">
								<div className="flex size-6 items-center justify-center rounded-md border bg-background">
									<Plus className="size-4" />
								</div>
								<div className="font-medium text-muted-foreground">
									{t("navigation.createOrganization")}
								</div>
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
