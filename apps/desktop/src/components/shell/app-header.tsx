"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	Separator,
	SidebarTrigger,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { LocaleMenu } from "./locale-menu";
import { ThemeToggle } from "./theme-toggle";

/** Top bar of the content column — the SaaS app header's layout. */
export function AppHeader({ title }: { title: string | null }) {
	const t = useTranslations("desktop.shell.header");
	return (
		<header className="flex h-14 shrink-0 items-center gap-2 bg-transparent px-4 md:px-8">
			<SidebarTrigger className="-ml-1" />
			<Separator
				orientation="vertical"
				className="mr-2 data-[orientation=vertical]:h-4"
			/>
			{title ? (
				<Breadcrumb label={t("breadcrumb")}>
					<BreadcrumbList className="font-semibold text-sm">
						<BreadcrumbItem>
							<BreadcrumbPage>{title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			) : null}
			<div className="ml-auto flex items-center gap-1">
				<LocaleMenu />
				<ThemeToggle />
			</div>
		</header>
	);
}
